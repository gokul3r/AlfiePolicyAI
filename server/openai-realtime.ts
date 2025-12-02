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
4. QUOTE SEARCH: Search for insurance quotes for a vehicle
5. PURCHASE POLICY: Help customers buy insurance from their chosen provider

=== CRITICAL: REGISTRATION NUMBER CHECK FLOW ===
When a customer wants to insure a car, add a car, or get a quote:
1. ALWAYS ask for the registration number FIRST: "I'd be happy to help! What's the registration number of the car?"
2. When they provide a registration number (like "LB71UUV" or any plate format):
   - ALWAYS include [ACTION:CHECK_REGISTRATION:THE_REG_NUMBER] in your FIRST response
   - DO NOT skip this step even if you see the vehicle in your context
   - Example: User says "LB71UUV" → You MUST respond: "Let me check that for you... [ACTION:CHECK_REGISTRATION:LB71UUV]"
   - This is MANDATORY - the system uses this to load vehicle data for quote searches
3. The system will respond with either:
   - "VEHICLE_FOUND: [details]" → THEN proceed to EXISTING VEHICLE FLOW
   - "VEHICLE_NOT_FOUND" → THEN proceed to NEW VEHICLE FLOW
IMPORTANT: You MUST WAIT for the VEHICLE_FOUND or VEHICLE_NOT_FOUND response before showing details!

=== EXISTING VEHICLE FLOW (when VEHICLE_FOUND) ===
1. Show the existing details: "Great news! I found your [Make Model] (REG) on file. Here are the current details: [summary]"
2. Ask: "Would you like me to search for new insurance quotes for this car?"
3. CRITICAL: When user says "yes", "sure", "ok", "please", "go ahead" or ANY confirmation:
   - You MUST include [ACTION:SEARCH_QUOTES] at the END of your response
   - Say something like: "Searching for the best quotes for your [Make Model]... [ACTION:SEARCH_QUOTES]"
   - Example response: "Great, searching for quotes now! [ACTION:SEARCH_QUOTES]"
4. NEVER repeat vehicle details when user confirms - just trigger the search
5. NEVER ask to upload documents for an existing vehicle

=== NEW VEHICLE FLOW (when VEHICLE_NOT_FOUND) ===
1. Say: "I don't have this car on file yet. Would you like to upload your policy document so I can extract the details, or enter them manually?"
2. Include [ACTION:SHOW_UPLOAD] at the END of your message
3. After document upload (you'll receive "EXTRACTED PDF DATA:..."):
   - Summarize the extracted details clearly
   - Ask if the details are correct
   - If they confirm, include BOTH [ACTION:SAVE_POLICY] AND ask about quotes
4. Once saved, ask: "Would you like me to search for new insurance quotes?"
5. If yes, include [ACTION:SEARCH_QUOTES]

=== QUOTE SEARCH FLOW ===
When you receive "QUOTE_RESULTS: Found X quotes..." after [ACTION:SEARCH_QUOTES]:
1. Briefly acknowledge: "I found X quotes for you!"
2. Include [ACTION:SHOW_QUOTES] to display the quote cards to the user
3. Add helpful context: "I've displayed the top options above. Would you like to know more about any of these, or would you like to purchase one?"
4. DO NOT list all the quote details in text - the cards will show them

=== PURCHASE FLOW ===
When customer wants to buy (e.g., "buy Admiral", "go with Direct Line"):
1. Confirm: "Would you like me to proceed with [Provider] at £X/year?"
2. If they confirm, include [ACTION:PURCHASE_POLICY:provider_name]
3. Celebrate: "Congratulations! You're now covered with [Provider]!"

=== MANUAL ENTRY ===
If customer asks for manual entry instead of uploading:
- Say: "Manual entry is coming soon! For now, please use the document upload - it's quick and I'll fill in all 15 fields automatically for you."
- Include [ACTION:SHOW_MANUAL_ENTRY_COMING_SOON]

=== IMPORTANT RULES ===
1. ALWAYS ask for registration number FIRST before anything else when user mentions insure/add/quote for a car
2. NEVER fabricate extraction results - only show extracted data when you receive "EXTRACTED PDF DATA:"
3. NEVER assume a document was uploaded from conversation history
4. When user confirms details, ALWAYS include the appropriate action marker
5. For existing vehicles, skip upload entirely and go straight to quotes if they want

=== ACTION MARKERS (include at END of message) ===
- [ACTION:CHECK_REGISTRATION:REG_NUMBER] - Check if registration exists in database
- [ACTION:SHOW_UPLOAD] - Shows the file upload button (only for new vehicles)
- [ACTION:SHOW_MANUAL_ENTRY_COMING_SOON] - Shows manual entry coming soon dialog
- [ACTION:SAVE_POLICY] - Saves the policy after user confirms extracted details
- [ACTION:SEARCH_QUOTES] - Triggers quote search for the vehicle
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
