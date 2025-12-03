import OpenAI from "openai";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// Known insurer names that can be selected
const KNOWN_INSURERS = [
  "Admiral", "Paxa", "Baviva", "Indirectlane", "Churchwell",
  "Ventura", "Zorich", "Hestingsdrive", "Assureon", "Soga"
];

export interface VoiceIntent {
  type: "quote_search" | "insurer_selection" | "confirmation" | "cancellation" | "general_chat";
  confidence: number;
  insurerName?: string; // Only present for insurer_selection
  rawTranscript: string;
}

/**
 * Uses OpenAI to detect the user's intent from voice transcript.
 * This provides semantic understanding rather than keyword matching,
 * which is crucial for voice input that may have variations.
 */
export async function detectVoiceIntent(transcript: string): Promise<VoiceIntent> {
  const normalizedTranscript = transcript.toLowerCase().trim();
  
  // Quick fallback for empty/very short transcripts
  if (!normalizedTranscript || normalizedTranscript.length < 3) {
    return { type: "general_chat", confidence: 0, rawTranscript: transcript };
  }

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0,
      messages: [
        {
          role: "system",
          content: `You are an intent classifier for a UK car insurance voice assistant. The user is speaking to get car insurance quotes. Speech recognition may mishear words.

IMPORTANT: Be LENIENT with quote_search detection. This is a car insurance app so users are likely asking about insurance/quotes.

Classify into these intents:

1. "quote_search" - User wants insurance quotes. Be VERY lenient - assume quote intent if:
   - They mention: quote, coat, code, insure, insurance, cover, policy, price, cost, premium, compare, search, find, get, need, want, looking for
   - They mention their car brand (Tesla, BMW, Ford, etc.)
   - They say things like: "I want to...", "can you find...", "help me get...", "I need..."
   - EVEN IF words are slightly wrong (e.g., "coat" = "quote", "code" = "quote", "ensure" = "insure")
   Examples: "I want a quote", "get me a coat for my Tesla", "insure my car", "find me insurance", "I want to get a code", "insurance for my Tesla"

2. "insurer_selection" - User picks a specific insurer. KNOWN INSURERS: ${KNOWN_INSURERS.join(", ")}
   Examples: "go with Admiral", "I'll take Paxa", "choose the first one", "that one", "Admiral please"

3. "confirmation" - User confirms/agrees to proceed.
   Examples: "yes", "yeah", "yep", "go ahead", "proceed", "do it", "sure", "okay", "confirm", "let's do it", "absolutely"
   IMPORTANT: "No, please proceed" or "No, go ahead" or "No, just proceed" are CONFIRMATIONS (the "no" is denying alternatives, followed by positive action)

4. "cancellation" - User wants to stop/cancel. ONLY when no positive action follows.
   Examples: "cancel", "stop", "no thanks", "never mind", "forget it", "no, I don't want that"
   IMPORTANT: If "no" is followed by "proceed", "go ahead", "continue", "do it" etc., that is a CONFIRMATION not cancellation!

5. "general_chat" - ONLY use this if clearly NOT about quotes/insurance/purchasing.
   Examples: "what time is it?", "tell me a joke", "who are you?"

DEFAULT TO "quote_search" if the user seems to want anything insurance-related.

Respond with JSON only:
{
  "type": "quote_search" | "insurer_selection" | "confirmation" | "cancellation" | "general_chat",
  "confidence": 0.0-1.0,
  "insurerName": "InsureName" | null
}`
        },
        {
          role: "user",
          content: `Classify this speech from a user in a car insurance app: "${transcript}"`
        }
      ],
      response_format: { type: "json_object" }
    });

    const result = JSON.parse(response.choices[0]?.message?.content || "{}");
    
    return {
      type: result.type || "general_chat",
      confidence: result.confidence || 0.5,
      insurerName: result.insurerName || undefined,
      rawTranscript: transcript
    };
  } catch (error) {
    console.error("[VoiceIntent] LLM intent detection failed:", error);
    // Fallback to basic keyword matching
    return fallbackIntentDetection(transcript);
  }
}

/**
 * Fallback keyword-based intent detection when LLM fails
 * This is VERY lenient because we're in a car insurance app
 */
