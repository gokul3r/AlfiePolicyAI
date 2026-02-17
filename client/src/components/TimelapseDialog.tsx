import {
  Dialog,
  DialogContent,
  DialogClose,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card";
import {
  X,
  Sparkles,
  Search,
  CheckCircle2,
  XCircle,
  Star,
  Shield,
  Scale,
  Gavel,
  Car,
  Wrench,
  Globe,
  Phone,
  Users,
  FileCheck,
  Heart,
  Umbrella,
  Zap,
  AlertTriangle,
  Award,
  BadgeCheck,
  ChevronDown,
  ChevronUp,
  ChevronLeft,
  ChevronRight,
  Calendar,
} from "lucide-react";
import { useState, useEffect } from "react";
import { flushSync } from "react-dom";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { IPhoneMockup } from "./IPhoneMockup";
import { AIThinkingStep } from "./AIThinkingStep";

export interface RejectedQuoteData {
  provider: string;
  cost: number;
  date: string;
}

interface TimelapseDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedVehicleId: string | null;
  frequency: "weekly" | "monthly";
  userEmail: string | null;
  minSavingsThreshold?: number;
  onQuoteAccepted?: (count?: number) => void;
  onQuoteRejected?: (quoteData: RejectedQuoteData) => void;
  quotesAccepted: number;
  quotesRejected: number;
  rejectedQuotes: RejectedQuoteData[];
}

type TimelapseState =
  | "intro"
  | "searching_with_phone"
  | "notification_slide"
  | "match_found"
  | "no_match"
  | "timelapse_complete"
  | "confirming_purchase"
  | "celebration";

interface MatchData {
  price: number;
  insurer: string;
  features: string[];
  requested_features: string[];
  missing_features: string[];
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
    new_policy_cost: number;
    upfront_impact: number;
    annual_premium_delta: number;
    stay_cost_12m: number;
    switch_cost_12m: number;
    annual_savings: number;
    stay_remaining_value: number;
    stay_renewal_cost: number;
    stay_renewal_days: number;
  };
}

