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
  insurerName?: string;
  rawTranscript: string;
}

// Use the same proven prompt structure as text chat intent classifier
const INTENT_SYSTEM_PROMPT = `You are an intent router for a UK car insurance voice assistant. Given a user's speech (which may have transcription errors), classify their intent.

QUOTE_SEARCH - User wants insurance quotes, prices, or to compare/switch/renew. Be VERY lenient - this is a car insurance app. Includes:
- Any mention of: quote, coat, code (mishearings of "quote"), price, cost, insure, insurance, cover, premium, compare, find, search, get, need, want, looking, switch, renew, cheaper, cheapest, best deal
- Mentioning their car (Tesla, Honda, BMW, etc.)
- Phrases like "I want to...", "can you find...", "help me get...", "how much..."
- Common mishearings: "coat" = quote, "code" = quote, "ensure" = insure

INSURER_SELECTION - User picks a specific insurer from available quotes.
Known insurers: ${KNOWN_INSURERS.join(", ")}
Also matches: "first one", "second one", "third", "cheapest", "best one", "top one", "that one"

CONFIRMATION - User agrees/confirms to proceed with purchase.
Examples: "yes", "yeah", "sure", "okay", "proceed", "go ahead", "do it", "confirm", "let's do it"
IMPORTANT: "No, please proceed" or "No, go ahead" = CONFIRMATION (the "no" denies alternatives, followed by positive action)

CANCELLATION - User wants to stop/cancel. ONLY when no positive action follows.
Examples: "cancel", "stop", "no thanks", "never mind", "forget it"
NOT cancellation if followed by proceed/go ahead/confirm.

GENERAL_CHAT - User asking a general insurance question (not requesting quotes).
Examples: "what is comprehensive cover?", "explain no claims bonus", "how does insurance work?"

DEFAULT TO "quote_search" if the user seems to want anything related to getting insurance.

Respond with JSON only:
{"type":"quote_search|insurer_selection|confirmation|cancellation|general_chat","confidence":0.0-1.0,"insurerName":"Name"|null}`;

/**
 * Uses OpenAI to detect the user's intent from voice transcript.
 * Aligned with text chat's proven intent classification approach.
 */
export async function detectVoiceIntent(transcript: string): Promise<VoiceIntent> {
  const normalizedTranscript = transcript.toLowerCase().trim();
  
  // Quick fallback for empty/very short transcripts or obvious garbage
  if (!normalizedTranscript || normalizedTranscript.length < 3) {
    return { type: "general_chat", confidence: 0, rawTranscript: transcript };
  }
  
  // Detect obvious garbage transcriptions (repeated characters, non-Latin scripts when unexpected)
  if (isGarbageTranscript(normalizedTranscript)) {
    console.log("[VoiceIntent] Detected garbage transcript, treating as quote_search");
    return { type: "quote_search", confidence: 0.5, rawTranscript: transcript };
  }

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 2000);
    
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0,
      max_tokens: 100,
      messages: [
        { role: "system", content: INTENT_SYSTEM_PROMPT },
        { role: "user", content: `Classify this speech from a user in a car insurance app: "${transcript}"` }
      ],
      response_format: { type: "json_object" }
    }, { signal: controller.signal });
    
    clearTimeout(timeoutId);

    const result = JSON.parse(response.choices[0]?.message?.content || "{}");
    
    console.log(`[VoiceIntent] LLM classified "${transcript.substring(0, 50)}..." as ${result.type} (${(result.confidence * 100).toFixed(0)}%)`);
    
    return {
      type: result.type || "general_chat",
      confidence: result.confidence || 0.5,
      insurerName: result.insurerName || undefined,
      rawTranscript: transcript
    };
  } catch (error: any) {
    if (error.name === "AbortError" || error.message?.includes("aborted")) {
      console.log("[VoiceIntent] LLM timeout, using keyword fallback");
    } else {
      console.error("[VoiceIntent] LLM intent detection failed:", error.message);
    }
    return fallbackIntentDetection(transcript);
  }
}

/**
 * Detect garbage transcriptions that should be ignored or defaulted
 */
function isGarbageTranscript(text: string): boolean {
  // Repeated characters pattern like "ba-ba-ba" or "na na na"
  if (/(.)\1{3,}/.test(text) || /(\w+)[- ]\1([- ]\1)+/.test(text)) {
    return true;
  }
  
  // Non-Latin scripts (Hindi, Chinese, etc.) when we expect English
  if (/[\u0900-\u097F\u4E00-\u9FFF\u3040-\u309F\u30A0-\u30FF]/.test(text)) {
    return true;
  }
  
  // Very short nonsense
  if (text.length < 5 && !/yes|no|ok|hi|hey/.test(text)) {
    return true;
  }
  
  return false;
}

/**
 * Fallback keyword-based intent detection when LLM fails
 * Aligned with text chat's keyword fallback - VERY lenient for quote detection
 */
