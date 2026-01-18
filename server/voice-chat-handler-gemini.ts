import WebSocket from "ws";
import { GoogleGenAI, Modality, Session, LiveConnectConfig, LiveServerMessage } from "@google/genai";
import { storage } from "./storage";
import { VehiclePolicyWithDetails } from "@shared/schema";

const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY;

// Quote intent keywords - includes common speech recognition errors
const QUOTE_INTENT_KEYWORDS = [
  // Primary keywords
  "quote", "quotes", "price", "pricing", "cost", "costs",
  "cheaper", "cheapest", "better deal", "switch", "compare",
  "how much", "renew", "renewal", "search for",
  // Common speech recognition errors for "quote"
  "code", "coat", "call", "cold", "goat", "cote",
  // Insurance-related phrases that indicate quote intent
  "insure my", "insurance for my", "insure the", "cover my",
  "get covered", "need cover", "want cover",
  // Vehicle-specific quote triggers
  "tesla", "car insurance", "vehicle insurance", "motor insurance",
  "auto insurance"
];

// More specific detection that avoids false positives
function detectQuoteIntent(text: string): boolean {
  const lowerText = text.toLowerCase();
  
  // Check for strong quote intent signals
  const strongSignals = [
    "quote", "quotes", "code", "coat", "call",
    "insure my", "insurance for", "price for", "cost of",
    "cheaper insurance", "better deal", "switch insurer",
    "how much to insure", "how much for", "get covered"
  ];
  
  if (strongSignals.some(signal => lowerText.includes(signal))) {
    return true;
  }
  
  // Check for vehicle + insurance context
  const hasVehicle = /tesla|car|vehicle|motor|auto/.test(lowerText);
  const hasInsuranceWord = /insurance|insure|cover|protect/.test(lowerText);
  
  if (hasVehicle && hasInsuranceWord) {
    return true;
  }
  
  // Check for standard keywords
  return QUOTE_INTENT_KEYWORDS.some(keyword => lowerText.includes(keyword));
}

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

// Native audio model for voice chat
const MODEL = "gemini-2.5-flash-native-audio-preview-12-2025";

const SYSTEM_INSTRUCTION = `You are Annie, a warm and friendly female insurance assistant with a British accent. You work for AutoAnnie, helping users find the best insurance quotes.

PERSONALITY:
- Warm, friendly, and reassuring
- Professional but approachable
- Helpful and patient
- Uses British English spellings and expressions

YOUR CAPABILITIES:
- Help users search for insurance quotes
- Answer questions about insurance
- Guide users through the quote search process

RESPONSE STYLE:
- Keep responses concise and natural
- Be conversational, not robotic
- Use a warm, empathetic tone
- Avoid technical jargon

IMPORTANT: When the conversation starts, you MUST greet the user with: "Hello! I'm Annie, your insurance assistant. How can I help you with your insurance today?"

QUOTE FLOW INSTRUCTIONS:
When a user asks for insurance quotes (mentions "quote", "insurance", "price", "cheaper", or any vehicle like Tesla, car, etc.):
- Say: "Perfect! I'm pulling up your vehicle details now. You should see them on your screen - please take a look and confirm if everything looks correct, and I'll search for the best quotes for you."
- The system will automatically show the user's registered vehicles on their screen.
- DO NOT ask them for vehicle details like make, model, year, etc. - we already have it on file.
- Wait for the user to confirm (they'll say "yes", "looks good", "confirm", etc.)
- When they confirm, say something like "Great! I'm searching for the best quotes now. This will just take a moment..."
- If the user says "no vehicles" or mentions they don't have any registered, apologize and offer to help them add a policy first.

When quote results come back (user says "got results" or "quotes are in" or the search completes):
- Say something like "Wonderful! The quotes are showing on your screen now. Have a look through them and let me know if you'd like more details on any of them."

For non-insurance questions, politely redirect the conversation back to insurance, explaining that you specialize in finding the best insurance deals.`;

const GREETING_TEXT = "Hello! I'm Annie, your insurance assistant. How can I help you with your insurance today?";

// Quote flow states
type QuoteFlowState = 
  | "idle" 
  | "awaiting_vehicle_selection" 
  | "awaiting_confirmation" 
  | "searching_quotes";

