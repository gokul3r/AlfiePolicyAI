import WebSocket from "ws";
import { GoogleGenAI, Modality, Session, LiveConnectConfig, LiveServerMessage } from "@google/genai";
import { storage } from "./storage";
import type { LiveNegotiation } from "@shared/schema";
import { buildSystemPrompt, parseOutcome, detectOutcomeFromSpeech, determineOutcomeCategory } from "./live-negotiation-agent";
import type { Server as SocketIOServer } from "socket.io";
import { EventEmitter } from "events";

const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY;
const MODEL = "gemini-2.5-flash-native-audio-preview-12-2025";

let ai: GoogleGenAI | null = null;

function getAIClient(): GoogleGenAI | null {
  if (!GOOGLE_API_KEY) return null;
  if (!ai) ai = new GoogleGenAI({ apiKey: GOOGLE_API_KEY });
  return ai;
}

let ioInstance: SocketIOServer | null = null;

export const voiceDecisionEmitter = new EventEmitter();

export function setSocketIOInstance(io: SocketIOServer) {
  ioInstance = io;
}

export async function handleVoiceNegotiation(
  clientWs: WebSocket,
  negotiationId: number,
  roomId: string
) {
  console.log(`[VoiceNego] New connection for negotiation ${negotiationId}, room ${roomId}`);

  const aiClient = getAIClient();
  if (!aiClient) {
    console.error("[VoiceNego] GOOGLE_API_KEY not configured");
    clientWs.send(JSON.stringify({ type: "error", message: "Voice service not configured." }));
    clientWs.close();
    return;
  }

  const negotiation = await storage.getLiveNegotiationById(negotiationId);
  if (!negotiation) {
    console.error(`[VoiceNego] Negotiation ${negotiationId} not found`);
    clientWs.send(JSON.stringify({ type: "error", message: "Negotiation not found." }));
    clientWs.close();
    return;
  }

  await storage.updateLiveNegotiationStatus(negotiation.id, "active");

  if (ioInstance) {
    ioInstance.to(roomId).emit("agent_joined", { negotiationId: negotiation.id });
  }

  let session: Session | null = null;
  let isClosing = false;
  let isOnHold = false;
  let detectedFinalOfferPrice: number | null = null;

  const handleCustomerDecision = (data: { roomId: string; decision: string; negotiationId?: number }) => {
    if (data.roomId !== roomId || isClosing || !session) return;
    const { decision } = data;
    console.log(`[VoiceNego] Customer decision via Socket.IO: ${decision}`);

    isOnHold = false;

    const stayFinalOffer = detectedFinalOfferPrice ?? negotiation.final_offer_price ?? negotiation.current_premium;
    const staySaving = Math.round((negotiation.current_premium - stayFinalOffer) * 100) / 100;
    const decisionInstruction = decision === "stay"
      ? `SYSTEM DECISION: The customer has decided to stay with ${negotiation.provider_name}. Announce this to the agent professionally — let them know ${negotiation.customer_name} has decided to stay with ${negotiation.provider_name} and is happy to continue their policy at the agreed price of £${stayFinalOffer.toFixed(2)}${staySaving > 0 ? `, saving £${staySaving.toFixed(2)} compared to their previous premium` : ""}. Then listen for their response, acknowledge any closing remarks warmly, and bring the call to a natural, polite conclusion before saying goodbye.`
      : `SYSTEM DECISION: The customer has decided to proceed with ${negotiation.competitor_name} and will not be continuing with ${negotiation.provider_name}. Announce this to the agent professionally and with courtesy. Then listen for their response, acknowledge any closing remarks warmly, and bring the call to a natural, polite conclusion before saying goodbye.`;

    session.sendClientContent({
      turns: [
        {
          role: "user",
          parts: [{ text: decisionInstruction }]
        }
      ],
      turnComplete: true
    });

    storage.updateLiveNegotiationStatus(negotiation.id, "completed");

    setTimeout(() => {
      isClosing = true;
      if (ioInstance) {
        ioInstance.to(roomId).emit("negotiation_closed", { decision });
      }
      session?.close();
    }, 60000);
  };

  voiceDecisionEmitter.on("customer_decision", handleCustomerDecision);
  let currentAssistantTranscript = "";
  let currentUserTranscript = "";
  let fullAssistantTurn = "";

  const systemPrompt = buildSystemPrompt(negotiation);

  const voiceSystemPrompt = systemPrompt + `

VOICE INTERACTION NOTE:
You are speaking by voice with the insurance provider's human agent. Keep your responses natural and conversational as you are in a voice call. Speak clearly and at a moderate pace. Do not use markdown, bullet points, or formatting — you are speaking aloud.

CALL CLOSING PROTOCOL:
VERIFICATION REQUIRED: Before speaking any decision, ask yourself: "Did I receive a SYSTEM message that explicitly stated what the customer decided?" If the answer is anything other than a clear yes — if you are inferring the decision from the agent's words, tone, or from conversational context — STOP immediately. Do not speak. Return to WHILE ON HOLD mode and wait in complete silence.

This protocol ONLY activates AFTER you have received a SYSTEM message explicitly telling you what the customer decided — for example: "The customer has decided to stay with..." or "The customer has decided to proceed with...". It does NOT apply while you are on hold waiting for the customer's decision. While on hold, follow the WHILE ON HOLD rules from your base instructions.

Once you have received the system decision message and announced it to the agent:
- Pause and genuinely listen for the agent's response. They may say "understood", "thank you", "no problem", "I'm sorry to hear that", "all the best", or something similar.
- Respond warmly and professionally to whatever they say. Mirror their tone — if they are gracious, be gracious back. If they wish the customer well, reciprocate.
- Only once the agent has had a chance to speak and you have acknowledged them should you bring the call to a close.
- Your closing sign-off should feel natural, not scripted. Something like: "Thank you again for your time today — it's been a pleasure speaking with you. Take care, and I hope we can do business in the future. Goodbye." — but adapt it naturally to whatever was just said.
- If after you announce the decision the agent goes quiet and does not respond, allow a brief pause, then wrap up gracefully yourself: "Well, thank you again for your time and the offer you made. It was a pleasure speaking with you. Take care, goodbye."
- The system will close the call automatically after a short window — you do not need to worry about that. Simply focus on closing professionally and naturally.`;

  const config: LiveConnectConfig = {
    responseModalities: [Modality.AUDIO],
    systemInstruction: voiceSystemPrompt,
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

  const handleServerMessage = async (message: LiveServerMessage) => {
    if (isClosing) return;

    try {
      if (message.serverContent?.modelTurn?.parts) {
        for (const part of message.serverContent.modelTurn.parts) {
          if (part.inlineData?.data) {
            const audioData = typeof part.inlineData.data === "string"
              ? part.inlineData.data
              : Buffer.from(part.inlineData.data).toString("base64");

            if (clientWs.readyState === WebSocket.OPEN) {
              clientWs.send(JSON.stringify({ type: "audio", audio: audioData }));
            }
            if (ioInstance) {
              ioInstance.to(roomId).emit("customer_audio", { audio: audioData, sampleRate: 24000 });
            }
          }
        }
      }

      if (message.serverContent?.inputTranscription?.text) {
        const userText = message.serverContent.inputTranscription.text;
        currentUserTranscript += userText;
        console.log(`[VoiceNego] Agent said (fragment): ${userText}`);

        if (ioInstance) {
          ioInstance.to(roomId).emit("voice_transcript", {
            sender: "agent",
            text: userText,
            isFinal: false,
          });
        }

        if (clientWs.readyState === WebSocket.OPEN) {
          clientWs.send(JSON.stringify({ type: "user_transcript_delta", delta: userText }));
        }
      }

      if (message.serverContent?.outputTranscription?.text) {
        const assistantText = message.serverContent.outputTranscription.text;
        currentAssistantTranscript += assistantText;
        fullAssistantTurn += assistantText;
        console.log(`[VoiceNego] AutoAnnie said (fragment): ${assistantText}`);

        if (ioInstance) {
          ioInstance.to(roomId).emit("voice_transcript", {
            sender: "autoannie",
            text: assistantText,
            isFinal: false,
          });
        }

        if (clientWs.readyState === WebSocket.OPEN) {
          clientWs.send(JSON.stringify({ type: "assistant_transcript_delta", delta: assistantText }));
        }
      }

      if (message.serverContent?.interrupted) {
        console.log("[VoiceNego] Response interrupted");
        currentAssistantTranscript = "";
      }

      if (message.serverContent?.turnComplete) {
        const userText = currentUserTranscript.trim();
        const assistantText = currentAssistantTranscript.trim();

        console.log(`[VoiceNego] Turn complete. Agent: "${userText.substring(0, 80)}...", AA: "${assistantText.substring(0, 80)}..."`);

        if (userText) {
          await storage.createLiveNegotiationMessage({
            negotiation_id: negotiation.id,
            sender: "agent",
            message: userText,
          });

          if (ioInstance) {
            ioInstance.to(roomId).emit("voice_transcript", {
              sender: "agent",
              text: userText,
              isFinal: true,
            });
          }
        }

        if (assistantText) {
          const cleanText = assistantText
            .replace(/\[OUTCOME:(ACCEPTED|REJECTED|CONSIDERING):£[\d.]+\]/g, "")
            .trim();

          await storage.createLiveNegotiationMessage({
            negotiation_id: negotiation.id,
            sender: "autoannie",
            message: cleanText,
          });

          if (ioInstance) {
            ioInstance.to(roomId).emit("voice_transcript", {
              sender: "autoannie",
              text: cleanText,
              isFinal: true,
            });
          }
        }

        let outcome = parseOutcome(fullAssistantTurn);
        if (outcome.type === null) {
          const speechOutcome = detectOutcomeFromSpeech(fullAssistantTurn, negotiation);
          if (speechOutcome.type !== null) {
            console.log(`[VoiceNego] Outcome detected via speech pattern: ${speechOutcome.type} at £${speechOutcome.price}`);
            outcome = speechOutcome;
          }
        }
        if (outcome.type !== null) {
          console.log(`[VoiceNego] Outcome detected: ${outcome.type} at £${outcome.price}`);
          isOnHold = true;
          detectedFinalOfferPrice = outcome.price;
          const category = determineOutcomeCategory(negotiation, outcome);
          await storage.updateLiveNegotiationStatus(
            negotiation.id,
            "awaiting_customer",
            category,
            outcome.price ?? undefined
          );

          if (ioInstance) {
            ioInstance.to(roomId).emit("negotiation_outcome", {
              negotiationId: negotiation.id,
              outcome: category,
              finalOfferPrice: outcome.price,
              competitorQuote: negotiation.competitor_quote,
              providerName: negotiation.provider_name,
              competitorName: negotiation.competitor_name,
            });
          }

          fullAssistantTurn = "";
        }

        if (clientWs.readyState === WebSocket.OPEN) {
          clientWs.send(JSON.stringify({
            type: "turn_complete",
            userTranscript: userText,
            assistantTranscript: assistantText,
          }));
        }

        currentUserTranscript = "";
        currentAssistantTranscript = "";
      }
    } catch (error) {
      console.error("[VoiceNego] Error handling message:", error);
    }
  };

  try {
    session = await aiClient.live.connect({
      model: MODEL,
      config: config,
      callbacks: {
        onopen: () => {
          console.log("[VoiceNego] Connected to Gemini Live API");
          if (clientWs.readyState === WebSocket.OPEN) {
            clientWs.send(JSON.stringify({ type: "session_ready" }));
          }

          setTimeout(() => {
            if (session && !isClosing) {
              console.log("[VoiceNego] Sending opening prompt to Gemini");
              session.sendClientContent({
                turns: [
                  {
                    role: "user",
                    parts: [{ text: "You are now connected to the insurance provider's agent. Start the negotiation by introducing yourself and stating the customer's case. Begin speaking." }]
                  }
                ],
                turnComplete: true
              });
            }
          }, 500);
        },
        onmessage: (message: LiveServerMessage) => {
          handleServerMessage(message);
        },
        onerror: (error: Error) => {
          console.error("[VoiceNego] Gemini Live error:", error);
          if (clientWs.readyState === WebSocket.OPEN) {
            clientWs.send(JSON.stringify({ type: "error", message: "Voice session error" }));
          }
        },
        onclosed: () => {
          console.log("[VoiceNego] Gemini Live session closed");
          isClosing = true;
          if (clientWs.readyState === WebSocket.OPEN) {
            clientWs.send(JSON.stringify({ type: "session_closed" }));
          }
        }
      }
    });
  } catch (error) {
    console.error("[VoiceNego] Failed to connect to Gemini Live:", error);
    clientWs.send(JSON.stringify({ type: "error", message: "Failed to start voice session" }));
    clientWs.close();
    return;
  }

  clientWs.on("message", (data) => {
    if (isClosing || !session) return;

    try {
      const msg = JSON.parse(data.toString());

      if (msg.type === "audio" && msg.audio && !isOnHold) {
        session.sendRealtimeInput({
          media: {
            data: msg.audio,
            mimeType: "audio/pcm;rate=16000",
          }
        });
        if (ioInstance) {
          ioInstance.to(roomId).emit("customer_audio", { audio: msg.audio, sampleRate: 16000 });
        }
      }

      if (msg.type === "customer_decision") {
        const { decision } = msg;
        console.log(`[VoiceNego] Customer decision received: ${decision}`);

        isOnHold = false;

        const stayFinalOffer = detectedFinalOfferPrice ?? negotiation.final_offer_price ?? negotiation.current_premium;
        const staySaving = Math.round((negotiation.current_premium - stayFinalOffer) * 100) / 100;
        const decisionInstruction = decision === "stay"
          ? `SYSTEM DECISION: The customer has decided to stay with ${negotiation.provider_name}. Announce this to the agent professionally — let them know ${negotiation.customer_name} has decided to stay with ${negotiation.provider_name} and is happy to continue their policy at the agreed price of £${stayFinalOffer.toFixed(2)}${staySaving > 0 ? `, saving £${staySaving.toFixed(2)} compared to their previous premium` : ""}. Then listen for their response, acknowledge any closing remarks warmly, and bring the call to a natural, polite conclusion before saying goodbye.`
          : `SYSTEM DECISION: The customer has decided to proceed with ${negotiation.competitor_name} and will not be continuing with ${negotiation.provider_name}. Announce this to the agent professionally and with courtesy. Then listen for their response, acknowledge any closing remarks warmly, and bring the call to a natural, polite conclusion before saying goodbye.`;

        session.sendClientContent({
          turns: [
            {
              role: "user",
              parts: [{ text: decisionInstruction }]
            }
          ],
          turnComplete: true
        });

        storage.updateLiveNegotiationStatus(negotiation.id, "completed");

        setTimeout(() => {
          isClosing = true;
          if (ioInstance) {
            ioInstance.to(roomId).emit("negotiation_closed", { decision });
          }
          session?.close();
        }, 60000);
      }
    } catch (error) {
      console.error("[VoiceNego] Error processing client message:", error);
    }
  });

  clientWs.on("close", () => {
    console.log("[VoiceNego] Agent WebSocket disconnected");
    isClosing = true;
    voiceDecisionEmitter.removeListener("customer_decision", handleCustomerDecision);
    session?.close();
  });

  clientWs.on("error", (error) => {
    console.error("[VoiceNego] WebSocket error:", error);
    isClosing = true;
    voiceDecisionEmitter.removeListener("customer_decision", handleCustomerDecision);
    session?.close();
  });
}
