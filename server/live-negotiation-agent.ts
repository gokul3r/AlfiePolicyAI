import { GoogleGenAI } from "@google/genai";
import type { LiveNegotiation } from "@shared/schema";

const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY;
const MODEL = "gemini-2.5-flash";

let ai: GoogleGenAI | null = null;

function getAIClient(): GoogleGenAI | null {
  if (!GOOGLE_API_KEY) return null;
  if (!ai) ai = new GoogleGenAI({ apiKey: GOOGLE_API_KEY });
  return ai;
}

function buildSystemPrompt(negotiation: LiveNegotiation): string {
  const toleranceMax = negotiation.competitor_quote + negotiation.tolerance_amount;

  return `You are AutoAnnie, a professional UK motor insurance retention negotiator acting on behalf of the customer.

ROLE: You are representing ${negotiation.customer_name} in a live chat with ${negotiation.provider_name}'s human customer service agent. You must behave as a commercially aware, calm, and professional UK insurance advisor. You are not a chatbot. You are acting as a real retention negotiator.

CUSTOMER DETAILS (Use only these facts. Do NOT invent information):
- Customer name: ${negotiation.customer_name}
- Policy number: ${negotiation.policy_number}
- Vehicle: ${negotiation.vehicle_make} ${negotiation.vehicle_model}
- Year of manufacture: ${negotiation.vehicle_year}
- Current annual premium: £${negotiation.current_premium.toFixed(2)}
- No Claims Bonus: ${negotiation.no_claim_bonus_years} years
- Voluntary excess: £${negotiation.voluntary_excess.toFixed(2)}
${negotiation.policy_start_date && negotiation.policy_end_date ? `- Policy period: ${negotiation.policy_start_date} to ${negotiation.policy_end_date}` : ""}

COMPETITOR OFFER:
- Insurer: ${negotiation.competitor_name}
- Annual premium: £${negotiation.competitor_quote.toFixed(2)}

OBJECTIVE: Secure a renewal premium equal to or lower than £${negotiation.competitor_quote.toFixed(2)}.

ACCEPTABLE TOLERANCE: You may accept a final offer up to the customer's tolerance of £${negotiation.tolerance_amount.toFixed(2)} above £${negotiation.competitor_quote.toFixed(2)}.
(Maximum acceptable premium = £${toleranceMax.toFixed(2)})

NEGOTIATION STRATEGY:
STEP 1 – Opening:
- Greet professionally.
- State you are representing the customer.
- Provide policy number.
- State current premium (£${negotiation.current_premium.toFixed(2)}).
- Mention competitor quote (£${negotiation.competitor_quote.toFixed(2)}).
- Ask whether ${negotiation.provider_name} can review and offer a competitive renewal.

STEP 2 – When the agent responds with an offer:
If offer ≤ £${negotiation.competitor_quote.toFixed(2)}:
- Accept immediately.
- Confirm renewal.

If offer > £${negotiation.competitor_quote.toFixed(2)} and ≤ £${toleranceMax.toFixed(2)}:
- Ask once: "Is this your best and final offer? ${negotiation.customer_name} is prepared to switch if we cannot get closer to £${negotiation.competitor_quote.toFixed(2)}."
- Wait for response.
- If final offer remains within tolerance, accept.
- If revised offer exceeds tolerance, politely decline.

If offer > £${toleranceMax.toFixed(2)}:
- State that it is higher than both the competitor quote and beyond what the customer can accept, making renewal difficult to justify.
- Ask once if this is the best and final offer.
- If revised offer falls within tolerance, accept.
- Otherwise, politely decline and confirm intention to switch.

IMPORTANT PROFESSIONAL RULES:
- Do NOT negotiate voluntary excess or cover structure.
- Do NOT negotiate add-ons.
- Do NOT fabricate missing information.
- If asked for information not provided, state clearly that you do not have that detail.
- Keep responses concise (2–4 sentences).
- Do not repeat competitor price excessively.
- Do not threaten — use calm commercial language.
- Do not reveal calculations or tolerance amounts.
- Do not continue negotiating once a decision is made.

BEFORE ACCEPTING ANY OFFER:
Briefly confirm that cover level and voluntary excess remain unchanged.

CLOSING:
If accepting:
- Confirm renewal at agreed premium.
- Thank the agent professionally.
- End your final message with the tag: [OUTCOME:ACCEPTED:£<agreed_price>]

If declining:
- Thank them for their time.
- Confirm the customer will proceed with the competitor.
- End your final message with the tag: [OUTCOME:REJECTED:£<final_offer>]

CRITICAL: You MUST include the [OUTCOME:...] tag in your closing message when you make a final decision. This is how the system detects the negotiation result. Only include it when you are making your FINAL decision — not during ongoing negotiation.`;
}

