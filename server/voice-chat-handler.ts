import WebSocket from "ws";
import { storage } from "./storage";
import { buildPolicyContext } from "./policy-context-builder";
import { detectVoiceIntent, generateVoiceResponse, type VoiceIntent } from "./voice-intent-detector";

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const OPENAI_REALTIME_URL = "wss://api.openai.com/v1/realtime?model=gpt-realtime-mini";
// Use the same API endpoint as the text chat (alfie-agent complete-analysis)
const QUOTE_SEARCH_API = "https://alfie-657860957693.europe-west4.run.app/complete-analysis";

interface TranscriptionBuffer {
  userTranscript: string;
  assistantTranscript: string;
}

// Voice conversation state machine
type VoiceFlowState = 
  | "idle" 
  | "searching_quotes" 
  | "quotes_ready" 
  | "awaiting_confirmation"
  | "purchasing"
  | "completed";

interface VoiceSessionState {
  flowState: VoiceFlowState;
  quotes: any[] | null;
  selectedInsurer: { name: string; price: number } | null;
  emailId: string;
}

// Quote card structure (matching ChatQuoteCard)
interface QuoteResult {
  insurer: string;
  trustpilotRating: number;
  defaqtoRating: number;
  annualCost: number;
  monthlyCost: number;
  excessVoluntary: number;
  excessCompulsory: number;
  autoAnnieScore: number;
  aiSummary: string;
}

/**
 * Handles WebSocket connection for voice chat with gpt-realtime-mini
 * Now includes intelligent quote search and purchase flow
 */
