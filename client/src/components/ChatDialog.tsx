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
import { Send, X, Upload, FileText, Loader2, ExternalLink, Search } from "lucide-react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { ChatMessage, QuoteWithInsights } from "@shared/schema";
import { ComingSoonDialog } from "./ComingSoonDialog";
import QuoteChatCard from "./QuoteChatCard";

// Module-level storage for vehicle data that persists across component re-renders
let persistentVehicleData: any = null;

interface ChatDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userEmail: string;
  initialMessage?: string;
  onNavigateToQuotes?: (quotes: QuoteWithInsights[], vehicleData: any) => void;
}

interface ExtractedPolicyData {
  email_id?: string;
  policy_number?: string;
  current_insurance_provider?: string;
  policy_start_date?: string;
  policy_end_date?: string;
  current_policy_cost?: number;
  driver_age?: number;
  vehicle_registration_number?: string;
  vehicle_manufacturer_name?: string;
  vehicle_model?: string;
  vehicle_year?: number;
  type_of_fuel?: string;
  type_of_cover_needed?: string;
  no_claim_bonus_years?: number;
  voluntary_excess?: number;
}

export default function ChatDialog({ 
  open, 
  onOpenChange, 
  userEmail, 
  initialMessage,
  onNavigateToQuotes
}: ChatDialogProps) {
  const [messageInput, setMessageInput] = useState("");
  const [hasProcessedInitialMessage, setHasProcessedInitialMessage] = useState(false);
  const [showUploadButton, setShowUploadButton] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [showManualEntryComing, setShowManualEntryComing] = useState(false);
  const [pendingPolicyData, setPendingPolicyData] = useState<ExtractedPolicyData | null>(null);
  const [chatQuotes, setChatQuotes] = useState<QuoteWithInsights[]>([]);
  const [allQuotes, setAllQuotes] = useState<QuoteWithInsights[]>([]);
  const [isSearchingQuotes, setIsSearchingQuotes] = useState(false);
  const [isPurchasing, setIsPurchasing] = useState(false);
  const [purchaseProgress, setPurchaseProgress] = useState<string>("");
  const [savedVehicleData, setSavedVehicleData] = useState<any>(null);
  const [showSearchQuotesButton, setShowSearchQuotesButton] = useState(false);
  const savedVehicleDataRef = useRef<any>(null); // Ref for immediate access in closures
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  // Fetch chat history
  const { data: messages = [], isLoading } = useQuery<ChatMessage[]>({
    queryKey: ["/api/chat/messages", userEmail],
    enabled: open && !!userEmail,
  });

  // Fetch existing vehicle policies to populate vehicle data for quote search
  const { data: existingPolicies = [] } = useQuery<any[]>({
    queryKey: ["/api/vehicle-policies", userEmail],
    enabled: open && !!userEmail,
  });

  // Populate persistentVehicleData from existing policies when they load
  useEffect(() => {
    if (existingPolicies.length > 0 && !persistentVehicleData) {
      const policy = existingPolicies[0]; // Use first/most recent policy
      const details = policy.details || {};
      const mappedData = {
        policy_id: policy.policy_id,
        vehicle_registration_number: details.vehicle_registration_number,
        vehicle_manufacturer_name: details.vehicle_manufacturer_name,
        vehicle_model: details.vehicle_model,
        vehicle_year: details.vehicle_year,
        type_of_fuel: details.type_of_fuel,
        type_of_cover_needed: details.type_of_cover_needed,
        no_claim_bonus_years: details.no_claim_bonus_years || 0,
        voluntary_excess: details.voluntary_excess || 250,
        driver_age: details.driver_age || 30,
        current_insurance_provider: policy.current_insurance_provider,
        policy_number: policy.policy_number,
        policy_start_date: policy.policy_start_date,
        policy_end_date: policy.policy_end_date,
        whisper_preferences: policy.whisper_preferences || "",
      };
      console.log("[ChatDialog] Populated persistentVehicleData from existing policy:", mappedData);
      persistentVehicleData = mappedData;
      savedVehicleDataRef.current = mappedData;
      setSavedVehicleData(mappedData);
    }
  }, [existingPolicies]);

  // Send message to AI mutation
  const sendMessageMutation = useMutation({
    mutationFn: async (message: string) => {
      const response = await apiRequest("POST", "/api/chat/send-message", {
        email_id: userEmail,
        message,
      });
      const data = await response.json();
      return data;
    },
    onSuccess: (data: any) => {
      console.log("[ChatDialog] Message mutation success, ref value:", savedVehicleDataRef.current ? "SET" : "NOT SET");
      queryClient.invalidateQueries({ queryKey: ["/api/chat/messages", userEmail] });
      
      // Check for action markers in the response
      const responseContent = data?.assistantMessage?.content || "";
      handleActionMarkers(responseContent);
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to send message",
        variant: "destructive",
      });
    },
  });

  // Handle action markers from AI response
  const handleActionMarkers = async (content: string) => {
    console.log("[ChatDialog] Checking action markers in:", content.substring(0, 100));
    console.log("[ChatDialog] savedVehicleData state:", savedVehicleData ? "SET" : "NOT SET");
    console.log("[ChatDialog] savedVehicleDataRef:", savedVehicleDataRef.current ? "SET" : "NOT SET");
    console.log("[ChatDialog] persistentVehicleData:", persistentVehicleData ? "SET" : "NOT SET");
    
    // Check if AI is asking about searching for quotes and we have vehicle data
    const quoteSearchPhrases = [
      "would you like me to search",
      "search for new insurance quotes",
      "search for quotes",
      "find quotes",
      "get quotes",
      "look for quotes",
      "insurance quotes for",
    ];
    const lowerContent = content.toLowerCase();
    const mentionsQuoteSearch = quoteSearchPhrases.some(phrase => lowerContent.includes(phrase));
    const hasVehicleData = persistentVehicleData || savedVehicleDataRef.current || savedVehicleData;
    
    if (mentionsQuoteSearch && hasVehicleData && !isSearchingQuotes && chatQuotes.length === 0) {
      console.log("[ChatDialog] Showing Search Quotes button - AI mentioned quotes and vehicle data is available");
      setShowSearchQuotesButton(true);
    }
    
    if (content.includes("[ACTION:SHOW_UPLOAD]")) {
      setShowUploadButton(true);
    }
    if (content.includes("[ACTION:SHOW_MANUAL_ENTRY_COMING_SOON]")) {
      setShowManualEntryComing(true);
    }
    if (content.includes("[ACTION:SAVE_POLICY]") && pendingPolicyData) {
      await savePolicyToDatabase(pendingPolicyData);
    }
    if (content.includes("[ACTION:SEARCH_QUOTES]")) {
      console.log("[ChatDialog] SEARCH_QUOTES detected!");
      setShowSearchQuotesButton(false); // Hide button when automatic search triggers
      // Try all sources: module-level, ref, then state (in order of reliability)
      const vehicleData = persistentVehicleData || savedVehicleDataRef.current || savedVehicleData;
      if (vehicleData) {
        console.log("[ChatDialog] Calling searchForQuotes with:", vehicleData);
        await searchForQuotes(vehicleData);
      } else {
        console.error("[ChatDialog] Cannot search - savedVehicleData is not set!");
      }
    }
    
    // Handle show quotes action - quotes are already displayed when chatQuotes is set
    // This marker confirms the AI wants to display them
    if (content.includes("[ACTION:SHOW_QUOTES]")) {
      // Quotes are already being displayed from chatQuotes state
      // This is just a confirmation marker
      console.log("[ChatDialog] SHOW_QUOTES action received - quotes should be visible");
    }
    
    // Handle registration check action
    const regMatch = content.match(/\[ACTION:CHECK_REGISTRATION:([^\]]+)\]/);
    if (regMatch) {
      const registrationNumber = regMatch[1];
      await checkRegistration(registrationNumber);
    }
    
    // Handle purchase action
    const purchaseMatch = content.match(/\[ACTION:PURCHASE_POLICY:([^\]]+)\]/);
    if (purchaseMatch) {
      const providerName = purchaseMatch[1];
      const selectedQuote = allQuotes.find(q => 
        q.insurer_name.toLowerCase().includes(providerName.toLowerCase())
      );
      if (selectedQuote) {
        await handlePurchase(selectedQuote);
      }
    }
  };

  // Check if registration exists in database and send result back to AI
  const checkRegistration = async (registrationNumber: string) => {
    try {
      const response = await apiRequest("POST", "/api/chat/check-registration", {
        email_id: userEmail,
        registration_number: registrationNumber,
      });
      const data = await response.json();
      
      if (data.found) {
        // Vehicle found - map to quote search compatible format
        const v = data.vehicle;
        const mappedVehicleData = {
          policy_id: v.policy_id,
          vehicle_registration_number: v.registration_number,
          vehicle_manufacturer_name: v.manufacturer,
          vehicle_model: v.model,
          vehicle_year: v.year,
          type_of_fuel: v.fuel_type,
          type_of_cover_needed: v.cover_type,
          no_claim_bonus_years: v.no_claim_bonus_years || 0,
          voluntary_excess: v.voluntary_excess || 250,
          driver_age: v.driver_age || 30,
          current_insurance_provider: v.current_provider,
          policy_number: v.policy_number,
          policy_start_date: v.policy_start_date,
          policy_end_date: v.policy_end_date,
        };
        // Set module-level, ref, AND state for maximum reliability
        console.log("[ChatDialog] BEFORE setting:", persistentVehicleData);
        persistentVehicleData = mappedVehicleData;
        savedVehicleDataRef.current = mappedVehicleData;
        setSavedVehicleData(mappedVehicleData);
        console.log("[ChatDialog] AFTER setting persistentVehicleData:", persistentVehicleData);
        console.log("[ChatDialog] Set savedVehicleData:", mappedVehicleData);
        
        // Send result back to AI to trigger existing vehicle flow
        const feedbackMessage = `VEHICLE_FOUND: ${v.manufacturer} ${v.model} (${v.registration_number}), Year: ${v.year}, Cover: ${v.cover_type}, Provider: ${v.current_provider}, Policy: ${v.policy_number}`;
        sendMessageMutation.mutate(feedbackMessage);
      } else {
        // Vehicle not found - send feedback to AI to trigger new vehicle flow
        const feedbackMessage = `VEHICLE_NOT_FOUND: No vehicle with registration ${registrationNumber} found in your account.`;
        sendMessageMutation.mutate(feedbackMessage);
      }
    } catch (error) {
      console.error("Error checking registration:", error);
      toast({
        title: "Error",
        description: "Failed to check registration. Please try again.",
        variant: "destructive",
      });
    }
  };

  // Save policy to database
  const savePolicyToDatabase = async (data: ExtractedPolicyData) => {
    try {
      const response = await apiRequest("POST", "/api/vehicle-policies", {
        policy: {
          email_id: userEmail,
          policy_type: "car",
          policy_number: data.policy_number || `POL-${Date.now()}`,
          current_insurance_provider: data.current_insurance_provider || "Unknown",
          policy_start_date: data.policy_start_date || new Date().toISOString().split('T')[0],
          policy_end_date: data.policy_end_date || new Date(Date.now() + 365*24*60*60*1000).toISOString().split('T')[0],
          current_policy_cost: data.current_policy_cost || 0,
        },
        details: {
          driver_age: data.driver_age || 30,
          vehicle_registration_number: data.vehicle_registration_number || "",
          vehicle_manufacturer_name: data.vehicle_manufacturer_name || "",
          vehicle_model: data.vehicle_model || "",
          vehicle_year: data.vehicle_year || new Date().getFullYear(),
          type_of_fuel: data.type_of_fuel || "Petrol",
          type_of_cover_needed: data.type_of_cover_needed || "comprehensive",
          no_claim_bonus_years: data.no_claim_bonus_years || 0,
          voluntary_excess: data.voluntary_excess || 250,
        },
      });
      
      queryClient.invalidateQueries({ queryKey: ["/api/vehicle-policies", userEmail] });
      const savedData = { ...data, ...response };
      // CRITICAL: Also update persistentVehicleData to ensure consistency
      console.log("[ChatDialog] savePolicyToDatabase - setting persistentVehicleData:", savedData);
      persistentVehicleData = savedData;
      savedVehicleDataRef.current = savedData;
      setSavedVehicleData(savedData);
      setPendingPolicyData(null);
      
      toast({
        title: "Policy Saved",
        description: "Your vehicle has been added successfully!",
      });
    } catch (error: any) {
      if (error.message?.includes("409")) {
        toast({
          title: "Vehicle Already Exists",
          description: "You already have a policy for this vehicle registration.",
          variant: "destructive",
        });
      } else {
        toast({
          title: "Error",
          description: "Failed to save policy. Please try again.",
          variant: "destructive",
        });
      }
    }
  };

  // Search for quotes
  const searchForQuotes = async (vehicleData: any) => {
    console.log("[ChatDialog] searchForQuotes called with:", JSON.stringify(vehicleData, null, 2));
    setIsSearchingQuotes(true);
    setChatQuotes([]);
    
    try {
      const requestPayload = {
        email_id: userEmail,
        policy_id: vehicleData.policy_id || "",
        current_insurance_provider: vehicleData.current_insurance_provider || "Unknown",
        vehicle_registration_number: vehicleData.vehicle_registration_number,
        vehicle_manufacturer_name: vehicleData.vehicle_manufacturer_name,
        vehicle_model: vehicleData.vehicle_model,
        vehicle_year: vehicleData.vehicle_year,
        type_of_fuel: vehicleData.type_of_fuel,
        type_of_cover_needed: vehicleData.type_of_cover_needed,
        no_claim_bonus_years: vehicleData.no_claim_bonus_years,
        voluntary_excess: vehicleData.voluntary_excess,
        driver_age: vehicleData.driver_age,
        whisper_preferences: vehicleData.whisper_preferences || "",
      };
      console.log("[ChatDialog] Sending quote search request:", JSON.stringify(requestPayload, null, 2));
      const response = await apiRequest("POST", "/api/search-quotes", requestPayload);
      
      const data = await response.json();
      const quotes = data.quotes || [];
      setAllQuotes(quotes);
      
      // Show top 3 quotes in chat
      const top3 = quotes.slice(0, 3);
      setChatQuotes(top3);
      
      // Send quote results as system feedback to AI
      if (quotes.length > 0) {
        const topQuoteSummary = top3.map((q: QuoteWithInsights, i: number) => 
          `${i + 1}. ${q.insurer_name}: £${q.original_quote?.output?.policy_cost?.toFixed(2) || 'N/A'}/year (Score: ${q.alfie_touch_score || 'N/A'})`
        ).join(", ");
        
        await sendMessageMutation.mutateAsync(
          `QUOTE_RESULTS: Found ${quotes.length} quotes for ${vehicleData.vehicle_manufacturer_name} ${vehicleData.vehicle_model}. Top 3: ${topQuoteSummary}`
        );
      } else {
        await sendMessageMutation.mutateAsync(
          "QUOTE_RESULTS: No quotes found for this vehicle."
        );
      }
    } catch (error: any) {
      console.error("[ChatDialog] Quote search error:", error);
      toast({
        title: "Quote Search Failed",
        description: "Unable to search for quotes. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSearchingQuotes(false);
    }
  };

  // Handle quote selection from chat
  const handleQuoteSelect = async (quote: QuoteWithInsights) => {
    const price = quote.original_quote?.output?.policy_cost;
    await sendMessageMutation.mutateAsync(
      `I'd like to go with ${quote.insurer_name}${price ? ` at £${price.toFixed(2)}/year` : ""}.`
    );
  };

  // Handle purchase flow
  const handlePurchase = async (quote: QuoteWithInsights) => {
    setIsPurchasing(true);
    const provider = quote.insurer_name;
    
    try {
      // Simulate purchase progress
      const steps = [
        `Contacting ${provider}...`,
        "Reviewing policy terms...",
        "Confirming your coverage...",
        "Finalizing your policy..."
      ];
      
      for (const step of steps) {
        setPurchaseProgress(step);
        await new Promise(resolve => setTimeout(resolve, 800));
      }
      
      // Update the policy in database with new provider
      if (savedVehicleData) {
        const policyId = savedVehicleData.policy_id || savedVehicleData.vehicle_id;
        if (policyId) {
          await apiRequest("PUT", `/api/vehicle-policies/${userEmail}/${policyId}`, {
            policy: {
              current_insurance_provider: provider,
              policy_start_date: new Date().toISOString().split('T')[0],
              policy_end_date: new Date(Date.now() + 365*24*60*60*1000).toISOString().split('T')[0],
              current_policy_cost: quote.original_quote?.output?.policy_cost || 0,
            },
            details: {}
          });
          
          queryClient.invalidateQueries({ queryKey: ["/api/vehicle-policies", userEmail] });
        }
      }
      
      setPurchaseProgress("");
      
      toast({
        title: "Congratulations!",
        description: `You're now covered with ${provider}!`,
      });
      
    } catch (error: any) {
      console.error("[ChatDialog] Purchase error:", error);
      toast({
        title: "Purchase Failed",
        description: "Unable to complete purchase. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsPurchasing(false);
    }
  };

  // Handle PDF upload
  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (file.type !== "application/pdf") {
      toast({
        title: "Invalid File",
        description: "Please upload a PDF file.",
        variant: "destructive",
      });
      return;
    }

    if (file.size > 6 * 1024 * 1024) {
      toast({
        title: "File Too Large",
        description: "Please upload a PDF smaller than 6MB.",
        variant: "destructive",
      });
      return;
    }

    setIsUploading(true);
    setShowUploadButton(false);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch("/api/extract-pdf", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        throw new Error("Failed to extract PDF");
      }

      const extractedData = await response.json();
      console.log("[ChatDialog] Extracted PDF data:", extractedData);

      // Store extracted data for potential save
      setPendingPolicyData(extractedData);
      
      // CRITICAL: Also set persistentVehicleData so SEARCH_QUOTES can use it immediately
      // Map extracted data to quote search compatible format
      const mappedData = {
        policy_id: "",
        vehicle_registration_number: extractedData.vehicle_registration_number,
        vehicle_manufacturer_name: extractedData.vehicle_manufacturer_name,
        vehicle_model: extractedData.vehicle_model,
        vehicle_year: extractedData.vehicle_year,
        type_of_fuel: extractedData.type_of_fuel,
        type_of_cover_needed: extractedData.type_of_cover_needed,
        no_claim_bonus_years: extractedData.no_claim_bonus_years || 0,
        voluntary_excess: extractedData.voluntary_excess || 250,
        driver_age: extractedData.driver_age || 30,
        current_insurance_provider: extractedData.current_insurance_provider,
        policy_number: extractedData.policy_number,
        policy_start_date: extractedData.policy_start_date,
        policy_end_date: extractedData.policy_end_date,
        whisper_preferences: "",
      };
      console.log("[ChatDialog] Setting persistentVehicleData from PDF extraction:", mappedData);
      persistentVehicleData = mappedData;
      savedVehicleDataRef.current = mappedData;
      setSavedVehicleData(mappedData);

      // Format extracted data as a message for the AI
      const extractedFields = formatExtractedData(extractedData);
      
      // Send a message to the AI with the extracted data
      await sendMessageMutation.mutateAsync(
        `I've uploaded my policy document. Here's what was extracted:\n${extractedFields}\n\nPlease review these details and let me know if they look correct.`
      );

    } catch (error: any) {
      console.error("[ChatDialog] PDF extraction error:", error);
      
      // Send error message to chat
      await sendMessageMutation.mutateAsync(
        "There was an error extracting my PDF document. Can you help?"
      );
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  // Format extracted data for display
  const formatExtractedData = (data: ExtractedPolicyData): string => {
    const fields = [];
    if (data.vehicle_manufacturer_name) fields.push(`Vehicle: ${data.vehicle_manufacturer_name} ${data.vehicle_model || ""}`);
    if (data.vehicle_registration_number) fields.push(`Registration: ${data.vehicle_registration_number}`);
    if (data.vehicle_year) fields.push(`Year: ${data.vehicle_year}`);
    if (data.type_of_fuel) fields.push(`Fuel: ${data.type_of_fuel}`);
    if (data.type_of_cover_needed) fields.push(`Cover: ${data.type_of_cover_needed}`);
    if (data.policy_number) fields.push(`Policy Number: ${data.policy_number}`);
    if (data.current_insurance_provider) fields.push(`Provider: ${data.current_insurance_provider}`);
    if (data.policy_start_date) fields.push(`Start Date: ${data.policy_start_date}`);
    if (data.policy_end_date) fields.push(`End Date: ${data.policy_end_date}`);
    if (data.current_policy_cost) fields.push(`Cost: £${data.current_policy_cost}`);
    if (data.driver_age) fields.push(`Driver Age: ${data.driver_age}`);
    if (data.no_claim_bonus_years) fields.push(`NCB Years: ${data.no_claim_bonus_years}`);
    if (data.voluntary_excess) fields.push(`Voluntary Excess: £${data.voluntary_excess}`);
    
    return fields.join("\n") || "No data could be extracted";
  };

  // Strip action markers from display text
  const stripActionMarkers = (content: string): string => {
    return content.replace(/\[ACTION:[^\]]+\]/g, "").trim();
  };

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (scrollAreaRef.current) {
      const scrollElement = scrollAreaRef.current.querySelector('[data-radix-scroll-area-viewport]');
      if (scrollElement) {
        scrollElement.scrollTop = scrollElement.scrollHeight;
      }
    }
  }, [messages, chatQuotes, isSearchingQuotes, purchaseProgress]);

  // Auto-send initial message when dialog opens
  useEffect(() => {
    if (open && initialMessage && !hasProcessedInitialMessage && !isLoading) {
      setHasProcessedInitialMessage(true);
      sendMessageMutation.mutate(initialMessage);
    }
    // Reset the flag when dialog closes
    if (!open) {
      setHasProcessedInitialMessage(false);
      setShowUploadButton(false);
      setShowSearchQuotesButton(false); // Reset search button visibility
      setPendingPolicyData(null);
      setChatQuotes([]);
      setAllQuotes([]);
    }
  }, [open, initialMessage, hasProcessedInitialMessage, isLoading]);

  const handleSendMessage = async () => {
    const trimmedMessage = messageInput.trim();
    if (!trimmedMessage) return;

    setMessageInput("");

    // Check if user is asking to upload
    if (trimmedMessage.toLowerCase().includes("upload")) {
      setShowUploadButton(true);
    }

    // Send message to AI (saves both user and assistant messages)
    await sendMessageMutation.mutateAsync(trimmedMessage);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const triggerFileUpload = () => {
    fileInputRef.current?.click();
  };

  const handleLoadMoreQuotes = () => {
    if (onNavigateToQuotes && allQuotes.length > 0) {
      onNavigateToQuotes(allQuotes, savedVehicleData);
      onOpenChange(false);
    }
  };

  // Handle Search Quotes button click
  const handleSearchQuotesClick = async () => {
    const vehicleData = persistentVehicleData || savedVehicleDataRef.current || savedVehicleData;
    if (vehicleData) {
      console.log("[ChatDialog] Search Quotes button clicked, using vehicle data:", vehicleData);
      setShowSearchQuotesButton(false); // Hide button while searching
      await searchForQuotes(vehicleData);
    } else {
      console.error("[ChatDialog] Search Quotes button clicked but no vehicle data available");
      toast({
        title: "Error",
        description: "Vehicle data not found. Please try again.",
        variant: "destructive",
      });
    }
  };

  return (
    <>
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
                    Ask me anything about UK insurance, add a new car, or search for quotes
                  </p>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                {messages.map((message) => (
                  <div
                    key={message.id}
                    className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}
                    data-testid={`message-${message.role}-${message.id}`}
                  >
                    <div
                      className={`max-w-[75%] rounded-lg px-4 py-3 ${
                        message.role === "user"
                          ? "bg-primary text-primary-foreground"
                          : "bg-muted text-foreground"
                      }`}
                    >
                      <p className="text-sm break-words whitespace-pre-wrap">
                        {stripActionMarkers(message.content)}
                      </p>
                      <p className="text-xs mt-1 opacity-70">
                        {new Date(message.created_at).toLocaleTimeString("en-GB", {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </p>
                    </div>
                  </div>
                ))}
                
                {/* Search Quotes button - shown when AI mentions quotes and vehicle data is available */}
                {showSearchQuotesButton && !isSearchingQuotes && chatQuotes.length === 0 && (
                  <div className="flex justify-center my-4">
                    <Button
                      onClick={handleSearchQuotesClick}
                      className="gap-2 px-6"
                      data-testid="button-search-quotes-chat"
                    >
                      <Search className="w-4 h-4" />
                      Search for Quotes
                    </Button>
                  </div>
                )}
                
                {/* Quote cards displayed in chat */}
                {chatQuotes.length > 0 && (
                  <div className="space-y-3 my-4">
                    <p className="text-sm font-medium text-muted-foreground">Top 3 Quotes:</p>
                    {chatQuotes.map((quote, index) => (
                      <QuoteChatCard
                        key={index}
                        quote={quote}
                        index={index}
                        onSelect={handleQuoteSelect}
                      />
                    ))}
                    {allQuotes.length > 3 && (
                      <Button
                        variant="outline"
                        className="w-full gap-2"
                        onClick={handleLoadMoreQuotes}
                        data-testid="button-load-more-quotes"
                      >
                        <ExternalLink className="w-4 h-4" />
                        View All {allQuotes.length} Quotes
                      </Button>
                    )}
                  </div>
                )}
                
                {/* Quote search in progress */}
                {isSearchingQuotes && (
                  <div className="flex justify-start">
                    <div className="max-w-[75%] rounded-lg px-4 py-3 bg-muted text-foreground">
                      <div className="flex items-center gap-2">
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <p className="text-sm">Searching for the best quotes...</p>
                      </div>
                    </div>
                  </div>
                )}
                
                {/* Purchase in progress */}
                {isPurchasing && purchaseProgress && (
                  <div className="flex justify-start">
                    <div className="max-w-[75%] rounded-lg px-4 py-3 bg-primary/10 text-foreground border border-primary/20">
                      <div className="flex items-center gap-2">
                        <Loader2 className="w-4 h-4 animate-spin text-primary" />
                        <p className="text-sm font-medium">{purchaseProgress}</p>
                      </div>
                    </div>
                  </div>
                )}
                
                {/* Pending upload or action states */}
                {isUploading && (
                  <div className="flex justify-start">
                    <div className="max-w-[75%] rounded-lg px-4 py-3 bg-muted text-foreground">
                      <div className="flex items-center gap-2">
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <p className="text-sm">Extracting policy details from your document...</p>
                      </div>
                    </div>
                  </div>
                )}
                
                {sendMessageMutation.isPending && !isUploading && !isSearchingQuotes && (
                  <div className="flex justify-start">
                    <div className="max-w-[75%] rounded-lg px-4 py-3 bg-muted text-foreground">
                      <div className="flex items-center gap-2">
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <p className="text-sm">AutoAnnie is thinking...</p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </ScrollArea>

          {/* Upload button area - shown when AI requests it */}
          {showUploadButton && (
            <div className="px-6 py-3 border-t bg-muted/30">
              <div className="flex items-center gap-3">
                <Button
                  onClick={triggerFileUpload}
                  variant="outline"
                  className="flex-1 gap-2"
                  disabled={isUploading}
                  data-testid="button-upload-policy-chat"
                >
                  <Upload className="w-4 h-4" />
                  Upload Policy Document
                </Button>
                <Button
                  onClick={() => setShowManualEntryComing(true)}
                  variant="ghost"
                  className="gap-2"
                  data-testid="button-manual-entry-chat"
                >
                  <FileText className="w-4 h-4" />
                  Manual Entry
                </Button>
              </div>
              <p className="text-xs text-muted-foreground mt-2 text-center">
                PDF files up to 6MB supported
              </p>
            </div>
          )}

          <div className="px-6 py-4 border-t shrink-0">
            <div className="flex items-center gap-2">
              <Input
                value={messageInput}
                onChange={(e) => setMessageInput(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="Type your message..."
                className="flex-1"
                disabled={sendMessageMutation.isPending || isUploading || isPurchasing}
                data-testid="input-chat-message"
              />
              <Button
                onClick={handleSendMessage}
                disabled={!messageInput.trim() || sendMessageMutation.isPending || isUploading || isPurchasing}
                size="icon"
                data-testid="button-send-message"
              >
                <Send className="w-4 h-4" />
              </Button>
            </div>
          </div>

          {/* Hidden file input */}
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf"
            onChange={handleFileUpload}
            className="hidden"
            data-testid="input-file-upload-chat"
          />
        </DialogContent>
      </Dialog>

      {/* Manual Entry Coming Soon Dialog */}
      <ComingSoonDialog
        open={showManualEntryComing}
        onOpenChange={setShowManualEntryComing}
        featureName="Manual Entry via Chat"
      />
    </>
  );
}