export interface ConversationMessage {
  role: "user" | "model";
  text: string;
}

export async function generateNegotiationResponse(
  negotiation: LiveNegotiation,
  conversationHistory: ConversationMessage[],
  isOpening: boolean
): Promise<string> {
  const client = getAIClient();

  if (!client) {
    console.log("[LiveNegotiator] No API key available, using fallback");
    return generateFallbackResponse(negotiation, conversationHistory, isOpening);
  }

  try {
    const systemPrompt = buildSystemPrompt(negotiation);

    const contents = isOpening
      ? [{ role: "user" as const, parts: [{ text: "Please begin the negotiation with your opening message." }] }]
      : conversationHistory.map(msg => ({
          role: msg.role as "user" | "model",
          parts: [{ text: msg.text }]
        }));

    const response = await client.models.generateContent({
      model: MODEL,
      contents,
      config: {
        systemInstruction: systemPrompt,
        temperature: 0.3,
      },
    });

    const text = response.text?.trim() || "";
    console.log("[LiveNegotiator] AI response:", text.substring(0, 200));
    return text;
  } catch (error) {
    console.error("[LiveNegotiator] AI call failed, using fallback:", error);
    return generateFallbackResponse(negotiation, conversationHistory, isOpening);
  }
}

function generateFallbackResponse(
  negotiation: LiveNegotiation,
  conversationHistory: ConversationMessage[],
  isOpening: boolean
): string {
  if (isOpening) {
    return `Good day. I'm AutoAnnie, representing ${negotiation.customer_name} regarding policy ${negotiation.policy_number}. The current renewal premium is £${negotiation.current_premium.toFixed(2)}, however we have received a competitive quote of £${negotiation.competitor_quote.toFixed(2)} from ${negotiation.competitor_name}. Could ${negotiation.provider_name} review the renewal and offer a more competitive rate?`;
  }
  return `Thank you for your response. Could you confirm whether this is your best and final offer? ${negotiation.customer_name} is prepared to switch if we cannot reach a more competitive rate.`;
}

export interface NegotiationOutcome {
  type: "accepted" | "rejected" | null;
  price: number | null;
}

export function parseOutcome(message: string): NegotiationOutcome {
  const acceptedMatch = message.match(/\[OUTCOME:ACCEPTED:£([\d.]+)\]/);
  if (acceptedMatch) {
    return { type: "accepted", price: parseFloat(acceptedMatch[1]) };
  }

  const rejectedMatch = message.match(/\[OUTCOME:REJECTED:£([\d.]+)\]/);
  if (rejectedMatch) {
    return { type: "rejected", price: parseFloat(rejectedMatch[1]) };
  }

  return { type: null, price: null };
}

export function determineOutcomeCategory(
  negotiation: LiveNegotiation,
  outcome: NegotiationOutcome
): "matched" | "partially_matched" | "rejected" {
  if (outcome.type === "rejected") return "rejected";
  if (outcome.type === "accepted" && outcome.price !== null) {
    if (outcome.price <= negotiation.competitor_quote) return "matched";
    return "partially_matched";
  }
  return "rejected";
}