export async function handleVoiceChat(clientWs: WebSocket, emailId: string) {
  console.log(`[VoiceChatGemini] New connection for ${emailId}`);
  
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
  
  // Quote flow state
  let quoteFlowState: QuoteFlowState = "idle";
  let availableVehicles: VehiclePolicyWithDetails[] = [];
  let selectedVehicle: VehiclePolicyWithDetails | null = null;
  
  // Fetch user's vehicles from database
  async function fetchUserVehicles(): Promise<VehiclePolicyWithDetails[]> {
    try {
      const vehicles = await storage.getVehiclePoliciesByEmail(emailId);
      console.log(`[VoiceChatGemini] Found ${vehicles.length} vehicles for ${emailId}`);
      return vehicles;
    } catch (error) {
      console.error("[VoiceChatGemini] Error fetching vehicles:", error);
      return [];
    }
  }
  
  // Send vehicle list to client for display
  function sendVehicleList(vehicles: VehiclePolicyWithDetails[]) {
    const vehiclesForDisplay: VehicleForDisplay[] = vehicles.map(v => ({
      policy_id: v.policy_id,
      vehicle_registration_number: v.details.vehicle_registration_number,
      vehicle_manufacturer_name: v.details.vehicle_manufacturer_name,
      vehicle_model: v.details.vehicle_model,
      vehicle_year: v.details.vehicle_year,
    }));
    
    clientWs.send(JSON.stringify({
      type: "show_vehicle_list",
      vehicles: vehiclesForDisplay,
    }));
  }
  
  // Handle vehicle selection (by index: 0-based)
  function handleVehicleSelection(index: number): boolean {
    if (index >= 0 && index < availableVehicles.length) {
      selectedVehicle = availableVehicles[index];
      quoteFlowState = "awaiting_confirmation";
      console.log(`[VoiceChatGemini] Selected vehicle: ${selectedVehicle.details.vehicle_manufacturer_name} ${selectedVehicle.details.vehicle_model}`);
      
      // Send quote details to client for confirmation display
      sendQuoteDetailsForConfirmation(selectedVehicle);
      return true;
    }
    return false;
  }
  
  // Send quote details to client for confirmation
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
  
  // Parse ordinal words to index (0-based)
  function parseOrdinalToIndex(text: string): number {
    const lowerText = text.toLowerCase();
    const ordinalMap: Record<string, number> = {
      "first": 0, "1st": 0, "one": 0, "number one": 0, "the first": 0,
      "second": 1, "2nd": 1, "two": 1, "number two": 1, "the second": 1,
      "third": 2, "3rd": 2, "three": 2, "number three": 2, "the third": 2,
      "fourth": 3, "4th": 3, "four": 3, "number four": 3, "the fourth": 3,
      "fifth": 4, "5th": 4, "five": 4, "number five": 4, "the fifth": 4,
    };
    
    for (const [word, index] of Object.entries(ordinalMap)) {
      if (lowerText.includes(word)) {
        return index;
      }
    }
    return -1;
  }
  
  // Check for confirmation keywords
  function isConfirmation(text: string): boolean {
    const confirmWords = ["yes", "yeah", "yep", "correct", "right", "confirm", "proceed", "go ahead", "looks good", "that's right", "ok", "okay"];
    const lowerText = text.toLowerCase();
    return confirmWords.some(word => lowerText.includes(word));
  }
  
  // Check for denial keywords
  function isDenial(text: string): boolean {
    const denyWords = ["no", "nope", "wrong", "incorrect", "cancel", "stop", "wait"];
    const lowerText = text.toLowerCase();
    return denyWords.some(word => lowerText.includes(word));
  }
  
  // Handle quote intent - fetch and display vehicles
  // NOTE: We do NOT call sendClientContent here as it crashes the Gemini session.
  // Instead, Annie's system instruction tells her what to say, and we just send UI data to the client.
  async function handleQuoteIntent() {
    console.log("[VoiceChatGemini] Quote intent detected, fetching vehicles for:", emailId);
    
    try {
      availableVehicles = await fetchUserVehicles();
      console.log(`[VoiceChatGemini] Fetched ${availableVehicles.length} vehicles`);
      
      if (availableVehicles.length === 0) {
        console.log("[VoiceChatGemini] No vehicles found, sending notification to client");
        // Send notification to client UI
        clientWs.send(JSON.stringify({
          type: "no_vehicles_found",
          message: "No registered vehicles found. Please add a policy first."
        }));
        return;
      }
      
      // SINGLE VEHICLE: Skip selection, go directly to confirmation
      if (availableVehicles.length === 1) {
        const vehicle = availableVehicles[0];
        selectedVehicle = vehicle;
        quoteFlowState = "awaiting_confirmation";
        console.log("[VoiceChatGemini] Single vehicle found, going to confirmation state");
        
        // Send quote details to client for confirmation display
        sendQuoteDetailsForConfirmation(vehicle);
        console.log("[VoiceChatGemini] Sent quote details for confirmation - user will see panel on screen");
        return;
      }
      
      // MULTIPLE VEHICLES: Show list for selection
      quoteFlowState = "awaiting_vehicle_selection";
      console.log("[VoiceChatGemini] Multiple vehicles found, showing selection list");
      
      // Send vehicle list to client
      sendVehicleList(availableVehicles);
      console.log("[VoiceChatGemini] Sent vehicle list to client - user will see cards on screen");
    } catch (error) {
      console.error("[VoiceChatGemini] Error in handleQuoteIntent:", error);
    }
  }
  
  // Process user message based on current flow state
  async function processUserMessage(userText: string) {
    if (!userText.trim()) {
      console.log("[VoiceChatGemini] Empty user text, skipping processing");
      return;
    }
    
    console.log(`[VoiceChatGemini] Processing user message: "${userText}" in state: ${quoteFlowState}`);
    const hasQuoteIntent = detectQuoteIntent(userText);
    console.log(`[VoiceChatGemini] Quote intent detected: ${hasQuoteIntent}`);
    
    switch (quoteFlowState) {
      case "idle":
        // Check for quote intent
        if (hasQuoteIntent) {
          console.log("[VoiceChatGemini] Calling handleQuoteIntent");
          await handleQuoteIntent();
        }
        break;
        
      case "awaiting_vehicle_selection":
        // Try to parse vehicle selection
        const selectedIndex = parseOrdinalToIndex(userText);
        if (selectedIndex >= 0 && selectedIndex < availableVehicles.length) {
          handleVehicleSelection(selectedIndex);
          // Send quote details to client - Annie will respond naturally via voice
          sendQuoteDetailsForConfirmation(selectedVehicle!);
          console.log("[VoiceChatGemini] User selected vehicle, showing details panel");
        }
        break;
        
      case "awaiting_confirmation":
        if (isConfirmation(userText)) {
          quoteFlowState = "searching_quotes";
          console.log("[VoiceChatGemini] User confirmed, triggering quote search");
          // Signal client to call quote API
          clientWs.send(JSON.stringify({
            type: "trigger_quote_search",
            vehicle: selectedVehicle,
          }));
          // Annie will respond naturally based on her system instruction
        } else if (isDenial(userText)) {
          quoteFlowState = "idle";
          selectedVehicle = null;
          console.log("[VoiceChatGemini] User denied, hiding quote details");
          clientWs.send(JSON.stringify({ type: "hide_quote_details" }));
          // Annie will respond naturally
        }
        break;
        
      case "searching_quotes":
        // Quotes are being searched, wait for results
        break;
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

  const handleServerMessage = (message: LiveServerMessage) => {
    if (isClosing) return;
    
    try {
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
      
      if (message.serverContent?.inputTranscription?.text) {
        const userText = message.serverContent.inputTranscription.text;
        currentUserTranscript += userText;
        console.log(`[VoiceChatGemini] User said (fragment): ${userText}`);
        clientWs.send(JSON.stringify({
          type: "user_transcript_delta",
          delta: userText,
        }));
      }
      
      if (message.serverContent?.outputTranscription?.text) {
        const assistantText = message.serverContent.outputTranscription.text;
        currentAssistantTranscript += assistantText;
        console.log(`[VoiceChatGemini] Assistant said (fragment): ${assistantText}`);
        clientWs.send(JSON.stringify({
          type: "assistant_transcript_delta",
          delta: assistantText,
        }));
      }
      
      if (message.serverContent?.interrupted) {
        console.log("[VoiceChatGemini] Response interrupted by user");
        currentAssistantTranscript = "";
      }
      
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
        
        // Process user message for quote flow - delay to let session settle after turn complete
        if (userText) {
          setTimeout(() => {
            processUserMessage(userText);
          }, 1000);
        }
        
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
          console.log("[VoiceChatGemini] Connected to Gemini Live API");
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
        if (quoteFlowState === "awaiting_vehicle_selection") {
          const success = handleVehicleSelection(message.index);
          if (success) {
            console.log("[VoiceChatGemini] Vehicle selected via click, showing details panel");
            // Just show the details panel - no sendClientContent to avoid crashing session
          }
        }
      }
      
      // Handle confirmation from client (user clicked confirm button)
      if (message.type === "confirm_quote_details") {
        console.log("[VoiceChatGemini] Client confirmed quote details via click");
        if (quoteFlowState === "awaiting_confirmation" && selectedVehicle) {
          quoteFlowState = "searching_quotes";
          clientWs.send(JSON.stringify({
            type: "trigger_quote_search",
            vehicle: selectedVehicle,
          }));
          // No sendClientContent - Annie continues naturally
        }
      }
      
      // Handle quote search results from client
      if (message.type === "quote_search_results") {
        console.log("[VoiceChatGemini] Received quote search results");
        quoteFlowState = "idle";
        // Results are displayed on client - no need to inject into Gemini
        // Annie doesn't need to announce results since they're shown visually
      }
      
    } catch (error) {
      if (data instanceof Buffer && session) {
        try {
          session.sendRealtimeInput({
            audio: {
              data: data.toString("base64"),
              mimeType: "audio/pcm;rate=16000"
            }
          });
        } catch (sendError) {
          console.error("[VoiceChatGemini] Error sending raw audio:", sendError);
        }
      }
    }
  });

  clientWs.on("close", () => {
    console.log("[VoiceChatGemini] Client disconnected");
    isClosing = true;
    if (greetingTimeout) {
      clearTimeout(greetingTimeout);
      greetingTimeout = null;
    }
    if (session) {
      try {
        session.close();
      } catch (error) {
        console.error("[VoiceChatGemini] Error closing session:", error);
      }
      session = null;
    }
  });

  clientWs.on("error", (error) => {
    console.error("[VoiceChatGemini] Client WebSocket error:", error);
    isClosing = true;
    if (session) {
      try {
        session.close();
      } catch (closeError) {
        console.error("[VoiceChatGemini] Error closing session on error:", closeError);
      }
      session = null;
    }
  });
}
