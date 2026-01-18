import WebSocket from "ws";
import OpenAI from "openai";

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const OPENAI_REALTIME_URL = "wss://api.openai.com/v1/realtime?model=gpt-realtime-mini";

const openai = new OpenAI({ apiKey: OPENAI_API_KEY });


/**
 * Simple intent detection: Is this a quote-related request?
 * Uses GPT-4o-mini for semantic understanding
 */
async function isQuoteRelatedIntent(transcript: string): Promise<boolean> {
  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: `You are an intent classifier. Determine if the user's message is related to insurance quotes, getting insurance prices, comparing insurance, or switching insurers.

Return ONLY "yes" or "no".

Examples of quote-related:
- "I want to find cheaper insurance" -> yes
- "Can you get me some quotes?" -> yes
- "How much would insurance cost?" -> yes
- "I'd like to compare prices" -> yes
- "Find me a better deal" -> yes
- "Search for quotes" -> yes

Examples of NOT quote-related:
- "What's the weather today?" -> no
- "Tell me a joke" -> no
- "What time is it?" -> no
- "How does car insurance work?" -> no (this is a general question, not a quote request)
- "Hello" -> no
- "Who are you?" -> no`
        },
        {
          role: "user",
          content: transcript
        }
      ],
      max_tokens: 10,
      temperature: 0
    });

    const result = response.choices[0]?.message?.content?.toLowerCase().trim();
    console.log(`[VoiceChat2.0] Intent check for "${transcript}": ${result}`);
    return result === "yes";
  } catch (error) {
    console.error("[VoiceChat2.0] Intent detection error:", error);
    return false;
  }
}

/**
 * Voice Chat Handler 2.0
 * Simplified version focusing on:
 * 1. Greeting the user
 * 2. Detecting if they want quotes
 * 3. Politely redirecting non-quote requests
 */
