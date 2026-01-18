import WebSocket from "ws";
import { GoogleGenAI, Modality, Session, LiveConnectConfig, LiveServerMessage } from "@google/genai";

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

When users ask about getting quotes, tell them you'd be happy to help search for insurance quotes. Ask what type of insurance they're looking for (car, home, etc.).

For non-insurance questions, politely redirect the conversation back to insurance, explaining that you specialize in finding the best insurance deals.`;

const GREETING_TEXT = "Hello! I'm Annie, your insurance assistant. How can I help you with your insurance today?";

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
        console.log(`[VoiceChatGemini] Turn complete. User: "${currentUserTranscript}", Assistant: "${currentAssistantTranscript}"`);
        
        if (greetingTimeout) {
          clearTimeout(greetingTimeout);
          greetingTimeout = null;
        }
        
        clientWs.send(JSON.stringify({
          type: "turn_complete",
          userTranscript: currentUserTranscript.trim(),
          assistantTranscript: currentAssistantTranscript.trim(),
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
