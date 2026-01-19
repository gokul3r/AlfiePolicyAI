import WebSocket from "ws";
import { GoogleGenAI, Modality, Session, LiveConnectConfig, LiveServerMessage, FunctionDeclaration, Type, Tool } from "@google/genai";
import { storage } from "./storage";
import { VehiclePolicyWithDetails } from "@shared/schema";

const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY;

// Simple vehicle type for client display
export interface VehicleForDisplay {
  policy_id: string;
  vehicle_registration_number: string;
  vehicle_manufacturer_name: string;
  vehicle_model: string;
  vehicle_year: number;
}

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

// Native audio model for voice chat with function calling support
const MODEL = "gemini-2.5-flash-native-audio-preview-12-2025";

// Define the tools/functions that Annie can call
const TOOL_DECLARATIONS: FunctionDeclaration[] = [
  {
    name: "get_user_vehicles",
    description: "Retrieves the list of vehicles registered to the current user. Call this when the user asks about insurance quotes, wants to compare prices, or mentions their vehicle. This will show the vehicle details on the user's screen.",
    parameters: {
      type: Type.OBJECT,
      properties: {},
      required: []
    }
  },
  {
    name: "search_quotes",
    description: "Searches for insurance quotes for a specific vehicle. Call this after the user has confirmed they want quotes for a vehicle. The results will be displayed on the user's screen.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        vehicle_id: {
          type: Type.STRING,
          description: "The policy_id of the vehicle to search quotes for. If only one vehicle, can be omitted."
        }
      },
      required: []
    }
  },
  {
    name: "get_available_quotes",
    description: "Gets the list of currently available insurance quotes. Call this if you need to know what quotes are showing on the user's screen, or if user asks about the options.",
    parameters: {
      type: Type.OBJECT,
      properties: {},
      required: []
    }
  },
  {
    name: "select_quote",
    description: "Selects a specific insurance quote for purchase. Call this when the user indicates they want to go with a specific insurer. You can use insurer name OR ordinal (first, second, cheapest). The backend will resolve the exact quote and price.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        selection: {
          type: Type.STRING,
          description: "The insurer name or ordinal the user mentioned (e.g., 'Admiral', 'Baviva', 'first', 'cheapest', 'the second one')"
        }
      },
      required: ["selection"]
    }
  },
  {
    name: "show_payment",
    description: "Shows the payment confirmation UI to the user. Call this after the user has confirmed they want to proceed with the selected quote (e.g., 'yes', 'proceed', 'confirm'). Uses the previously selected quote.",
    parameters: {
      type: Type.OBJECT,
      properties: {},
      required: []
    }
  },
  {
    name: "complete_purchase",
    description: "Completes the insurance policy purchase. Call this ONLY after the user has explicitly confirmed the payment (e.g., 'confirm payment', 'pay now', 'complete the purchase'). Uses the previously selected quote and vehicle.",
    parameters: {
      type: Type.OBJECT,
      properties: {},
      required: []
    }
  },
  {
    name: "cancel_flow",
    description: "Cancels the current quote search or purchase flow. Call this when the user says they want to cancel, go back, or change their mind.",
    parameters: {
      type: Type.OBJECT,
      properties: {},
      required: []
    }
  }
];

const TOOLS: Tool[] = [
  {
    functionDeclarations: TOOL_DECLARATIONS
  }
];