export async function handleVoiceChat(clientWs: WebSocket, emailId: string) {
  console.log(`[VoiceChat] New connection for ${emailId}`);

  // Session state for voice flow
  const sessionState: VoiceSessionState = {
    flowState: "idle",
    quotes: null,
    selectedInsurer: null,
    emailId
  };

  // Fetch user's policies to build context
  const policies = await storage.getVehiclePoliciesByEmail(emailId);
  const policyContext = buildPolicyContext(emailId, policies);

  // Connect to OpenAI Realtime API
  const openaiWs = new WebSocket(OPENAI_REALTIME_URL, {
    headers: {
      "Authorization": `Bearer ${OPENAI_API_KEY}`,
      "OpenAI-Beta": "realtime=v1",
    },
  });

  // Track transcriptions for saving to database
  let transcriptionBuffer: TranscriptionBuffer = {
    userTranscript: "",
    assistantTranscript: "",
  };
  
  // Flag to track when WE are sending a voice message (vs OpenAI auto-responding)
  let ourResponseInProgress = false;

  // Helper to send TTS message through OpenAI Realtime
  const sendVoiceMessage = (text: string) => {
    if (openaiWs.readyState === WebSocket.OPEN) {
      console.log(`[VoiceChat] Sending TTS: "${text}"`);
      
      // Mark that we're sending our own response
      ourResponseInProgress = true;
      
      // Create a text response that OpenAI will convert to speech
      openaiWs.send(JSON.stringify({
        type: "conversation.item.create",
        item: {
          type: "message",
          role: "assistant",
          content: [{ type: "text", text }]
        }
      }));
      
      // Trigger the response to be spoken
      openaiWs.send(JSON.stringify({
        type: "response.create"
      }));
    }
  };

  // Helper to send status updates to client (null clears the status)
  const sendStatusUpdate = (status: string | null) => {
    clientWs.send(JSON.stringify({
      type: "status_update",
      status
    }));
  };

  // Search for quotes using the external API (same format as text chat)
  const searchQuotes = async (): Promise<QuoteResult[]> => {
    try {
      // Get policy details - handle both flat and nested policy formats
      const policy = policies[0];
      if (!policy) {
        console.error("[VoiceChat] No policy found");
        return [];
      }
      
      // Support both VehiclePolicyWithDetails (nested) and VehiclePolicy (flat)
      const details = 'details' in policy ? policy.details : policy;
      const vehicleReg = (details as any)?.vehicle_registration_number;
      
      if (!vehicleReg) {
        console.error("[VoiceChat] No vehicle registration found in policy");
        return [];
      }
      
      // Validate required fields exist before calling API
      const driverAge = (details as any)?.driver_age;
      const vehicleYear = (details as any)?.vehicle_year;
      if (!driverAge || !vehicleYear) {
        console.error("[VoiceChat] Missing required policy details (driver_age or vehicle_year)");
        return [];
      }

      console.log(`[VoiceChat] Searching quotes for vehicle: ${vehicleReg}`);
      console.log(`[VoiceChat] Policy details:`, {
        vehicleReg,
        make: (details as any)?.vehicle_manufacturer_name,
        model: (details as any)?.vehicle_model,
        year: vehicleYear,
        driverAge
      });
      
      // Build the full request body EXACTLY matching text chat format from routes.ts
      // All field names and casing must match the API requirements
      const quoteRequestBody = {
        insurance_details: {
          email_id: policy.email_id,
          driver_age: driverAge,
          vehicle_registration_number: vehicleReg,
          vehicle_manufacturer_name: (details as any)?.vehicle_manufacturer_name,
          vehicle_model: (details as any)?.vehicle_model,
          vehicle_year: vehicleYear,
          type_of_fuel: (details as any)?.type_of_fuel,
          type_of_Cover_needed: (details as any)?.type_of_cover_needed,  // Capital C required by API
          No_Claim_bonus_years: (details as any)?.no_claim_bonus_years,  // Capital N and C required by API
          Voluntary_Excess: (details as any)?.voluntary_excess,  // Capital V and E required by API
          current_insurance_provider: policy.current_insurance_provider,
          policy_id: policy.policy_id,
          policy_type: policy.policy_type
        },
        user_preferences: policy.whisper_preferences || "",
        conversation_history: [],
        trust_pilot_data: null,
        defacto_ratings: null
      };
      
      console.log(`[VoiceChat] Calling Quote Search API with body:`, JSON.stringify(quoteRequestBody, null, 2));
      
      // Use timeout to prevent hanging
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000);
      
      const response = await fetch(QUOTE_SEARCH_API, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(quoteRequestBody),
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorText = await response.text().catch(() => "Unknown error");
        console.error(`[VoiceChat] Quote API error (${response.status}):`, errorText);
        throw new Error(`Quote search failed: ${response.status}`);
      }

      const data = await response.json();
      console.log(`[VoiceChat] Quote API returned ${data.quotes_with_insights?.length || 0} quotes`);
      
      // Log raw API response for debugging
      console.log(`[VoiceChat] Raw API response sample:`, JSON.stringify(data.quotes_with_insights?.[0], null, 2));
      
      // Transform API response to our QuoteResult format
      const quotes: QuoteResult[] = (data.quotes_with_insights || []).slice(0, 10).map((q: any) => {
        // Get annual cost - try multiple field names
        const rawAnnualCost = q.annual_cost || q.annualCost || q.quote_price || q.price || 0;
        // Get AutoAnnie score - normalize from 0-100 to 0-5 scale
        const rawScore = q.auto_annie_score || q.autoAnnieScore || q.alfie_touch_score || 80;
        const normalizedScore = rawScore > 10 ? Math.round((rawScore / 100) * 5 * 10) / 10 : rawScore;
        
        return {
          insurer: q.insurer_name || q.insurer || "Unknown",
          trustpilotRating: q.trust_pilot_score || q.trustpilotRating || 4.0,
          defaqtoRating: q.defaqto_score || q.defaqtoRating || 4,
          annualCost: rawAnnualCost,
          monthlyCost: q.monthly_cost || q.monthlyCost || Math.round(rawAnnualCost / 12),
          excessVoluntary: q.voluntary_excess || q.excessVoluntary || 250,
          excessCompulsory: q.compulsory_excess || q.excessCompulsory || 250,
          autoAnnieScore: normalizedScore,  // Now normalized to 0-5 scale
          aiSummary: q.ai_summary || q.aiSummary || "Good value policy with comprehensive cover."
        };
      });
      
      console.log(`[VoiceChat] Transformed ${quotes.length} quotes for display`);
      return quotes;
    } catch (error: any) {
      console.error("[VoiceChat] Quote search error:", error.name, error.message);
      if (error.name === 'AbortError') {
        console.error("[VoiceChat] Quote search timed out after 30 seconds");
      }
      return [];
    }
  };

  // Execute purchase flow
  const executePurchase = async (insurerName: string, price: number) => {
    try {
      // Get vehicle registration - handle both flat and nested formats
      const policy = policies[0];
      if (!policy) {
        throw new Error("No policy found");
      }
      const details = 'details' in policy ? policy.details : policy;
      const vehicleReg = (details as any)?.vehicle_registration_number;
      
      if (!vehicleReg) {
        throw new Error("No vehicle registration found");
      }

      console.log(`[VoiceChat] Starting purchase for ${insurerName} at £${price}`);

      // Send progress updates
      sendStatusUpdate("Processing payment...");
      await new Promise(r => setTimeout(r, 2000));
      
      sendStatusUpdate("Verifying details...");
      await new Promise(r => setTimeout(r, 1500));
      
      sendStatusUpdate(`Contacting ${insurerName}...`);
      await new Promise(r => setTimeout(r, 2000));

      // Call storage directly (avoid HTTP call on same server)
      // This is more reliable than making an HTTP call to ourselves
      await storage.purchasePolicy({
        email_id: emailId, 
        vehicle_registration_number: vehicleReg, 
        insurer_name: insurerName, 
        policy_cost: price
      });

      sendStatusUpdate("Finalizing policy...");
      await new Promise(r => setTimeout(r, 1500));

      console.log(`[VoiceChat] Purchase completed successfully`);
      return true;
    } catch (error) {
      console.error("[VoiceChat] Purchase error:", error);
      return false;
    }
  };

  // Process user transcript and handle intents
  const processUserIntent = async (transcript: string) => {
    console.log(`[VoiceChat] Processing intent for: "${transcript}"`);
    console.log(`[VoiceChat] Current state: ${sessionState.flowState}`);

    // Use LLM to detect intent
    const intent = await detectVoiceIntent(transcript);
    console.log(`[VoiceChat] Detected intent:`, intent);

    switch (sessionState.flowState) {
      case "idle":
        if (intent.type === "quote_search") {
          // User wants to search for quotes
          sessionState.flowState = "searching_quotes";
          
          // Send voice response
          sendVoiceMessage(generateVoiceResponse("quote_search_start"));
          sendStatusUpdate("Searching for quotes...");
          
          // Search for quotes in background
          const quotes = await searchQuotes();
          
          if (quotes.length > 0) {
            sessionState.quotes = quotes;
            sessionState.flowState = "quotes_ready";
            
            // Send quotes to client for visual display
            clientWs.send(JSON.stringify({
              type: "quotes_received",
              quotes: quotes.slice(0, 10) // Max 10 quotes
            }));
            
            // Get top quote for voice summary
            const topQuote = quotes[0];
            sendVoiceMessage(generateVoiceResponse("quotes_found", {
              totalQuotes: quotes.length,
              topQuote: {
                insurer: topQuote.insurer,
                price: topQuote.annualCost,
                trustpilot: topQuote.trustpilotRating
              }
            }));
            sendStatusUpdate(null);
          } else {
            sessionState.flowState = "idle";
            sendVoiceMessage(generateVoiceResponse("no_quotes_available"));
            sendStatusUpdate(null);
          }
          return true; // Handled
        }
        break;

      case "quotes_ready":
        if (intent.type === "insurer_selection") {
          let selectedQuote = null;
          
          // Check if user said positional selection like "first one", "cheapest", "best"
          const lowerTranscript = transcript.toLowerCase();
          if (lowerTranscript.includes("first") || lowerTranscript.includes("top") || lowerTranscript.includes("best") || lowerTranscript.includes("cheapest")) {
            selectedQuote = sessionState.quotes?.[0]; // First/best quote
          } else if (lowerTranscript.includes("second")) {
            selectedQuote = sessionState.quotes?.[1];
          } else if (lowerTranscript.includes("third")) {
            selectedQuote = sessionState.quotes?.[2];
          } else if (intent.insurerName) {
            // User mentioned specific insurer - use flexible matching
            const targetInsurer = intent.insurerName!.toLowerCase().trim();
            
            // Find matching quote with flexible matching (exact, partial, or fuzzy)
            selectedQuote = sessionState.quotes?.find(q => {
              const quoteInsurer = q.insurer.toLowerCase().trim();
              // Exact match
              if (quoteInsurer === targetInsurer) return true;
              // Partial match (insurer name contains the spoken name or vice versa)
              if (quoteInsurer.includes(targetInsurer) || targetInsurer.includes(quoteInsurer)) return true;
              // Starts with match
              if (quoteInsurer.startsWith(targetInsurer) || targetInsurer.startsWith(quoteInsurer)) return true;
              return false;
            });
          }
          
          if (selectedQuote) {
            sessionState.selectedInsurer = {
              name: selectedQuote.insurer,
              price: selectedQuote.annualCost
            };
            sessionState.flowState = "awaiting_confirmation";
            
            // Send to client to show payment section
            clientWs.send(JSON.stringify({
              type: "insurer_selected",
              insurer: selectedQuote.insurer,
              price: selectedQuote.annualCost
            }));
            
            // Ask for confirmation naturally
            sendVoiceMessage(generateVoiceResponse("insurer_selected", {
              insurerName: selectedQuote.insurer,
              price: selectedQuote.annualCost
            }));
            return true;
          } else {
            sendVoiceMessage(generateVoiceResponse("insurer_not_found"));
            return true;
          }
        }
        break;

      case "awaiting_confirmation":
        if (intent.type === "confirmation") {
          // User confirmed purchase
          sessionState.flowState = "purchasing";
          
          sendVoiceMessage(generateVoiceResponse("purchase_confirmed"));
          
          // Execute purchase
          const success = await executePurchase(
            sessionState.selectedInsurer!.name,
            sessionState.selectedInsurer!.price
          );
          
          if (success) {
            sessionState.flowState = "completed";
            
            // Notify client
            clientWs.send(JSON.stringify({
              type: "purchase_complete",
              insurer: sessionState.selectedInsurer!.name,
              price: sessionState.selectedInsurer!.price
            }));
            
            sendVoiceMessage(generateVoiceResponse("purchase_complete", {
              insurerName: sessionState.selectedInsurer!.name
            }));
            sendStatusUpdate(null);
            
            // Reset state for new conversation
            sessionState.flowState = "idle";
            sessionState.quotes = null;
            sessionState.selectedInsurer = null;
          } else {
            sessionState.flowState = "quotes_ready";
            sendVoiceMessage("I'm sorry, there was an issue processing your payment. Would you like to try again?");
            sendStatusUpdate(null);
          }
          return true;
        } else if (intent.type === "cancellation") {
          // User cancelled
          sessionState.flowState = "quotes_ready";
          sessionState.selectedInsurer = null;
          
          clientWs.send(JSON.stringify({
            type: "selection_cancelled"
          }));
          
          sendVoiceMessage(generateVoiceResponse("purchase_cancelled"));
          return true;
        }
        break;
    }

    // Intent not handled by flow - return false to let normal chat handle it
    return false;
  };

  openaiWs.on("open", () => {
    console.log("[VoiceChat] Connected to OpenAI Realtime API");

    // Initialize session with AutoAnnie personality + policy context
    // IMPORTANT: Disable auto-response so we can process intents first
    const sessionConfig = {
      type: "session.update",
      session: {
        modalities: ["text", "audio"],
        instructions: `You are AutoAnnie, a friendly and calm UK car insurance assistant. You ONLY answer general insurance questions. You do NOT search for quotes or make up quote prices - that is handled by another system.

PERSONALITY:
- Warm, polite, and trustworthy
- Speak calmly and clearly
- Use everyday language (avoid jargon)
- Keep responses VERY brief: 1-2 sentences maximum
- Never mention specific prices or insurers unless directly asked about a policy

POLICY CONTEXT:
${policyContext}

IMPORTANT:
- For general insurance questions, provide helpful answers
- Do NOT make up quote prices or insurer names
- Do NOT say you're searching for quotes - the system handles that separately`,
        voice: "alloy",
        input_audio_format: "pcm16",
        output_audio_format: "pcm16",
        input_audio_transcription: {
          model: "whisper-1",
        },
        turn_detection: {
          type: "server_vad",
          threshold: 0.5,
          prefix_padding_ms: 300,
          silence_duration_ms: 600,
          create_response: false, // CRITICAL: Don't auto-respond, we handle intent first
        },
      },
    };

    openaiWs.send(JSON.stringify(sessionConfig));
    console.log("[VoiceChat] Session configured with policy context");
  });

  openaiWs.on("message", async (data: WebSocket.Data) => {
    try {
      const event = JSON.parse(data.toString());

      // Forward audio responses to client
      if (event.type === "response.audio.delta" && event.delta) {
        clientWs.send(JSON.stringify({
          type: "audio",
          audio: event.delta,
        }));
      }

      // Capture user transcription and process intent BEFORE OpenAI responds
      if (event.type === "conversation.item.input_audio_transcription.completed") {
        transcriptionBuffer.userTranscript = event.transcript || "";
        console.log(`[VoiceChat] User said: ${transcriptionBuffer.userTranscript}`);
        
        // Cancel any EXISTING OpenAI auto-response before we process
        // Note: our flag will be set by sendVoiceMessage when WE want to speak
        if (!ourResponseInProgress) {
          openaiWs.send(JSON.stringify({ type: "response.cancel" }));
          console.log("[VoiceChat] Cancelled any pending OpenAI auto-response");
        }
        
        // Send to client for UI display
        clientWs.send(JSON.stringify({
          type: "user_transcript",
          transcript: transcriptionBuffer.userTranscript,
        }));

        // Process intent - this may call sendVoiceMessage which sets ourResponseInProgress
        const handled = await processUserIntent(transcriptionBuffer.userTranscript);
        
        if (!handled) {
          // Intent not handled by our flow - let OpenAI respond for general chat
          console.log("[VoiceChat] Intent not handled, triggering OpenAI response");
          ourResponseInProgress = true; // Mark that this is an allowed response
          openaiWs.send(JSON.stringify({
            type: "response.create"
          }));
        }
        // If handled, processUserIntent already called sendVoiceMessage which sets the flag
      }

      // Capture assistant transcription
      if (event.type === "response.audio_transcript.delta") {
        transcriptionBuffer.assistantTranscript += event.delta || "";
      }

      // Save transcriptions when response is complete
      if (event.type === "response.audio_transcript.done") {
        console.log(`[VoiceChat] Assistant said: ${transcriptionBuffer.assistantTranscript}`);
        
        // Send to client
        clientWs.send(JSON.stringify({
          type: "assistant_transcript",
          transcript: transcriptionBuffer.assistantTranscript,
        }));

        // Save both messages to database
        if (transcriptionBuffer.userTranscript && transcriptionBuffer.assistantTranscript) {
          await storage.saveChatMessage({
            email_id: emailId,
            role: "user",
            content: transcriptionBuffer.userTranscript,
          });

          await storage.saveChatMessage({
            email_id: emailId,
            role: "assistant",
            content: transcriptionBuffer.assistantTranscript,
          });

          console.log("[VoiceChat] Transcriptions saved to database");
        }

        // Reset buffer
        transcriptionBuffer = {
          userTranscript: "",
          assistantTranscript: "",
        };
      }

      // Forward session events to client
      if (event.type === "session.created" || event.type === "session.updated") {
        clientWs.send(JSON.stringify({
          type: "session_ready",
        }));
      }
      
      // Intercept speech stopped event - cancel any auto-response UNLESS we triggered it
      if (event.type === "input_audio_buffer.speech_stopped") {
        if (!ourResponseInProgress) {
          console.log("[VoiceChat] Speech stopped, cancelling any OpenAI auto-response");
          openaiWs.send(JSON.stringify({ type: "response.cancel" }));
        }
      }
      
      // Cancel ONLY unwanted OpenAI auto-responses, not our own TTS
      if (event.type === "response.created") {
        if (!ourResponseInProgress) {
          // This is OpenAI auto-responding - cancel it!
          console.log("[VoiceChat] OpenAI auto-started response, cancelling...");
          openaiWs.send(JSON.stringify({ type: "response.cancel" }));
        } else {
          console.log("[VoiceChat] Our TTS response started (not cancelling)");
        }
      }
      
      // Reset flag when response is done
      if (event.type === "response.done") {
        console.log("[VoiceChat] Response completed, resetting flag");
        ourResponseInProgress = false;
      }

      // Log errors and reset flag to avoid stuck state
      if (event.type === "error") {
        console.error("[VoiceChat] OpenAI error:", event.error);
        ourResponseInProgress = false; // Reset flag on error
        clientWs.send(JSON.stringify({
          type: "error",
          message: event.error?.message || "Unknown error",
        }));
      }
      
      // Reset flag on response.cancel as well
      if (event.type === "response.cancelled") {
        console.log("[VoiceChat] Response was cancelled, resetting flag");
        ourResponseInProgress = false;
      }

    } catch (error) {
      console.error("[VoiceChat] Error processing OpenAI message:", error);
    }
  });

  openaiWs.on("error", (error) => {
    console.error("[VoiceChat] OpenAI WebSocket error:", error);
    clientWs.send(JSON.stringify({
      type: "error",
      message: "Connection error with AI service",
    }));
  });

  openaiWs.on("close", () => {
    console.log("[VoiceChat] OpenAI connection closed");
    clientWs.close();
  });

  // Forward client audio to OpenAI
  clientWs.on("message", (data: WebSocket.Data) => {
    try {
      const message = JSON.parse(data.toString());

      if (message.type === "audio" && message.audio) {
        // Forward audio data to OpenAI
        openaiWs.send(JSON.stringify({
          type: "input_audio_buffer.append",
          audio: message.audio,
        }));
      }

      if (message.type === "input_audio_buffer.commit") {
        // Commit audio buffer when user stops speaking
        openaiWs.send(JSON.stringify({
          type: "input_audio_buffer.commit",
        }));
      }

      if (message.type === "response.create") {
        // Trigger AI response
        openaiWs.send(JSON.stringify({
          type: "response.create",
        }));
      }

    } catch (error) {
      console.error("[VoiceChat] Error processing client message:", error);
    }
  });

  clientWs.on("close", () => {
    console.log(`[VoiceChat] Client disconnected: ${emailId}`);
    openaiWs.close();
  });

  clientWs.on("error", (error) => {
    console.error("[VoiceChat] Client WebSocket error:", error);
    openaiWs.close();
  });
}