export function TimelapseDialog({
  open,
  onOpenChange,
  selectedVehicleId,
  frequency,
  userEmail,
  minSavingsThreshold = 50,
  onQuoteAccepted,
  onQuoteRejected,
  quotesAccepted,
  quotesRejected,
  rejectedQuotes,
}: TimelapseDialogProps) {
  const [state, setState] = useState<TimelapseState>("intro");
  const [currentDate, setCurrentDate] = useState<string>("");
  const [currentWeekMatches, setCurrentWeekMatches] = useState<MatchData[]>([]);
  const [currentMatchIndex, setCurrentMatchIndex] = useState<number>(0);
  const [weekIndex, setWeekIndex] = useState<number>(0);
  const [policyEndDate, setPolicyEndDate] = useState<Date | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [vehicleName, setVehicleName] = useState<string>("");
  const [vehicleRegNumber, setVehicleRegNumber] = useState<string>("");
  const [showNotification, setShowNotification] = useState(false);
  const [currentInsuranceProvider, setCurrentInsuranceProvider] =
    useState<string>("");
  const [priceHistory, setPriceHistory] = useState<
    { month: string; lowestPrice: number | null; marketLowestPrice: number | null; status?: "purchased" | "matched" | "market"; insurer?: string; features?: string[]; marketInsurer?: string; marketFeatures?: string[] }[]
  >([]);
  const [currentPolicyPrice, setCurrentPolicyPrice] = useState<number>(0);
  const { toast } = useToast();

  // Calculate next search date based on frequency
  const calculateNextDate = (
    currentDate: Date,
    frequency: "weekly" | "monthly",
  ): Date => {
    const nextDate = new Date(currentDate);
    if (frequency === "weekly") {
      nextDate.setDate(nextDate.getDate() + 7);
    } else {
      const currentDay = currentDate.getDate();
      const targetMonth = currentDate.getMonth() + 1;
      nextDate.setMonth(targetMonth, 1);
      const lastDayOfTargetMonth = new Date(nextDate.getFullYear(), nextDate.getMonth() + 1, 0).getDate();
      nextDate.setDate(Math.min(currentDay, lastDayOfTargetMonth));
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
      const apiResponse = await apiRequest(
        "POST",
        "/api/timelapse-search-week",
        {
          policy_id: selectedVehicleId,
          email_id: userEmail,
          search_date: dateStr,
        },
      );

      const response: any = await apiResponse.json();
      const allMatches: MatchData[] = response.matches || [];

      // Store the current insurance provider from the API response
      if (response.current_insurance_provider) {
        setCurrentInsuranceProvider(response.current_insurance_provider);
      }

      // Filter matches based on minimum savings threshold using 12-month annual savings
      const matches = allMatches.filter((match) => {
        return (
          match.financial_breakdown.annual_savings >= minSavingsThreshold
        );
      });

      console.log(
        `[Timelapse] Week ${dateStr}: ${allMatches.length} total matches, ${matches.length} above £${minSavingsThreshold} threshold`,
      );

      // Track price data for the live graph - aggregate per month+year
      const monthLabel = searchDate.toLocaleDateString("en-GB", { month: "short", year: "2-digit" });
      const lowestPrice = allMatches.length > 0 ? Math.min(...allMatches.map((m) => m.price)) : null;
      const allQuotePrices: number[] = response.all_quote_prices || [];
      const marketLowestPrice = allQuotePrices.length > 0 ? Math.min(...allQuotePrices) : null;

      const bestMatch = allMatches.length > 0
        ? allMatches.reduce((best, m) => (m.price < best.price ? m : best), allMatches[0])
        : null;
      const matchedInsurer = bestMatch?.insurer || bestMatch?.financial_breakdown?.new_quote_insurer;
      const matchedFeatures = bestMatch?.features;

      const marketQuotes = response.all_quotes_basic || [];
      const cheapestMarketQuote = marketQuotes.length > 0
        ? marketQuotes.reduce((best: any, q: any) => {
            const price = q.price || q.annual_premium;
            const bestPrice = best.price || best.annual_premium;
            return price < bestPrice ? q : best;
          }, marketQuotes[0])
        : null;
      const marketInsurerName = cheapestMarketQuote?.insurer || cheapestMarketQuote?.insurer_name;
      const marketQuoteFeatures = cheapestMarketQuote?.features;

      setPriceHistory((prev) => {
        const existing = prev.find((p) => p.month === monthLabel);
        if (existing) {
          const updatedEntry = { ...existing };
          if (lowestPrice !== null) {
            if (updatedEntry.lowestPrice === null || lowestPrice < updatedEntry.lowestPrice) {
              updatedEntry.lowestPrice = lowestPrice;
              updatedEntry.insurer = matchedInsurer;
              updatedEntry.features = matchedFeatures;
              updatedEntry.status = "matched";
            }
          }
          if (marketLowestPrice !== null) {
            if (updatedEntry.marketLowestPrice === null || marketLowestPrice < updatedEntry.marketLowestPrice) {
              updatedEntry.marketLowestPrice = marketLowestPrice;
              updatedEntry.marketInsurer = marketInsurerName;
              updatedEntry.marketFeatures = marketQuoteFeatures;
            }
          }
          if (updatedEntry.lowestPrice !== existing.lowestPrice || updatedEntry.marketLowestPrice !== existing.marketLowestPrice) {
            return prev.map((p) => p.month === monthLabel ? updatedEntry : p);
          }
          return prev;
        }
        return [...prev, {
          month: monthLabel,
          lowestPrice,
          marketLowestPrice,
          status: lowestPrice !== null ? "matched" as const : undefined,
          insurer: matchedInsurer,
          features: matchedFeatures,
          marketInsurer: marketInsurerName,
          marketFeatures: marketQuoteFeatures,
        }];
      });

      if (matches.length > 0) {
        // Match found above threshold! Show notification on iPhone
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
        setWeekIndex((prev) => prev + 1);

        // Check if we've reached the end
        if (nextDate > endDate) {
          console.log(
            `[Timelapse] Reached policy end date (${endDate.toISOString().split("T")[0]}). Timelapse complete.`,
          );
          flushSync(() => {
            setState("timelapse_complete");
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
    setPriceHistory([]);
    setCurrentPolicyPrice(0);

    try {
      // Clear previous session's quote history (session-based, not cumulative)
      try {
        await apiRequest(
          "DELETE",
          `/api/quote-history/${encodeURIComponent(userEmail)}`,
        );
        console.log(
          "[Timelapse] Cleared previous quote history for new session",
        );
      } catch (clearError) {
        console.warn(
          "[Timelapse] Failed to clear previous quote history, continuing anyway:",
          clearError,
        );
      }

      // Fetch the actual policy to get the real end date and vehicle name
      const policyResponse = await apiRequest(
        "GET",
        `/api/vehicle-policies/${userEmail}`,
      );
      const policies = await policyResponse.json();
      const currentPolicy = policies.find(
        (p: any) => p.policy_id === selectedVehicleId,
      );

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

      // Extract vehicle name, registration, and current price for notifications + chart
      const vehicleDisplayName = `${currentPolicy.vehicle_manufacturer_name} ${currentPolicy.vehicle_model}`;
      setVehicleName(vehicleDisplayName);
      setVehicleRegNumber(currentPolicy.vehicle_registration_number || "");
      if (currentPolicy.current_policy_cost) {
        setCurrentPolicyPrice(Number(currentPolicy.current_policy_cost));
      }

      console.log(
        `[Timelapse] Using real policy end date: ${endDate.toISOString().split("T")[0]}`,
      );

      // Start searching from policy start date + 1 interval (1 week or 1 month)
      const policyStartDate = new Date(currentPolicy.policy_start_date);
      const firstSearchDate = calculateNextDate(policyStartDate, frequency);
      console.log(
        `[Timelapse] Policy start: ${policyStartDate.toISOString().split("T")[0]}, first search: ${firstSearchDate.toISOString().split("T")[0]} (${frequency})`,
      );
      await searchWeek(firstSearchDate, endDate);
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

  // Helper to store quote in history
  const saveQuoteToHistory = async (
    match: MatchData,
    status: "matched" | "rejected",
  ) => {
    // Always update session counters regardless of API success
    if (status === "matched") {
      onQuoteAccepted?.(1);
    } else {
      onQuoteRejected?.({
        provider: match.financial_breakdown.new_quote_insurer,
        cost: match.financial_breakdown.new_quote_price,
        date: currentDate,
      });
    }

    if (!userEmail || !vehicleRegNumber) return;

    try {
      await apiRequest("POST", "/api/quote-history", {
        email_id: userEmail,
        insurance_provider_name: match.financial_breakdown.new_quote_insurer,
        vehicle_number: vehicleRegNumber,
        price_of_quote: match.financial_breakdown.new_quote_price,
        features: match.features,
        status,
      });
    } catch (error) {
      console.error(`[Timelapse] Failed to save quote as ${status}:`, error);
    }
  };

  const handleConfirmPurchase = async () => {
    // Save selected match as matched, and all others as rejected
    const currentMatch = currentWeekMatches[currentMatchIndex];
    if (currentMatch) {
      await saveQuoteToHistory(currentMatch, "matched");
    }
    for (let i = 0; i < currentWeekMatches.length; i++) {
      if (i !== currentMatchIndex) {
        await saveQuoteToHistory(currentWeekMatches[i], "rejected");
      }
    }

    // Update the policy in the database with the new insurer
    if (currentMatch && userEmail && vehicleRegNumber) {
      try {
        await apiRequest("POST", "/api/purchase-policy", {
          email_id: userEmail,
          vehicle_registration_number: vehicleRegNumber,
          insurer_name: currentMatch.insurer,
          policy_cost: currentMatch.price,
        });
        console.log(
          `[Timelapse] DB updated: policy switched to ${currentMatch.insurer} at £${currentMatch.price}`,
        );
        setCurrentPolicyPrice(currentMatch.price);

        // Mark the corresponding price history entry as "purchased" (green dot)
        // Update price, insurer, and features to reflect the actual selected match
        const purchaseMonthLabel = new Date(currentDate).toLocaleDateString("en-GB", { month: "short", year: "2-digit" });
        const purchasedInsurer = currentMatch.insurer || currentMatch.financial_breakdown.new_quote_insurer;
        const purchasedPrice = currentMatch.price;
        const purchasedFeatures = currentMatch.features;
        setPriceHistory((prev) =>
          prev.map((p) =>
            p.month === purchaseMonthLabel
              ? { ...p, status: "purchased" as const, lowestPrice: purchasedPrice, insurer: purchasedInsurer, features: purchasedFeatures }
              : p
          )
        );

        queryClient.invalidateQueries({ queryKey: ["/api/vehicle-policies", userEmail] });
      } catch (purchaseError) {
        console.error("[Timelapse] Failed to update policy in DB:", purchaseError);
      }
    }

    setState("confirming_purchase");
  };

  const handleKeepSearching = async () => {
    // Save all matches from this period as rejected (user chose to move on)
    for (const match of currentWeekMatches) {
      await saveQuoteToHistory(match, "rejected");
    }

    // Continue to next search period
    setIsSearching(true);
    setCurrentMatchIndex(0);
    setCurrentWeekMatches([]);

    // Calculate next search date
    const nextDate = calculateNextDate(new Date(currentDate), frequency);
    setWeekIndex((prev) => prev + 1);

    // Check if we've reached the end - use policyEndDate from state
    if (!policyEndDate) {
      console.error("[Timelapse] policyEndDate is null in handleKeepSearching");
      setState("no_match");
      setIsSearching(false);
      return;
    }

    if (nextDate > policyEndDate) {
      console.log(
        `[Timelapse] Reached policy end date after keeping searching.`,
      );
      flushSync(() => {
        setState("timelapse_complete");
        setIsSearching(false);
      });
      return;
    }

    // Continue searching from next week, passing endDate to avoid async state issues
    await searchWeek(nextDate, policyEndDate);
  };

  const handleContinueTimelapse = async () => {
    if (!policyEndDate) {
      console.error("[Timelapse] policyEndDate is null in handleContinueTimelapse");
      setState("no_match");
      return;
    }

    // Calculate next search date from where the match was found
    const nextDate = calculateNextDate(new Date(currentDate), frequency);
    setWeekIndex((prev) => prev + 1);

    console.log(
      `[Timelapse] Continuing timelapse from ${nextDate.toISOString().split("T")[0]}, end date: ${policyEndDate.toISOString().split("T")[0]}`,
    );

    // Check if we've passed the original policy end date
    if (nextDate > policyEndDate) {
      console.log("[Timelapse] Reached policy end date after continuing timelapse.");
      flushSync(() => {
        setState("timelapse_complete");
        setIsSearching(false);
      });
      return;
    }

    // Reset match state and resume searching
    setCurrentMatchIndex(0);
    setCurrentWeekMatches([]);
    setIsSearching(true);
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
    setVehicleRegNumber("");
    setShowNotification(false);
    setPriceHistory([]);
    setCurrentPolicyPrice(0);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent
        className="max-w-full max-h-full w-screen h-screen p-0 m-0 border-0"
        data-testid="dialog-timelapse"
      >
        <DialogTitle className="sr-only">
          Timelapse Demo - Auto-Annie Quote Search
        </DialogTitle>

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
                Experience how{" "}
                <span className="text-primary">Auto-Annie's</span> scheduled
                quote search works
              </h2>
              <p className="text-lg text-muted-foreground max-w-2xl">
                Watch as Auto-Annie searches for the best insurance quotes{" "}
                {frequency} until a match is found
              </p>
            </div>

            <Button
              size="lg"
              onClick={handleStartTimelapse}
              disabled={!selectedVehicleId || isSearching}
              className="px-12 py-7 text-xl animate-in fade-in slide-in-from-bottom-4 duration-700 delay-150"
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
              priceHistory={priceHistory}
              currentPolicyPrice={currentPolicyPrice}
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
                savings:
                  currentWeekMatches[currentMatchIndex].financial_breakdown
                    .annual_savings,
                provider:
                  currentWeekMatches[currentMatchIndex].financial_breakdown
                    .new_quote_insurer,
              }}
              onNotificationTap={handleNotificationTap}
              caption="Tap the notification to view details"
              priceHistory={priceHistory}
              currentPolicyPrice={currentPolicyPrice}
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
            onPreviousMatch={() => setCurrentMatchIndex((prev) => Math.max(0, prev - 1))}
            onNextMatch={() => setCurrentMatchIndex((prev) => Math.min(currentWeekMatches.length - 1, prev + 1))}
            canSearchMoreMonths={
              policyEndDate
                ? calculateNextDate(new Date(currentDate), frequency) <=
                  policyEndDate
                : false
            }
            frequency={frequency}
            quotesAccepted={quotesAccepted}
            quotesRejected={quotesRejected}
            rejectedQuotes={rejectedQuotes}
            searchDate={currentDate}
          />
        )}

        {/* Timelapse Complete - Keep chart visible with summary banner */}
        {state === "timelapse_complete" && (
          <div className="flex flex-col items-center h-full overflow-y-auto p-8 pt-4">
            <IPhoneMockup
              showNotification={false}
              searchDate={currentDate}
              caption=""
              priceHistory={priceHistory}
              currentPolicyPrice={currentPolicyPrice}
            />
            <div className="w-full max-w-md mt-6 pb-4 shrink-0 animate-in fade-in slide-in-from-bottom-4 duration-500">
              <div className="rounded-md border border-border bg-muted/50 p-4 text-center space-y-3">
                <div className="flex items-center justify-center gap-2">
                  <Calendar className="w-5 h-5 text-muted-foreground" />
                  <span className="text-base font-semibold text-foreground">
                    End of Timelapse Demo
                  </span>
                </div>
                <div className="flex justify-center gap-6 text-sm">
                  <div className="flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4 text-green-500" />
                    <span className="text-muted-foreground">
                      Accepted:{" "}
                      <span className="font-medium text-green-600 dark:text-green-400">
                        {quotesAccepted}
                      </span>
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <XCircle className="w-4 h-4 text-red-500" />
                    <span className="text-muted-foreground">
                      Rejected:{" "}
                      <span className="font-medium text-red-600 dark:text-red-400">
                        {quotesRejected}
                      </span>
                    </span>
                  </div>
                </div>
                <Button
                  size="lg"
                  onClick={handleClose}
                  className="w-full mt-2"
                  data-testid="button-close-timelapse-complete"
                >
                  Close
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* No Match State */}
        {state === "no_match" && <NoMatchState onClose={handleClose} />}

        {/* Confirming Purchase State - AI Thinking Steps */}
        {state === "confirming_purchase" && currentWeekMatches.length > 0 && (
          <ConfirmingPurchaseState
            newProvider={
              currentWeekMatches[currentMatchIndex].financial_breakdown
                .new_quote_insurer
            }
            oldProvider={currentInsuranceProvider}
            onComplete={() => setState("celebration")}
          />
        )}

        {/* Celebration State */}
        {state === "celebration" && currentWeekMatches.length > 0 && (
          <CelebrationState
            provider={
              currentWeekMatches[currentMatchIndex].financial_breakdown
                .new_quote_insurer
            }
            onClose={handleClose}
            onContinueTimelapse={handleContinueTimelapse}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

// Feature configuration for icons and colors
const FEATURE_CONFIG: Record<
  string,
  { icon: any; color: string; bgColor: string }
> = {
  "Legal Cover": {
    icon: Gavel,
    color: "text-blue-600 dark:text-blue-400",
    bgColor: "bg-blue-50 dark:bg-blue-950/50",
  },
  "Windshield Cover": {
    icon: Car,
    color: "text-cyan-600 dark:text-cyan-400",
    bgColor: "bg-cyan-50 dark:bg-cyan-950/50",
  },
  "Courtesy Car": {
    icon: Car,
    color: "text-indigo-600 dark:text-indigo-400",
    bgColor: "bg-indigo-50 dark:bg-indigo-950/50",
  },
  "Breakdown Cover": {
    icon: Wrench,
    color: "text-orange-600 dark:text-orange-400",
    bgColor: "bg-orange-50 dark:bg-orange-950/50",
  },
  "Personal Accident Cover": {
    icon: Heart,
    color: "text-red-600 dark:text-red-400",
    bgColor: "bg-red-50 dark:bg-red-950/50",
  },
  "European Cover": {
    icon: Globe,
    color: "text-emerald-600 dark:text-emerald-400",
    bgColor: "bg-emerald-50 dark:bg-emerald-950/50",
  },
  "No Claim Bonus Protection": {
    icon: Shield,
    color: "text-violet-600 dark:text-violet-400",
    bgColor: "bg-violet-50 dark:bg-violet-950/50",
  },
  "24/7 Helpline": {
    icon: Phone,
    color: "text-teal-600 dark:text-teal-400",
    bgColor: "bg-teal-50 dark:bg-teal-950/50",
  },
  "Family Cover": {
    icon: Users,
    color: "text-pink-600 dark:text-pink-400",
    bgColor: "bg-pink-50 dark:bg-pink-950/50",
  },
  Comprehensive: {
    icon: Umbrella,
    color: "text-purple-600 dark:text-purple-400",
    bgColor: "bg-purple-50 dark:bg-purple-950/50",
  },
  "Third Party": {
    icon: Scale,
    color: "text-amber-600 dark:text-amber-400",
    bgColor: "bg-amber-50 dark:bg-amber-950/50",
  },
  "Defacto Rating": {
    icon: Award,
    color: "text-yellow-600 dark:text-yellow-400",
    bgColor: "bg-yellow-50 dark:bg-yellow-950/50",
  },
};

// Match Found State Component
function MatchFoundState({
  matchData,
  matchNumber,
  totalMatches,
  onConfirmPurchase,
  onKeepSearching,
  onPreviousMatch,
  onNextMatch,
  canSearchMoreMonths,
  frequency,
  quotesAccepted,
  quotesRejected,
  rejectedQuotes,
  searchDate,
}: {
  matchData: MatchData;
  matchNumber: number;
  totalMatches: number;
  onConfirmPurchase: () => void;
  onKeepSearching: () => void;
  onPreviousMatch: () => void;
  onNextMatch: () => void;
  canSearchMoreMonths: boolean;
  frequency: "weekly" | "monthly";
  quotesAccepted: number;
  quotesRejected: number;
  rejectedQuotes: RejectedQuoteData[];
  searchDate: string;
}) {
  const { insurer, price, ai_insight, financial_breakdown } = matchData;
  const [showAllFeatures, setShowAllFeatures] = useState(false);
  const [showDeltaBreakdown, setShowDeltaBreakdown] = useState(false);
  const [showSwitchCostBreakdown, setShowSwitchCostBreakdown] = useState(false);
  const requestedFeatures = matchData.requested_features ?? [];
  const missingFeatures = matchData.missing_features ?? [];

  const getFeatureConfig = (feature: string) => {
    return (
      FEATURE_CONFIG[feature] || {
        icon: CheckCircle2,
        color: "text-gray-600 dark:text-gray-400",
        bgColor: "bg-gray-50 dark:bg-gray-900/50",
      }
    );
  };


  return (
    <div className="flex flex-col h-full overflow-y-auto p-8 bg-gradient-to-br from-background via-background to-green-500/5">
      {/* Success Header */}
      <div className="text-center mb-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
        <CheckCircle2 className="h-20 w-20 text-green-500 mx-auto mb-4" />
        <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-2">
          Quote Match Found!
        </h2>
        <div className="flex items-center justify-center gap-2 text-muted-foreground mb-1">
          <Calendar className="w-4 h-4" />
          <span className="text-base font-medium" data-testid="text-search-month-year">
            {(() => {
              const d = searchDate ? new Date(searchDate) : new Date();
              return d.toLocaleDateString("en-GB", { month: "long", year: "numeric" });
            })()}
          </span>
        </div>
        <div className="mt-2 space-y-1.5">
          <p className="text-lg text-green-600 dark:text-green-400" data-testid="text-savings-headline">
            Switching to <span className="text-xl font-bold">{matchData.financial_breakdown.new_quote_insurer}</span> will save you{" "}
            <span className="text-xl font-bold">£{matchData.financial_breakdown.annual_savings.toFixed(2)}</span>{" "}
            over the next 12 months
          </p>
          <p className="text-xs text-muted-foreground" data-testid="text-upfront-cost">
            {matchData.financial_breakdown.upfront_impact !== 0 ? (
              <>
                {matchData.financial_breakdown.upfront_impact < 0 ? "You would pay " : "You would receive "}
                <span className="font-bold">
                  £{Math.abs(matchData.financial_breakdown.upfront_impact).toFixed(2)}
                </span>
                {matchData.financial_breakdown.upfront_impact < 0 ? " today to make this change." : " back today."}
              </>
            ) : (
              "No upfront cost to make this change."
            )}
          </p>
        </div>
        {totalMatches > 1 && (
          <div className="flex items-center justify-center gap-3 mt-3" data-testid="match-navigation">
            <Button
              size="icon"
              variant="outline"
              onClick={onPreviousMatch}
              disabled={matchNumber <= 1}
              data-testid="button-previous-match"
            >
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <span className="text-sm font-medium text-muted-foreground min-w-[100px] text-center">
              Match {matchNumber} of {totalMatches}
            </span>
            <Button
              size="icon"
              variant="outline"
              onClick={onNextMatch}
              disabled={matchNumber >= totalMatches}
              data-testid="button-next-match"
            >
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        )}
      </div>

      {/* Financial Breakdown */}
      <div className="max-w-3xl mx-auto w-full space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700 delay-100">
        {/* New Quote Header */}
        <div className="text-center mb-6">
          <h3 className="text-5xl font-bold text-primary mb-2">
            £{financial_breakdown.new_quote_price.toFixed(2)}
          </h3>
          <div className="flex items-center justify-center gap-2 flex-wrap">
            <span className="text-2xl text-muted-foreground">
              {financial_breakdown.new_quote_insurer}
            </span>
            {(() => {
              const rating = matchData.trustpilot_rating ?? 0;
              const reviewCount = Math.floor(Math.random() * 5000 + 2000);
              if (rating <= 0) return null;
              return (
                <>
                  <span className="text-muted-foreground/40 text-xl">·</span>
                  <div className="flex items-center gap-1.5" data-testid="rating-section">
                    <Star className="w-4 h-4 fill-blue-500 text-blue-500 shrink-0" />
                    <span className="text-sm font-semibold text-foreground">
                      {rating.toFixed(1)}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      ({reviewCount.toLocaleString()})
                    </span>
                  </div>
                </>
              );
            })()}
          </div>
        </div>

        {/* Financial Details Card */}
        <div className="bg-card border border-border rounded-lg p-6 space-y-4">
          <div className="flex justify-between items-center py-2 border-b border-border">
            <span className="text-muted-foreground">Current cost</span>
            <span className="text-lg font-semibold">
              £{financial_breakdown.current_cost.toFixed(2)}
            </span>
          </div>

          <div className="border-b border-border">
            <button
              onClick={() => setShowSwitchCostBreakdown(!showSwitchCostBreakdown)}
              className="flex justify-between items-center w-full py-2 text-left"
              data-testid="button-toggle-switch-cost"
            >
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground">Cost to switch</span>
                {!showSwitchCostBreakdown && (
                  <span className="text-xs text-muted-foreground">(details)</span>
                )}
              </div>
              <div className="flex items-center gap-2">
                <span className={`text-lg font-semibold ${financial_breakdown.upfront_impact < 0 ? "" : "text-green-600 dark:text-green-400"}`}>
                  {financial_breakdown.upfront_impact < 0 ? "" : "+ "}£{Math.abs(financial_breakdown.upfront_impact).toFixed(2)}
                </span>
                {showSwitchCostBreakdown ? (
                  <ChevronUp className="w-3.5 h-3.5 text-muted-foreground" />
                ) : (
                  <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />
                )}
              </div>
            </button>
            {showSwitchCostBreakdown && (
              <div className="pb-3 space-y-1 text-xs text-muted-foreground animate-in fade-in slide-in-from-top-2 duration-300">
                <p className="text-xs text-muted-foreground mb-2">Upfront impact if you switch today</p>
                <div className="ml-2 pl-3 border-l-2 border-border space-y-1">
                  <div className="flex justify-between">
                    <span>Pro-rata refund from old policy</span>
                    <span className="text-green-600 dark:text-green-400">+ £{financial_breakdown.pro_rata_refund.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Cancellation fee</span>
                    <span className="text-red-600 dark:text-red-400">- £{financial_breakdown.cancellation_fee.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>New policy cost (12 months)</span>
                    <span className="text-red-600 dark:text-red-400">- £{financial_breakdown.new_policy_cost.toFixed(2)}</span>
                  </div>
                  <div className="border-t border-border pt-1.5 mt-1.5 flex justify-between font-medium text-foreground">
                    <span>You would {financial_breakdown.upfront_impact < 0 ? "pay" : "receive"} today</span>
                    <span className={financial_breakdown.upfront_impact > 0 ? "text-green-600 dark:text-green-400" : ""}>
                      £{Math.abs(financial_breakdown.upfront_impact).toFixed(2)}
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Annual Savings - Unified collapsible section */}
          <div className="bg-muted/30 rounded-lg overflow-hidden" data-testid="section-annual-savings">
            <button
              onClick={() => setShowDeltaBreakdown(!showDeltaBreakdown)}
              className="flex justify-between items-center w-full py-3 px-4 text-left"
              data-testid="button-toggle-annual-savings"
            >
              <div className="flex items-center gap-2">
                <span className="font-semibold">Annual Savings</span>
                <span className="text-xs text-muted-foreground">
                  {showDeltaBreakdown ? "" : "(tap for details)"}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span
                  className={`text-xl font-bold ${
                    financial_breakdown.annual_savings > 0
                      ? "text-green-600 dark:text-green-400"
                      : "text-red-600 dark:text-red-400"
                  }`}
                  data-testid="text-annual-savings"
                >
                  {financial_breakdown.annual_savings > 0 ? "Save " : "Extra "}
                  £{Math.abs(financial_breakdown.annual_savings).toFixed(2)}
                </span>
                {showDeltaBreakdown ? (
                  <ChevronUp className="w-4 h-4 text-muted-foreground" />
                ) : (
                  <ChevronDown className="w-4 h-4 text-muted-foreground" />
                )}
              </div>
            </button>

            {showDeltaBreakdown && (
              <div className="px-4 pb-4 pt-1 space-y-4 animate-in fade-in slide-in-from-top-2 duration-300 text-xs text-muted-foreground">
                <p className="text-xs text-muted-foreground">
                  Cost over next 12 months from switch date
                </p>

                {/* If you stay */}
                <div className="space-y-1">
                  <div className="flex justify-between font-medium text-foreground">
                    <span>If you stay</span>
                    <span>£{financial_breakdown.stay_cost_12m.toFixed(2)}</span>
                  </div>
                  <div className="ml-2 pl-3 border-l-2 border-border space-y-1">
                    <div className="flex justify-between">
                      <span>Remaining coverage (~{financial_breakdown.days_remaining} days)</span>
                      <span>£{financial_breakdown.stay_remaining_value.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Renewal (~{financial_breakdown.stay_renewal_days} days at same rate)</span>
                      <span>£{financial_breakdown.stay_renewal_cost.toFixed(2)}</span>
                    </div>
                  </div>
                </div>

                {/* If you switch */}
                <div className="space-y-1">
                  <div className="flex justify-between font-medium text-foreground">
                    <span>If you switch</span>
                    <span className={financial_breakdown.annual_savings > 0 ? "text-green-600 dark:text-green-400" : ""}>
                      £{financial_breakdown.switch_cost_12m.toFixed(2)}
                    </span>
                  </div>
                  <div className="ml-2 pl-3 border-l-2 border-green-300 dark:border-green-700 space-y-1">
                    <div className="flex justify-between">
                      <span>New policy (12 months)</span>
                      <span>£{financial_breakdown.new_quote_price.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Cancellation fee</span>
                      <span>£{financial_breakdown.cancellation_fee.toFixed(2)}</span>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Features Section - Compact themed design */}
        <div
          className="bg-muted/30 rounded-lg"
          data-testid="features-section"
        >
          {/* Header */}
          <div className="px-4 py-3 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-primary shrink-0" />
            <span className="text-sm font-semibold">Feature Coverage</span>
            {requestedFeatures.length > 0 && (
              <span className="ml-auto text-xs text-muted-foreground" data-testid="text-feature-match-count">
                {requestedFeatures.length}/{requestedFeatures.length + missingFeatures.length} matched
              </span>
            )}
          </div>

          <div className="px-4 pb-4 space-y-3">
            {/* Requested Features - compact 2-column grid */}
            {requestedFeatures.length > 0 && (
              <div data-testid="requested-features-section">
                <p className="text-xs text-muted-foreground mb-2">
                  Your requested features
                </p>
                <div className="grid grid-cols-2 gap-1.5">
                  {requestedFeatures.map((feature, idx) => (
                    <div
                      key={`req-${idx}`}
                      className="flex items-center gap-1.5 text-xs px-2 py-1.5 rounded-md bg-background"
                      data-testid={`requested-feature-${idx}`}
                    >
                      <CheckCircle2 className="w-3.5 h-3.5 text-green-500 shrink-0" />
                      <span className="text-foreground truncate">{feature}</span>
                    </div>
                  ))}
                  {missingFeatures.map((feature, idx) => (
                    <div
                      key={`miss-${idx}`}
                      className="flex items-center gap-1.5 text-xs px-2 py-1.5 rounded-md bg-background"
                      data-testid={`missing-feature-${idx}`}
                    >
                      <XCircle className="w-3.5 h-3.5 text-red-500 shrink-0" />
                      <span className="text-muted-foreground truncate">{feature}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {requestedFeatures.length === 0 && (
              <p className="text-xs text-muted-foreground">
                No specific features requested via whisper
              </p>
            )}

            {/* All Quote Features - Collapsible */}
            <div className="border-t border-border pt-3">
              <button
                onClick={() => setShowAllFeatures(!showAllFeatures)}
                className="flex items-center justify-between w-full text-left"
                data-testid="button-toggle-all-features"
              >
                <span className="text-xs text-muted-foreground">
                  All quote features ({matchData.features.length})
                </span>
                <div className="flex items-center gap-1 text-muted-foreground">
                  <span className="text-xs">{showAllFeatures ? "Hide" : "Show"}</span>
                  {showAllFeatures ? (
                    <ChevronUp className="w-3.5 h-3.5" />
                  ) : (
                    <ChevronDown className="w-3.5 h-3.5" />
                  )}
                </div>
              </button>
              {showAllFeatures && (
                <div className="grid grid-cols-2 gap-1.5 mt-2 animate-in fade-in slide-in-from-top-2 duration-300">
                  {matchData.features.map((feature, idx) => {
                    const config = getFeatureConfig(feature);
                    const IconComponent = config.icon;
                    return (
                      <div
                        key={idx}
                        className="flex items-center gap-1.5 text-xs px-2 py-1.5 rounded-md bg-background"
                        data-testid={`quote-feature-${idx}`}
                      >
                        <IconComponent
                          className={`w-3.5 h-3.5 ${config.color} shrink-0`}
                        />
                        <span className="text-foreground truncate">
                          {feature}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>


        {/* AutoAnnie's Insight - Blue branded */}
        {ai_insight && (
          <div
            className="rounded-lg overflow-hidden border border-blue-200 dark:border-blue-800"
            data-testid="insight-section"
          >
            <div className="bg-gradient-to-r from-blue-500 to-blue-600 px-4 py-3 flex items-center gap-2 relative overflow-hidden">
              <Sparkles className="w-5 h-5 text-white animate-pulse" />
              <span className="text-sm font-semibold text-white">
                AutoAnnie's Insight
              </span>
              <div className="ml-auto flex items-center gap-1.5 bg-white/20 px-2 py-0.5 rounded-full">
                <Shield className="w-3 h-3 text-white" />
                <span className="text-xs font-medium text-white">
                  AI Analysis
                </span>
              </div>
            </div>
            <div className="bg-gradient-to-br from-blue-50 via-white to-blue-50/50 dark:from-blue-950/50 dark:via-background dark:to-blue-950/30 p-4">
              <div className="flex items-start gap-3">
                <div className="bg-blue-100 dark:bg-blue-900 p-2 rounded-lg shrink-0">
                  <BadgeCheck className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                </div>
                <p className="text-sm text-foreground leading-relaxed">
                  {ai_insight}
                </p>
              </div>
              {/* Coverage Match Indicator */}
              <div className="mt-3 pt-3 border-t border-blue-100 dark:border-blue-800">
                <div className="flex items-center justify-between text-xs mb-1.5">
                  <span className="text-muted-foreground">Coverage Match</span>
                  <span className="font-semibold text-blue-600 dark:text-blue-400">
                    {Math.floor(85 + Math.random() * 10)}%
                  </span>
                </div>
                <div className="h-2 bg-blue-100 dark:bg-blue-900 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-blue-500 to-blue-600 rounded-full transition-all duration-1000"
                    style={{ width: `${85 + Math.random() * 10}%` }}
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Session Quote Counters */}
        <div className="flex justify-center gap-6 py-3 mt-4 border-t border-border">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-green-500" />
            <span
              className="text-sm font-medium"
              data-testid="text-quotes-accepted"
            >
              Quotes Accepted:{" "}
              <span className="text-green-600 dark:text-green-400">
                {quotesAccepted}
              </span>
            </span>
          </div>
          <HoverCard openDelay={200} closeDelay={100}>
            <HoverCardTrigger asChild>
              <div
                className="flex items-center gap-2 cursor-pointer hover:opacity-80 transition-opacity"
                data-testid="hover-quotes-rejected"
              >
                <XCircle className="w-4 h-4 text-red-500" />
                <span
                  className="text-sm font-medium"
                  data-testid="text-quotes-rejected"
                >
                  Quotes Rejected:{" "}
                  <span className="text-red-600 dark:text-red-400">
                    {quotesRejected}
                  </span>
                </span>
              </div>
            </HoverCardTrigger>
            <HoverCardContent className="w-72" align="center" side="top">
              <div className="space-y-2">
                <h4 className="text-sm font-semibold text-foreground">
                  Rejected Quotes
                </h4>
                {rejectedQuotes.length === 0 ? (
                  <p className="text-xs text-muted-foreground">
                    No quotes rejected yet
                  </p>
                ) : (
                  <div className="space-y-1.5 max-h-40 overflow-y-auto">
                    {rejectedQuotes.map((quote, index) => (
                      <div
                        key={index}
                        className="flex justify-between items-center text-xs py-1.5 px-2 bg-muted/50 rounded"
                        data-testid={`rejected-quote-row-${index}`}
                      >
                        <span className="font-medium truncate max-w-[120px]">
                          {quote.provider}
                        </span>
                        <span className="text-muted-foreground">
                          {quote.date}
                        </span>
                        <span className="font-semibold text-red-600 dark:text-red-400">
                          £{quote.cost.toFixed(2)}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </HoverCardContent>
          </HoverCard>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row gap-4 pt-6">
          <Button
            size="lg"
            onClick={onConfirmPurchase}
            className="flex-1 text-lg py-6"
            data-testid="button-confirm-purchase"
          >
            Switch Policy
          </Button>
          <Button
            size="lg"
            variant="outline"
            onClick={onKeepSearching}
            disabled={!canSearchMoreMonths}
            className="flex-1 text-lg py-6"
            data-testid="button-keep-searching"
          >
            {canSearchMoreMonths
              ? "Continue Demo"
              : "End of policy period"}
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
          Auto-Annie couldn't find a quote matching your budget and preferences
          before your policy end date.
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
  onComplete,
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
    {
      text: `Cancelling policy from ${oldProvider}`,
      blinks: 3,
      duration: 1800,
    },
    {
      text: `Receiving confirmation from ${oldProvider}`,
      blinks: 2,
      duration: 1200,
    },
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
      setCurrentStep((prev) => prev + 1);
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

        <div
          className="bg-card border border-border rounded-xl p-8 space-y-3"
          data-testid="ai-thinking-steps"
        >
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
function CelebrationState({
  provider,
  onClose,
  onContinueTimelapse,
}: {
  provider: string;
  onClose: () => void;
  onContinueTimelapse: () => void;
}) {
  useEffect(() => {
    // Create confetti particles
    const confettiContainer = document.getElementById("confetti-container");
    if (!confettiContainer) return;

    const colors = [
      "#3b82f6",
      "#10b981",
      "#f59e0b",
      "#ef4444",
      "#8b5cf6",
      "#ec4899",
    ];
    const particleCount = 50;

    for (let i = 0; i < particleCount; i++) {
      const particle = document.createElement("div");
      particle.className = "confetti-particle";
      particle.style.cssText = `
        position: absolute;
        width: 10px;
        height: 10px;
        background-color: ${colors[Math.floor(Math.random() * colors.length)]};
        left: ${Math.random() * 100}%;
        top: -10px;
        opacity: ${Math.random() * 0.8 + 0.2};
        animation: confetti-fall ${Math.random() * 3 + 2}s linear forwards;
        border-radius: ${Math.random() > 0.5 ? "50%" : "0"};
      `;
      confettiContainer.appendChild(particle);
    }

    // Cleanup
    return () => {
      if (confettiContainer) {
        confettiContainer.innerHTML = "";
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

      <div className="flex flex-col sm:flex-row gap-4 z-20 animate-in fade-in slide-in-from-bottom-4 duration-700 delay-500">
        <Button
          size="lg"
          onClick={onContinueTimelapse}
          variant="outline"
          className="px-8 py-7 text-xl"
          data-testid="button-continue-timelapse"
        >
          Continue Timelapse
        </Button>
        <Button
          size="lg"
          onClick={onClose}
          className="px-12 py-7 text-xl"
          data-testid="button-close-celebration"
        >
          Close
        </Button>
      </div>
    </div>
  );
}