const SYSTEM_INSTRUCTION = `You are Annie, a warm and friendly female insurance assistant with a British accent. You work for AutoAnnie, helping users find the best insurance quotes.

PERSONALITY:
- Warm, friendly, and reassuring
- Professional but approachable
- Helpful and patient
- Uses British English spellings and expressions

YOUR TOOLS (always use these to take actions):
- get_user_vehicles: Fetch user's registered vehicles - call this when user mentions quotes/insurance
- search_quotes: Search for quotes - call after user confirms vehicle, vehicle_id is optional for single vehicle
- get_available_quotes: Get list of current quotes - call if you need to know available options
- select_quote(selection): Select a quote - pass the insurer name or ordinal user mentioned (e.g., "Admiral", "first", "cheapest")
- show_payment: Show payment UI - call after user confirms quote selection (e.g., "yes", "proceed")
- complete_purchase: Complete the purchase - call ONLY after explicit payment confirmation
- cancel_flow: Cancel current operation

RESPONSE STYLE:
- Keep responses concise (1-2 sentences)
- Be conversational and warm
- Avoid technical jargon

IMPORTANT: Greet the user with: "Hello! I'm Annie, your insurance assistant. How can I help you with your insurance today?"

QUOTE FLOW - USE YOUR TOOLS:
1. User asks for quotes (mentions "quote", "insurance", "price", "cheaper", vehicle, etc.):
   - Call get_user_vehicles
   - Say: "I'm pulling up your vehicle details now."

2. User confirms vehicle (says "yes", "looks good", "correct", "proceed"):
   - Call search_quotes (vehicle_id optional if single vehicle)
   - Say: "Searching for the best quotes now..."
   - The tool response will tell you the quotes are being searched

3. User selects a quote (says "go with Baviva", "first one", "cheapest"):
   - Call select_quote with their selection as the 'selection' parameter
   - The tool will find the matching quote and return the exact insurer name and price
   - Confirm with user: "Just to confirm - you'd like [insurer] at £[price]?"

4. User confirms selection (says "yes", "proceed", "confirm"):
   - Call show_payment (no parameters needed - uses selected quote)
   - Say: "Showing payment details on your screen now."

5. User confirms PAYMENT (says "confirm payment", "pay now", "complete purchase", "do it"):
   - Call complete_purchase (no parameters needed - uses stored state)
   - Say: "Processing your policy switch now..."

6. User cancels (says "no", "cancel", "wait", "stop"):
   - Call cancel_flow
   - Say: "No problem, I've cancelled that."

CRITICAL RULES:
- ALWAYS call your tools to take actions - don't just talk about doing things
- The backend stores the state (selected vehicle, selected quote) - your tools use this state
- For select_quote, just pass what the user said (e.g., "Admiral", "the first one", "cheapest")
- Payment confirmation requires explicit payment words ("pay", "purchase", "complete")
- If unsure which quote user wants, call get_available_quotes to see options`;

const GREETING_TEXT = "Hello! I'm Annie, your insurance assistant. How can I help you with your insurance today?";

