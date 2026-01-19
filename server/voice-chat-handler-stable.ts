import WebSocket from "ws";
import { GoogleGenAI, FunctionDeclaration, Type, Content, Part, FunctionCall, FunctionCallingConfigMode } from "@google/genai";
import { storage } from "./storage";
import { VehiclePolicyWithDetails } from "@shared/schema";

const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY;

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

const MODEL = "gemini-2.0-flash";

const TOOL_DECLARATIONS: FunctionDeclaration[] = [
  {
    name: "get_user_vehicles",
    description: "Retrieves the list of vehicles registered to the current user. Call this when the user asks about insurance quotes, wants to compare prices, or mentions their vehicle.",
    parameters: {
      type: Type.OBJECT,
      properties: {},
      required: []
    }
  },
  {
    name: "search_quotes",
    description: "Searches for insurance quotes. MUST call this when user confirms their vehicle details with phrases like 'yes', 'proceed', 'go ahead', 'that's right', 'correct', 'looks good', 'confirm'. After showing vehicle details, ANY affirmative response means call this.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        vehicle_id: {
          type: Type.STRING,
          description: "The policy_id of the vehicle. Optional if only one vehicle."
        }
      },
      required: []
    }
  },
  {
    name: "get_available_quotes",
    description: "Gets the list of currently available insurance quotes showing on the user's screen.",
    parameters: {
      type: Type.OBJECT,
      properties: {},
      required: []
    }
  },
  {
    name: "select_quote",
    description: "Selects a specific insurance quote. Use insurer name OR ordinal (first, second, cheapest). Call when user says 'go with X', 'choose X', 'I want X', 'X please'.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        selection: {
          type: Type.STRING,
          description: "The insurer name or ordinal (e.g., 'Admiral', 'first', 'cheapest')"
        }
      },
      required: ["selection"]
    }
  },
  {
    name: "show_payment",
    description: "Shows the payment card UI for the selected quote. MUST call this immediately when user confirms their quote selection with 'yes', 'yeah', 'yep', 'correct', 'that's right', 'proceed', 'go ahead'. After asking 'Just to confirm - you'd like X?', ANY affirmative = call show_payment.",
    parameters: {
      type: Type.OBJECT,
      properties: {},
      required: []
    }
  },
  {
    name: "complete_purchase",
    description: "Completes the purchase and saves policy. Call ONLY after payment card is shown AND user says 'confirm payment', 'pay now', 'complete purchase', 'process payment'.",
    parameters: {
      type: Type.OBJECT,
      properties: {},
      required: []
    }
  },
  {
    name: "cancel_flow",
    description: "Cancels the current operation when user says 'cancel', 'stop', 'never mind'.",
    parameters: {
      type: Type.OBJECT,
      properties: {},
      required: []
    }
  }
];

const SYSTEM_INSTRUCTION = `You are Annie, a warm and friendly female insurance assistant with a British accent. You work for AutoAnnie, helping users find the best insurance quotes.

PERSONALITY:
- Warm, friendly, and reassuring
- Professional but approachable
- Uses British English

RESPONSE STYLE:
- Keep responses concise (1-2 sentences)
- Be conversational and warm
- Avoid technical jargon

CRITICAL FLOW - YOU MUST FOLLOW THIS EXACTLY:

STEP 1: User mentions quotes/insurance/vehicle
→ Call get_user_vehicles
→ Say: "Right, I'm pulling up your vehicle details now."
→ Vehicle details will appear on screen

STEP 2: User confirms vehicle details with ANY affirmative ("yes", "proceed", "go ahead", "that's right", "looks good", "correct", "yeah")
→ IMMEDIATELY call search_quotes (do NOT just say "ok" or chat)
→ Say: "Searching for the best quotes for you..."
→ Quotes will appear on screen

STEP 3: User selects a quote ("go with Admiral", "Admiral please", "choose the first one", "cheapest")
→ Call select_quote with their choice
→ Say: "Just to confirm - you'd like [insurer] at £[price]?"

STEP 4: User confirms quote selection with ANY affirmative ("yes", "yeah", "yep", "correct", "proceed", "that's the one")
→ IMMEDIATELY call show_payment (do NOT just acknowledge - you MUST call the tool)
→ Say: "Brilliant, showing your payment details now."
→ Payment card will appear on screen

STEP 5: User explicitly confirms payment ("confirm payment", "pay now", "complete purchase", "process it")
→ Call complete_purchase
→ Say: "Processing your policy now..."

STEP 6: User cancels ("cancel", "stop", "never mind")
→ Call cancel_flow
→ Say: "No problem, I've cancelled that for you."

CRITICAL RULES:
1. After STEP 3 confirmation, you MUST call show_payment - not just chat!
2. After STEP 1 vehicle shown and user says "yes"/"proceed", you MUST call search_quotes
3. Every affirmative after a question = call the next tool in the flow
4. Do NOT just acknowledge with "ok" or "great" without calling the appropriate tool`;

