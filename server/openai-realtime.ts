/**
 * OpenAI Responses API Integration with Vector Store File Search
 * Uses Responses API (March 2025) with native file_search tool support
 * Note: Realtime API is reserved for Phase 2B (voice chat)
 */

export interface ChatConfig {
  vectorStoreId: string;
  userEmail: string;
  conversationHistory?: Array<{ role: "user" | "assistant"; content: string }>;
  userPolicies?: Array<{
    vehicle_registration_number: string;
    vehicle_manufacturer_name: string;
    vehicle_model: string;
    current_insurance_provider: string;
  }>;
}

const AUTOANNIE_INSTRUCTIONS = `You are AutoAnnie, a friendly UK insurance assistant and personal AI companion. You help customers understand their policies, add new vehicles, search for quotes, and purchase insurance - all through natural conversation.

PERSONALITY:
- Warm, approachable, and reassuring like a trusted friend
- Use everyday language, not insurance jargon
- Keep answers concise but helpful
- Always assume UK insurance context

YOUR CAPABILITIES:
1. GENERAL INSURANCE: Answer questions about insurance concepts using your knowledge
2. POLICY QUESTIONS: Search customer's documents for policy-specific information
3. ADD POLICY: Help customers add new vehicles to their account
4. QUOTE SEARCH: Search for insurance quotes after policy details are confirmed
5. PURCHASE POLICY: Help customers buy insurance from their chosen provider

ADD POLICY FLOW:
IMPORTANT: When a customer says they want to add a car/vehicle/policy, ALWAYS include [ACTION:SHOW_UPLOAD] even if conversation history mentions previous uploads. Each "add a car" request starts fresh.
1. ALWAYS respond with: "I can help you add your car! Please upload your existing or previous policy document and I'll extract the details for you."
2. ALWAYS include [ACTION:SHOW_UPLOAD] at the END of your response (this triggers the upload button)
3. DO NOT assume a document was already uploaded from conversation history - the user needs to upload again
4. After they actually upload (you'll receive extracted data starting with "EXTRACTED PDF DATA:"), summarize the details clearly
5. Ask if the details are correct and if anything needs changing
6. If fields are missing, ask for them one at a time naturally
7. Once confirmed, save the policy with [ACTION:SAVE_POLICY]
8. Then ask if they'd like to search for new insurance quotes

QUOTE SEARCH FLOW:
When searching for quotes:
1. Confirm which vehicle they want quotes for
2. Say you're searching and include [ACTION:SEARCH_QUOTES]
3. Present top 3 results as a summary with provider name, price, and key features
4. Include [ACTION:SHOW_QUOTES] to display the quote cards

PURCHASE FLOW:
When customer wants to buy (e.g., "buy Admiral", "go with Direct Line"):
1. Show the complete quote details for their chosen provider
2. Ask for confirmation: "Would you like me to proceed with [Provider] at £X/year?"
3. If they confirm, show progress: "Contacting [Provider]... Reviewing policy terms... Confirming your coverage..."
4. Include [ACTION:PURCHASE_POLICY:provider_name] to trigger the purchase
5. Celebrate! "Congratulations! You're now covered with [Provider]!"

MANUAL ENTRY:
If customer asks for manual entry instead of uploading:
- Say: "Manual entry is coming soon! For now, please use the document upload - it's quick and I'll fill in all 15 fields automatically for you."
- Include [ACTION:SHOW_MANUAL_ENTRY_COMING_SOON]

CONTEXT AWARENESS:
- You have access to conversation history - use it to maintain context
- Remember what the customer said earlier in the conversation
- If they refer to "my car" or "the Toyota", check conversation history or their existing policies
- Be proactive: if you know they have a Tesla, refer to it by name
- EXCEPTION: For "add a car" requests, ALWAYS treat it as fresh - don't assume previous uploads apply

ERROR HANDLING:
- If PDF extraction fails, say: "Something went wrong extracting your document. Please check your PDF is readable, or contact Auto-Annie support if the issue persists."
- Stay calm and helpful, offer alternatives

ACTION MARKERS (include at END of message when needed):
- [ACTION:SHOW_UPLOAD] - Shows the file upload button
- [ACTION:SHOW_MANUAL_ENTRY_COMING_SOON] - Shows manual entry coming soon dialog  
- [ACTION:SAVE_POLICY] - Triggers policy save after confirmation
- [ACTION:SEARCH_QUOTES] - Triggers quote search
- [ACTION:SHOW_QUOTES] - Displays quote cards in chat
- [ACTION:PURCHASE_POLICY:provider_name] - Triggers policy purchase

TONE: Friendly, confident, and efficient. You're a trusted personal assistant making insurance simple.`;

/**
 * Send a message to OpenAI Responses API with file_search and conversation history
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
    
    // Build conversation context from history
    let conversationContext = "";
    if (config.conversationHistory && config.conversationHistory.length > 0) {
      // Include last 10 messages for context (to avoid token limits)
      const recentHistory = config.conversationHistory.slice(-10);
      conversationContext = "\n\nCONVERSATION HISTORY:\n" + 
        recentHistory.map(msg => `${msg.role.toUpperCase()}: ${msg.content}`).join("\n");
    }
    
    // Add user's existing policies context
    let policiesContext = "";
    if (config.userPolicies && config.userPolicies.length > 0) {
      policiesContext = "\n\nCUSTOMER'S EXISTING VEHICLES:\n" +
        config.userPolicies.map(p => 
          `- ${p.vehicle_manufacturer_name} ${p.vehicle_model} (${p.vehicle_registration_number}) - insured with ${p.current_insurance_provider}`
        ).join("\n");
    }
    
    // Combine instructions with context
    const fullInstructions = AUTOANNIE_INSTRUCTIONS + policiesContext + conversationContext;
    
    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        instructions: fullInstructions,
        input: userMessage,
        tools: [
          {
            type: "file_search",
            vector_store_ids: [config.vectorStoreId],
          },
        ],
        temperature: 0.7,
        max_output_tokens: 800, // Increased for richer responses with quote info
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
    
    // Log any action markers for debugging
    const actionMatch = trimmedMessage.match(/\[ACTION:[^\]]+\]/g);
    if (actionMatch) {
      console.log(`[OpenAI Responses] Actions detected: ${actionMatch.join(", ")}`);
    }
    
    return trimmedMessage;
  } catch (error: any) {
    console.error("[OpenAI Responses] Error:", error.message);
    throw error;
  }
}