export async function handleVoiceChat(clientWs: WebSocket, emailId: string) {
  console.log(`[VoiceChat2.0] New connection for ${emailId}`);

  // Connect to OpenAI Realtime API
  const openaiWs = new WebSocket(OPENAI_REALTIME_URL, {
    headers: {
      "Authorization": `Bearer ${OPENAI_API_KEY}`,
      "OpenAI-Beta": "realtime=v1",
    },
  });

  // Flag to ensure welcome greeting only plays once
  let hasGreeted = false;

  // Helper to send TTS message through OpenAI Realtime
  const sendVoiceMessage = (text: string) => {
    console.log(`[VoiceChat2.0] Sending voice message: "${text}"`);
    
    // Send text transcript to client for display
    clientWs.send(JSON.stringify({
      type: "assistant_transcript",
      transcript: text,
    }));
    
    if (openaiWs.readyState === WebSocket.OPEN) {
      // Use response.create with inline input for TTS
      openaiWs.send(JSON.stringify({
        type: "response.create",
        response: {
          modalities: ["text", "audio"],
          instructions: "You are Annie, a warm and friendly insurance assistant. Read the following text aloud with a helpful, reassuring tone. Do not add extra commentary - just deliver the message naturally and warmly.",
          input: [{
            type: "message",
            role: "assistant",
            content: [{ 
              type: "text", 
              text: text 
            }]
          }]
        }
      }));
    }
  };

  // Process user speech and respond appropriately
  const processUserSpeech = async (transcript: string) => {
    console.log(`[VoiceChat2.0] Processing user speech: "${transcript}"`);
    
    // Check if this is a quote-related request
    const isQuoteRequest = await isQuoteRelatedIntent(transcript);
    
    if (isQuoteRequest) {
      // User wants quotes - acknowledge and prepare (placeholder for now)
      sendVoiceMessage("Great! I'd love to help you find some insurance quotes. Let me gather the information I need. This feature is coming soon!");
    } else {
      // Not quote-related - politely explain our focus
      sendVoiceMessage("I'm Annie, your insurance assistant. I specialise in finding you the best insurance quotes. Would you like me to search for some quotes for you?");
    }
  };

  openaiWs.on("open", () => {
    console.log("[VoiceChat2.0] Connected to OpenAI Realtime API");

    // Initialize session with voice settings
    // CRITICAL: create_response: false prevents OpenAI from auto-responding
    // We manually control all responses via sendVoiceMessage()
    const sessionConfig = {
      type: "session.update",
      session: {
        modalities: ["text", "audio"],
        instructions: `You are Annie, a warm and friendly female insurance assistant. Your ONLY job is to read text aloud EXACTLY as provided.

RULES:
1. READ ONLY the exact text provided - word for word, nothing more
2. Use a warm, friendly, and reassuring British tone
3. NEVER add commentary, opinions, or follow-up questions after reading
4. STOP immediately after reading the provided text

You are a voice reader, not a chatbot. Read the text and stop.`,
        voice: "shimmer",
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
          create_response: false,  // CRITICAL: Disable auto-responses - we control all responses manually
        },
      },
    };

    openaiWs.send(JSON.stringify(sessionConfig));
  });

  openaiWs.on("message", async (data: Buffer) => {
    try {
      const event = JSON.parse(data.toString());

      switch (event.type) {
        case "session.created":
        case "session.updated":
          console.log(`[VoiceChat2.0] ${event.type}`);
          // Signal client that session is ready
          clientWs.send(JSON.stringify({ type: "session_ready" }));
          
          // Send greeting if we haven't yet
          if (!hasGreeted) {
            hasGreeted = true;
            setTimeout(() => {
              sendVoiceMessage("Hello! I'm Annie, your insurance assistant. How can I help you today?");
            }, 500);
          }
          break;

        case "input_audio_buffer.speech_started":
          console.log("[VoiceChat2.0] User started speaking");
          break;

        case "input_audio_buffer.speech_stopped":
          console.log("[VoiceChat2.0] User stopped speaking");
          break;

        case "conversation.item.input_audio_transcription.completed":
          // User finished speaking - we have their transcript
          const userTranscript = event.transcript?.trim();
          if (userTranscript) {
            console.log(`[VoiceChat2.0] User said: "${userTranscript}"`);
            
            // Send to client for display
            clientWs.send(JSON.stringify({
              type: "user_transcript",
              transcript: userTranscript,
            }));
            
            // Process and respond
            await processUserSpeech(userTranscript);
          }
          break;

        case "response.audio.delta":
          // Forward audio to client
          if (event.delta) {
            clientWs.send(JSON.stringify({
              type: "audio",
              audio: event.delta,
            }));
          }
          break;

        case "response.done":
          console.log("[VoiceChat2.0] Response complete");
          break;

        case "error":
          console.error("[VoiceChat2.0] OpenAI error:", event.error);
          break;
      }
    } catch (error) {
      console.error("[VoiceChat2.0] Error processing message:", error);
    }
  });

  openaiWs.on("error", (error) => {
    console.error("[VoiceChat2.0] OpenAI WebSocket error:", error);
    clientWs.send(JSON.stringify({
      type: "error",
      message: "Connection error with voice service",
    }));
  });

  openaiWs.on("close", (code, reason) => {
    console.log(`[VoiceChat2.0] OpenAI connection closed: ${code} ${reason}`);
  });

  // Handle messages from client (audio data)
  clientWs.on("message", (data: Buffer) => {
    try {
      const message = JSON.parse(data.toString());
      
      if (message.type === "audio" && message.audio) {
        // Forward audio to OpenAI
        if (openaiWs.readyState === WebSocket.OPEN) {
          openaiWs.send(JSON.stringify({
            type: "input_audio_buffer.append",
            audio: message.audio,
          }));
        }
      }
    } catch (error) {
      // Binary audio data - forward to OpenAI as base64
      if (openaiWs.readyState === WebSocket.OPEN && data instanceof Buffer) {
        openaiWs.send(JSON.stringify({
          type: "input_audio_buffer.append",
          audio: data.toString("base64"),
        }));
      }
    }
  });

  clientWs.on("close", () => {
    console.log("[VoiceChat2.0] Client disconnected");
    if (openaiWs.readyState === WebSocket.OPEN) {
      openaiWs.close();
    }
  });

  clientWs.on("error", (error) => {
    console.error("[VoiceChat2.0] Client WebSocket error:", error);
  });
}
