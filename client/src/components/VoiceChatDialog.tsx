import { useState, useEffect, useRef, useCallback } from "react";
import { Mic, MicOff, X, Loader2, Volume2, VolumeX } from "lucide-react";
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

interface VehicleForDisplay {
  policy_id: string;
  vehicle_registration_number: string;
  vehicle_manufacturer_name: string;
  vehicle_model: string;
  vehicle_year: number;
}

interface QuoteDetails {
  email_id: string;
  driver_age: number;
  vehicle_registration_number: string;
  vehicle_manufacturer_name: string;
  vehicle_model: string;
  vehicle_year: number;
  type_of_fuel: string;
  type_of_cover_needed: string;
  no_claim_bonus_years: number;
  voluntary_excess: number;
  current_insurance_provider: string;
  policy_id: string;
  policy_type: string;
  policy_end_date: string;
  policy_number: string;
  whisper_preferences: string;
}

function mapToQuoteCard(quote: any): ChatQuote {
  const originalQuote = quote.original_quote?.output || quote.original_quote || quote;
  const aiAnalysis = quote.ai_analysis || {};
  
  return {
    insurer_name: quote.insurer_name || originalQuote.insurer_name || quote.insurer || "Unknown",
    alfie_touch_score: quote.alfie_touch_score || aiAnalysis.alfie_touch_score || quote.autoAnnieScore || 4.0,
    alfie_message: aiAnalysis.alfie_message || quote.alfie_message || quote.aiSummary || "A competitive insurance option.",
    isTopMatch: false,
    quote_price: originalQuote.policy_cost || quote.policy_cost || quote.annualCost || quote.quote_price,
    available_features: aiAnalysis.available_features || quote.available_features || [],
    features_matched: aiAnalysis.features_matched || quote.features_matched || [],
    features_missing: aiAnalysis.features_missing || quote.features_missing || []
  };
}

interface SpeechRecognitionEvent {
  resultIndex: number;
  results: SpeechRecognitionResultList;
}

interface SpeechRecognitionErrorEvent {
  error: string;
  message?: string;
}

interface SpeechRecognitionResultList {
  length: number;
  item(index: number): SpeechRecognitionResult;
  [index: number]: SpeechRecognitionResult;
}

interface SpeechRecognitionResult {
  isFinal: boolean;
  length: number;
  item(index: number): SpeechRecognitionAlternative;
  [index: number]: SpeechRecognitionAlternative;
}

interface SpeechRecognitionAlternative {
  transcript: string;
  confidence: number;
}

interface SpeechRecognition extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start(): void;
  stop(): void;
  abort(): void;
  onstart: ((this: SpeechRecognition, ev: Event) => any) | null;
  onend: ((this: SpeechRecognition, ev: Event) => any) | null;
  onresult: ((this: SpeechRecognition, ev: SpeechRecognitionEvent) => any) | null;
  onerror: ((this: SpeechRecognition, ev: SpeechRecognitionErrorEvent) => any) | null;
}

interface SpeechRecognitionConstructor {
  new (): SpeechRecognition;
}

declare global {
  interface Window {
    SpeechRecognition: SpeechRecognitionConstructor;
    webkitSpeechRecognition: SpeechRecognitionConstructor;
  }
}

