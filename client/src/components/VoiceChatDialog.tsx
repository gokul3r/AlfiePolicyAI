import { useState, useEffect, useRef } from "react";
import { Mic, MicOff, X, Loader2 } from "lucide-react";
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
import { motion, AnimatePresence } from "framer-motion";
import ChatQuoteCard, { type ChatQuote } from "./ChatQuoteCard";
import PaymentSection from "./PaymentSection";
import { useToast } from "@/hooks/use-toast";
import { queryClient } from "@/lib/queryClient";

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

// Map backend quote format to ChatQuote format
function mapToQuoteCard(quote: any): ChatQuote {
  return {
    insurer_name: quote.insurer || quote.insurer_name,
    alfie_touch_score: quote.autoAnnieScore || quote.alfie_touch_score || 4.0,
    alfie_message: quote.aiSummary || quote.alfie_message || "A competitive insurance option.",
    isTopMatch: false,
    quote_price: quote.annualCost || quote.quote_price,
    available_features: quote.available_features || [],
    features_matched: quote.features_matched || [],
    features_missing: quote.features_missing || []
  };
}

export function VoiceChatDialog({ open, onOpenChange, userEmail }: VoiceChatDialogProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [currentUserTranscript, setCurrentUserTranscript] = useState("");
  const [currentAssistantTranscript, setCurrentAssistantTranscript] = useState("");
  const [permissionError, setPermissionError] = useState<string | null>(null);
  
  // Voice flow states
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [quotes, setQuotes] = useState<ChatQuote[]>([]);
  const [selectedInsurer, setSelectedInsurer] = useState<{ name: string; price: number } | null>(null);
  const [purchaseComplete, setPurchaseComplete] = useState(false);
  
  const { toast } = useToast();

  const wsRef = useRef<WebSocket | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordingAudioContextRef = useRef<AudioContext | null>(null);
  const playbackAudioContextRef = useRef<AudioContext | null>(null);
  const audioStreamRef = useRef<MediaStream | null>(null);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const audioQueueRef = useRef<AudioBufferSourceNode[]>([]);
  const nextPlayTimeRef = useRef<number>(0);
  const hasAudioDataRef = useRef<boolean>(false);
  
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
  }, [messages, currentUserTranscript, currentAssistantTranscript, quotes, statusMessage]);

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
      
      // Handle status updates from voice flow
      if (data.type === "status_update") {
        setStatusMessage(data.status);
      }
      
      // Handle quotes received
      if (data.type === "quotes_received") {
        console.log("[VoiceChat] Received quotes:", data.quotes);
        const mappedQuotes = data.quotes.map(mapToQuoteCard);
        setQuotes(mappedQuotes);
        setStatusMessage(null);
      }
      
      // Handle insurer selection
      if (data.type === "insurer_selected") {
        console.log("[VoiceChat] Insurer selected:", data.insurer, data.price);
        setSelectedInsurer({ name: data.insurer, price: data.price });
      }
      
      // Handle selection cancelled
      if (data.type === "selection_cancelled") {
        setSelectedInsurer(null);
      }
      
      // Handle purchase complete
      if (data.type === "purchase_complete") {
        console.log("[VoiceChat] Purchase complete:", data.insurer);
        setSelectedInsurer(null);
        setPurchaseComplete(true);
        setStatusMessage(null);
        
        // Invalidate queries to refresh data
        queryClient.invalidateQueries({ queryKey: ["/api/vehicle-policies", userEmail] });
        
        toast({
          title: "Policy Purchased!",
          description: `Your new ${data.insurer} policy is now active.`,
        });
        
        // Reset quotes after successful purchase
        setTimeout(() => {
          setQuotes([]);
          setPurchaseComplete(false);
        }, 5000);
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
      // Full cleanup when dialog closes
      cleanupSession();
    };
  }, [open, userEmail]);

  const startRecording = async () => {
    try {
      // Clear any previous errors
      setPermissionError(null);

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioStreamRef.current = stream;

      // Create audio context for recording
      const audioContext = new AudioContext({ sampleRate: 24000 });
      recordingAudioContextRef.current = audioContext;

      // Initialize playback context if not already done (resume on user interaction)
      if (!playbackAudioContextRef.current) {
        playbackAudioContextRef.current = new AudioContext({ sampleRate: 24000 });
        await playbackAudioContextRef.current.resume();
      }

      const source = audioContext.createMediaStreamSource(stream);
      const processor = audioContext.createScriptProcessor(4096, 1, 1);

      source.connect(processor);
      processor.connect(audioContext.destination);

      // Reset audio buffer tracking
      hasAudioDataRef.current = false;

      processor.onaudioprocess = (e) => {
        if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;

        const inputData = e.inputBuffer.getChannelData(0);
        const pcm16 = convertFloat32ToPCM16(inputData);
        const base64Audio = arrayBufferToBase64(pcm16);

        // Mark that we have audio data
        hasAudioDataRef.current = true;

        wsRef.current.send(JSON.stringify({
          type: "audio",
          audio: base64Audio,
        }));
      };

      setIsRecording(true);
    } catch (error: any) {
      console.error("[VoiceChat] Error starting recording:", error);
      
      // Handle specific error cases
      if (error.name === "NotAllowedError" || error.name === "PermissionDeniedError") {
        setPermissionError(
          "Microphone access was denied. Please allow microphone permissions in your browser settings and try again."
        );
      } else if (error.name === "NotFoundError") {
        setPermissionError(
          "No microphone found. Please connect a microphone and try again."
        );
      } else if (error.name === "NotReadableError") {
        setPermissionError(
          "Your microphone is being used by another application. Please close other apps using the microphone and try again."
        );
      } else {
        setPermissionError(
          "Unable to access microphone. Please check your browser settings and try again."
        );
      }
    }
  };

  const stopRecording = () => {
    if (audioStreamRef.current) {
      audioStreamRef.current.getTracks().forEach(track => track.stop());
      audioStreamRef.current = null;
    }

    if (recordingAudioContextRef.current) {
      recordingAudioContextRef.current.close();
      recordingAudioContextRef.current = null;
    }

    // Only commit if we actually have audio data
    // Server VAD will automatically trigger response when speech ends
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN && hasAudioDataRef.current) {
      wsRef.current.send(JSON.stringify({
        type: "input_audio_buffer.commit",
      }));

      // Reset flag
      hasAudioDataRef.current = false;
    }

    setIsRecording(false);
  };

  const cleanupSession = () => {
    // Stop recording if active
    stopRecording();

    // Stop all queued audio playback
    audioQueueRef.current.forEach(source => {
      try {
        source.stop();
      } catch (e) {
        // Source may have already stopped
      }
    });
    audioQueueRef.current = [];

    // Close playback audio context to free resources
    if (playbackAudioContextRef.current) {
      playbackAudioContextRef.current.close();
      playbackAudioContextRef.current = null;
    }

    // Reset play timer for next session
    nextPlayTimeRef.current = 0;

    // Clear all messages and transcripts for fresh start
    setMessages([]);
    setCurrentUserTranscript("");
    setCurrentAssistantTranscript("");
    userTranscriptRef.current = "";
    assistantTranscriptRef.current = "";
    
    // Reset voice flow states
    setStatusMessage(null);
    setQuotes([]);
    setSelectedInsurer(null);
    setPurchaseComplete(false);

    // Close WebSocket connection (any state except already CLOSED)
    if (wsRef.current && wsRef.current.readyState !== WebSocket.CLOSED) {
      wsRef.current.close();
    }
    wsRef.current = null;

    // Reset connection state
    setIsConnecting(false);
    
    // Clear any error states
    setPermissionError(null);

    console.log("[VoiceChat] Session cleaned up");
  };

  const toggleRecording = () => {
    if (isRecording) {
      stopRecording();
    } else {
      startRecording();
    }
  };

  // Audio playback - convert PCM16 to Float32 and queue for playback
  const playAudioChunk = async (base64Audio: string) => {
    try {
      if (!playbackAudioContextRef.current) {
        playbackAudioContextRef.current = new AudioContext({ sampleRate: 24000 });
        await playbackAudioContextRef.current.resume();
      }

      const audioContext = playbackAudioContextRef.current;
      
      // Decode base64 to PCM16 ArrayBuffer
      const pcm16Buffer = base64ToArrayBuffer(base64Audio);
      const pcm16Array = new Int16Array(pcm16Buffer);
      
      // Convert PCM16 to Float32
      const float32Array = new Float32Array(pcm16Array.length);
      for (let i = 0; i < pcm16Array.length; i++) {
        float32Array[i] = pcm16Array[i] / (pcm16Array[i] < 0 ? 0x8000 : 0x7fff);
      }
      
      // Create AudioBuffer
      const audioBuffer = audioContext.createBuffer(1, float32Array.length, 24000);
      audioBuffer.getChannelData(0).set(float32Array);
      
      // Create source and queue for playback
      const source = audioContext.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(audioContext.destination);
      
      // Schedule playback to avoid gaps/overlaps
      const currentTime = audioContext.currentTime;
      const startTime = Math.max(currentTime, nextPlayTimeRef.current);
      source.start(startTime);
      
      // Update next play time
      nextPlayTimeRef.current = startTime + audioBuffer.duration;
      
      audioQueueRef.current.push(source);
      
      // Clean up finished sources
      source.onended = () => {
        const index = audioQueueRef.current.indexOf(source);
        if (index > -1) {
          audioQueueRef.current.splice(index, 1);
        }
      };
    } catch (error) {
      console.error("[VoiceChat] Error playing audio:", error);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent 
        className="sm:max-w-2xl h-[85vh] flex flex-col p-0"
        data-testid="dialog-voice-chat"
      >
        <DialogHeader className="px-6 py-4 border-b shrink-0">
          <div className="flex items-center justify-between">
            <DialogTitle>Talk with AutoAnnie</DialogTitle>
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
            {/* Conversation messages */}
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
                      AA
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
                    AA
                  </AvatarFallback>
                </Avatar>
                <div className="rounded-lg px-4 py-2 max-w-[75%] bg-muted/70">
                  <p className="text-sm italic">{currentAssistantTranscript}</p>
                </div>
              </div>
            )}
            
            {/* Status message indicator */}
            <AnimatePresence mode="wait">
              {statusMessage && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.3 }}
                  className="flex justify-start"
                >
                  <div className="bg-gradient-to-r from-primary/10 to-primary/5 border border-primary/20 rounded-lg px-4 py-3 max-w-[85%]">
                    <div className="flex items-center gap-3">
                      <motion.div
                        animate={{ rotate: 360 }}
                        transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }}
                      >
                        <Loader2 className="w-4 h-4 text-primary" />
                      </motion.div>
                      <span className="text-sm font-medium text-foreground">
                        {statusMessage}
                      </span>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
            
            {/* Quote cards display */}
            {quotes.length > 0 && (
              <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="space-y-3 my-4"
              >
                <p className="text-sm text-muted-foreground mb-2">
                  Here are your insurance quotes:
                </p>
                {quotes.map((quote, idx) => (
                  <ChatQuoteCard 
                    key={`voice-quote-${idx}`} 
                    quote={quote} 
                    index={idx}
                  />
                ))}
              </motion.div>
            )}
            
            {/* Payment section - shown when insurer is selected */}
            <AnimatePresence>
              {selectedInsurer && !purchaseComplete && (
                <PaymentSection 
                  totalAmount={selectedInsurer.price} 
                  insurerName={selectedInsurer.name}
                />
              )}
            </AnimatePresence>
            
            {/* Purchase success indicator */}
            {purchaseComplete && (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 rounded-lg p-4 text-center"
              >
                <p className="text-green-700 dark:text-green-300 font-medium">
                  Policy purchased successfully!
                </p>
              </motion.div>
            )}
          </div>
        </ScrollArea>

        <div className="px-6 py-4 border-t shrink-0">
          {permissionError ? (
            <div className="space-y-4">
              <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-4">
                <p className="text-sm text-destructive font-medium mb-2">
                  Microphone Access Required
                </p>
                <p className="text-sm text-muted-foreground">
                  {permissionError}
                </p>
              </div>
              <div className="flex items-center justify-center gap-3">
                <Button
                  variant="default"
                  onClick={() => {
                    setPermissionError(null);
                    startRecording();
                  }}
                  data-testid="button-retry-microphone"
                >
                  Try Again
                </Button>
                <Button
                  variant="outline"
                  onClick={() => onOpenChange(false)}
                  data-testid="button-cancel-voice-chat"
                >
                  Cancel
                </Button>
              </div>
            </div>
          ) : (
            <>
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
              
              {/* Voice flow hints */}
              {quotes.length > 0 && !selectedInsurer && (
                <p className="text-center text-xs text-muted-foreground mt-2">
                  Say an insurer name like "Go with Admiral" to select
                </p>
              )}
              {selectedInsurer && (
                <p className="text-center text-xs text-muted-foreground mt-2">
                  Say "Yes" or "Proceed" to confirm the purchase
                </p>
              )}
            </>
          )}
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