function fallbackIntentDetection(transcript: string): VoiceIntent {
  const lower = transcript.toLowerCase().trim();
  
  // Quote search keywords - be VERY lenient, include common mishearings
  const quoteKeywords = [
    "quote", "quotes", "coat", "code", "cold",
    "price", "prices", "pricing", "cost", "costs",
    "insure", "insurance", "ensure",
    "search", "find", "get", "need", "want", "looking",
    "compare", "comparison", "shop around",
    "policy", "policies", "premium",
    "renew", "renewal", "switch", "switching",
    "cheaper", "cheapest", "best deal", "better rate",
    "how much", "cover my", "coverage",
    "car insurance", "motor insurance", "vehicle insurance",
    "tesla", "bmw", "ford", "audi", "mercedes", "honda", "toyota", "car", "vehicle",
    "my car", "my vehicle", "for my", "new car"
  ];
  if (quoteKeywords.some(kw => lower.includes(kw))) {
    return { type: "quote_search", confidence: 0.8, rawTranscript: transcript };
  }
  
  // Positive action keywords that indicate confirmation
  const positiveActions = ["proceed", "go ahead", "continue", "do it", "go on", "confirm"];
  
  // Check for "No, [positive action]" pattern - this is CONFIRMATION not cancellation
  if (lower.startsWith("no") && positiveActions.some(pa => lower.includes(pa))) {
    return { type: "confirmation", confidence: 0.9, rawTranscript: transcript };
  }
  
  // Confirmation keywords
  const confirmKeywords = [
    "yes", "yeah", "yep", "sure", "okay", "ok", "confirm", "proceed",
    "go ahead", "do it", "absolutely", "definitely", "let's go",
    "sounds good", "please proceed", "go on"
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
  
  // Position selection keywords
  const selectionKeywords = ["first", "second", "third", "cheapest", "best", "top", "that one"];
  if (selectionKeywords.some(kw => lower.includes(kw))) {
    return { type: "insurer_selection", confidence: 0.6, rawTranscript: transcript };
  }
  
  // Default to general_chat - but this will now be handled properly
  return { type: "general_chat", confidence: 0.5, rawTranscript: transcript };
}

/**
 * Generate warm, friendly voice responses for different scenarios
 * Auto Annie should sound helpful, reassuring, and professional
 */
export function generateVoiceResponse(scenario: string, data?: any): string {
  switch (scenario) {
    case "quote_search_start":
      return "Great! I'm searching for the best car insurance deals for you. Just give me a moment.";
    
    case "quotes_found":
      if (data?.topQuote) {
        return `Wonderful! I've found ${data.totalQuotes || "several"} quotes for you. The top option is ${data.topQuote.insurer} at ${data.topQuote.price} pounds per year, with an excellent Trustpilot rating of ${data.topQuote.trustpilot}. Take a look at the options on your screen. Just let me know which one you'd like to go with!`;
      }
      return "Great news! I've found some quotes for you. Have a look at the options on your screen and let me know which one catches your eye.";
    
    case "insurer_selected":
      if (data?.insurerName && data?.price) {
        return `Excellent choice! ${data.insurerName} at ${data.price} pounds per year. Shall I go ahead and set this up for you?`;
      }
      return "Great choice! Would you like me to proceed with this policy?";
    
    case "purchase_confirmed":
      return "Perfect! I'm processing your payment now. This will just take a moment.";
    
    case "purchase_processing":
      return "Processing your payment...";
    
    case "purchase_verifying":
      return "Verifying your details...";
    
    case "purchase_contacting":
      if (data?.insurerName) {
        return `Getting in touch with ${data.insurerName} to finalise your policy...`;
      }
      return "Contacting the insurer to finalise your policy...";
    
    case "purchase_complete":
      if (data?.insurerName) {
        return `Brilliant! Your ${data.insurerName} policy is now active. You're all covered! I'm sending the confirmation details to your email right now. Is there anything else I can help you with?`;
      }
      return "Brilliant! Your new policy is now active. You're all covered!";
    
    case "purchase_cancelled":
      return "No problem at all. Take your time to look through the other options. Just let me know when you're ready.";
    
    case "insurer_not_found":
      return "I'm sorry, I didn't quite catch which insurer you'd like. Could you please say the name again?";
    
    case "no_quotes_available":
      return "I'm sorry, I couldn't find any quotes at the moment. Would you like me to try again?";
    
    default:
      return "I'm here to help! What would you like to know?";
  }
}

/**
 * Generate a helpful response for general insurance questions
 * This is called when the intent is general_chat
 */
export async function generateGeneralResponse(question: string): Promise<string> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);
    
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0.7,
      max_tokens: 150,
      messages: [
        { 
          role: "system", 
          content: `You are Auto Annie, a friendly UK car insurance assistant. Answer the user's question briefly and helpfully (2-3 sentences max). Keep responses conversational and easy to understand. If the question isn't about insurance, politely redirect to insurance topics.`
        },
        { role: "user", content: question }
      ]
    }, { signal: controller.signal });
    
    clearTimeout(timeoutId);
    
    return response.choices[0]?.message?.content || "I'm here to help with car insurance. What would you like to know?";
  } catch (error) {
    console.error("[VoiceIntent] Failed to generate general response:", error);
    return "I'm here to help with car insurance. What would you like to know?";
  }
}