export function VoiceChatDialog({ open, onOpenChange, userEmail }: VoiceChatDialogProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [speakerEnabled, setSpeakerEnabled] = useState(true);
  const [messages, setMessages] = useState<Message[]>([]);
  const [currentUserTranscript, setCurrentUserTranscript] = useState("");
  const [permissionError, setPermissionError] = useState<string | null>(null);
  
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [quotes, setQuotes] = useState<ChatQuote[]>([]);
  const [selectedInsurer, setSelectedInsurer] = useState<{ name: string; price: number } | null>(null);
  const [showPaymentCard, setShowPaymentCard] = useState(false);
  const [purchaseComplete, setPurchaseComplete] = useState(false);
  
  const [vehicleList, setVehicleList] = useState<VehicleForDisplay[]>([]);
  const [quoteDetails, setQuoteDetails] = useState<QuoteDetails | null>(null);
  const [isSearchingQuotes, setIsSearchingQuotes] = useState(false);
  
  const { toast } = useToast();

  const wsRef = useRef<WebSocket | null>(null);
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const isRecordingRef = useRef<boolean>(false);
  const sessionIdRef = useRef<number>(0);
  const isProcessingRef = useRef<boolean>(false);
  const pendingMessageRef = useRef<string>("");
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (scrollAreaRef.current) {
      const scrollContainer = scrollAreaRef.current.querySelector('[data-radix-scroll-area-viewport]');
      if (scrollContainer) {
        scrollContainer.scrollTop = scrollContainer.scrollHeight;
      }
    }
  }, [messages, currentUserTranscript, quotes, statusMessage]);

  const speak = useCallback((text: string) => {
    if (!speakerEnabled || !text) return;
    
    window.speechSynthesis.cancel();
    
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'en-GB';
    utterance.rate = 1.0;
    utterance.pitch = 1.0;
    
    const voices = window.speechSynthesis.getVoices();
    const britishFemale = voices.find(v => 
      v.lang.includes('en-GB') && v.name.toLowerCase().includes('female')
    ) || voices.find(v => v.lang.includes('en-GB')) || voices[0];
    
    if (britishFemale) {
      utterance.voice = britishFemale;
    }
    
    utterance.onstart = () => setIsSpeaking(true);
    utterance.onend = () => setIsSpeaking(false);
    utterance.onerror = () => setIsSpeaking(false);
    
    window.speechSynthesis.speak(utterance);
  }, [speakerEnabled]);

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

      if (data.type === "assistant_response" && data.text) {
        console.log("[VoiceChat] Assistant:", data.text);
        setMessages(prev => [
          ...prev,
          { role: "assistant", content: data.text, timestamp: new Date() }
        ]);
        speak(data.text);
        
        isProcessingRef.current = false;
        
        if (pendingMessageRef.current && wsRef.current?.readyState === WebSocket.OPEN) {
          const pending = pendingMessageRef.current;
          pendingMessageRef.current = "";
          setTimeout(() => {
            if (!isProcessingRef.current) {
              isProcessingRef.current = true;
              console.log("[VoiceChat] Sending queued message:", pending);
              setMessages(prev => [
                ...prev,
                { role: "user", content: pending, timestamp: new Date() }
              ]);
              wsRef.current?.send(JSON.stringify({
                type: "user_message",
                text: pending,
              }));
            }
          }, 100);
        }
      }

      if (data.type === "status_update") {
        setStatusMessage(data.status);
      }
      
      if (data.type === "quotes_received") {
        const rawQuotes = data.quotes_with_insights || data.quotes || [];
        console.log("[VoiceChat] Received quotes:", rawQuotes.length);
        
        const sortedQuotes = [...rawQuotes].sort((a: any, b: any) => {
          const scoreA = a.alfie_touch_score || a.ai_analysis?.alfie_touch_score || 0;
          const scoreB = b.alfie_touch_score || b.ai_analysis?.alfie_touch_score || 0;
          return scoreB - scoreA;
        });
        const topQuotes = sortedQuotes.slice(0, 3);
        
        const mappedQuotes = topQuotes.map((q: any, idx: number) => ({
          ...mapToQuoteCard(q),
          isTopMatch: idx === 0
        }));
        setQuotes(mappedQuotes);
        setStatusMessage(null);
        
        wsRef.current?.send(JSON.stringify({
          type: "quote_results",
          quotes: mappedQuotes.map(q => ({
            insurer_name: q.insurer_name,
            policy_cost: q.quote_price,
          })),
        }));
      }
      
      if (data.type === "insurer_selected" || data.type === "quote_selected") {
        console.log("[VoiceChat] Quote selected:", data.insurer, data.price);
        setSelectedInsurer({ name: data.insurer, price: data.price });
      }
      
      if (data.type === "selection_cancelled" || data.type === "purchase_cancelled") {
        console.log("[VoiceChat] Cancelled");
        setSelectedInsurer(null);
        setShowPaymentCard(false);
      }
      
      if (data.type === "show_payment_card") {
        console.log("[VoiceChat] Show payment:", data.insurer, data.price);
        setSelectedInsurer({ name: data.insurer, price: data.price });
        setShowPaymentCard(true);
      }
      
      if (data.type === "payment_cancelled") {
        setSelectedInsurer(null);
        setShowPaymentCard(false);
      }
      
      if (data.type === "purchase_confirmed") {
        setStatusMessage("Processing your policy switch...");
      }
      
      if (data.type === "purchase_status") {
        setStatusMessage(data.status);
      }
      
      if (data.type === "purchase_error") {
        setStatusMessage(null);
        setSelectedInsurer(null);
        setShowPaymentCard(false);
        toast({
          title: "Purchase Failed",
          description: data.message || "Something went wrong.",
          variant: "destructive",
        });
      }
      
      if (data.type === "purchase_complete") {
        setSelectedInsurer(null);
        setShowPaymentCard(false);
        setPurchaseComplete(true);
        setStatusMessage(null);
        
        queryClient.invalidateQueries({ queryKey: ["/api/vehicle-policies", userEmail] });
        
        toast({
          title: "Policy Purchased!",
          description: `Your new ${data.insurer} policy is now active.`,
        });
        
        setTimeout(() => {
          setQuotes([]);
          setPurchaseComplete(false);
        }, 5000);
      }
      
      if (data.type === "show_vehicle_selection") {
        console.log("[VoiceChat] Vehicle selection:", data.vehicles);
        setVehicleList(data.vehicles || []);
      }
      
      if (data.type === "show_quote_details") {
        console.log("[VoiceChat] Quote details:", data.details);
        setQuoteDetails(data.details);
        setVehicleList([]);
      }
      
      if (data.type === "trigger_quote_search") {
        console.log("[VoiceChat] Triggering quote search");
        setIsSearchingQuotes(true);
        setStatusMessage("Searching for the best quotes...");
        setQuoteDetails(null);
        
        try {
          const vehicle = data.vehicle;
          const requestPayload = {
            insurance_details: {
              email_id: vehicle.email_id || userEmail,
              driver_age: vehicle.details.driver_age,
              vehicle_registration_number: vehicle.details.vehicle_registration_number,
              vehicle_manufacturer_name: vehicle.details.vehicle_manufacturer_name,
              vehicle_model: vehicle.details.vehicle_model,
              vehicle_year: vehicle.details.vehicle_year,
              type_of_fuel: vehicle.details.type_of_fuel,
              type_of_Cover_needed: vehicle.details.type_of_cover_needed,
              No_Claim_bonus_years: vehicle.details.no_claim_bonus_years,
              Voluntary_Excess: vehicle.details.voluntary_excess,
              current_insurance_provider: vehicle.current_insurance_provider,
              policy_id: vehicle.policy_id,
              policy_type: vehicle.policy_type,
            },
            user_preferences: vehicle.whisper_preferences || "",
          };
          
          const response = await fetch("/api/search-quotes", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(requestPayload),
          });
          
          if (response.ok) {
            const quotesData = await response.json();
            console.log("[VoiceChat] Quote results:", quotesData);
            
            const rawQuotes = quotesData.quotes_with_insights || quotesData.quotes || [];
            
            const sortedQuotes = [...rawQuotes].sort((a, b) => {
              const scoreA = a.alfie_touch_score || a.ai_analysis?.alfie_touch_score || 0;
              const scoreB = b.alfie_touch_score || b.ai_analysis?.alfie_touch_score || 0;
              return scoreB - scoreA;
            });
            const topQuotes = sortedQuotes.slice(0, 3);
            
            const mappedQuotes = topQuotes.map((q, idx) => ({
              ...mapToQuoteCard(q),
              isTopMatch: idx === 0
            }));
            
            setQuotes(mappedQuotes);
            
            wsRef.current?.send(JSON.stringify({
              type: "quote_results",
              quotes: mappedQuotes.map(q => ({
                insurer_name: q.insurer_name,
                policy_cost: q.quote_price,
              })),
            }));
          } else {
            throw new Error(`API error: ${response.status}`);
          }
        } catch (error) {
          console.error("[VoiceChat] Quote search error:", error);
          toast({
            title: "Search Failed",
            description: "Could not find quotes. Please try again.",
            variant: "destructive",
          });
        } finally {
          setIsSearchingQuotes(false);
          setStatusMessage(null);
        }
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
      cleanupSession();
    };
  }, [open, userEmail, speak, toast]);

  const sendMessage = useCallback((text: string) => {
    if (!text.trim() || !wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;
    
    if (isProcessingRef.current) {
      console.log("[VoiceChat] Already processing, queueing:", text);
      pendingMessageRef.current = text.trim();
      return;
    }
    
    isProcessingRef.current = true;
    console.log("[VoiceChat] Sending:", text);
    
    setMessages(prev => [
      ...prev,
      { role: "user", content: text.trim(), timestamp: new Date() }
    ]);
    
    wsRef.current.send(JSON.stringify({
      type: "user_message",
      text: text.trim(),
    }));
  }, []);

  const startRecording = async () => {
    try {
      setPermissionError(null);
      
      const SpeechRecognitionAPI = window.SpeechRecognition || window.webkitSpeechRecognition;
      
      if (!SpeechRecognitionAPI) {
        setPermissionError("Speech recognition is not supported in this browser. Please use Chrome, Edge, or Safari.");
        return;
      }
      
      sessionIdRef.current += 1;
      const currentSessionId = sessionIdRef.current;
      
      const recognition = new SpeechRecognitionAPI();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = 'en-GB';
      
      const restartRecognition = () => {
        if (!isRecordingRef.current || sessionIdRef.current !== currentSessionId) {
          console.log("[VoiceChat] Not restarting - session changed or recording stopped");
          return;
        }
        
        console.log("[VoiceChat] Restarting recognition...");
        setTimeout(() => {
          if (isRecordingRef.current && sessionIdRef.current === currentSessionId && recognitionRef.current) {
            try {
              recognitionRef.current.start();
              console.log("[VoiceChat] Recognition restarted successfully");
            } catch (e: any) {
              if (e.message?.includes('already started')) {
                console.log("[VoiceChat] Recognition already running");
              } else {
                console.error("[VoiceChat] Failed to restart recognition:", e);
                isRecordingRef.current = false;
                setIsRecording(false);
              }
            }
          }
        }, 150);
      };
      
      recognition.onstart = () => {
        console.log("[VoiceChat] Recognition started, session:", currentSessionId);
      };
      
      recognition.onresult = (event: SpeechRecognitionEvent) => {
        let interimTranscript = '';
        let finalTranscript = '';
        
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const transcript = event.results[i][0].transcript;
          if (event.results[i].isFinal) {
            finalTranscript += transcript;
          } else {
            interimTranscript += transcript;
          }
        }
        
        setCurrentUserTranscript(interimTranscript || finalTranscript);
        
        if (finalTranscript) {
          if (debounceTimerRef.current) {
            clearTimeout(debounceTimerRef.current);
          }
          
          const textToSend = finalTranscript.trim();
          debounceTimerRef.current = setTimeout(() => {
            sendMessage(textToSend);
            setCurrentUserTranscript("");
            debounceTimerRef.current = null;
          }, 300);
        }
      };
      
      recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
        console.log("[VoiceChat] Recognition error:", event.error, "session:", currentSessionId);
        
        if (event.error === 'not-allowed') {
          setPermissionError("Microphone access was denied. Please allow microphone permissions.");
          isRecordingRef.current = false;
          setIsRecording(false);
        } else if (event.error === 'no-speech') {
          console.log("[VoiceChat] No speech detected");
        } else if (event.error === 'aborted') {
          console.log("[VoiceChat] Recognition aborted");
        } else if (event.error === 'network') {
          console.log("[VoiceChat] Network error");
        } else {
          console.error("[VoiceChat] Unhandled recognition error:", event.error);
        }
      };
      
      recognition.onend = () => {
        console.log("[VoiceChat] Recognition ended, session:", currentSessionId, "shouldRestart:", isRecordingRef.current);
        if (isRecordingRef.current && sessionIdRef.current === currentSessionId) {
          restartRecognition();
        }
      };
      
      recognitionRef.current = recognition;
      
      try {
        recognition.start();
        isRecordingRef.current = true;
        setIsRecording(true);
        console.log("[VoiceChat] Recognition started successfully, session:", currentSessionId);
      } catch (e) {
        console.error("[VoiceChat] Failed to start recognition:", e);
        setPermissionError("Unable to start speech recognition. Please try again.");
        recognitionRef.current = null;
      }
      
    } catch (error: any) {
      console.error("[VoiceChat] Error starting recognition:", error);
      setPermissionError("Unable to start speech recognition. Please check your browser settings.");
    }
  };

  const stopRecording = () => {
    console.log("[VoiceChat] Stopping recording, session:", sessionIdRef.current);
    isRecordingRef.current = false;
    sessionIdRef.current += 1;
    if (recognitionRef.current) {
      recognitionRef.current.abort();
      recognitionRef.current = null;
    }
    setIsRecording(false);
    setCurrentUserTranscript("");
  };

  const cleanupSession = () => {
    stopRecording();
    window.speechSynthesis.cancel();
    
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
    }
    
    isProcessingRef.current = false;
    pendingMessageRef.current = "";
    
    setMessages([]);
    setCurrentUserTranscript("");
    setStatusMessage(null);
    setQuotes([]);
    setSelectedInsurer(null);
    setShowPaymentCard(false);
    setPurchaseComplete(false);
    setVehicleList([]);
    setQuoteDetails(null);

    if (wsRef.current && wsRef.current.readyState !== WebSocket.CLOSED) {
      wsRef.current.close();
    }
    wsRef.current = null;

    setIsConnecting(false);
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

  const toggleSpeaker = () => {
    if (speakerEnabled) {
      window.speechSynthesis.cancel();
    }
    setSpeakerEnabled(!speakerEnabled);
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
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="icon"
                onClick={toggleSpeaker}
                data-testid="button-toggle-speaker"
              >
                {speakerEnabled ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => onOpenChange(false)}
                data-testid="button-close-voice-chat"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
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

            {currentUserTranscript && (
              <div className="flex gap-3 justify-end">
                <div className="rounded-lg px-4 py-2 max-w-[75%] bg-primary/70 text-primary-foreground">
                  <p className="text-sm italic">{currentUserTranscript}</p>
                </div>
              </div>
            )}
            
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
            
            <AnimatePresence>
              {vehicleList.length > 0 && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="space-y-2 my-4"
                >
                  <p className="text-sm text-muted-foreground mb-2">
                    Select a vehicle for your quote:
                  </p>
                  {vehicleList.map((vehicle, idx) => (
                    <motion.button
                      key={vehicle.policy_id}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: idx * 0.1 }}
                      onClick={() => {
                        wsRef.current?.send(JSON.stringify({
                          type: "select_vehicle",
                          index: idx,
                        }));
                      }}
                      className="w-full text-left bg-card hover:bg-accent/50 border rounded-lg p-3 transition-colors"
                      data-testid={`vehicle-card-${idx}`}
                    >
                      <div className="flex items-center gap-3">
                        <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary/10 text-primary font-semibold text-sm">
                          {idx + 1}
                        </div>
                        <div>
                          <p className="font-medium text-foreground">
                            {vehicle.vehicle_year} {vehicle.vehicle_manufacturer_name} {vehicle.vehicle_model}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            {vehicle.vehicle_registration_number}
                          </p>
                        </div>
                      </div>
                    </motion.button>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
            
            <AnimatePresence>
              {quoteDetails && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="my-4 bg-card border rounded-lg p-4"
                >
                  <h4 className="font-semibold text-foreground mb-3">Quote Search Details</h4>
                  <div className="grid grid-cols-2 gap-2 text-sm max-h-64 overflow-y-auto">
                    <div className="text-muted-foreground">Vehicle:</div>
                    <div className="text-foreground">{quoteDetails.vehicle_manufacturer_name} {quoteDetails.vehicle_model}</div>
                    
                    <div className="text-muted-foreground">Registration:</div>
                    <div className="text-foreground">{quoteDetails.vehicle_registration_number}</div>
                    
                    <div className="text-muted-foreground">Driver Age:</div>
                    <div className="text-foreground">{quoteDetails.driver_age}</div>
                    
                    <div className="text-muted-foreground">Cover Type:</div>
                    <div className="text-foreground">{quoteDetails.type_of_cover_needed}</div>
                    
                    <div className="text-muted-foreground">No Claims Bonus:</div>
                    <div className="text-foreground">{quoteDetails.no_claim_bonus_years} years</div>
                    
                    <div className="text-muted-foreground">Current Provider:</div>
                    <div className="text-foreground">{quoteDetails.current_insurance_provider}</div>
                  </div>
                  
                  <div className="flex gap-2 mt-4">
                    <Button
                      onClick={() => {
                        wsRef.current?.send(JSON.stringify({ type: "confirm_quote_details" }));
                      }}
                      className="flex-1"
                      data-testid="button-confirm-quote-details"
                    >
                      Confirm & Search
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => {
                        setQuoteDetails(null);
                        wsRef.current?.send(JSON.stringify({ type: "cancel_quote_details" }));
                      }}
                      data-testid="button-cancel-quote-details"
                    >
                      Cancel
                    </Button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
            
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
            
            <AnimatePresence>
              {selectedInsurer && showPaymentCard && !purchaseComplete && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="space-y-2"
                >
                  <p className="text-sm text-muted-foreground text-center">
                    Please review and say "Confirm payment" or "Pay now" to complete:
                  </p>
                  <PaymentSection 
                    totalAmount={selectedInsurer.price} 
                    insurerName={selectedInsurer.name}
                  />
                </motion.div>
              )}
            </AnimatePresence>
            
            <AnimatePresence>
              {selectedInsurer && !showPaymentCard && !purchaseComplete && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="bg-primary/10 border border-primary/20 rounded-lg p-4 text-center"
                >
                  <p className="text-sm font-medium text-primary">
                    Selected: {selectedInsurer.name} at £{selectedInsurer.price.toFixed(2)}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Say "Yes" to proceed or "No" to choose another
                  </p>
                </motion.div>
              )}
            </AnimatePresence>
            
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
                  className={cn(
                    "rounded-full h-16 w-16",
                    isSpeaking && "ring-2 ring-primary ring-offset-2 animate-pulse"
                  )}
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
                  : isSpeaking
                  ? "Annie is speaking..."
                  : isRecording
                  ? "Listening... Tap to stop"
                  : "Tap to speak"}
              </p>
              
              {quotes.length > 0 && !selectedInsurer && (
                <p className="text-center text-xs text-muted-foreground mt-2">
                  Say an insurer name like "Go with Admiral" to select
                </p>
              )}
              {selectedInsurer && !showPaymentCard && (
                <p className="text-center text-xs text-muted-foreground mt-2">
                  Say "Yes" to proceed or "No" to choose another
                </p>
              )}
              {selectedInsurer && showPaymentCard && (
                <p className="text-center text-xs text-muted-foreground mt-2">
                  Say "Confirm payment" or "Pay now" to complete
                </p>
              )}
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
