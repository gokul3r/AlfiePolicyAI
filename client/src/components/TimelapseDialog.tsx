import { Dialog, DialogContent, DialogClose, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { X, Sparkles, Search, CheckCircle2, XCircle } from "lucide-react";
import { useState } from "react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface TimelapseDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedVehicleId: string | null;
  frequency: "weekly" | "monthly";
  userEmail: string | null;
}

type TimelapseState = "intro" | "searching" | "match_found" | "no_match" | "confirmed";

interface MatchData {
  iteration_index: number;
  quote_data: {
    price: number;
    insurer: string;
    features: string[];
    trustpilot_rating: number;
    ai_insight: string;
  };
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
  const [allMatches, setAllMatches] = useState<MatchData[]>([]);
  const [allIterations, setAllIterations] = useState<any[]>([]);
  const [currentMatchIndex, setCurrentMatchIndex] = useState<number>(0);
  const [isSearching, setIsSearching] = useState(false);
  const { toast } = useToast();

  const handleStartTimelapse = async () => {
    if (!selectedVehicleId || !userEmail) {
      toast({
        title: "Error",
        description: "Please select a vehicle first",
        variant: "destructive",
      });
      return;
    }

    setState("searching");
    setIsSearching(true);

    try {
      const response: any = await apiRequest("POST", "/api/timelapse-search", {
        policy_id: selectedVehicleId,
        email_id: userEmail,
        frequency,
      });

      // Store all matches and iterations from the response
      const matches: MatchData[] = response.all_matches || [];
      const iterations = response.iterations || [];
      setAllMatches(matches);
      setAllIterations(iterations);

      // Simulate iteration progress with 2-second delays until first match
      let firstMatchFound = false;
      for (let i = 0; i < iterations.length; i++) {
        const iteration = iterations[i];
        setCurrentDate(iteration.date);

        // Wait 2 seconds before checking next date
        await new Promise((resolve) => setTimeout(resolve, 2000));

        // Stop and show first match when found
        if (iteration.match_found && !firstMatchFound) {
          firstMatchFound = true;
          setCurrentMatchIndex(0);
          setState("match_found");
          setIsSearching(false);
          return;
        }
      }

      // No match found after all iterations
      if (matches.length === 0) {
        setState("no_match");
      } else {
        // We have matches but simulation ended
        setCurrentMatchIndex(0);
        setState("match_found");
      }
      setIsSearching(false);
    } catch (error: any) {
      console.error("Timelapse search error:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to perform timelapse search",
        variant: "destructive",
      });
      setState("intro");
      setIsSearching(false);
    }
  };

  const handleConfirmPurchase = () => {
    setState("confirmed");
  };

  const [isEndOfResults, setIsEndOfResults] = useState(false);

  const handleKeepSearching = async () => {
    // Check if there are more matches
    if (currentMatchIndex + 1 >= allMatches.length) {
      // No more matches - show end state
      setIsEndOfResults(true);
      setState("no_match");
      return;
    }

    // Get the iteration indices directly from the match data
    const currentMatchData = allMatches[currentMatchIndex];
    const nextMatchData = allMatches[currentMatchIndex + 1];
    
    const currentMatchIterIndex = currentMatchData.iteration_index;
    const nextMatchIterIndex = nextMatchData.iteration_index;

    // Validate iteration data
    if (
      currentMatchIterIndex === undefined || 
      nextMatchIterIndex === undefined ||
      nextMatchIterIndex <= currentMatchIterIndex ||
      !allIterations || 
      allIterations.length === 0
    ) {
      // Missing iteration data - this is an error state
      toast({
        title: "Unable to continue search",
        description: "Missing timeline data. Please try searching again.",
        variant: "destructive",
      });
      setIsSearching(false);
      return;
    }

    // Verify all iterations exist in the range
    for (let i = currentMatchIterIndex + 1; i <= nextMatchIterIndex; i++) {
      if (!allIterations[i]) {
        toast({
          title: "Incomplete timeline data",
          description: "Some dates are missing. Please try searching again.",
          variant: "destructive",
        });
        setIsSearching(false);
        return;
      }
    }

    // Simulate searching through the iterations between matches
    setState("searching");
    setIsSearching(true);

    // Play through iterations from current to next match
    for (let i = currentMatchIterIndex + 1; i <= nextMatchIterIndex; i++) {
      const iteration = allIterations[i];
      
      // Defensive guard - should never happen due to validation above
      if (!iteration) {
        toast({
          title: "Timeline error",
          description: "Missing iteration data at position " + i,
          variant: "destructive",
        });
        setIsSearching(false);
        // Stay in searching state to show error - don't jump to match
        return;
      }

      setCurrentDate(iteration.date);
      
      // Wait 2 seconds before checking next date
      await new Promise((resolve) => setTimeout(resolve, 2000));
      
      if (i === nextMatchIterIndex) {
        // Reached the next match
        setCurrentMatchIndex(currentMatchIndex + 1);
        setState("match_found");
        setIsSearching(false);
        return;
      }
    }
  };

  const handleClose = () => {
    setState("intro");
    setCurrentDate("");
    setAllMatches([]);
    setAllIterations([]);
    setCurrentMatchIndex(0);
    setIsSearching(false);
    setIsEndOfResults(false);
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

        {/* Searching State */}
        {state === "searching" && (
          <SearchingState currentDate={currentDate} frequency={frequency} />
        )}

        {/* Match Found State */}
        {state === "match_found" && allMatches.length > 0 && (
          <MatchFoundState
            matchData={allMatches[currentMatchIndex]}
            matchNumber={currentMatchIndex + 1}
            totalMatches={allMatches.length}
            onConfirmPurchase={handleConfirmPurchase}
            onKeepSearching={handleKeepSearching}
            hasMoreMatches={currentMatchIndex + 1 < allMatches.length}
          />
        )}

        {/* No Match State */}
        {state === "no_match" && (
          <NoMatchState onClose={handleClose} isEndOfResults={isEndOfResults} />
        )}

        {/* Confirmed State */}
        {state === "confirmed" && allMatches.length > 0 && (
          <ConfirmedState insurer={allMatches[currentMatchIndex].quote_data.insurer} onClose={handleClose} />
        )}
      </DialogContent>
    </Dialog>
  );
}

