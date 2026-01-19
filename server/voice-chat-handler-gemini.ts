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
- Say something like "Wonderful! The quotes are showing on your screen now. I've found some great options for you. Have a look and let me know which one catches your eye, or if you'd like more details on any of them."

QUOTE SELECTION AND PURCHASE FLOW:
When a user selects a quote (says things like "go with Admiral", "I want PAXA", "the first one", "cheapest one", etc.):
- ALWAYS confirm before proceeding. Say something like: "Just to confirm - you'd like to go with [insurer name] for [price]? Say 'yes' to proceed or 'no' if you'd like to look at other options."
- Wait for their confirmation.
- If they say "yes", "proceed", "confirm", "go ahead" - say: "Brilliant! I'm processing your policy switch now. You'll see the progress on your screen..."
- If they say "no", "cancel", or want to look at others - say: "No problem! Take your time looking through the quotes. Let me know when you've decided."

If a user wants MORE quotes or isn't happy with the options:
- Say: "I understand! This quick quote gives you a snapshot of available options. For a more comprehensive search with additional filters, you can use the Quote Search option from the home screen. Would you like me to help with anything else?"

IMPORTANT RULES:
- Always confirm with the customer before proceeding with any purchase
- Be reassuring during the purchase process
- If something goes wrong, apologize and offer to help