export async function handleVoiceChat(clientWs: WebSocket, emailId: string) {
  console.log(`[VoiceChatGemini] New connection for ${emailId} - AGENT MODE`);
  
  const aiClient = getAIClient();
  if (!aiClient) {
    console.error("[VoiceChatGemini] Cannot start voice chat: GOOGLE_API_KEY not configured");
    clientWs.send(JSON.stringify({
      type: "error",
      message: "Voice service not configured. Please add GOOGLE_API_KEY.",
    }));
    clientWs.close();
    return;
  }
  
  let session: Session | null = null;
  let hasGreeted = false;
  let isClosing = false;
  let currentAssistantTranscript = "";
  let currentUserTranscript = "";
  
  // State for context (shared with tool handlers)
  let availableVehicles: VehiclePolicyWithDetails[] = [];
  let selectedVehicle: VehiclePolicyWithDetails | null = null;
  let displayedQuotes: { insurer_name: string; policy_cost: number; quote_reference_number?: string }[] = [];
  let selectedQuote: { insurer_name: string; price: number } | null = null;
  
  // Tool execution handlers
  async function executeGetUserVehicles(): Promise<{ 
    success: boolean; 
    vehicle_count: number;
    selected_vehicle_id?: string;
    vehicles?: { id: string; description: string }[];
    message: string 
  }> {
    try {
      const vehicles = await storage.getVehiclePoliciesByEmail(emailId);
      console.log(`[VoiceChatGemini] get_user_vehicles: Found ${vehicles.length} vehicles`);
      availableVehicles = vehicles;
      
      if (vehicles.length === 0) {
        clientWs.send(JSON.stringify({
          type: "no_vehicles_found",
          message: "No registered vehicles found."
        }));
        return { success: false, vehicle_count: 0, message: "No vehicles registered. Please add a policy first." };
      }
      
      // Convert to simplified format for Gemini
      const vehiclesList = vehicles.map((v, i) => ({
        id: v.policy_id,
        description: `${i + 1}. ${v.details.vehicle_manufacturer_name} ${v.details.vehicle_model} (${v.details.vehicle_registration_number})`
      }));
      
      // If single vehicle, auto-select it and show quote details
      if (vehicles.length === 1) {
        selectedVehicle = vehicles[0];
        sendQuoteDetailsForConfirmation(vehicles[0]);
        return { 
          success: true,
          vehicle_count: 1,
          selected_vehicle_id: vehicles[0].policy_id,
          vehicles: vehiclesList,
          message: `Found 1 vehicle: ${vehicles[0].details.vehicle_manufacturer_name} ${vehicles[0].details.vehicle_model}. It is automatically selected and details are shown on screen. When user confirms, call search_quotes with vehicle_id: "${vehicles[0].policy_id}".`
        };
      }
      
      // Multiple vehicles - show list and let user choose
      clientWs.send(JSON.stringify({
        type: "show_vehicle_list",
        vehicles: vehicles.map(v => ({
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
        message: `Found ${vehicles.length} vehicles. Ask which one they want quotes for. Use the vehicle_id when calling search_quotes.`
      };
    } catch (error) {
      console.error("[VoiceChatGemini] get_user_vehicles error:", error);
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
  
  async function executeSearchQuotes(vehicleId: string): Promise<{ success: boolean; message: string }> {
    try {
      // Find the vehicle
      let vehicle = availableVehicles.find(v => v.policy_id === vehicleId);
      
      // If not found by ID, try first vehicle if only one available
      if (!vehicle && availableVehicles.length === 1) {
        vehicle = availableVehicles[0];
      }
      
      // If still not found, use selectedVehicle
      if (!vehicle && selectedVehicle) {
        vehicle = selectedVehicle;
      }
      
      if (!vehicle) {
        return { success: false, message: "Vehicle not found. Please ask user to select a vehicle." };
      }
      
      selectedVehicle = vehicle;
      console.log(`[VoiceChatGemini] search_quotes: Triggering search for ${vehicle.details.vehicle_registration_number}`);
      
      // Trigger quote search on client
      clientWs.send(JSON.stringify({
        type: "trigger_quote_search",
        vehicle: vehicle,
      }));
      
      return { 
        success: true, 
        message: `Searching quotes for ${vehicle.details.vehicle_manufacturer_name} ${vehicle.details.vehicle_model}. Results will appear on the user's screen shortly. Tell the user you're searching and they'll see results soon.`
      };
    } catch (error) {
      console.error("[VoiceChatGemini] search_quotes error:", error);
      return { success: false, message: "Error searching quotes" };
    }
  }
  
  // Get available quotes tool
  async function executeGetAvailableQuotes(): Promise<{
    success: boolean;
    quote_count: number;
    quotes?: { position: number; insurer: string; price: number }[];
    message: string;
  }> {
    console.log(`[VoiceChatGemini] get_available_quotes: ${displayedQuotes.length} quotes available`);
    
    if (displayedQuotes.length === 0) {
      return {
        success: false,
        quote_count: 0,
        message: "No quotes available yet. Call search_quotes first to get quotes."
      };
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
      message: `Available quotes: ${summary}. The first quote is the best match based on user preferences.`
    };
  }
  
  async function executeSelectQuote(selection: string): Promise<{ 
    success: boolean; 
    insurer_name?: string;
    price?: number;
    available_quotes?: string[];
    message: string 
  }> {
    console.log(`[VoiceChatGemini] select_quote: selection="${selection}"`);
    
    // If no quotes available, return error with helpful message
    if (displayedQuotes.length === 0) {
      return { 
        success: false, 
        message: "No quotes available. Call search_quotes first to get quotes."
      };
    }
    
    const selectionLower = (selection || "").toLowerCase();
    let quote = null;
    
    // First try ordinal matching (first, second, third, cheapest, best)
    const ordinalPatterns: { pattern: RegExp; index: number }[] = [
      { pattern: /\b(first|1st|cheapest|best|top|number\s*one|number\s*1)\b/, index: 0 },
      { pattern: /\b(second|2nd|number\s*two|number\s*2)\b/, index: 1 },
      { pattern: /\b(third|3rd|number\s*three|number\s*3)\b/, index: 2 },
      { pattern: /\b(fourth|4th)\b/, index: 3 },
      { pattern: /\b(fifth|5th)\b/, index: 4 },
    ];
    
    for (const { pattern, index } of ordinalPatterns) {
      if (pattern.test(selectionLower) && index < displayedQuotes.length) {
        quote = displayedQuotes[index];
        console.log(`[VoiceChatGemini] Matched by ordinal: position ${index + 1}`);
        break;
      }
    }
    
    // If no ordinal match, try fuzzy name matching
    if (!quote) {
      quote = displayedQuotes.find(q => {
        const qLower = q.insurer_name.toLowerCase();
        // Partial match in either direction
        return qLower.includes(selectionLower) || selectionLower.includes(qLower);
      }) || null;
      if (quote) {
        console.log(`[VoiceChatGemini] Matched by name: ${quote.insurer_name}`);
      }
    }
    
    // If still no match, return available options
    if (!quote) {
      const availableQuotes = displayedQuotes.slice(0, 5).map(q => `${q.insurer_name}: £${q.policy_cost}`);
      return { 
        success: false,
        available_quotes: availableQuotes,
        message: `Could not find a quote matching "${selection}". Available quotes: ${availableQuotes.join(", ")}. Ask user to clarify which one they want.`
      };
    }
    
    selectedQuote = { insurer_name: quote.insurer_name, price: quote.policy_cost };
    
    // Notify client
    clientWs.send(JSON.stringify({
      type: "quote_selected",
      insurer: selectedQuote.insurer_name,
      price: selectedQuote.price,
    }));
    
    return { 
      success: true,
      insurer_name: selectedQuote.insurer_name,
      price: selectedQuote.price,
      message: `Selected ${selectedQuote.insurer_name} at £${selectedQuote.price}. Confirm with user: "Just to confirm - you'd like ${selectedQuote.insurer_name} at £${selectedQuote.price}?"`
    };
  }
  
  async function executeShowPayment(): Promise<{ success: boolean; insurer_name?: string; price?: number; message: string }> {
    console.log(`[VoiceChatGemini] show_payment called, selectedQuote:`, selectedQuote);
    
    // Validate we have a selected quote
    if (!selectedQuote) {
      return { 
        success: false, 
        message: "No quote selected. Call select_quote first to select a quote before showing payment."
      };
    }
    
    // Notify client to show payment card
    clientWs.send(JSON.stringify({
      type: "show_payment_card",
      insurer: selectedQuote.insurer_name,
      price: selectedQuote.price,
    }));
    
    return { 
      success: true,
      insurer_name: selectedQuote.insurer_name,
      price: selectedQuote.price,
      message: `Payment card for ${selectedQuote.insurer_name} at £${selectedQuote.price} is now shown. Wait for user to confirm payment with phrases like "confirm payment", "pay now", or "complete purchase" before calling complete_purchase.`
    };
  }
  
  async function executeCompletePurchase(): Promise<{ success: boolean; policy_id?: string; message: string }> {
    console.log(`[VoiceChatGemini] complete_purchase called, vehicle:`, selectedVehicle?.details?.vehicle_registration_number, `quote:`, selectedQuote);
    
    // Validate required state
    if (!selectedVehicle) {
      return { success: false, message: "No vehicle selected. Call get_user_vehicles first." };
    }
    
    if (!selectedQuote) {
      return { success: false, message: "No quote selected. Call select_quote first to select a quote." };
    }
    
    const insurer = selectedQuote.insurer_name;
    const amount = selectedQuote.price;
    const registration = selectedVehicle.details.vehicle_registration_number;
    
    try {
      // Notify client that purchase is starting
      clientWs.send(JSON.stringify({
        type: "purchase_confirmed",
        insurer: insurer,
        price: amount,
      }));
      
      // Status updates
      clientWs.send(JSON.stringify({
        type: "purchase_status",
        status: "Processing payment...",
        step: 1
      }));
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      clientWs.send(JSON.stringify({
        type: "purchase_status",
        status: "Verifying details...",
        step: 2
      }));
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      clientWs.send(JSON.stringify({
        type: "purchase_status",
        status: `Contacting ${insurer}...`,
        step: 3
      }));
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      // Make the actual purchase
      const purchaseData = {
        email_id: emailId,
        vehicle_registration_number: registration,
        insurer_name: insurer,
        policy_cost: amount,
      };
      
      const newPolicy = await storage.purchasePolicy(purchaseData);
      console.log("[VoiceChatGemini] Purchase successful:", newPolicy);
      
      // Send success
      clientWs.send(JSON.stringify({
        type: "purchase_complete",
        success: true,
        insurer: insurer,
        price: amount,
        policy: newPolicy,
      }));
      
      // Reset state
      selectedQuote = null;
      displayedQuotes = [];
      
      return { 
        success: true,
        policy_id: newPolicy.policy_id,
        message: `Purchase complete! The user's new policy with ${insurer} at £${amount}/year is now active. Congratulate them and ask if there's anything else you can help with.`
      };
    } catch (error) {
      console.error("[VoiceChatGemini] Purchase error:", error);
      clientWs.send(JSON.stringify({
        type: "purchase_error",
        message: error instanceof Error ? error.message : "Purchase failed",
      }));
      return { success: false, message: "Purchase failed. Please ask the user to try again." };
    }
  }
  
  async function executeCancelFlow(): Promise<{ success: boolean; message: string }> {
    console.log("[VoiceChatGemini] cancel_flow called");
    
    clientWs.send(JSON.stringify({
      type: "purchase_cancelled",
    }));
    
    selectedQuote = null;
    
    return { 
      success: true, 
      message: "Flow cancelled. Ask the user what they'd like to do instead."
    };
  }
  
  // Execute a tool call and return the result
  async function executeTool(name: string, args: Record<string, unknown>): Promise<unknown> {
    console.log(`[VoiceChatGemini] Executing tool: ${name}`, args);
    
    switch (name) {
      case "get_user_vehicles":
        return await executeGetUserVehicles();
        
      case "search_quotes":
        return await executeSearchQuotes((args.vehicle_id as string) || "");
        
      case "get_available_quotes":
        return await executeGetAvailableQuotes();
        
      case "select_quote":
        return await executeSelectQuote((args.selection as string) || "");
        
      case "show_payment":
        return await executeShowPayment();
        
      case "complete_purchase":
        return await executeCompletePurchase();
        
      case "cancel_flow":
        return await executeCancelFlow();
        
      default:
        console.warn(`[VoiceChatGemini] Unknown tool: ${name}`);
        return { success: false, message: `Unknown tool: ${name}` };
    }
  }
  
  const config: LiveConnectConfig = {
    responseModalities: [Modality.AUDIO],
    systemInstruction: SYSTEM_INSTRUCTION,
    speechConfig: {
      voiceConfig: {
        prebuiltVoiceConfig: {
          voiceName: "Aoede"
        }
      }
    },
    tools: TOOLS,
    inputAudioTranscription: {},
    outputAudioTranscription: {}
  };

  let greetingTimeout: NodeJS.Timeout | null = null;
  
  const sendGreeting = () => {
    if (hasGreeted || !session) return;
    hasGreeted = true;
    
    console.log("[VoiceChatGemini] Triggering greeting");
    
    greetingTimeout = setTimeout(() => {
      if (currentAssistantTranscript.length === 0 && !isClosing) {
        console.log("[VoiceChatGemini] Greeting timeout - sending fallback");
        clientWs.send(JSON.stringify({
          type: "turn_complete",
          userTranscript: "",
          assistantTranscript: GREETING_TEXT,
        }));
      }
    }, 5000);
    
    session.sendClientContent({
      turns: [
        {
          role: "user",
          parts: [{ text: "Start the conversation by greeting me." }]
        }
      ],
      turnComplete: true
    });
  };

  const handleServerMessage = async (message: LiveServerMessage) => {
    if (isClosing) return;
    
    try {
      // Handle audio output
      if (message.serverContent?.modelTurn?.parts) {
        for (const part of message.serverContent.modelTurn.parts) {
          if (part.inlineData?.data) {
            const audioData = typeof part.inlineData.data === "string" 
              ? part.inlineData.data 
              : Buffer.from(part.inlineData.data).toString("base64");
            
            clientWs.send(JSON.stringify({
              type: "audio",
              audio: audioData,
            }));
          }
        }
      }
      
      // Handle user transcript
      if (message.serverContent?.inputTranscription?.text) {
        const userText = message.serverContent.inputTranscription.text;
        currentUserTranscript += userText;
        console.log(`[VoiceChatGemini] User said (fragment): ${userText}`);
        clientWs.send(JSON.stringify({
          type: "user_transcript_delta",
          delta: userText,
        }));
      }
      
      // Handle assistant transcript
      if (message.serverContent?.outputTranscription?.text) {
        const assistantText = message.serverContent.outputTranscription.text;
        currentAssistantTranscript += assistantText;
        console.log(`[VoiceChatGemini] Assistant said (fragment): ${assistantText}`);
        clientWs.send(JSON.stringify({
          type: "assistant_transcript_delta",
          delta: assistantText,
        }));
      }
      
      // Handle tool calls from Gemini
      if (message.toolCall) {
        console.log("[VoiceChatGemini] Tool call received:", JSON.stringify(message.toolCall));
        
        const functionCalls = message.toolCall.functionCalls || [];
        const functionResponses: { id: string; name: string; response: Record<string, unknown> }[] = [];
        
        for (const call of functionCalls) {
          if (!call.name || !call.id) {
            console.warn("[VoiceChatGemini] Skipping tool call with missing name or id");
            continue;
          }
          const result = await executeTool(call.name, call.args as Record<string, unknown>);
          functionResponses.push({
            id: call.id,
            name: call.name,
            response: result as Record<string, unknown>
          });
        }
        
        // Send tool responses back to Gemini
        if (functionResponses.length > 0 && session) {
          console.log("[VoiceChatGemini] Sending tool responses:", JSON.stringify(functionResponses));
          session.sendToolResponse({
            functionResponses: functionResponses
          });
        }
      }
      
      // Handle interruption
      if (message.serverContent?.interrupted) {
        console.log("[VoiceChatGemini] Response interrupted by user");
        currentAssistantTranscript = "";
      }
      
      // Handle turn complete
      if (message.serverContent?.turnComplete) {
        const userText = currentUserTranscript.trim();
        const assistantText = currentAssistantTranscript.trim();
        
        console.log(`[VoiceChatGemini] Turn complete. User: "${userText}", Assistant: "${assistantText}"`);
        
        if (greetingTimeout) {
          clearTimeout(greetingTimeout);
          greetingTimeout = null;
        }
        
        clientWs.send(JSON.stringify({
          type: "turn_complete",
          userTranscript: userText,
          assistantTranscript: assistantText,
        }));
        
        currentUserTranscript = "";
        currentAssistantTranscript = "";
      }
    } catch (error) {
      console.error("[VoiceChatGemini] Error handling message:", error);
    }
  };

  try {
    session = await aiClient.live.connect({
      model: MODEL,
      config: config,
      callbacks: {
        onopen: () => {
          console.log("[VoiceChatGemini] Connected to Gemini Live API (AGENT MODE with tools)");
          clientWs.send(JSON.stringify({ type: "session_ready" }));
          
          setTimeout(() => {
            sendGreeting();
          }, 500);
        },
        onmessage: (message: LiveServerMessage) => {
          handleServerMessage(message);
        },
        onerror: (error) => {
          console.error("[VoiceChatGemini] Gemini error:", error);
          if (!isClosing) {
            clientWs.send(JSON.stringify({
              type: "error",
              message: "Connection error with voice service",
            }));
          }
        },
        onclose: (event) => {
          console.log("[VoiceChatGemini] Gemini connection closed:", event?.reason || "unknown");
        },
      },
    });
  } catch (error) {
    console.error("[VoiceChatGemini] Failed to connect:", error);
    clientWs.send(JSON.stringify({
      type: "error",
      message: "Failed to connect to voice service",
    }));
    return;
  }

  clientWs.on("message", async (data: Buffer) => {
    if (!session || isClosing) return;
    
    try {
      const message = JSON.parse(data.toString());
      
      if (message.type === "audio" && message.audio) {
        try {
          session.sendRealtimeInput({
            audio: {
              data: message.audio,
              mimeType: "audio/pcm;rate=16000"
            }
          });
        } catch (error) {
          console.error("[VoiceChatGemini] Error sending audio:", error);
        }
      }
      
      // Handle vehicle selection from client (user clicked on a vehicle card)
      if (message.type === "select_vehicle" && typeof message.index === "number") {
        console.log(`[VoiceChatGemini] Client selected vehicle index: ${message.index}`);
        if (message.index < availableVehicles.length) {
          selectedVehicle = availableVehicles[message.index];
          sendQuoteDetailsForConfirmation(selectedVehicle);
        }
      }
      
      // Handle confirmation from client (user clicked confirm button)
      if (message.type === "confirm_quote_details") {
        console.log("[VoiceChatGemini] Client confirmed quote details, triggering search");
        if (selectedVehicle) {
          clientWs.send(JSON.stringify({
            type: "trigger_quote_search",
            vehicle: selectedVehicle,
          }));
        }
      }
      
      // Handle quote results from client (client received quotes from API)
      if (message.type === "quote_results" && message.quotes) {
        console.log(`[VoiceChatGemini] Received ${message.quotes.length} quote results from client`);
        displayedQuotes = message.quotes.map((q: { insurer_name: string; policy_cost: number; quote_reference_number?: string }) => ({
          insurer_name: q.insurer_name,
          policy_cost: q.policy_cost,
          quote_reference_number: q.quote_reference_number
        }));
        
        // Inform Gemini about the quotes through context injection
        if (session && displayedQuotes.length > 0) {
          const quotesSummary = displayedQuotes
            .slice(0, 5)
            .map((q, i) => `${i + 1}. ${q.insurer_name}: £${q.policy_cost}`)
            .join(", ");
          
          // Note: We don't sendClientContent here as it may crash the session
          // The quotes are displayed on UI and Annie will see user's selection
          console.log(`[VoiceChatGemini] Quotes available: ${quotesSummary}`);
        }
      }
      
      // Handle quote selection from client (user clicked on a quote card)
      if (message.type === "select_quote_from_client" && message.insurer && message.price) {
        console.log(`[VoiceChatGemini] Client selected quote: ${message.insurer} at £${message.price}`);
        selectedQuote = { insurer_name: message.insurer, price: message.price };
        
        clientWs.send(JSON.stringify({
          type: "quote_selected",
          insurer: message.insurer,
          price: message.price,
        }));
      }
      
    } catch (error) {
      console.error("[VoiceChatGemini] Error processing client message:", error);
    }
  });

  clientWs.on("close", () => {
    console.log("[VoiceChatGemini] Client disconnected");
    isClosing = true;
    if (greetingTimeout) {
      clearTimeout(greetingTimeout);
    }
    if (session) {
      session.close();
    }
  });

  clientWs.on("error", (error) => {
    console.error("[VoiceChatGemini] Client websocket error:", error);
    isClosing = true;
    if (session) {
      session.close();
    }
  });
}