// Searching State Component
function SearchingState({ currentDate, frequency }: { currentDate: string; frequency: string }) {
  return (
    <div className="flex flex-col items-center justify-center h-full space-y-12 p-8 bg-gradient-to-br from-background via-background to-accent/5">
      {/* Blinking Date Display */}
      <div
        className="text-center animate-pulse"
        data-testid="text-search-date"
      >
        <p className="text-sm text-muted-foreground uppercase tracking-wider mb-2">Searching on</p>
        <h3 className="text-4xl md:text-5xl font-bold text-primary">
          {currentDate || "Starting..."}
        </h3>
        <p className="text-sm text-muted-foreground mt-2">
          Checking {frequency} for matching quotes
        </p>
      </div>

      {/* AI Search Animation */}
      <div className="relative" data-testid="animation-searching">
        {/* Pulsing search icon with gradient rings */}
        <div className="relative w-48 h-48 flex items-center justify-center">
          {/* Outer ring */}
          <div className="absolute inset-0 rounded-full bg-gradient-to-r from-purple-500/20 to-blue-500/20 animate-ping" />
          
          {/* Middle ring */}
          <div className="absolute inset-8 rounded-full bg-gradient-to-r from-purple-500/30 to-blue-500/30 animate-pulse" />
          
          {/* Inner ring */}
          <div className="absolute inset-16 rounded-full bg-gradient-to-r from-purple-500/40 to-blue-500/40" />
          
          {/* Center icon */}
          <div className="relative z-10">
            <Search className="h-24 w-24 text-primary animate-pulse" />
          </div>

          {/* Floating sparkles */}
          <Sparkles className="absolute top-4 right-4 h-6 w-6 text-purple-400 animate-bounce delay-100" />
          <Sparkles className="absolute bottom-4 left-4 h-5 w-5 text-blue-400 animate-bounce delay-300" />
          <Sparkles className="absolute top-12 left-12 h-4 w-4 text-purple-300 animate-bounce delay-500" />
        </div>
      </div>

      {/* Status Text */}
      <div className="text-center space-y-2 animate-pulse">
        <p className="text-xl md:text-2xl font-semibold text-foreground">
          Searching for the best quotes...
        </p>
        <p className="text-muted-foreground">
          Auto-Annie is checking insurance providers for you
        </p>
      </div>
    </div>
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
  const { quote_data, financial_breakdown } = matchData;

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
              {quote_data.features.join(", ")}
            </p>
          </div>

          <div className="bg-card border border-border rounded-lg p-4">
            <h4 className="font-semibold mb-2">Rating</h4>
            <p className="text-sm text-muted-foreground">
              Trustpilot: {quote_data.trustpilot_rating?.toFixed(1) || "N/A"}
            </p>
          </div>
        </div>

        {/* AI Insight */}
        {quote_data.ai_insight && (
          <div className="bg-accent/20 border border-accent rounded-lg p-4">
            <h4 className="font-semibold mb-2 flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary" />
              Auto-Annie's Insight
            </h4>
            <p className="text-sm text-muted-foreground">
              {quote_data.ai_insight}
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
function NoMatchState({ 
  onClose, 
  isEndOfResults = false 
}: { 
  onClose: () => void;
  isEndOfResults?: boolean;
}) {
  return (
    <div className="flex flex-col items-center justify-center h-full space-y-8 p-8 bg-gradient-to-br from-background via-background to-destructive/5">
      <div className="text-center space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
        <XCircle className="h-20 w-20 text-destructive mx-auto" />
        <h2 className="text-3xl md:text-4xl font-bold text-foreground">
          {isEndOfResults ? "No More Matches" : "No Match Found"}
        </h2>
        <p className="text-lg text-muted-foreground max-w-md">
          {isEndOfResults 
            ? "You've seen all available matching quotes from Auto-Annie's search through to your policy end date."
            : "Auto-Annie couldn't find a quote matching your budget and preferences before your policy end date."}
        </p>
        <p className="text-base text-muted-foreground max-w-md">
          {isEndOfResults 
            ? "Feel free to review the matches again or close to return."
            : "Try adjusting your budget and preferences, then search again."}
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

// Confirmed State Component
function ConfirmedState({ insurer, onClose }: { insurer: string; onClose: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center h-full space-y-8 p-8 bg-gradient-to-br from-background via-background to-green-500/5">
      <div className="text-center space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
        <CheckCircle2 className="h-24 w-24 text-green-500 mx-auto" />
        <h2 className="text-4xl md:text-5xl font-bold text-foreground">
          You're Covered!
        </h2>
        <p className="text-2xl text-muted-foreground">
          You are now covered with <span className="font-semibold text-primary">{insurer}</span>
        </p>
        <p className="text-base text-muted-foreground max-w-md mt-4">
          This is a demo. In the real app, your policy would be switched automatically.
        </p>
      </div>

      <Button
        size="lg"
        onClick={onClose}
        className="px-12 py-7 text-xl"
        data-testid="button-close-confirmed"
      >
        Close
      </Button>
    </div>
  );
}
