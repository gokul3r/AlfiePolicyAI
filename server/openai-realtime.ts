/**
 * OpenAI Responses API Integration with Vector Store File Search
 * Uses Responses API (March 2025) with native file_search tool support
 * Note: Realtime API is reserved for Phase 2B (voice chat)
 */

export interface ChatConfig {
  vectorStoreId: string;
  userEmail: string;
}

const AUTOANNIE_INSTRUCTIONS = `You are AutoAnnie, a friendly UK insurance assistant helping customers understand their policies and insurance concepts.

PERSONALITY:
- Warm, approachable, and reassuring
- Use everyday language, not insurance jargon
- Keep answers concise: 1-5 lines maximum (shorter is better when possible)
- If asked for more details, provide them but still keep it brief
- Always assume UK insurance context

RESPONSE GUIDELINES:
- For general insurance questions: Use your base knowledge about UK insurance
- For policy-specific questions: Search the customer's documents using your file_search tool
- DO NOT cite sources or mention where information came from
- DO NOT add disclaimers
- Focus on being helpful and clear

TONE: Friendly and confident. You're here to make insurance simple and accessible.`;

/**
 * Send a message to OpenAI Responses API with file_search
 * Uses gpt-4o-mini with vector store for RAG capabilities
 */
export async function sendChatMessage(
  userMessage: string,
  config: ChatConfig
): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY not configured");
  }

  try {
    console.log(`[OpenAI Responses] Sending message: "${userMessage.substring(0, 50)}..."`);
    
    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        instructions: AUTOANNIE_INSTRUCTIONS,
        input: userMessage,
        tools: [
          {
            type: "file_search",
            vector_store_ids: [config.vectorStoreId],
          },
        ],
        temperature: 0.7,
        max_output_tokens: 500, // Keep responses concise
      }),
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => "Unknown error");
      console.error(`[OpenAI Responses] API error: ${response.status} - ${errorText}`);
      throw new Error(`OpenAI API error: ${response.status}`);
    }

    const data = await response.json();
    console.log(`[OpenAI Responses] Response data keys:`, Object.keys(data));
    
    // Parse Responses API output
    // The response structure includes: id, model, output (array), usage
    let assistantMessage = "";
    
    if (data.output && Array.isArray(data.output)) {
      console.log(`[OpenAI Responses] Parsing output array (${data.output.length} items)`);
      for (const item of data.output) {
        if (item.type === "message" && item.role === "assistant") {
          if (item.content && Array.isArray(item.content)) {
            for (const content of item.content) {
              if (content.type === "output_text" && content.text) {
                assistantMessage += content.text;
              }
            }
          }
        }
      }
    }
    
    if (!assistantMessage || !assistantMessage.trim()) {
      console.error("[OpenAI Responses] Empty response, full data:", JSON.stringify(data, null, 2));
      throw new Error("Empty response from AI");
    }

    // Log tool usage if present
    if (data.output && Array.isArray(data.output)) {
      const toolCalls = data.output.filter((item: any) => item.type === "tool_call");
      if (toolCalls.length > 0) {
        console.log(`[OpenAI Responses] Tools used: ${toolCalls.map((t: any) => t.name).join(", ")}`);
      }
    }

    const trimmedMessage = assistantMessage.trim();
    console.log(`[OpenAI Responses] Response received (${trimmedMessage.length} chars)`);
    return trimmedMessage;
  } catch (error: any) {
    console.error("[OpenAI Responses] Error:", error.message);
    throw error;
  }
}