For non-insurance questions, politely redirect the conversation back to insurance, explaining that you specialize in finding the best insurance deals.`;

const GREETING_TEXT = "Hello! I'm Annie, your insurance assistant. How can I help you with your insurance today?";

// Quote flow states
type QuoteFlowState = 
  | "idle" 
  | "awaiting_vehicle_selection" 
  | "awaiting_confirmation" 
  | "searching_quotes"
  | "quotes_displayed"
  | "awaiting_purchase_confirmation"
  | "processing_purchase";

// Known insurer names for detection
const KNOWN_INSURERS = [
  "admiral", "paxa", "direct line", "directline", "aviva", "axa", 
  "churchill", "hastings", "esure", "more than", "morethan", 
  "tesco", "sainsbury", "rac", "aa", "confused", "compare the market",
  "go compare", "moneysupermarket", "zurich", "allianz", "lloyds"
];

// Detect if user is selecting a provider from their message
function detectProviderSelection(text: string): { detected: boolean; provider?: string; ordinal?: number } {
  const lowerText = text.toLowerCase();
  
  // Selection verb indicators (make detection more confident but not required)
  const hasSelectionVerb = /\b(go with|want|choose|select|take|switch to|let's do|i'll take|sounds good|please)\b/.test(lowerText);
  
  // Check for ordinal selection ("first one", "second option", "the third", "first", "the first")
  const ordinalPatterns = [
    { pattern: /\b(the\s+)?(first|1st)(\s+one|\s+option|\s+quote|\s+choice)?\b/, ordinal: 1 },
    { pattern: /\b(the\s+)?(second|2nd)(\s+one|\s+option|\s+quote|\s+choice)?\b/, ordinal: 2 },
    { pattern: /\b(the\s+)?(third|3rd)(\s+one|\s+option|\s+quote|\s+choice)?\b/, ordinal: 3 },
    { pattern: /\bnumber\s*(one|1)\b/, ordinal: 1 },
    { pattern: /\bnumber\s*(two|2)\b/, ordinal: 2 },
    { pattern: /\bnumber\s*(three|3)\b/, ordinal: 3 },
  ];
  
  for (const { pattern, ordinal } of ordinalPatterns) {
    if (pattern.test(lowerText)) {
      // Allow ordinal selection even without explicit verb (e.g., "the first one" is enough)
      return { detected: true, ordinal };
    }
  }
  
  // Check for "cheapest", "lowest", "best" - these indicate selection
  if (/\b(cheapest|lowest|best|top)\s*(one|option|quote|price)?\b/.test(lowerText)) {
    return { detected: true, ordinal: 1 }; // Top quote is best/cheapest after sorting
  }
  
  // Check for specific insurer names - allow with or without selection verbs
  for (const insurer of KNOWN_INSURERS) {
    if (lowerText.includes(insurer)) {
      // If has selection verb or positive phrase, definitely selecting
      if (hasSelectionVerb || /\b(please|sounds good|looks good|that one|ok|okay)\b/.test(lowerText)) {
        return { detected: true, provider: insurer };
      }
      // Even just mentioning insurer name alone after quotes displayed likely means selection
      // (e.g., user says "Admiral" or "Admiral please")
      if (lowerText.trim().length < 50) { // Short utterances with insurer name = selection
        return { detected: true, provider: insurer };
      }
    }
  }
  
  return { detected: false };
}

// Detect purchase confirmation
function detectPurchaseConfirmation(text: string): "confirm" | "reject" | "none" {
  const lowerText = text.toLowerCase();
  
  // Confirmation patterns
  const confirmPatterns = [
    /\byes\b/, /\byeah\b/, /\byep\b/, /\bproceed\b/, /\bconfirm\b/, 
    /\bgo ahead\b/, /\bdo it\b/, /\blet's go\b/, /\bsure\b/, /\bgo on\b/,
    /\bthat's right\b/, /\bcorrect\b/, /\bplease\b/
  ];
  
  // Rejection patterns
  const rejectPatterns = [
    /\bno\b/, /\bnope\b/, /\bcancel\b/, /\bstop\b/, /\bwait\b/,
    /\bhold on\b/, /\bdon't\b/, /\bdo not\b/, /\bactually\b/,
    /\bchanged my mind\b/, /\bother options\b/
  ];
  
  for (const pattern of confirmPatterns) {
    if (pattern.test(lowerText)) {
      return "confirm";
    }
  }
  
  for (const pattern of rejectPatterns) {
    if (pattern.test(lowerText)) {
      return "reject";
    }
  }
  
  return "none";
}

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
  
  // Quote selection state (for purchase flow)
  interface DisplayedQuote {
    insurer_name: string;
    policy_cost: number;
    quote_reference_number?: string;
  }
  let displayedQuotes: DisplayedQuote[] = [];
  let selectedQuoteForPurchase: DisplayedQuote | null = null;
  
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
  
  // Process the actual purchase after confirmation
  async function processPurchase(quote: DisplayedQuote) {
    if (!selectedVehicle) {
      console.error("[VoiceChatGemini] No vehicle selected for purchase");
      clientWs.send(JSON.stringify({
        type: "purchase_error",
        message: "No vehicle selected for purchase"
      }));
      quoteFlowState = "quotes_displayed";
      return;
    }
    
    console.log(`[VoiceChatGemini] Processing purchase: ${quote.insurer_name} at £${quote.policy_cost}`);
    
    try {
      // Status update 1: Processing payment
      clientWs.send(JSON.stringify({
        type: "purchase_status",
        status: "Processing payment...",
        step: 1
      }));
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Status update 2: Verifying details
      clientWs.send(JSON.stringify({
        type: "purchase_status",
        status: "Verifying details...",
        step: 2
      }));
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      // Status update 3: Contacting insurer
      clientWs.send(JSON.stringify({
        type: "purchase_status",
        status: `Contacting ${quote.insurer_name}...`,
        step: 3
      }));
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      // Make the actual purchase via storage layer directly
      const purchaseData = {
        email_id: emailId,
        vehicle_registration_number: selectedVehicle.details.vehicle_registration_number,
        insurer_name: quote.insurer_name,
        policy_cost: quote.policy_cost,
      };
      
      console.log("[VoiceChatGemini] Purchasing policy:", purchaseData);
      
      const newPolicy = await storage.purchasePolicy(purchaseData);
      console.log("[VoiceChatGemini] Purchase successful:", newPolicy);
      
      // Send success to client
      clientWs.send(JSON.stringify({
        type: "purchase_complete",
        success: true,
        insurer: quote.insurer_name,
        price: quote.policy_cost,
        policy: newPolicy,
      }));
      
      // Reset state
      quoteFlowState = "idle";
      selectedQuoteForPurchase = null;
      displayedQuotes = [];
      
    } catch (error) {
      console.error("[VoiceChatGemini] Purchase error:", error);
      clientWs.send(JSON.stringify({
        type: "purchase_error",
        message: error instanceof Error ? error.message : "Purchase failed",
      }));
      quoteFlowState = "quotes_displayed";
      selectedQuoteForPurchase = null;
    }
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
        
      case "quotes_displayed":
        // Check if user is selecting a provider
        const providerSelection = detectProviderSelection(userText);
        console.log(`[VoiceChatGemini] Provider selection detection:`, providerSelection);
        
        if (providerSelection.detected) {
          let selectedQuote: DisplayedQuote | null = null;
          
          if (providerSelection.ordinal !== undefined && providerSelection.ordinal <= displayedQuotes.length) {
            // User selected by ordinal (first, second, third)
            selectedQuote = displayedQuotes[providerSelection.ordinal - 1];
            console.log(`[VoiceChatGemini] User selected by ordinal ${providerSelection.ordinal}: ${selectedQuote?.insurer_name}`);
          } else if (providerSelection.provider) {
            // User selected by provider name
            selectedQuote = displayedQuotes.find(q => 
              q.insurer_name.toLowerCase().includes(providerSelection.provider!)
            ) || null;
            console.log(`[VoiceChatGemini] User selected by name "${providerSelection.provider}": ${selectedQuote?.insurer_name}`);
          }
          
          if (selectedQuote) {
            selectedQuoteForPurchase = selectedQuote;
            quoteFlowState = "awaiting_purchase_confirmation";
            console.log(`[VoiceChatGemini] Quote selected for purchase: ${selectedQuote.insurer_name} at £${selectedQuote.policy_cost}`);
            
            // Notify client about the selection
            clientWs.send(JSON.stringify({
              type: "quote_selected",
              insurer: selectedQuote.insurer_name,
              price: selectedQuote.policy_cost,
            }));
            // Annie will ask for confirmation naturally via her system instruction
          }
        }
        break;
        
      case "awaiting_purchase_confirmation":
        // Check if user confirmed or rejected the purchase
        const purchaseDecision = detectPurchaseConfirmation(userText);
        console.log(`[VoiceChatGemini] Purchase confirmation detection: ${purchaseDecision}`);
        
        if (purchaseDecision === "confirm" && selectedQuoteForPurchase) {
          quoteFlowState = "processing_purchase";
          console.log(`[VoiceChatGemini] User confirmed purchase of ${selectedQuoteForPurchase.insurer_name}`);
          
          // Notify client that purchase is starting
          clientWs.send(JSON.stringify({
            type: "purchase_confirmed",
            insurer: selectedQuoteForPurchase.insurer_name,
            price: selectedQuoteForPurchase.policy_cost,
          }));
          
          // Start the actual purchase process (async, with status updates)
          processPurchase(selectedQuoteForPurchase);
          // Annie will respond naturally: "Brilliant! I'm processing your policy switch now..."
        } else if (purchaseDecision === "reject") {
          console.log("[VoiceChatGemini] User rejected purchase, going back to quotes displayed");
          quoteFlowState = "quotes_displayed";
          selectedQuoteForPurchase = null;
          
          clientWs.send(JSON.stringify({
            type: "purchase_cancelled",
          }));
          // Annie will respond naturally: "No problem! Take your time..."
        }
        break;
        
      case "processing_purchase":
        // Purchase is being processed, wait for completion
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
        console.log("[VoiceChatGemini] Received quote search results, count:", message.quotesCount);
        
        if (message.success && message.quotesCount > 0) {
          quoteFlowState = "quotes_displayed";
          console.log("[VoiceChatGemini] Quotes displayed, ready for selection");
        } else {
          quoteFlowState = "idle";
          console.log("[VoiceChatGemini] No quotes found or error, back to idle");
        }
        // Results are displayed on client - Annie's system instruction handles the response
      }
      
      // Handle quote details from client (for tracking displayed quotes)
      if (message.type === "displayed_quotes") {
        console.log("[VoiceChatGemini] Received displayed quotes info:", message.quotes?.length);
        displayedQuotes = (message.quotes || []).map((q: any) => ({
          insurer_name: q.insurer_name || q.insurer || "Unknown",
          policy_cost: q.policy_cost || q.quote_price || 0,
          quote_reference_number: q.quote_reference_number,
        }));
        console.log("[VoiceChatGemini] Stored quotes for selection:", displayedQuotes.map(q => q.insurer_name));
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