function fallbackIntentDetection(transcript: string): VoiceIntent {
  const lower = transcript.toLowerCase().trim();
  
  // Quote search keywords - be VERY lenient, include common mishearings
  const quoteKeywords = [
    "quote", "coat", "code", "cold", // Common mishearings of "quote"
    "insure", "insurance", "ensure", // Insurance terms
    "search", "find", "get", "need", "want", "looking",
    "compare", "policy", "policies", "price", "cost", "premium",
    "tesla", "bmw", "ford", "audi", "mercedes", "car", "vehicle", // Car mentions
    "my car", "my vehicle", "for my"
  ];
  if (quoteKeywords.some(kw => lower.includes(kw))) {
    return { type: "quote_search", confidence: 0.8, rawTranscript: transcript };
  }
  
  // Positive action keywords that indicate confirmation even if preceded by "no"
  const positiveActions = ["proceed", "go ahead", "continue", "do it", "go on", "confirm"];
  
  // Check for "No, [positive action]" pattern - this is CONFIRMATION not cancellation
  if (lower.startsWith("no") && positiveActions.some(pa => lower.includes(pa))) {
    return { type: "confirmation", confidence: 0.9, rawTranscript: transcript };
  }
  
  // Confirmation keywords - check first if very short
  const confirmKeywords = [
    "yes", "yeah", "yep", "sure", "okay", "ok", "confirm", "proceed",
    "go ahead", "do it", "absolutely", "definitely", "let's go", "lets go",
    "that's fine", "sounds good", "please proceed", "go on"
  ];
  if (confirmKeywords.some(kw => lower === kw || lower.startsWith(kw + " ") || lower.includes(kw))) {
    return { type: "confirmation", confidence: 0.8, rawTranscript: transcript };
  }
  
  // Cancellation keywords - but NOT if followed by positive action
  const cancelKeywords = ["cancel", "stop", "no thank", "never mind", "forget", "abort", "don't want"];
  const hasCancelKeyword = cancelKeywords.some(kw => lower.includes(kw));
  const hasPositiveAction = positiveActions.some(pa => lower.includes(pa));
  if (hasCancelKeyword && !hasPositiveAction) {
    return { type: "cancellation", confidence: 0.8, rawTranscript: transcript };
  }
  
  // Insurer selection - check for any mention of known insurers
  for (const insurer of KNOWN_INSURERS) {
    if (lower.includes(insurer.toLowerCase())) {
      return { 
        type: "insurer_selection", 
        confidence: 0.8, 
        insurerName: insurer,
        rawTranscript: transcript 
      };
    }
  }
  
  // Also check for "first one", "second one", "cheapest", "best"
  const selectionKeywords = ["first", "second", "third", "cheapest", "best", "top", "that one"];
  if (selectionKeywords.some(kw => lower.includes(kw))) {
    return { type: "insurer_selection", confidence: 0.6, rawTranscript: transcript };
  }
  
  return { type: "general_chat", confidence: 0.5, rawTranscript: transcript };
}

/**
 * Generate polite voice responses for different scenarios
 */
export function generateVoiceResponse(scenario: string, data?: any): string {
  switch (scenario) {
    case "quote_search_start":
      return "Let me search for the best car insurance quotes for you. This will just take a moment.";
    
    case "quotes_found":
      if (data?.topQuote) {
        return `I've found ${data.totalQuotes || "several"} quotes for you. The best one is from ${data.topQuote.insurer} at ${data.topQuote.price} pounds per year, with a Trustpilot rating of ${data.topQuote.trustpilot}. You can see all the options on screen. Would you like to go with any of these?`;
      }
      return "I've found some quotes for you. Take a look at the options on your screen and let me know which one you'd like.";
    
    case "insurer_selected":
      if (data?.insurerName && data?.price) {
        return `You've chosen ${data.insurerName} at ${data.price} pounds per year. Do you want to proceed with this?`;
      }
      return "Do you want to proceed with this insurer?";
    
    case "purchase_confirmed":
      return "Perfect. I'm processing your payment now.";
    
    case "purchase_processing":
      return "Processing your payment...";
    
    case "purchase_verifying":
      return "Verifying your details...";
    
    case "purchase_contacting":
      if (data?.insurerName) {
        return `Contacting ${data.insurerName}...`;
      }
      return "Contacting the insurer...";
    
    case "purchase_complete":
      if (data?.insurerName) {
        return `Congratulations! Your ${data.insurerName} policy is now active. You'll receive confirmation details by email shortly.`;
      }
      return "Congratulations! Your new policy is now active.";
    
    case "purchase_cancelled":
      return "No problem. Let me know if you'd like to explore other options.";
    
    case "insurer_not_found":
      return "I didn't catch which insurer you'd like. Could you please say the name again?";
    
    case "no_quotes_available":
      return "I couldn't find any quotes at the moment. Would you like me to try again?";
    
    default:
      return "I'm here to help. What would you like to know?";
  }
}
