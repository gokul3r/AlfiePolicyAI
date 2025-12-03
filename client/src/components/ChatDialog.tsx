import { useState, useEffect, useRef } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Send, X, Loader2 } from "lucide-react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { ChatMessage } from "@shared/schema";
import ChatQuoteCard, { type ChatQuote } from "./ChatQuoteCard";
import { motion, AnimatePresence } from "framer-motion";

interface QuoteCardsData {
  type: "quote_cards";
  intro: string;
  quotes: ChatQuote[];
  outro: string;
}

interface ChatDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userEmail: string;
  initialMessage?: string;
}

// Helper to parse quote cards from message content
function parseQuoteCards(content: string): { isQuoteCards: boolean; data?: QuoteCardsData; plainText?: string } {
  const startTag = "[QUOTE_CARDS]";
  const endTag = "[/QUOTE_CARDS]";
  const startIndex = content.indexOf(startTag);
  const endIndex = content.indexOf(endTag);
  
  if (startIndex !== -1 && endIndex !== -1 && endIndex > startIndex) {
    try {
      const jsonContent = content.substring(startIndex + startTag.length, endIndex);
      const data = JSON.parse(jsonContent) as QuoteCardsData;
      return { isQuoteCards: true, data };
    } catch (e) {
      return { isQuoteCards: false, plainText: content };
    }
  }
  return { isQuoteCards: false, plainText: content };
}

// Detect quote search intent (matches backend logic)
function isQuoteSearchIntent(message: string): boolean {
  const lowerMessage = message.toLowerCase();
  const quoteKeywords = [
    "search for quotes", "find quotes", "get quotes", "look for quotes",
    "find me quotes", "get me quotes", "search quotes", "quote search",
    "insurance quotes", "find insurance", "search insurance", "get insurance",
    "buy a policy", "buy insurance", "purchase insurance", "new policy",
    "compare quotes", "compare insurance", "find me insurance"
  ];
  return quoteKeywords.some(keyword => lowerMessage.includes(keyword));
}

// Known insurer names from quote results
const KNOWN_INSURERS = [
  "admiral", "paxa", "baviva", "indirectlane", "churchwell",
  "ventura", "zorich", "hestingsdrive", "assureon", "soga"
];

// Detect purchase intent and extract insurer name
function detectPurchaseIntent(message: string): { isPurchase: boolean; insurerName?: string } {
  const lowerMessage = message.toLowerCase().trim();
  
  // Check for insurer name anywhere in message with purchase intent keywords
  const purchaseKeywords = ["go with", "buy", "choose", "select", "proceed", "i want", "take", "get the", "sign up"];
  const hasPurchaseIntent = purchaseKeywords.some(keyword => lowerMessage.includes(keyword));
  
  if (hasPurchaseIntent) {
    // Look for any known insurer in the message
    for (const insurer of KNOWN_INSURERS) {
      if (lowerMessage.includes(insurer)) {
        // Format insurer name (capitalize first letter)
        const insurerName = insurer.charAt(0).toUpperCase() + insurer.slice(1);
        return { isPurchase: true, insurerName };
      }
    }
  }
  
  // Also try regex patterns for more complex phrases
  const purchasePatterns = [
    /(?:go with|buy|purchase|get|choose|select|proceed with|i want|i'll take|sign up with|take the)\s+(\w+)/i,
    /(\w+)\s+(?:please|sounds good|looks good|is my choice|one please)/i,
  ];
  
  for (const pattern of purchasePatterns) {
    const match = lowerMessage.match(pattern);
    if (match) {
      const potentialInsurer = match[1].toLowerCase();
      // Check if the extracted word is a known insurer
      const matchedInsurer = KNOWN_INSURERS.find(insurer => 
        potentialInsurer.includes(insurer) || insurer.includes(potentialInsurer)
      );
      if (matchedInsurer) {
        const insurerName = matchedInsurer.charAt(0).toUpperCase() + matchedInsurer.slice(1);
        return { isPurchase: true, insurerName };
      }
    }
  }
  
  return { isPurchase: false };
}

// Check if message is confirming a purchase
function isConfirmingPurchase(message: string): boolean {
  const lowerMessage = message.toLowerCase().trim();
  const confirmations = ["yes", "yeah", "yep", "sure", "ok", "okay", "confirm", "confirmed", "proceed", "go ahead", "do it", "yes please"];
  return confirmations.some(c => lowerMessage === c || lowerMessage.startsWith(c + " ") || lowerMessage.startsWith(c + ","));
}

// Animated Agent Status Component
function AgentStatusBubble({ status }: { status: string }) {
  return (
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
          <motion.span
            className="text-sm font-medium text-foreground"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.1 }}
          >
            {status}
          </motion.span>
        </div>
      </div>
    </motion.div>
  );
}

