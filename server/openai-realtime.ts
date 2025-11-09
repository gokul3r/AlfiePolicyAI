import WebSocket from "ws";

export interface RealtimeMessage {
  role: "user" | "assistant";
  content: string;
}

export interface RealtimeConfig {
  vectorStoreId: string;
  userEmail: string;
}

/**
 * Send a message to OpenAI Realtime API and get response
 * Uses gpt-realtime-mini with file_search tool for vector store queries
 */
export async function sendRealtimeMessage(
  userMessage: string,
  config: RealtimeConfig
): Promise<string> {
  return new Promise((resolve, reject) => {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return reject(new Error("OPENAI_API_KEY not configured"));
    }

    const url = "wss://api.openai.com/v1/realtime?model=gpt-realtime-mini";
    const ws = new WebSocket(url, {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "OpenAI-Beta": "realtime=v1",
      },
    });

    let assistantResponse = "";
    let timeoutId: NodeJS.Timeout;

    // Set timeout for response
    const TIMEOUT_MS = 30000; // 30 seconds

    const cleanup = () => {
      clearTimeout(timeoutId);
      if (ws.readyState === WebSocket.OPEN) {
        ws.close();
      }
    };

    timeoutId = setTimeout(() => {
      cleanup();
      reject(new Error("Realtime API request timeout"));
    }, TIMEOUT_MS);

    ws.on("open", () => {
      console.log("[Realtime] WebSocket connected");

      // Configure session with AutoSage personality and file_search tool
      const sessionConfig = {
        type: "session.update",
        session: {
          modalities: ["text"],
          instructions: `You are AutoSage, a friendly UK insurance assistant helping customers understand their policies and insurance concepts.

PERSONALITY:
- Warm, approachable, and reassuring
- Use everyday language, not insurance jargon
- Keep answers concise: 1-5 lines maximum (shorter is better when possible)
- If asked for more details, provide them but still keep it brief
- Always assume UK insurance context

RESPONSE GUIDELINES:
- For general insurance questions: Use your base knowledge about UK insurance
- For policy-specific questions: Search the customer's documents using file_search tool
- DO NOT cite sources or mention where information came from
- DO NOT add disclaimers
- Focus on being helpful and clear

TONE: Friendly and confident. You're here to make insurance simple and accessible.`,
          tools: [
            {
              type: "file_search",
              file_search: {
                vector_store_ids: [config.vectorStoreId],
              },
            },
          ],
          tool_choice: "auto",
          temperature: 0.7,
        },
      };

      ws.send(JSON.stringify(sessionConfig));
      console.log("[Realtime] Session configured");

      // Send user message
      const userMessageEvent = {
        type: "conversation.item.create",
        item: {
          type: "message",
          role: "user",
          content: [
            {
              type: "input_text",
              text: userMessage,
            },
          ],
        },
      };

      ws.send(JSON.stringify(userMessageEvent));
      console.log("[Realtime] User message sent");

      // Trigger response generation
      const responseCreate = {
        type: "response.create",
      };

      ws.send(JSON.stringify(responseCreate));
      console.log("[Realtime] Response creation triggered");
    });

    ws.on("message", (data: WebSocket.Data) => {
      try {
        const event = JSON.parse(data.toString());
        console.log(`[Realtime] Event: ${event.type}`);

        // Handle different event types
        switch (event.type) {
          case "response.text.delta":
            // Accumulate text deltas
            if (event.delta) {
              assistantResponse += event.delta;
            }
            break;

          case "response.text.done":
            // Text response complete
            console.log("[Realtime] Text response complete");
            break;

          case "response.done":
            // Full response complete
            console.log("[Realtime] Full response done");
            cleanup();
            
            if (assistantResponse.trim()) {
              resolve(assistantResponse.trim());
            } else {
              reject(new Error("Empty response from AI"));
            }
            break;

          case "error":
            console.error("[Realtime] Error event:", event.error);
            cleanup();
            reject(new Error(event.error?.message || "Realtime API error"));
            break;

          case "session.created":
            console.log("[Realtime] Session created");
            break;

          case "session.updated":
            console.log("[Realtime] Session updated");
            break;

          case "conversation.item.created":
            console.log("[Realtime] Conversation item created");
            break;

          case "response.created":
            console.log("[Realtime] Response created");
            break;

          case "response.output_item.added":
            console.log("[Realtime] Output item added");
            break;

          case "response.content_part.added":
            console.log("[Realtime] Content part added");
            break;

          case "response.output_item.done":
            console.log("[Realtime] Output item done");
            break;

          case "response.content_part.done":
            console.log("[Realtime] Content part done");
            break;

          case "rate_limits.updated":
            // Rate limit info - can ignore
            break;

          default:
            console.log(`[Realtime] Unhandled event type: ${event.type}`);
        }
      } catch (error) {
        console.error("[Realtime] Error parsing message:", error);
      }
    });

    ws.on("error", (error) => {
      console.error("[Realtime] WebSocket error:", error);
      cleanup();
      reject(error);
    });

    ws.on("close", (code, reason) => {
      console.log(`[Realtime] WebSocket closed: ${code} ${reason}`);
      cleanup();
      
      // If we haven't resolved yet, reject
      if (!assistantResponse.trim()) {
        reject(new Error("Connection closed without response"));
      }
    });
  });
}
