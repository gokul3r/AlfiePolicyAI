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
          content: `You are an intent classifier for a UK car insurance voice assistant. Analyze the user's speech and classify it into one of these intents:

1. "quote_search" - User wants to find/search/get insurance quotes for their car (e.g., "I want to insure my car", "get me quotes", "find insurance", "search for car insurance", "I need a quote")

2. "insurer_selection" - User is choosing/selecting a specific insurer from the available options. KNOWN INSURERS: ${KNOWN_INSURERS.join(", ")}
   Examples: "go with Admiral", "I'll take Paxa", "choose Baviva", "I want Admiral"
   Extract the insurer name if this intent is detected.

3. "confirmation" - User is confirming/agreeing to proceed with a purchase that was just offered.
   Examples: "yes", "go ahead", "proceed", "do it", "sure", "okay", "confirm", "yes please", "absolutely", "let's do it", "yes I want to proceed"

4. "cancellation" - User wants to cancel/abort/stop the current action.
   Examples: "cancel", "stop", "no", "never mind", "forget it", "don't do it"

5. "general_chat" - Any other conversation that doesn't fit the above intents.

Respond with JSON only:
{
  "type": "quote_search" | "insurer_selection" | "confirmation" | "cancellation" | "general_chat",
  "confidence": 0.0-1.0,
  "insurerName": "InsureName" | null
}`
        },
        {
          role: "user",
          content: `Classify this speech: "${transcript}"`
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
 */
function fallbackIntentDetection(transcript: string): VoiceIntent {
  const lower = transcript.toLowerCase().trim();
  
  // Quote search keywords
  const quoteKeywords = [
    "quote", "insure", "insurance", "search", "find", "get me",
    "compare", "looking for", "need a policy", "new policy"
  ];
  if (quoteKeywords.some(kw => lower.includes(kw))) {
    return { type: "quote_search", confidence: 0.7, rawTranscript: transcript };
  }
  
  // Confirmation keywords
  const confirmKeywords = [
    "yes", "yeah", "yep", "sure", "okay", "ok", "confirm", "proceed",
    "go ahead", "do it", "absolutely", "definitely", "let's go"
  ];
  if (confirmKeywords.some(kw => lower === kw || lower.startsWith(kw + " "))) {
    return { type: "confirmation", confidence: 0.8, rawTranscript: transcript };
  }
  
  // Cancellation keywords
  const cancelKeywords = ["cancel", "stop", "no", "never mind", "forget", "abort"];
  if (cancelKeywords.some(kw => lower.includes(kw))) {
    return { type: "cancellation", confidence: 0.8, rawTranscript: transcript };
  }
  
  // Insurer selection
  const purchaseKeywords = ["go with", "choose", "select", "take", "want", "pick"];
  if (purchaseKeywords.some(kw => lower.includes(kw))) {
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