// Data needed for purchasing a policy
interface PendingPurchaseData {
  insurerName: string;
  quotePrice: number;
}

export default function ChatDialog({ open, onOpenChange, userEmail, initialMessage }: ChatDialogProps) {
  const [messageInput, setMessageInput] = useState("");
  const [hasProcessedInitialMessage, setHasProcessedInitialMessage] = useState(false);
  const [agentStatus, setAgentStatus] = useState<string | null>(null);
  const [pendingPurchase, setPendingPurchase] = useState<PendingPurchaseData | null>(null); // Quote data awaiting confirmation
  const [lastQuotes, setLastQuotes] = useState<ChatQuote[]>([]); // Store quotes from last search
  const [purchaseInProgress, setPurchaseInProgress] = useState(false);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  // Execute the real purchase flow with animated status messages
  const runPurchaseSimulation = async (purchaseData: PendingPurchaseData) => {
    setPurchaseInProgress(true);
    const { insurerName, quotePrice } = purchaseData;
    
    const steps = [
      { status: "Auto Annie verifying the details...", delay: 1500 },
      { status: `Contacting ${insurerName}...`, delay: 2000 },
      { status: "Buying the policy...", delay: 2000 },
      { status: "Awaiting confirmation...", delay: 1500 },
      { status: "Cancelling existing policy...", delay: 1500 },
    ];
    
    try {
      // Show first status while getting vehicle registration
      setAgentStatus(steps[0].status);
      
      // Get the user's first vehicle policy to get registration number
      const policiesResponse = await fetch(`/api/vehicle-policies/${encodeURIComponent(userEmail)}`);
      if (!policiesResponse.ok) throw new Error("Failed to fetch vehicle policies");
      const policies = await policiesResponse.json();
      
      if (!policies || policies.length === 0) {
        throw new Error("No vehicle policy found");
      }
      
      // API returns flattened response - vehicle_registration_number is at top level
      const vehicleRegistration = policies[0].vehicle_registration_number;
      if (!vehicleRegistration) {
        throw new Error("Vehicle registration not found");
      }
      
      // Continue with animated steps
      for (let i = 1; i < steps.length; i++) {
        await new Promise(resolve => setTimeout(resolve, steps[i-1].delay));
        setAgentStatus(steps[i].status);
      }
      
      // Make the real API call to update the policy
      await apiRequest("POST", "/api/purchase-policy", {
        email_id: userEmail,
        vehicle_registration_number: vehicleRegistration,
        insurer_name: insurerName,
        policy_cost: quotePrice,
      });
      
      // Wait for final step
      await new Promise(resolve => setTimeout(resolve, steps[steps.length - 1].delay));
      
      // Clear status and mark purchase complete
      setAgentStatus(null);
      setPurchaseInProgress(false);
      
      // Add success message to chat
      await apiRequest("POST", "/api/chat/save-assistant-message", {
        email_id: userEmail,
        message: `Congratulations! You are now protected with ${insurerName}. Your new policy is active at £${quotePrice.toFixed(2)}/year and your previous policy has been cancelled. You'll receive confirmation details via email shortly.`,
      });
      
      // Invalidate all relevant caches so the new policy shows everywhere
      queryClient.invalidateQueries({ queryKey: ["/api/chat/messages", userEmail] });
      queryClient.invalidateQueries({ queryKey: ["/api/vehicle-policies", userEmail] });
      
      toast({
        title: "Policy Purchased!",
        description: `Your new ${insurerName} policy is now active.`,
      });
      
    } catch (error: any) {
      setAgentStatus(null);
      setPurchaseInProgress(false);
      
      // Add error message to chat
      await apiRequest("POST", "/api/chat/save-assistant-message", {
        email_id: userEmail,
        message: `I'm sorry, there was an issue completing the purchase: ${error.message}. Please try again or contact support.`,
      });
      
      queryClient.invalidateQueries({ queryKey: ["/api/chat/messages", userEmail] });
      
      toast({
        title: "Purchase Failed",
        description: error.message || "Failed to complete the purchase",
        variant: "destructive",
      });
    }
  };

  // Fetch chat history
  const { data: messages = [], isLoading } = useQuery<ChatMessage[]>({
    queryKey: ["/api/chat/messages", userEmail],
    enabled: open && !!userEmail,
  });

  // Send message to AI mutation
  const sendMessageMutation = useMutation({
    mutationFn: async (message: string) => {
      return await apiRequest("POST", "/api/chat/send-message", {
        email_id: userEmail,
        message,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/chat/messages", userEmail] });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to send message",
        variant: "destructive",
      });
    },
  });

  // Auto-scroll to bottom when new messages arrive or agent status changes
  useEffect(() => {
    if (scrollAreaRef.current) {
      const scrollElement = scrollAreaRef.current.querySelector('[data-radix-scroll-area-viewport]');
      if (scrollElement) {
        scrollElement.scrollTop = scrollElement.scrollHeight;
      }
    }
  }, [messages, agentStatus]);

  // Extract quotes from messages when they arrive (for purchase flow)
  useEffect(() => {
    if (messages.length > 0) {
      // Look at the last assistant message for quote cards
      for (let i = messages.length - 1; i >= 0; i--) {
        if (messages[i].role === "assistant") {
          const parsed = parseQuoteCards(messages[i].content);
          if (parsed.isQuoteCards && parsed.data?.quotes) {
            setLastQuotes(parsed.data.quotes);
            break;
          }
        }
      }
    }
  }, [messages]);

  // Auto-send initial message when dialog opens
  useEffect(() => {
    const handleInitialMessage = async () => {
      if (open && initialMessage && !hasProcessedInitialMessage && !isLoading) {
        setHasProcessedInitialMessage(true);
        
        // Check if initial message is a quote search
        if (isQuoteSearchIntent(initialMessage)) {
          setAgentStatus("Auto Annie looking for quotes...");
          
          const apiPromise = sendMessageMutation.mutateAsync(initialMessage);
          
          const statusTimeout = setTimeout(() => {
            setAgentStatus("Auto Annie analysing the quotes...");
          }, 2000);
          
          await apiPromise;
          
          clearTimeout(statusTimeout);
          setAgentStatus(null);
        } else {
          sendMessageMutation.mutate(initialMessage);
        }
      }
    };
    
    handleInitialMessage();
    
    // Reset all state when dialog closes
    if (!open) {
      setHasProcessedInitialMessage(false);
      setAgentStatus(null);
      setPendingPurchase(null);
      setPurchaseInProgress(false);
      setLastQuotes([]);
    }
  }, [open, initialMessage, hasProcessedInitialMessage, isLoading]);

  const handleSendMessage = async () => {
    const trimmedMessage = messageInput.trim();
    if (!trimmedMessage) return;

    setMessageInput("");
    
    // Check purchase intent first
    const purchaseIntent = detectPurchaseIntent(trimmedMessage);

    // Check if user is confirming a pending purchase
    if (pendingPurchase && isConfirmingPurchase(trimmedMessage)) {
      // Save user's confirmation message first
      await apiRequest("POST", "/api/chat/save-user-message", {
        email_id: userEmail,
        message: trimmedMessage,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/chat/messages", userEmail] });
      
      const purchaseData = pendingPurchase;
      setPendingPurchase(null);
      
      // Run the real purchase flow
      await runPurchaseSimulation(purchaseData);
      return;
    }

    // Check if this is a purchase intent (e.g., "Go with Admiral")
    if (purchaseIntent.isPurchase && purchaseIntent.insurerName) {
      // Save user message
      await apiRequest("POST", "/api/chat/save-user-message", {
        email_id: userEmail,
        message: trimmedMessage,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/chat/messages", userEmail] });
      
      // Find the quote price from last shown quotes
      const matchingQuote = lastQuotes.find(
        q => q.insurer_name.toLowerCase() === purchaseIntent.insurerName!.toLowerCase()
      );
      const quotePrice = matchingQuote?.quote_price ?? 0;
      
      // Set pending purchase with full data
      setPendingPurchase({
        insurerName: purchaseIntent.insurerName,
        quotePrice: quotePrice,
      });
      
      // Add confirmation message to chat with price
      const priceText = quotePrice > 0 ? ` at £${quotePrice.toFixed(2)}/year` : "";
      await apiRequest("POST", "/api/chat/save-assistant-message", {
        email_id: userEmail,
        message: `Do you want to proceed with the quote from ${purchaseIntent.insurerName}${priceText}?`,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/chat/messages", userEmail] });
      return;
    }

    // Check if this is a quote search - show animated status messages
    if (isQuoteSearchIntent(trimmedMessage)) {
      setAgentStatus("Auto Annie looking for quotes...");
      
      // Create a promise that resolves when API completes
      const apiPromise = sendMessageMutation.mutateAsync(trimmedMessage);
      
      // Show "analysing" status after 2 seconds
      const statusTimeout = setTimeout(() => {
        setAgentStatus("Auto Annie analysing the quotes...");
      }, 2000);
      
      // Wait for API to complete
      await apiPromise;
      
      // Clear timeout and status
      clearTimeout(statusTimeout);
      setAgentStatus(null);
    } else {
      // Regular message - no animated status
      await sendMessageMutation.mutateAsync(trimmedMessage);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent 
        className="h-[90vh] max-w-2xl flex flex-col p-0"
        data-testid="dialog-chat"
      >
        <DialogHeader className="px-6 py-4 border-b shrink-0">
          <div className="flex items-center justify-between">
            <DialogTitle className="text-xl font-bold">
              Chat with AutoAnnie
            </DialogTitle>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => onOpenChange(false)}
              data-testid="button-close-chat"
            >
              <X className="w-5 h-5" />
            </Button>
          </div>
        </DialogHeader>

        <ScrollArea 
          ref={scrollAreaRef}
          className="flex-1 px-6 py-4"
          data-testid="scroll-chat-history"
        >
          {isLoading ? (
            <div className="flex items-center justify-center h-full">
              <p className="text-sm text-muted-foreground">Loading chat history...</p>
            </div>
          ) : messages.length === 0 ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-center space-y-2">
                <p className="text-base font-medium text-foreground">
                  Welcome to AutoAnnie Chat
                </p>
                <p className="text-sm text-muted-foreground">
                  Ask me anything about UK insurance or your policy
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {messages.map((message) => {
                const parsed = message.role === "assistant" 
                  ? parseQuoteCards(message.content) 
                  : { isQuoteCards: false, plainText: message.content };

                return (
                  <div
                    key={message.id}
                    className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}
                    data-testid={`message-${message.role}-${message.id}`}
                  >
                    {parsed.isQuoteCards && parsed.data ? (
                      <div className="w-full max-w-[90%] space-y-4">
                        <div className="bg-muted text-foreground rounded-lg px-4 py-3">
                          <p className="text-sm font-medium">{parsed.data.intro}</p>
                          <p className="text-xs mt-1 opacity-70">
                            {new Date(message.created_at).toLocaleTimeString("en-GB", {
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </p>
                        </div>
                        
                        <div className="space-y-4 pt-2">
                          {parsed.data.quotes.map((quote, index) => (
                            <ChatQuoteCard
                              key={`${quote.insurer_name}-${index}`}
                              quote={quote}
                              index={index}
                            />
                          ))}
                        </div>

                        <div className="bg-muted/50 text-foreground rounded-lg px-4 py-2">
                          <p className="text-sm text-muted-foreground">{parsed.data.outro}</p>
                        </div>
                      </div>
                    ) : (
                      <div
                        className={`max-w-[75%] rounded-lg px-4 py-3 ${
                          message.role === "user"
                            ? "bg-primary text-primary-foreground"
                            : "bg-muted text-foreground"
                        }`}
                      >
                        <p className="text-sm break-words">{message.content}</p>
                        <p className="text-xs mt-1 opacity-70">
                          {new Date(message.created_at).toLocaleTimeString("en-GB", {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </p>
                      </div>
                    )}
                  </div>
                );
              })}
              
              {/* Animated Agent Status */}
              <AnimatePresence mode="wait">
                {agentStatus && (
                  <AgentStatusBubble status={agentStatus} />
                )}
              </AnimatePresence>
            </div>
          )}
        </ScrollArea>

        <div className="px-6 py-4 border-t shrink-0">
          <div className="flex items-center gap-2">
            <Input
              value={messageInput}
              onChange={(e) => setMessageInput(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Type your message..."
              className="flex-1"
              disabled={sendMessageMutation.isPending}
              data-testid="input-chat-message"
            />
            <Button
              onClick={handleSendMessage}
              disabled={!messageInput.trim() || sendMessageMutation.isPending}
              size="icon"
              data-testid="button-send-message"
            >
              <Send className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
