import { useState, useEffect, useRef } from "react";
import { Mic, MicOff, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

interface Message {
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
}

interface VoiceChatDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userEmail: string;
}

export function VoiceChatDialog({ open, onOpenChange, userEmail }: VoiceChatDialogProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [currentUserTranscript, setCurrentUserTranscript] = useState("");
  const [currentAssistantTranscript, setCurrentAssistantTranscript] = useState("");

  const wsRef = useRef<WebSocket | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const audioStreamRef = useRef<MediaStream | null>(null);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  
  // Use refs to track transcripts to avoid stale closure in WebSocket handler
  const userTranscriptRef = useRef<string>("");
  const assistantTranscriptRef = useRef<string>("");

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (scrollAreaRef.current) {
      const scrollContainer = scrollAreaRef.current.querySelector('[data-radix-scroll-area-viewport]');
      if (scrollContainer) {
        scrollContainer.scrollTop = scrollContainer.scrollHeight;
      }
    }
  }, [messages, currentUserTranscript, currentAssistantTranscript]);

  // Initialize WebSocket connection when dialog opens
  useEffect(() => {
    if (!open) return;

    setIsConnecting(true);
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const wsUrl = `${protocol}//${window.location.host}/api/voice-chat?email=${encodeURIComponent(userEmail)}`;
    
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      console.log("[VoiceChat] WebSocket connected");
    };

    ws.onmessage = async (event) => {
      const data = JSON.parse(event.data);

      if (data.type === "session_ready") {
        setIsConnecting(false);
        console.log("[VoiceChat] Session ready");
      }

      if (data.type === "user_transcript") {
        userTranscriptRef.current = data.transcript;
        setCurrentUserTranscript(data.transcript);
      }

      if (data.type === "assistant_transcript") {
        assistantTranscriptRef.current = data.transcript;
        setCurrentAssistantTranscript(data.transcript);
        
        // Add completed messages to history using refs (not stale state)
        const userText = userTranscriptRef.current;
        const assistantText = assistantTranscriptRef.current;
        
        if (userText && assistantText) {
          setMessages(prev => [
            ...prev,
            { role: "user", content: userText, timestamp: new Date() },
            { role: "assistant", content: assistantText, timestamp: new Date() },
          ]);
          
          // Reset both state and refs
          userTranscriptRef.current = "";
          assistantTranscriptRef.current = "";
          setCurrentUserTranscript("");
          setCurrentAssistantTranscript("");
        }
      }

      if (data.type === "audio" && data.audio) {
        // Play audio response
        await playAudioChunk(data.audio);
      }

      if (data.type === "error") {
        console.error("[VoiceChat] Error:", data.message);
      }
    };

    ws.onerror = (error) => {
      console.error("[VoiceChat] WebSocket error:", error);
      setIsConnecting(false);
    };

    ws.onclose = () => {
      console.log("[VoiceChat] WebSocket closed");
      setIsConnecting(false);
      stopRecording();
    };

    return () => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.close();
      }
      stopRecording();
    };
  }, [open, userEmail]);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioStreamRef.current = stream;

      // Create audio context for processing
      const audioContext = new AudioContext({ sampleRate: 24000 });
      audioContextRef.current = audioContext;

      const source = audioContext.createMediaStreamSource(stream);
      const processor = audioContext.createScriptProcessor(4096, 1, 1);

      source.connect(processor);
      processor.connect(audioContext.destination);

      processor.onaudioprocess = (e) => {
        if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;

        const inputData = e.inputBuffer.getChannelData(0);
        const pcm16 = convertFloat32ToPCM16(inputData);
        const base64Audio = arrayBufferToBase64(pcm16);

        wsRef.current.send(JSON.stringify({
          type: "audio",
          audio: base64Audio,
        }));
      };

      setIsRecording(true);
    } catch (error) {
      console.error("[VoiceChat] Error starting recording:", error);
    }
  };

  const stopRecording = () => {
    if (audioStreamRef.current) {
      audioStreamRef.current.getTracks().forEach(track => track.stop());
      audioStreamRef.current = null;
    }

    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }

    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: "input_audio_buffer.commit",
      }));
    }

    setIsRecording(false);
  };

  const toggleRecording = () => {
    if (isRecording) {
      stopRecording();
    } else {
      startRecording();
    }
  };

  // Audio playback
  const playAudioChunk = async (base64Audio: string) => {
    try {
      const audioData = base64ToArrayBuffer(base64Audio);
      const audioContext = new AudioContext({ sampleRate: 24000 });
      const audioBuffer = await audioContext.decodeAudioData(audioData);
      
      const source = audioContext.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(audioContext.destination);
      source.start();
    } catch (error) {
      console.error("[VoiceChat] Error playing audio:", error);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl h-[80vh] flex flex-col p-0">
        <DialogHeader className="px-6 py-4 border-b">
          <div className="flex items-center justify-between">
            <DialogTitle>Talk with AutoSage</DialogTitle>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => onOpenChange(false)}
              data-testid="button-close-voice-chat"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </DialogHeader>

        <ScrollArea className="flex-1 px-6" ref={scrollAreaRef}>
          <div className="space-y-4 py-4">
            {messages.map((msg, idx) => (
              <div
                key={idx}
                className={cn(
                  "flex gap-3",
                  msg.role === "user" ? "justify-end" : "justify-start"
                )}
                data-testid={`message-${msg.role}-${idx}`}
              >
                {msg.role === "assistant" && (
                  <Avatar className="h-8 w-8 mt-1">
                    <AvatarFallback className="bg-primary text-primary-foreground text-xs">
                      AS
                    </AvatarFallback>
                  </Avatar>
                )}
                <div
                  className={cn(
                    "rounded-lg px-4 py-2 max-w-[75%]",
                    msg.role === "user"
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted"
                  )}
                >
                  <p className="text-sm">{msg.content}</p>
                </div>
              </div>
            ))}

            {/* Current transcripts being built */}
            {currentUserTranscript && (
              <div className="flex gap-3 justify-end">
                <div className="rounded-lg px-4 py-2 max-w-[75%] bg-primary/70 text-primary-foreground">
                  <p className="text-sm italic">{currentUserTranscript}</p>
                </div>
              </div>
            )}

            {currentAssistantTranscript && (
              <div className="flex gap-3 justify-start">
                <Avatar className="h-8 w-8 mt-1">
                  <AvatarFallback className="bg-primary text-primary-foreground text-xs">
                    AS
                  </AvatarFallback>
                </Avatar>
                <div className="rounded-lg px-4 py-2 max-w-[75%] bg-muted/70">
                  <p className="text-sm italic">{currentAssistantTranscript}</p>
                </div>
              </div>
            )}
          </div>
        </ScrollArea>

        <div className="px-6 py-4 border-t">
          <div className="flex items-center justify-center gap-4">
            <Button
              size="lg"
              variant={isRecording ? "destructive" : "default"}
              className="rounded-full h-16 w-16"
              onClick={toggleRecording}
              disabled={isConnecting}
              data-testid="button-toggle-recording"
            >
              {isRecording ? (
                <MicOff className="h-6 w-6" />
              ) : (
                <Mic className="h-6 w-6" />
              )}
            </Button>
          </div>
          <p className="text-center text-sm text-muted-foreground mt-3">
            {isConnecting
              ? "Connecting..."
              : isRecording
              ? "Listening... Tap to stop"
              : "Tap to speak"}
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// Audio conversion utilities
function convertFloat32ToPCM16(float32Array: Float32Array): ArrayBuffer {
  const pcm16 = new Int16Array(float32Array.length);
  for (let i = 0; i < float32Array.length; i++) {
    const s = Math.max(-1, Math.min(1, float32Array[i]));
    pcm16[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
  }
  return pcm16.buffer;
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binaryString = atob(base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes.buffer;
}
