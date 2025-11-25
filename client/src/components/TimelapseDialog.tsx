import { Dialog, DialogContent, DialogClose, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { X, Sparkles, Search, CheckCircle2, XCircle } from "lucide-react";
import { useState, useEffect } from "react";
import { flushSync } from "react-dom";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { IPhoneMockup } from "./IPhoneMockup";
import { AIThinkingStep } from "./AIThinkingStep";

interface TimelapseDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedVehicleId: string | null;
  frequency: "weekly" | "monthly";
  userEmail: string | null;
}

type TimelapseState = "intro" | "searching_with_phone" | "notification_slide" | "match_found" | "no_match" | "confirming_purchase" | "celebration";

interface MatchData {
  price: number;
  insurer: string;
  features: string[];
  trustpilot_rating: number;
  ai_insight: string;
  full_quote_data: any;
  financial_breakdown: {
    new_quote_price: number;
    new_quote_insurer: string;
    current_cost: number;
    cancellation_fee: number;
    pro_rata_refund: number;
    days_remaining: number;
    upfront_impact: number;
    annual_premium_delta: number;
  };
}

export function TimelapseDialog({
  open,
  onOpenChange,
  selectedVehicleId,
  frequency,
  userEmail,
}: TimelapseDialogProps) {
  const [state, setState] = useState<TimelapseState>("intro");
  const [currentDate, setCurrentDate] = useState<string>("");
  const [currentWeekMatches, setCurrentWeekMatches] = useState<MatchData[]>([]);
  const [currentMatchIndex, setCurrentMatchIndex] = useState<number>(0);
  const [weekIndex, setWeekIndex] = useState<number>(0);
  const [policyEndDate, setPolicyEndDate] = useState<Date | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [vehicleName, setVehicleName] = useState<string>("");
  const [showNotification, setShowNotification] = useState(false);
  const { toast } = useToast();

  // Calculate next search date based on frequency
  const calculateNextDate = (currentDate: Date, frequency: "weekly" | "monthly"): Date => {
    const nextDate = new Date(currentDate);
    if (frequency === "weekly") {
      nextDate.setDate(nextDate.getDate() + 7);
    } else {
      nextDate.setMonth(nextDate.getMonth() + 1);
    }
    return nextDate;
  };

  // Search for quotes on a specific week
  const searchWeek = async (searchDate: Date, endDate: Date): Promise<void> => {
    const dateStr = searchDate.toISOString().split("T")[0];
    console.log(`[Timelapse] Searching week: ${dateStr}`);
    
    flushSync(() => {
      setCurrentDate(dateStr);
      setState("searching_with_phone");
      setShowNotification(false);
    });

    try {
      const apiResponse = await apiRequest("POST", "/api/timelapse-search-week", {
        policy_id: selectedVehicleId,
        email_id: userEmail,
        search_date: dateStr,
      });

      const response: any = await apiResponse.json();
      const matches: MatchData[] = response.matches || [];

      console.log(`[Timelapse] Week ${dateStr}: ${matches.length} matches found`);

      if (matches.length > 0) {
        // Match found! Show notification on iPhone
        flushSync(() => {
          setCurrentWeekMatches(matches);
          setCurrentMatchIndex(0);
          setState("notification_slide");
          setShowNotification(true);
          setIsSearching(false);
        });
      } else {
        // No match - continue searching (stay on iPhone screen)
        await new Promise((resolve) => setTimeout(resolve, 800));

        // Continue to next week
        const nextDate = calculateNextDate(searchDate, frequency);
        setWeekIndex(prev => prev + 1);

        // Check if we've reached the end
        if (nextDate > endDate) {
          console.log(`[Timelapse] Reached policy end date (${endDate.toISOString().split("T")[0]}). No matches found.`);
          flushSync(() => {
            setState("no_match");
            setIsSearching(false);
          });
        } else {
          // Continue searching next week
          await searchWeek(nextDate, endDate);
        }
      }
    } catch (error: any) {
      console.error("[Timelapse] Error searching week:", error);
      toast({
        title: "Search Error",
        description: error.message || "Failed to search this week",
        variant: "destructive",
      });
      setState("intro");
      setIsSearching(false);
    }
  };

  const handleStartTimelapse = async () => {
    if (!selectedVehicleId || !userEmail) {
      toast({
        title: "Error",
        description: "Please select a vehicle first",
        variant: "destructive",
      });
      return;
    }

    // Reset state
    setWeekIndex(0);
    setCurrentMatchIndex(0);
    setCurrentWeekMatches([]);
    setIsSearching(true);
    setShowNotification(false);

    try {
      // Fetch the actual policy to get the real end date and vehicle name
      const policyResponse = await apiRequest("GET", `/api/vehicle-policies/${userEmail}`);
      const policies = await policyResponse.json();
      const currentPolicy = policies.find((p: any) => p.policy_id === selectedVehicleId);

      if (!currentPolicy || !currentPolicy.policy_end_date) {
        toast({
          title: "Error",
          description: "Could not find policy end date",
          variant: "destructive",
        });
        setIsSearching(false);
        return;
      }

      // Use the real policy end date from the database
      const endDate = new Date(currentPolicy.policy_end_date);
      setPolicyEndDate(endDate);

      // Extract vehicle name for notifications
      const vehicleDisplayName = `${currentPolicy.vehicle_manufacturer_name} ${currentPolicy.vehicle_model}`;
      setVehicleName(vehicleDisplayName);

      console.log(`[Timelapse] Using real policy end date: ${endDate.toISOString().split("T")[0]}`);

      // Start searching from today, passing endDate as parameter to avoid async state issues
      const today = new Date();
      await searchWeek(today, endDate);
    } catch (error: any) {
      console.error("[Timelapse] Error fetching policy:", error);
      toast({
        title: "Error",
        description: "Failed to load policy data",
        variant: "destructive",
      });
      setIsSearching(false);
      setState("intro");
    }
  };

  const handleNotificationTap = () => {
    // User tapped the notification - hide iPhone and show match details
    setState("match_found");
  };

  const handleConfirmPurchase = () => {
    setState("confirming_purchase");
  };

  const handleKeepSearching = async () => {
    // Check if there are more matches in current week results
    if (currentMatchIndex + 1 < currentWeekMatches.length) {
      // Show next match from the same week
      setCurrentMatchIndex(currentMatchIndex + 1);
      return;
    }

    // No more matches in current week - continue to next week
    setIsSearching(true);
    setCurrentMatchIndex(0);
    setCurrentWeekMatches([]);

    // Calculate next search date
    const nextDate = calculateNextDate(new Date(currentDate), frequency);
    setWeekIndex(prev => prev + 1);

    // Check if we've reached the end - use policyEndDate from state
    if (!policyEndDate) {
      console.error("[Timelapse] policyEndDate is null in handleKeepSearching");
      setState("no_match");
      setIsSearching(false);
      return;
    }

    if (nextDate > policyEndDate) {
      console.log(`[Timelapse] Reached policy end date after keeping searching.`);
      flushSync(() => {
        setState("no_match");
        setIsSearching(false);
      });
      return;
    }

    // Continue searching from next week, passing endDate to avoid async state issues
    await searchWeek(nextDate, policyEndDate);
  };

  const handleClose = () => {
    setState("intro");
    setCurrentDate("");
    setCurrentWeekMatches([]);
    setCurrentMatchIndex(0);
    setWeekIndex(0);
    setPolicyEndDate(null);
    setIsSearching(false);
    setVehicleName("");
    setShowNotification(false);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent
        className="max-w-full max-h-full w-screen h-screen p-0 m-0 border-0"
        data-testid="dialog-timelapse"
      >
        <DialogTitle className="sr-only">Timelapse Demo - Auto-Annie Quote Search</DialogTitle>

        {/* Close X button - always visible */}
        <DialogClose asChild>
          <Button
            variant="ghost"
            size="icon"
            className="absolute right-6 top-6 z-50 hover-elevate active-elevate-2"
            data-testid="button-close-timelapse"
          >
            <X className="h-5 w-5" />
            <span className="sr-only">Close</span>
          </Button>
        </DialogClose>

        {/* Intro State */}
        {state === "intro" && (
          <div className="flex flex-col items-center justify-center h-full space-y-8 p-8">
            <div className="text-center space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-700">
              <h2 className="text-3xl md:text-4xl font-bold text-foreground leading-relaxed">
                Experience how <span className="text-primary">Auto-Annie's</span> scheduled quote search works
              </h2>
              <p className="text-lg text-muted-foreground max-w-2xl">
                Watch as Auto-Annie searches for the best insurance quotes {frequency} until a match is found
              </p>
            </div>

            <Button
              size="lg"
              onClick={handleStartTimelapse}
              disabled={!selectedVehicleId || isSearching}
              className="px-12 py-7 text-xl animate-in fade-in slide-in-from-bottom-4 duration-700 delay-300"
              data-testid="button-start-timelapse"
            >
              <Sparkles className="mr-2 h-5 w-5" />
              Start
            </Button>
          </div>
        )}

        {/* Searching with iPhone - Show iPhone screen while searching */}
        {state === "searching_with_phone" && (
          <div className="flex flex-col items-center justify-center h-full p-8">
            <IPhoneMockup
              showNotification={false}
              searchDate={currentDate}
              caption="Auto-Annie is searching in the background..."
            />
          </div>
        )}

        {/* Notification Slide - Show notification on iPhone */}
        {state === "notification_slide" && currentWeekMatches.length > 0 && (
          <div className="flex flex-col items-center justify-center h-full p-8">
            <IPhoneMockup
              showNotification={showNotification}
              notificationData={{
                vehicle: vehicleName,
                savings: Math.abs(currentWeekMatches[currentMatchIndex].financial_breakdown.annual_premium_delta),
                provider: currentWeekMatches[currentMatchIndex].financial_breakdown.new_quote_insurer,
              }}
              onNotificationTap={handleNotificationTap}
              caption="Tap the notification to view details"
            />
          </div>
        )}

        {/* Match Found State */}
        {state === "match_found" && currentWeekMatches.length > 0 && (
          <MatchFoundState
            matchData={currentWeekMatches[currentMatchIndex]}
            matchNumber={currentMatchIndex + 1}
            totalMatches={currentWeekMatches.length}
            onConfirmPurchase={handleConfirmPurchase}
            onKeepSearching={handleKeepSearching}
            hasMoreMatches={currentMatchIndex + 1 < currentWeekMatches.length}
          />
        )}

        {/* No Match State */}
        {state === "no_match" && (
          <NoMatchState onClose={handleClose} />
        )}

        {/* Confirming Purchase State - AI Thinking Steps */}
        {state === "confirming_purchase" && currentWeekMatches.length > 0 && (
          <ConfirmingPurchaseState
            newProvider={currentWeekMatches[currentMatchIndex].financial_breakdown.new_quote_insurer}
            oldProvider={currentWeekMatches[currentMatchIndex].insurer}
            onComplete={() => setState("celebration")}
          />
        )}

        {/* Celebration State */}
        {state === "celebration" && currentWeekMatches.length > 0 && (
          <CelebrationState 
            provider={currentWeekMatches[currentMatchIndex].financial_breakdown.new_quote_insurer}
            onClose={handleClose} 
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

// Match Found State Component
function MatchFoundState({
  matchData,
  matchNumber,
  totalMatches,
  onConfirmPurchase,
  onKeepSearching,
  hasMoreMatches,
}: {
  matchData: MatchData;
  matchNumber: number;
  totalMatches: number;
  onConfirmPurchase: () => void;
  onKeepSearching: () => void;
  hasMoreMatches: boolean;
}) {
  const { insurer, price, ai_insight, financial_breakdown } = matchData;

  return (
    <div className="flex flex-col h-full overflow-y-auto p-8 bg-gradient-to-br from-background via-background to-green-500/5">
      {/* Success Header */}
      <div className="text-center mb-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
        <CheckCircle2 className="h-20 w-20 text-green-500 mx-auto mb-4" />
        <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-2">
          Quote Match Found!
        </h2>
        <p className="text-lg text-muted-foreground">
          Auto-Annie found a great deal for you
        </p>
        {totalMatches > 1 && (
          <p className="text-sm text-muted-foreground mt-2">
            Showing match {matchNumber} of {totalMatches}
          </p>
        )}
      </div>

      {/* Financial Breakdown */}
      <div className="max-w-3xl mx-auto w-full space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700 delay-100">
        {/* New Quote Header */}
        <div className="text-center mb-6">
          <h3 className="text-5xl font-bold text-primary mb-2">
            £{financial_breakdown.new_quote_price.toFixed(2)}
          </h3>
          <p className="text-2xl text-muted-foreground">
            {financial_breakdown.new_quote_insurer}
          </p>
        </div>

        {/* Financial Details Card */}
        <div className="bg-card border border-border rounded-lg p-6 space-y-4">
          <div className="flex justify-between items-center py-2 border-b border-border">
            <span className="text-muted-foreground">Current cost</span>
            <span className="text-lg font-semibold">
              £{financial_breakdown.current_cost.toFixed(2)}
            </span>
          </div>

          <div className="flex justify-between items-center py-2 border-b border-border">
            <span className="text-muted-foreground">Cancellation fee</span>
            <span className="text-lg font-semibold">
              £{financial_breakdown.cancellation_fee.toFixed(2)}
            </span>
          </div>

          <div className="flex justify-between items-center py-2 border-b border-border">
            <span className="text-muted-foreground">
              Pro-rata refund (~{financial_breakdown.days_remaining} days)
            </span>
            <span className="text-lg font-semibold text-green-600">
              £{financial_breakdown.pro_rata_refund.toFixed(2)}
            </span>
          </div>

          <div className="flex justify-between items-center py-3 bg-accent/30 rounded-lg px-4 mt-4">
            <span className="font-semibold">Upfront impact</span>
            <span className={`text-xl font-bold ${
              financial_breakdown.upfront_impact > 0 ? "text-green-600" : "text-red-600"
            }`}>
              {financial_breakdown.upfront_impact > 0 ? "Receive back " : "Pay "}
              £{Math.abs(financial_breakdown.upfront_impact).toFixed(2)}
            </span>
          </div>

          <div className="flex justify-between items-center py-3 bg-primary/10 rounded-lg px-4">
            <span className="font-semibold">Annual premium delta</span>
            <span className={`text-xl font-bold ${
              financial_breakdown.annual_premium_delta > 0 ? "text-green-600" : "text-red-600"
            }`}>
              {financial_breakdown.annual_premium_delta > 0 ? "Saving " : "Paying "}
              £{Math.abs(financial_breakdown.annual_premium_delta).toFixed(2)} per year
            </span>
          </div>
        </div>

        {/* Features & Rating */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-card border border-border rounded-lg p-4">
            <h4 className="font-semibold mb-2">Features included</h4>
            <p className="text-sm text-muted-foreground">
              {matchData.features.join(", ")}
            </p>
          </div>

          <div className="bg-card border border-border rounded-lg p-4">
            <h4 className="font-semibold mb-2">Rating</h4>
            <p className="text-sm text-muted-foreground">
              Trustpilot: {matchData.trustpilot_rating?.toFixed(1) || "N/A"}
            </p>
          </div>
        </div>

        {/* AI Insight */}
        {ai_insight && (
          <div className="bg-accent/20 border border-accent rounded-lg p-4">
            <h4 className="font-semibold mb-2 flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary" />
              Auto-Annie's Insight
            </h4>
            <p className="text-sm text-muted-foreground">
              {ai_insight}
            </p>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row gap-4 pt-6">
          <Button
            size="lg"
            onClick={onConfirmPurchase}
            className="flex-1 text-lg py-6"
            data-testid="button-confirm-purchase"
          >
            Confirm purchase
          </Button>
          <Button
            size="lg"
            variant="outline"
            onClick={onKeepSearching}
            disabled={!hasMoreMatches}
            className="flex-1 text-lg py-6"
            data-testid="button-keep-searching"
          >
            {hasMoreMatches ? "Keep searching" : "No more matches"}
          </Button>
        </div>
      </div>
    </div>
  );
}

// No Match State Component
function NoMatchState({ onClose }: { onClose: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center h-full space-y-8 p-8 bg-gradient-to-br from-background via-background to-destructive/5">
      <div className="text-center space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
        <XCircle className="h-20 w-20 text-destructive mx-auto" />
        <h2 className="text-3xl md:text-4xl font-bold text-foreground">
          No Match Found
        </h2>
        <p className="text-lg text-muted-foreground max-w-md">
          Auto-Annie couldn't find a quote matching your budget and preferences before your policy end date.
        </p>
        <p className="text-base text-muted-foreground max-w-md">
          Try adjusting your budget and preferences, then search again.
        </p>
      </div>

      <Button
        size="lg"
        onClick={onClose}
        className="px-8 py-6 text-lg"
        data-testid="button-close-no-match"
      >
        Close
      </Button>
    </div>
  );
}

// Confirming Purchase State - AI Thinking Steps
function ConfirmingPurchaseState({ 
  newProvider, 
  oldProvider, 
  onComplete 
}: { 
  newProvider: string; 
  oldProvider: string; 
  onComplete: () => void;
}) {
  const [currentStep, setCurrentStep] = useState(0);

  const steps = [
    { text: `Contacting ${newProvider}`, blinks: 3, duration: 1800 },
    { text: `Buying policy from ${newProvider}`, blinks: 3, duration: 1800 },
    { text: "Verifying policy document received", blinks: 2, duration: 1200 },
    { text: `Cancelling policy from ${oldProvider}`, blinks: 3, duration: 1800 },
    { text: `Receiving confirmation from ${oldProvider}`, blinks: 2, duration: 1200 },
    { text: "Reviewing old policy cancellation", blinks: 2, duration: 1200 },
  ];

  useEffect(() => {
    if (currentStep >= steps.length) {
      // All steps completed - wait a moment then show celebration
      const timer = setTimeout(() => {
        onComplete();
      }, 500);
      return () => clearTimeout(timer);
    }

    // Process current step
    const timer = setTimeout(() => {
      setCurrentStep(prev => prev + 1);
    }, steps[currentStep].duration);

    return () => clearTimeout(timer);
  }, [currentStep, steps.length, onComplete]);

  return (
    <div className="flex flex-col items-center justify-center h-full p-8 bg-gradient-to-br from-background via-background to-blue-500/5">
      <div className="max-w-2xl w-full space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
        <div className="text-center mb-12">
          <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-3">
            Switching your policy...
          </h2>
          <p className="text-lg text-muted-foreground">
            Auto-Annie is working on your behalf
          </p>
        </div>

        <div className="bg-card border border-border rounded-xl p-8 space-y-3" data-testid="ai-thinking-steps">
          {steps.map((step, index) => (
            <AIThinkingStep
              key={index}
              text={step.text}
              status={
                index < currentStep 
                  ? "completed" 
                  : index === currentStep 
                  ? "processing" 
                  : "pending"
              }
            />
          ))}
        </div>
      </div>
    </div>
  );
}

// Celebration State with Confetti
function CelebrationState({ provider, onClose }: { provider: string; onClose: () => void }) {
  useEffect(() => {
    // Create confetti particles
    const confettiContainer = document.getElementById('confetti-container');
    if (!confettiContainer) return;

    const colors = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];
    const particleCount = 50;

    for (let i = 0; i < particleCount; i++) {
      const particle = document.createElement('div');
      particle.className = 'confetti-particle';
      particle.style.cssText = `
        position: absolute;
        width: 10px;
        height: 10px;
        background-color: ${colors[Math.floor(Math.random() * colors.length)]};
        left: ${Math.random() * 100}%;
        top: -10px;
        opacity: ${Math.random() * 0.8 + 0.2};
        animation: confetti-fall ${Math.random() * 3 + 2}s linear forwards;
        border-radius: ${Math.random() > 0.5 ? '50%' : '0'};
      `;
      confettiContainer.appendChild(particle);
    }

    // Cleanup
    return () => {
      if (confettiContainer) {
        confettiContainer.innerHTML = '';
      }
    };
  }, []);

  return (
    <div className="relative flex flex-col items-center justify-center h-full space-y-8 p-8 bg-gradient-to-br from-background via-background to-green-500/5 overflow-hidden">
      <div 
        id="confetti-container" 
        className="absolute inset-0 pointer-events-none z-10"
        data-testid="confetti-container"
      />

      <style>{`
        @keyframes confetti-fall {
          to {
            transform: translateY(100vh) rotate(720deg);
            opacity: 0;
          }
        }
      `}</style>

      <div className="text-center space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700 z-20">
        <CheckCircle2 className="h-28 w-28 text-green-500 mx-auto animate-in zoom-in duration-500" />
        <h2 className="text-5xl md:text-6xl font-bold text-foreground">
          You're covered!
        </h2>
        <p className="text-3xl text-foreground font-medium">
          with <span className="text-primary">{provider}</span>
        </p>
        <p className="text-lg text-muted-foreground max-w-md mx-auto mt-6">
          Auto-Annie has successfully switched your insurance policy
        </p>
      </div>

      <Button
        size="lg"
        onClick={onClose}
        className="px-12 py-7 text-xl z-20 animate-in fade-in slide-in-from-bottom-4 duration-700 delay-500"
        data-testid="button-close-celebration"
      >
        Close
      </Button>
    </div>
  );
}