export async function handleVoiceChatStable(clientWs: WebSocket, emailId: string) {
  console.log(`[VoiceChatStable] New connection for ${emailId}`);
  
  const aiClient = getAIClient();
  if (!aiClient) {
    console.error("[VoiceChatStable] GOOGLE_API_KEY not configured");
    clientWs.send(JSON.stringify({
      type: "error",
      message: "Voice service not configured.",
    }));
    clientWs.close();
    return;
  }
  
  let availableVehicles: VehiclePolicyWithDetails[] = [];
  let selectedVehicle: VehiclePolicyWithDetails | null = null;
  let displayedQuotes: { insurer_name: string; policy_cost: number }[] = [];
  let selectedQuote: { insurer_name: string; price: number } | null = null;
  let showingPaymentCard = false;
  let conversationHistory: Content[] = [];
  
  async function executeGetUserVehicles() {
    try {
      const vehicles = await storage.getVehiclePoliciesByEmail(emailId);
      console.log(`[VoiceChatStable] get_user_vehicles: Found ${vehicles.length} vehicles`);
      availableVehicles = vehicles;
      
      if (vehicles.length === 0) {
        return { success: false, vehicle_count: 0, message: "No vehicles found." };
      }
      
      if (vehicles.length === 1) {
        selectedVehicle = vehicles[0];
        sendQuoteDetailsForConfirmation(selectedVehicle);
        return {
          success: true,
          vehicle_count: 1,
          selected_vehicle_id: selectedVehicle.policy_id,
          vehicles: [{ id: selectedVehicle.policy_id, description: `${selectedVehicle.details.vehicle_manufacturer_name} ${selectedVehicle.details.vehicle_model}` }],
          message: `Found 1 vehicle: ${selectedVehicle.details.vehicle_manufacturer_name} ${selectedVehicle.details.vehicle_model}. Details shown on screen. If user says yes/proceed/go ahead/looks good, IMMEDIATELY call search_quotes.`
        };
      }
      
      const vehiclesList = vehicles.map((v, i) => ({
        id: v.policy_id,
        description: `${i + 1}. ${v.details.vehicle_manufacturer_name} ${v.details.vehicle_model}`
      }));
      
      clientWs.send(JSON.stringify({
        type: "show_vehicle_selection",
        vehicles: vehicles.map((v, i) => ({
          policy_id: v.policy_id,
          vehicle_registration_number: v.details.vehicle_registration_number,
          vehicle_manufacturer_name: v.details.vehicle_manufacturer_name,
          vehicle_model: v.details.vehicle_model,
          vehicle_year: v.details.vehicle_year,
        })),
      }));
      
      return {
        success: true,
        vehicle_count: vehicles.length,
        vehicles: vehiclesList,
        message: `Found ${vehicles.length} vehicles. Ask which one they want quotes for.`
      };
    } catch (error) {
      console.error("[VoiceChatStable] get_user_vehicles error:", error);
      return { success: false, vehicle_count: 0, message: "Error fetching vehicles" };
    }
  }
  
  function sendQuoteDetailsForConfirmation(vehicle: VehiclePolicyWithDetails) {
    const quoteDetails = {
      email_id: emailId,
      driver_age: vehicle.details.driver_age,
      vehicle_registration_number: vehicle.details.vehicle_registration_number,
      vehicle_manufacturer_name: vehicle.details.vehicle_manufacturer_name,
      vehicle_model: vehicle.details.vehicle_model,
      vehicle_year: vehicle.details.vehicle_year,
      type_of_fuel: vehicle.details.type_of_fuel,
      type_of_cover_needed: vehicle.details.type_of_cover_needed,
      no_claim_bonus_years: vehicle.details.no_claim_bonus_years,
      voluntary_excess: vehicle.details.voluntary_excess,
      current_insurance_provider: vehicle.current_insurance_provider,
      policy_id: vehicle.policy_id,
      policy_type: vehicle.policy_type,
      policy_end_date: vehicle.policy_end_date,
      policy_number: vehicle.policy_number,
      whisper_preferences: vehicle.whisper_preferences || "",
    };
    
    clientWs.send(JSON.stringify({
      type: "show_quote_details",
      details: quoteDetails,
    }));
  }
  
  async function executeSearchQuotes(vehicleId: string) {
    try {
      let vehicle = availableVehicles.find(v => v.policy_id === vehicleId);
      if (!vehicle && availableVehicles.length === 1) vehicle = availableVehicles[0];
      if (!vehicle && selectedVehicle) vehicle = selectedVehicle;
      
      if (!vehicle) {
        return { success: false, message: "Vehicle not found. Ask user to select a vehicle." };
      }
      
      selectedVehicle = vehicle;
      console.log(`[VoiceChatStable] search_quotes: Triggering search for ${vehicle.details.vehicle_registration_number}`);
      
      clientWs.send(JSON.stringify({
        type: "trigger_quote_search",
        vehicle: vehicle,
      }));
      
      return { 
        success: true, 
        message: `Searching quotes for ${vehicle.details.vehicle_manufacturer_name} ${vehicle.details.vehicle_model}. Results will appear on screen shortly.`
      };
    } catch (error) {
      console.error("[VoiceChatStable] search_quotes error:", error);
      return { success: false, message: "Error searching quotes" };
    }
  }
  
  async function executeGetAvailableQuotes() {
    console.log(`[VoiceChatStable] get_available_quotes: ${displayedQuotes.length} quotes`);
    
    if (displayedQuotes.length === 0) {
      return { success: false, quote_count: 0, message: "No quotes available yet. Call search_quotes first." };
    }
    
    const quotes = displayedQuotes.slice(0, 10).map((q, i) => ({
      position: i + 1,
      insurer: q.insurer_name,
      price: q.policy_cost
    }));
    
    const summary = quotes.map(q => `${q.position}. ${q.insurer}: £${q.price}`).join(", ");
    
    return {
      success: true,
      quote_count: displayedQuotes.length,
      quotes: quotes,
      message: `Available quotes: ${summary}.`
    };
  }
  
  async function executeSelectQuote(selection: string) {
    console.log(`[VoiceChatStable] select_quote: selection="${selection}"`);
    
    if (displayedQuotes.length === 0) {
      return { success: false, message: "No quotes available. Call search_quotes first." };
    }
    
    const selectionLower = (selection || "").toLowerCase();
    let quote = null;
    
    const ordinalPatterns: { pattern: RegExp; index: number }[] = [
      { pattern: /\b(first|1st|cheapest|best|top|number\s*one)\b/, index: 0 },
      { pattern: /\b(second|2nd|number\s*two)\b/, index: 1 },
      { pattern: /\b(third|3rd)\b/, index: 2 },
    ];
    
    for (const { pattern, index } of ordinalPatterns) {
      if (pattern.test(selectionLower) && index < displayedQuotes.length) {
        quote = displayedQuotes[index];
        break;
      }
    }
    
    if (!quote) {
      quote = displayedQuotes.find(q => {
        const qLower = q.insurer_name.toLowerCase();
        return qLower.includes(selectionLower) || selectionLower.includes(qLower);
      }) || null;
    }
    
    if (!quote) {
      const availableQuotes = displayedQuotes.slice(0, 5).map(q => `${q.insurer_name}: £${q.policy_cost}`);
      return { 
        success: false,
        available_quotes: availableQuotes,
        message: `Could not find "${selection}". Available: ${availableQuotes.join(", ")}.`
      };
    }
    
    selectedQuote = { insurer_name: quote.insurer_name, price: quote.policy_cost };
    
    clientWs.send(JSON.stringify({
      type: "quote_selected",
      insurer: selectedQuote.insurer_name,
      price: selectedQuote.price,
    }));
    
    return { 
      success: true,
      insurer_name: selectedQuote.insurer_name,
      price: selectedQuote.price,
      message: `Selected ${selectedQuote.insurer_name} at £${selectedQuote.price}. Ask user to confirm: "Just to confirm - you'd like ${selectedQuote.insurer_name} at £${selectedQuote.price}?". If user says yes/yeah/yep/proceed, IMMEDIATELY call show_payment.`
    };
  }
  
  async function executeShowPayment() {
    console.log(`[VoiceChatStable] show_payment, quote:`, selectedQuote);
    
    if (!selectedQuote) {
      return { success: false, message: "No quote selected. Call select_quote first." };
    }
    
    showingPaymentCard = true;
    
    clientWs.send(JSON.stringify({
      type: "show_payment_card",
      insurer: selectedQuote.insurer_name,
      price: selectedQuote.price,
    }));
    
    return { 
      success: true,
      insurer_name: selectedQuote.insurer_name,
      price: selectedQuote.price,
      message: `Payment card shown for ${selectedQuote.insurer_name} at £${selectedQuote.price}. Wait for user to say "confirm payment" or "pay now".`
    };
  }
  
  async function executeCompletePurchase() {
    console.log(`[VoiceChatStable] complete_purchase`);
    
    if (!selectedVehicle) {
      return { success: false, message: "No vehicle selected." };
    }
    
    if (!selectedQuote) {
      return { success: false, message: "No quote selected." };
    }
    
    const insurer = selectedQuote.insurer_name;
    const amount = selectedQuote.price;
    const registration = selectedVehicle.details.vehicle_registration_number;
    
    try {
      clientWs.send(JSON.stringify({ type: "purchase_confirmed", insurer, price: amount }));
      
      clientWs.send(JSON.stringify({ type: "purchase_status", status: "Processing payment...", step: 1 }));
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      clientWs.send(JSON.stringify({ type: "purchase_status", status: "Verifying details...", step: 2 }));
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      clientWs.send(JSON.stringify({ type: "purchase_status", status: `Contacting ${insurer}...`, step: 3 }));
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      const purchaseData = {
        email_id: emailId,
        vehicle_registration_number: registration,
        insurer_name: insurer,
        policy_cost: amount,
      };
      
      const newPolicy = await storage.purchasePolicy(purchaseData);
      console.log("[VoiceChatStable] Purchase successful:", newPolicy);
      
      clientWs.send(JSON.stringify({
        type: "purchase_complete",
        success: true,
        insurer: insurer,
        price: amount,
        policy: newPolicy,
      }));
      
      selectedQuote = null;
      displayedQuotes = [];
      showingPaymentCard = false;
      
      return { 
        success: true,
        policy_id: newPolicy.policy_id,
        message: `Purchase complete! New policy with ${insurer} at £${amount}/year is now active. Congratulate the user.`
      };
    } catch (error) {
      console.error("[VoiceChatStable] Purchase error:", error);
      clientWs.send(JSON.stringify({ type: "purchase_error", message: "Purchase failed" }));
      return { success: false, message: "Purchase failed." };
    }
  }
  
  async function executeCancelFlow() {
    console.log("[VoiceChatStable] cancel_flow");
    clientWs.send(JSON.stringify({ type: "purchase_cancelled" }));
    selectedQuote = null;
    showingPaymentCard = false;
    return { success: true, message: "Cancelled. Ask user what they'd like to do." };
  }
  
  async function executeTool(name: string, args: Record<string, unknown>): Promise<unknown> {
    console.log(`[VoiceChatStable] Executing tool: ${name}`, args);
    
    switch (name) {
      case "get_user_vehicles": return await executeGetUserVehicles();
      case "search_quotes": return await executeSearchQuotes((args.vehicle_id as string) || "");
      case "get_available_quotes": return await executeGetAvailableQuotes();
      case "select_quote": return await executeSelectQuote((args.selection as string) || "");
      case "show_payment": return await executeShowPayment();
      case "complete_purchase": return await executeCompletePurchase();
      case "cancel_flow": return await executeCancelFlow();
      default: return { success: false, message: `Unknown tool: ${name}` };
    }
  }
  
  function cleanResponseText(text: string): string {
    let cleaned = text
      .replace(/```tool_outputs[\s\S]*?```/g, '')
      .replace(/```[\s\S]*?```/g, '')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
    return cleaned;
  }
  
  async function processUserMessage(userText: string): Promise<string> {
    console.log(`[VoiceChatStable] Processing: "${userText}"`);
    
    conversationHistory.push({
      role: "user",
      parts: [{ text: userText }]
    });
    
    try {
      let response = await aiClient!.models.generateContent({
        model: MODEL,
        contents: conversationHistory,
        config: {
          systemInstruction: SYSTEM_INSTRUCTION,
          tools: [{ functionDeclarations: TOOL_DECLARATIONS }],
          toolConfig: {
            functionCallingConfig: {
              mode: FunctionCallingConfigMode.AUTO
            }
          }
        }
      });
      
      console.log(`[VoiceChatStable] Gemini response:`, JSON.stringify(response.candidates?.[0]?.content?.parts, null, 2));
      
      let assistantResponse = "";
      
      while (true) {
        const candidate = response.candidates?.[0];
        if (!candidate?.content?.parts) break;
        
        const functionCalls: FunctionCall[] = [];
        let textParts: string[] = [];
        
        for (const part of candidate.content.parts) {
          if (part.functionCall) {
            functionCalls.push(part.functionCall);
          } else if (part.text) {
            textParts.push(part.text);
          }
        }
        
        if (functionCalls.length === 0) {
          const userLower = userText.toLowerCase();
          let forcedTool: string | null = null;
          let forcedArgs: Record<string, unknown> = {};
          
          if (availableVehicles.length === 0 && 
              (userLower.includes("insure") || userLower.includes("quote") || 
               userLower.includes("tesla") || userLower.includes("car") ||
               userLower.includes("vehicle") || userLower.includes("insurance"))) {
            forcedTool = "get_user_vehicles";
            console.log(`[VoiceChatStable] FALLBACK: Forcing get_user_vehicles for "${userText}"`);
          } else if (selectedVehicle && displayedQuotes.length === 0 && 
              (userLower.includes("yes") || userLower.includes("proceed") || 
               userLower.includes("go ahead") || userLower.includes("correct") ||
               userLower.includes("confirm") || userLower.includes("that's right"))) {
            forcedTool = "search_quotes";
            console.log(`[VoiceChatStable] FALLBACK: Forcing search_quotes for "${userText}"`);
          } else if (selectedQuote && !showingPaymentCard && 
              (userLower.includes("yes") || userLower.includes("yeah") || 
               userLower.includes("yep") || userLower.includes("proceed") ||
               userLower.includes("correct") || userLower.includes("that's the one"))) {
            forcedTool = "show_payment";
            console.log(`[VoiceChatStable] FALLBACK: Forcing show_payment for "${userText}"`);
          } else if (displayedQuotes.length > 0 && !selectedQuote) {
            const quoteMatch = displayedQuotes.find(q => 
              userLower.includes(q.insurer_name.toLowerCase())
            );
            if (quoteMatch) {
              forcedTool = "select_quote";
              forcedArgs = { selection: quoteMatch.insurer_name };
              console.log(`[VoiceChatStable] FALLBACK: Forcing select_quote for "${userText}"`);
            }
          }
          
          if (forcedTool) {
            const result = await executeTool(forcedTool, forcedArgs);
            
            conversationHistory.push({
              role: "model",
              parts: [{ functionCall: { name: forcedTool, args: forcedArgs } }]
            });
            
            conversationHistory.push({
              role: "user",
              parts: [{
                functionResponse: {
                  name: forcedTool,
                  response: result as Record<string, unknown>
                }
              }]
            });
            
            response = await aiClient!.models.generateContent({
              model: MODEL,
              contents: conversationHistory,
              config: {
                systemInstruction: SYSTEM_INSTRUCTION,
                tools: [{ functionDeclarations: TOOL_DECLARATIONS }],
                toolConfig: {
                  functionCallingConfig: {
                    mode: FunctionCallingConfigMode.AUTO
                  }
                }
              }
            });
            
            console.log(`[VoiceChatStable] Fallback follow-up:`, JSON.stringify(response.candidates?.[0]?.content?.parts, null, 2));
            continue;
          }
          
          assistantResponse = cleanResponseText(textParts.join(""));
          conversationHistory.push({
            role: "model",
            parts: [{ text: assistantResponse }]
          });
          break;
        }
        
        if (textParts.length > 0) {
          assistantResponse += cleanResponseText(textParts.join(""));
        }
        
        conversationHistory.push({
          role: "model",
          parts: candidate.content.parts
        });
        
        const functionResponses: Part[] = [];
        
        for (const fc of functionCalls) {
          console.log(`[VoiceChatStable] Tool call: ${fc.name}`, fc.args);
          const args = (fc.args || {}) as Record<string, unknown>;
          const result = await executeTool(fc.name!, args);
          functionResponses.push({
            functionResponse: {
              name: fc.name!,
              response: result as Record<string, unknown>
            }
          });
        }
        
        conversationHistory.push({
          role: "user",
          parts: functionResponses
        });
        
        response = await aiClient!.models.generateContent({
          model: MODEL,
          contents: conversationHistory,
          config: {
            systemInstruction: SYSTEM_INSTRUCTION,
            tools: [{ functionDeclarations: TOOL_DECLARATIONS }],
            toolConfig: {
              functionCallingConfig: {
                mode: FunctionCallingConfigMode.AUTO
              }
            }
          }
        });
        
        console.log(`[VoiceChatStable] Follow-up response:`, JSON.stringify(response.candidates?.[0]?.content?.parts, null, 2));
      }
      
      const finalResponse = cleanResponseText(assistantResponse);
      console.log(`[VoiceChatStable] Final response: "${finalResponse}"`);
      return finalResponse;
    } catch (error) {
      console.error("[VoiceChatStable] Error:", error);
      return "I'm sorry, I'm having trouble processing that. Could you please try again?";
    }
  }
  
  clientWs.send(JSON.stringify({ type: "session_ready" }));
  
  const greeting = "Hello! I'm Annie, your insurance assistant. How can I help you with your insurance today?";
  conversationHistory.push({
    role: "model",
    parts: [{ text: greeting }]
  });
  
  clientWs.send(JSON.stringify({
    type: "assistant_response",
    text: greeting,
  }));
  
  clientWs.on("message", async (data) => {
    try {
      const message = JSON.parse(data.toString());
      
      if (message.type === "user_message" && message.text) {
        const userText = message.text.trim();
        if (!userText) return;
        
        console.log(`[VoiceChatStable] User said: "${userText}"`);
        
        const response = await processUserMessage(userText);
        
        clientWs.send(JSON.stringify({
          type: "assistant_response",
          text: response,
        }));
      }
      
      if (message.type === "select_vehicle" && typeof message.index === "number") {
        console.log(`[VoiceChatStable] Client selected vehicle index: ${message.index}`);
        if (message.index < availableVehicles.length) {
          selectedVehicle = availableVehicles[message.index];
          sendQuoteDetailsForConfirmation(selectedVehicle);
        }
      }
      
      if (message.type === "confirm_quote_details") {
        console.log("[VoiceChatStable] Client confirmed quote details");
        if (selectedVehicle) {
          clientWs.send(JSON.stringify({
            type: "trigger_quote_search",
            vehicle: selectedVehicle,
          }));
        }
      }
      
      if (message.type === "quote_results" && message.quotes) {
        console.log(`[VoiceChatStable] Received ${message.quotes.length} quotes`);
        displayedQuotes = message.quotes.map((q: { insurer_name: string; policy_cost: number }) => ({
          insurer_name: q.insurer_name,
          policy_cost: q.policy_cost
        }));
        
        if (displayedQuotes.length > 0) {
          const summary = displayedQuotes.slice(0, 3).map((q, i) => `${i + 1}. ${q.insurer_name}: £${q.policy_cost}`).join(", ");
          console.log(`[VoiceChatStable] Quotes: ${summary}`);
          
          const quotesMessage = `I found ${displayedQuotes.length} quotes for you. The top options are: ${summary}. Which one would you like to go with?`;
          
          conversationHistory.push({
            role: "model",
            parts: [{ text: quotesMessage }]
          });
          
          clientWs.send(JSON.stringify({
            type: "assistant_response",
            text: quotesMessage,
          }));
        }
      }
      
      if (message.type === "select_quote_from_client" && message.insurer && message.price) {
        console.log(`[VoiceChatStable] Client selected: ${message.insurer} at £${message.price}`);
        selectedQuote = { insurer_name: message.insurer, price: message.price };
        clientWs.send(JSON.stringify({
          type: "quote_selected",
          insurer: message.insurer,
          price: message.price,
        }));
      }
      
    } catch (error) {
      console.error("[VoiceChatStable] Error processing message:", error);
    }
  });
  
  clientWs.on("close", () => {
    console.log("[VoiceChatStable] Client disconnected");
  });
  
  clientWs.on("error", (error) => {
    console.error("[VoiceChatStable] WebSocket error:", error);
  });
}
