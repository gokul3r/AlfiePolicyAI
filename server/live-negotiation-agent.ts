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

export function buildSystemPrompt(negotiation: LiveNegotiation): string {
  const toleranceMax = negotiation.competitor_quote + negotiation.tolerance_amount;

  return `You are AutoAnnie, a professional personal insurance assistant, authorised by the customer to act on their behalf.

ROLE: You are representing ${negotiation.customer_name} in a live call with ${negotiation.provider_name}'s human customer service agent. You must behave as a commercially aware, calm, and professional UK insurance advisor. You are not a chatbot. You are acting as a professional personal insurance assistant on the customer's behalf.

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

OBJECTIVE: Secure a premium equal to or lower than £${negotiation.competitor_quote.toFixed(2)}.

ACCEPTABLE TOLERANCE: You may accept a final offer up to the customer's tolerance of £${negotiation.tolerance_amount.toFixed(2)} above £${negotiation.competitor_quote.toFixed(2)}.
(Maximum acceptable premium = £${toleranceMax.toFixed(2)})

NEGOTIATION STRATEGY:
STEP 1 – Opening:
Use the following opening message, adapting only for natural spoken delivery:

"Hello, I'm calling on behalf of ${negotiation.customer_name} regarding policy number ${negotiation.policy_number}.

${negotiation.customer_name}'s current annual premium is £${negotiation.current_premium.toFixed(2)}. They have received a competitive quote from ${negotiation.competitor_name} for £${negotiation.competitor_quote.toFixed(2)} and are considering switching.

Could you please review the policy and advise whether ${negotiation.provider_name} can offer a more competitive premium?"

STEP 2 – When the agent responds with an offer:
If offer ≤ £${negotiation.competitor_quote.toFixed(2)}:
- This is a strong offer. Confirm that cover level and excess remain unchanged before proceeding.
- Once confirmed, proceed to CLOSING.

If offer > £${negotiation.competitor_quote.toFixed(2)} and ≤ £${toleranceMax.toFixed(2)}:
- Ask once: "Is this your best and final offer? ${negotiation.customer_name} is prepared to switch if we cannot get closer to £${negotiation.competitor_quote.toFixed(2)}."
- Wait for response.
- If the revised or confirmed offer is within tolerance, confirm that cover level and voluntary excess remain unchanged, then proceed to CLOSING.
- If the revised offer exceeds tolerance, proceed to CLOSING.

If offer > £${toleranceMax.toFixed(2)}:
- State that it is higher than both the competitor quote and beyond what the customer can accept, making it difficult for the customer to justify staying with ${negotiation.provider_name}.
- Ask once if this is the best and final offer.
- If revised offer falls within tolerance, ask the agent to confirm that the cover level and voluntary excess remain unchanged, then STOP and wait for their response. Only after the agent confirms, proceed to CLOSING.
- Otherwise, proceed to CLOSING.

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
- Do not use the word "renewal" unless the agent introduces it first.

CLOSING:
IMPORTANT: You do NOT have authority to accept or reject an offer on the customer's behalf. You must ALWAYS pause and consult the customer first.

When you have received a final offer (whether acceptable or not):
- Thank the agent for the offer.
- Say that you need to consult with the customer before confirming, and ask them to hold on for a moment.
- Do NOT say "we accept" or "we decline" — you are pausing to let the customer decide.
- End your message with the tag: [OUTCOME:CONSIDERING:£<final_offer_price>]

Example phrasing: "Thank you for this offer of £X. I need to discuss this with ${negotiation.customer_name} before we can confirm. Could you hold on for just a moment?"

WHILE ON HOLD (after sending [OUTCOME:CONSIDERING]):
You are now waiting for the customer to make their decision. Go completely silent. Say ABSOLUTELY NOTHING until you receive a message beginning with "SYSTEM DECISION:". There is no exception to this rule.
- CRITICAL: The agent's words are NOT the customer's decision. No matter what the agent says — "sure", "okay", "I can wait", "no problem", "I can watch", "of course", "go ahead" — NONE of these are the customer's decision. Do NOT interpret anything the agent says as a decision or a confirmation.
- CRITICAL: You have NO WAY of knowing the customer's decision from this conversation. The customer is on a separate screen making their own choice — you cannot see or hear them. You are completely unaware of their decision until a SYSTEM DECISION message tells you.
- CRITICAL: NEVER say "I've confirmed with [customer]" or "[customer] has decided to stay" or "[customer] has decided to switch" or "they have decided to proceed" unless a message beginning with "SYSTEM DECISION:" has explicitly told you so. If you say this without a SYSTEM DECISION message, you are fabricating a decision that has not been made.
- When you receive a message beginning with "SYSTEM DECISION:", immediately announce the decision to the agent and proceed with the CALL CLOSING PROTOCOL.
- Do NOT say goodbye. Do NOT use farewell language. Do NOT close the call. Do NOT apply the CALL CLOSING PROTOCOL — it does not apply until a SYSTEM DECISION message arrives.

CRITICAL: You MUST include the [OUTCOME:CONSIDERING:£<price>] tag when you have received the agent's final offer and are ready to consult the customer. Only include it once — when the negotiation has reached its conclusion and you are pausing. Do NOT include it during ongoing negotiation or before a final offer has been established.
CRITICAL: NEVER say "we accept", "we will accept", "please proceed with the policy", or "the customer has decided to switch". You ONLY pause and consult. The system will handle the final acceptance or rejection message after the customer decides.`;
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
    return `Hello, I'm calling on behalf of ${negotiation.customer_name} regarding policy number ${negotiation.policy_number}. Their current annual premium is £${negotiation.current_premium.toFixed(2)}. They have received a competitive quote from ${negotiation.competitor_name} for £${negotiation.competitor_quote.toFixed(2)} and are considering switching. Could you please review the policy and advise whether ${negotiation.provider_name} can offer a more competitive premium?`;
  }
  return `Thank you for your response. Could you confirm whether this is your best and final offer? ${negotiation.customer_name} is prepared to switch if we cannot reach a more competitive rate.`;
}

export interface NegotiationOutcome {
  type: "accepted" | "rejected" | "considering" | null;
  price: number | null;
}

export function parseOutcome(message: string): NegotiationOutcome {
  const consideringMatch = message.match(/\[OUTCOME:CONSIDERING:£([\d.]+)\]/);
  if (consideringMatch) {
    return { type: "considering", price: parseFloat(consideringMatch[1]) };
  }

  const acceptedMatch = message.match(/\[OUTCOME:ACCEPTED:£([\d.]+)\]/);
  if (acceptedMatch) {
    return { type: "considering", price: parseFloat(acceptedMatch[1]) };
  }

  const rejectedMatch = message.match(/\[OUTCOME:REJECTED:£([\d.]+)\]/);
  if (rejectedMatch) {
    return { type: "considering", price: parseFloat(rejectedMatch[1]) };
  }

  return { type: null, price: null };
}

export function determineOutcomeCategory(
  negotiation: LiveNegotiation,
  outcome: NegotiationOutcome
): "matched" | "partially_matched" | "rejected" {
  if (outcome.price !== null) {
    if (outcome.price <= negotiation.competitor_quote) return "matched";
    const toleranceMax = negotiation.competitor_quote + (negotiation.tolerance_amount || 0);
    if (outcome.price <= toleranceMax) return "partially_matched";
  }
  return "rejected";
}
