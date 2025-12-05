import OpenAI from "openai";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export type IntentType = "QUOTE" | "POLICY" | "GENERAL";

export interface IntentResult {
  intent: IntentType;
  confidence: number;
  reason: string;
  source: "llm" | "fallback";
}

// NOTE: POLICY intent is currently disabled - all policy-related questions go to GENERAL
const INTENT_SYSTEM_PROMPT = `You are an intent router for an insurance assistant chatbot. Given a user message about insurance, classify the intent as one of two categories:

QUOTE - User wants to get a new insurance quote, compare prices, shop around, renew, switch insurers, or find cheaper insurance. This includes:
- Asking for quotes or prices
- Wanting to compare or shop around
- Renewing or switching insurance
- Looking for cheaper/better deals
- Asking "how much to insure" something

GENERAL - Everything else, including:
- Questions about their existing policy (when does it end, coverage details, payments)
- General insurance education questions
- "What is comprehensive cover?"
- "Explain no claims bonus"
- Cancellation questions
- Any other insurance-related questions

Respond ONLY with valid JSON in this exact format:
{"intent":"QUOTE","confidence":0.95,"reason":"User wants to compare insurance prices"}

Do not include any text before or after the JSON.`;

const FEW_SHOT_EXAMPLES = [
  { role: "user" as const, content: "I need a quote for my car" },
  { role: "assistant" as const, content: '{"intent":"QUOTE","confidence":0.98,"reason":"User explicitly requesting a car insurance quote"}' },
  { role: "user" as const, content: "How much would it cost to insure my Honda?" },
  { role: "assistant" as const, content: '{"intent":"QUOTE","confidence":0.95,"reason":"User asking about insurance pricing for their vehicle"}' },
  { role: "user" as const, content: "Can you find me cheaper insurance?" },
  { role: "assistant" as const, content: '{"intent":"QUOTE","confidence":0.92,"reason":"User wants to shop around for better insurance rates"}' },
  { role: "user" as const, content: "I want to switch from Admiral" },
  { role: "assistant" as const, content: '{"intent":"QUOTE","confidence":0.90,"reason":"User wants to switch insurers, which requires getting new quotes"}' },
  { role: "user" as const, content: "When does my policy end?" },
  { role: "assistant" as const, content: '{"intent":"GENERAL","confidence":0.95,"reason":"User asking about their existing policy details"}' },
  { role: "user" as const, content: "Cancel my insurance" },
  { role: "assistant" as const, content: '{"intent":"GENERAL","confidence":0.92,"reason":"User asking about policy cancellation"}' },
  { role: "user" as const, content: "What is comprehensive cover?" },
  { role: "assistant" as const, content: '{"intent":"GENERAL","confidence":0.95,"reason":"User asking a general educational question about insurance"}' },
];

const QUOTE_KEYWORDS = [
  "quote", "quotes",
  "price", "prices", "pricing", "cost", "costs",
  "insure my", "insure a",
  "how much to insure", "how much would it cost",
  "get insurance", "buy insurance", "need insurance", "want insurance",
  "find insurance", "search insurance", "looking for insurance",
  "compare", "comparison", "shop around", "shopping around",
  "renew", "renewal", "switch", "switching",
  "cheaper", "cheapest", "best deal", "better deal", "better rate",
  "new policy", "new insurance",
  "quote me", "price me",
  "cover my", "coverage for my",
  "motor insurance", "car insurance", "vehicle insurance", "auto insurance"
];

// POLICY_KEYWORDS disabled - these now fall through to GENERAL

function keywordFallback(message: string): IntentResult {
  const lowerMessage = message.toLowerCase();
  
  for (const keyword of QUOTE_KEYWORDS) {
    if (lowerMessage.includes(keyword)) {
      return {
        intent: "QUOTE",
        confidence: 0.75,
        reason: `Matched quote keyword: "${keyword}"`,
        source: "fallback"
      };
    }
  }
  
  // All non-quote messages go to GENERAL (including former POLICY intents)
  return {
    intent: "GENERAL",
    confidence: 0.60,
    reason: "No quote keywords detected, routing to general assistant",
    source: "fallback"
  };
}

async function tryClassifyWithLLM(message: string, timeoutMs: number): Promise<IntentResult | null> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
    
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: INTENT_SYSTEM_PROMPT },
        ...FEW_SHOT_EXAMPLES,
        { role: "user", content: message }
      ],
      temperature: 0,
      max_tokens: 100,
      response_format: { type: "json_object" },
    }, { signal: controller.signal });
    
    clearTimeout(timeoutId);
    
    const content = response.choices[0]?.message?.content?.trim();
    if (!content) {
      console.log(`[Intent] Empty LLM response`);
      return null;
    }
    
    const parsed = JSON.parse(content);
    
    // Only accept QUOTE or GENERAL - convert any POLICY to GENERAL
    let intent = parsed.intent;
    if (intent === "POLICY") {
      intent = "GENERAL";
      console.log(`[Intent] Converted POLICY to GENERAL (POLICY intent disabled)`);
    }
    
    if (!["QUOTE", "GENERAL"].includes(intent)) {
      console.log(`[Intent] Invalid intent "${parsed.intent}"`);
      return null;
    }
    
    return {
      intent: intent as IntentType,
      confidence: typeof parsed.confidence === "number" ? parsed.confidence : 0.8,
      reason: parsed.reason || "LLM classification",
      source: "llm"
    };
    
  } catch (error: any) {
    if (error.name === "AbortError" || error.message?.includes("aborted")) {
      console.log(`[Intent] LLM timeout after ${timeoutMs}ms`);
    } else {
      console.log(`[Intent] LLM error: ${error.message}`);
    }
    return null;
  }
}

export async function classifyIntent(message: string, timeoutMs: number = 2000, maxRetries: number = 1): Promise<IntentResult> {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    if (attempt > 0) {
      const jitterMs = Math.random() * 200;
      await new Promise(resolve => setTimeout(resolve, jitterMs));
      console.log(`[Intent] Retry attempt ${attempt}/${maxRetries}`);
    }
    
    const result = await tryClassifyWithLLM(message, timeoutMs);
    if (result) {
      console.log(`[Intent] LLM classified "${message.substring(0, 50)}..." as ${result.intent} (${(result.confidence * 100).toFixed(0)}%): ${result.reason}`);
      return result;
    }
  }
  
  console.log(`[Intent] All LLM attempts failed, using keyword fallback`);
  return keywordFallback(message);
}

export function isQuoteIntent(result: IntentResult): boolean {
  return result.intent === "QUOTE";
}

export function isPolicyIntent(result: IntentResult): boolean {
  // POLICY intent is disabled - always returns false
  return false;
}

export function isGeneralIntent(result: IntentResult): boolean {
  return result.intent === "GENERAL";
}
