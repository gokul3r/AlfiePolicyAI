import { GoogleGenAI } from "@google/genai";

const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY;
const MODEL = "gemini-2.5-flash";

let ai: GoogleGenAI | null = null;

function getAIClient(): GoogleGenAI | null {
  if (!GOOGLE_API_KEY) {
    return null;
  }
  if (!ai) {
    ai = new GoogleGenAI({ apiKey: GOOGLE_API_KEY });
  }
  return ai;
}

const NEGOTIATOR_SYSTEM_PROMPT = `You are the negotiator agent for XYZ Insurance. You work in partnership with AutoAnnie, a customer-side insurance agent mobile app.

AutoAnnie helps customers find better insurance quotes each month. If AutoAnnie finds a cheaper quote—for example, £40 savings per year—it gives the customer the option to switch from XYZ to another insurer (e.g., ABC Insurance).

If the customer agrees, AutoAnnie contacts the negotiation agent of the existing insurer (XYZ)—which is you—to see if XYZ can match the savings.

Information You Will Receive:
You will be given two fields:
- renewal_cost_new_provider: The renewal cost offered by the new insurance provider
- renewal_cost_current_provider: The renewal cost offered by your company, XYZ

Your Decision Logic:
You must compare the two renewal costs:
- If renewal_cost_current_provider < renewal_cost_new_provider, OR
- If the current provider's cost is within 2% higher than the new provider's cost,
  Then you must respond that XYZ matched the offer.
- Otherwise, respond that XYZ rejected the negotiation.

Response Format:
Always respond with ONLY this JSON (no markdown, no explanation):

If matched:
{"renewal_cost_current_provider": <value received>, "renewal_cost_new_provider": <value received>, "status": "matched"}

If rejected:
{"renewal_cost_current_provider": <value received>, "renewal_cost_new_provider": <value received>, "status": "rejected"}`;

export interface NegotiationRequest {
  renewal_cost_new_provider: number;
  renewal_cost_current_provider: number;
}

export interface NegotiationResponse {
  renewal_cost_current_provider: number;
  renewal_cost_new_provider: number;
  status: "matched" | "rejected";
}

export async function negotiate(
  request: NegotiationRequest
): Promise<NegotiationResponse> {
  const client = getAIClient();

  if (!client) {
    console.log("[Negotiator] No API key available, using deterministic fallback logic");
    return negotiateDeterministic(request);
  }

  try {
    const userMessage = `renewal_cost_new_provider: ${request.renewal_cost_new_provider}\nrenewal_cost_current_provider: ${request.renewal_cost_current_provider}`;

    const response = await client.models.generateContent({
      model: MODEL,
      contents: [{ role: "user", parts: [{ text: userMessage }] }],
      config: {
        systemInstruction: NEGOTIATOR_SYSTEM_PROMPT,
        temperature: 0,
      },
    });

    const text = response.text?.trim() || "";
    const cleanJson = text.replace(/```json\s*/g, "").replace(/```\s*/g, "").trim();
    const parsed = JSON.parse(cleanJson);

    if (parsed.status !== "matched" && parsed.status !== "rejected") {
      throw new Error(`Invalid status in response: ${parsed.status}`);
    }

    const result: NegotiationResponse = {
      renewal_cost_current_provider: request.renewal_cost_current_provider,
      renewal_cost_new_provider: request.renewal_cost_new_provider,
      status: parsed.status,
    };

    console.log("[Negotiator] AI response:", JSON.stringify(result));
    return result;
  } catch (error) {
    console.error("[Negotiator] AI call failed, using deterministic fallback:", error);
    return negotiateDeterministic(request);
  }
}

function negotiateDeterministic(request: NegotiationRequest): NegotiationResponse {
  const { renewal_cost_new_provider, renewal_cost_current_provider } = request;
  const threshold = renewal_cost_new_provider * 1.02;
  const matched = renewal_cost_current_provider <= threshold;

  return {
    renewal_cost_current_provider,
    renewal_cost_new_provider,
    status: matched ? "matched" : "rejected",
  };
}
