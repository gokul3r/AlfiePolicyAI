import WebSocket from "ws";
import { storage } from "./storage";
import { buildPolicyContext } from "./policy-context-builder";

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const OPENAI_REALTIME_URL = "wss://api.openai.com/v1/realtime?model=gpt-realtime-mini";

interface TranscriptionBuffer {
  userTranscript: string;
  assistantTranscript: string;
}

/**
 * Handles WebSocket connection for voice chat with gpt-realtime-mini
 * Manages bidirectional audio streaming and transcription persistence
 */
export async function handleVoiceChat(clientWs: WebSocket, emailId: string) {
  console.log(`[VoiceChat] New connection for ${emailId}`);

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

  openaiWs.on("open", () => {
    console.log("[VoiceChat] Connected to OpenAI Realtime API");

    // Initialize session with AutoAnnie personality + policy context
    const sessionConfig = {
      type: "session.update",
      session: {
        modalities: ["text", "audio"],
        instructions: `You are AutoAnnie, a friendly UK car insurance assistant helping users understand their policies and answer insurance questions.

PERSONALITY:
- Warm, approachable, and trustworthy
- Use everyday language (avoid jargon)
- Keep responses VERY brief: 1-5 lines maximum (shorter is better)
- Never include citations, source references, or disclaimers
- Be conversational and helpful

POLICY CONTEXT:
${policyContext}

IMPORTANT:
- Use the policy context above to answer specific questions about the user's coverage
- For general insurance questions, use your base knowledge
- Always relate answers to UK insurance practices
- Be concise - voice responses should be quick and clear`,
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
          silence_duration_ms: 500,
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

      // Capture user transcription
      if (event.type === "conversation.item.input_audio_transcription.completed") {
        transcriptionBuffer.userTranscript = event.transcript || "";
        console.log(`[VoiceChat] User said: ${transcriptionBuffer.userTranscript}`);
        
        // Send to client for UI display
        clientWs.send(JSON.stringify({
          type: "user_transcript",
          transcript: transcriptionBuffer.userTranscript,
        }));
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

      // Log errors
      if (event.type === "error") {
        console.error("[VoiceChat] OpenAI error:", event.error);
        clientWs.send(JSON.stringify({
          type: "error",
          message: event.error?.message || "Unknown error",
        }));
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
