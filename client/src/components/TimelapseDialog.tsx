import {
  Dialog,
  DialogContent,
  DialogClose,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
  TrendingUp,
  SlidersHorizontal,
  Clock,
  Bot,
  MessageSquare,
  UserRound,
  Mic,
} from "lucide-react";
import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { flushSync } from "react-dom";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { IPhoneMockup } from "./IPhoneMockup";
import { AIThinkingStep } from "./AIThinkingStep";
import { io as socketIO, type Socket } from "socket.io-client";

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
  negotiationMode?: "human" | "ai" | "live_agent";
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
  | "negotiate_prompt"
  | "negotiating"
  | "live_negotiating"
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
  negotiationMode = "ai",
  onQuoteAccepted,
  onQuoteRejected,
  quotesAccepted,
  quotesRejected,
  rejectedQuotes,
}: TimelapseDialogProps) {
  const [state, setState] = useState<TimelapseState>("intro");
  const [stayProvider, setStayProvider] = useState<string | null>(null);
  const [currentDate, setCurrentDate] = useState<string>("");
  const [currentWeekMatches, setCurrentWeekMatches] = useState<MatchData[]>([]);
  const [currentMatchIndex, setCurrentMatchIndex] = useState<number>(0);
  const [weekIndex, setWeekIndex] = useState<number>(0);
  const [policyEndDate, setPolicyEndDate] = useState<Date | null>(null);
  const [policyStartDate, setPolicyStartDate] = useState<Date | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [vehicleName, setVehicleName] = useState<string>("");
  const [vehicleRegNumber, setVehicleRegNumber] = useState<string>("");
  const [showNotification, setShowNotification] = useState(false);
  const [currentInsuranceProvider, setCurrentInsuranceProvider] =
    useState<string>("");
  const [previousProvider, setPreviousProvider] = useState<string>("");
  const currentProviderRef = useRef<string>("");
  const [priceHistory, setPriceHistory] = useState<
    {
      month: string;
      lowestPrice: number | null;
      marketLowestPrice: number | null;
      status?: "purchased" | "matched" | "market";
      insurer?: string;
      features?: string[];
    }[]
  >([]);
  const [currentPolicyPrice, setCurrentPolicyPrice] = useState<number>(0);
  const [whisperBudget, setWhisperBudget] = useState<number | null>(null);
  const [allQuotesBasic, setAllQuotesBasic] = useState<{ insurer: string; price: number; features: string[] }[]>([]);
  const [policyNumber, setPolicyNumber] = useState<string>("");
  const [userName, setUserName] = useState<string>("");
  const [vehicleMake, setVehicleMake] = useState<string>("");
  const [vehicleModel, setVehicleModel] = useState<string>("");
  const [vehicleYear, setVehicleYear] = useState<number>(0);
  const [noClaimBonusYears, setNoClaimBonusYears] = useState<number>(0);
  const [voluntaryExcess, setVoluntaryExcess] = useState<number>(0);
  const [toleranceAmount, setToleranceAmount] = useState<number>(0);
  const [liveNegotiationId, setLiveNegotiationId] = useState<number | null>(null);
  const [liveNegotiationRoomId, setLiveNegotiationRoomId] = useState<string>("");
  const [liveNegotiationMode, setLiveNegotiationMode] = useState<"text" | "voice">("text");
  const [liveNegotiationOutcome, setLiveNegotiationOutcome] = useState<{
    outcome: string;
    finalOfferPrice: number;
    competitorQuote: number;
    providerName: string;
    competitorName: string;
  } | null>(null);
  const { toast } = useToast();

  const consecutiveNoMatchMonths = useMemo(() => {
    let count = 0;
    for (let i = priceHistory.length - 1; i >= 0; i--) {
      if (
        priceHistory[i].lowestPrice === null &&
        priceHistory[i].status !== "purchased"
      ) {
        count++;
      } else {
        break;
      }
    }
    return count;
  }, [priceHistory]);

  useEffect(() => {
    if (!open || !selectedVehicleId || !userEmail) return;
    const fetchPolicySummary = async () => {
      try {
        const response = await apiRequest("GET", `/api/vehicle-policies/${userEmail}`);
        const policies = await response.json();
        const policy = policies.find((p: any) => p.policy_id === selectedVehicleId);
        if (policy) {
          if (policy.current_policy_cost) {
            setCurrentPolicyPrice(Number(policy.current_policy_cost));
          }
          if (policy.policy_start_date) {
            setPolicyStartDate(new Date(policy.policy_start_date));
          }
          if (policy.policy_end_date) {
            setPolicyEndDate(new Date(policy.policy_end_date));
          }
          if (policy.policy_number) {
            setPolicyNumber(policy.policy_number);
          }
        }
        if (userEmail) {
          const namePart = userEmail.split("@")[0].replace(/[._-]/g, " ");
          setUserName(namePart.replace(/\b\w/g, (c) => c.toUpperCase()));
        }
      } catch (err) {
        console.error("[Timelapse] Failed to pre-fetch policy summary:", err);
      }
    };
    fetchPolicySummary();
  }, [open, selectedVehicleId, userEmail]);

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
      const lastDayOfTargetMonth = new Date(
        nextDate.getFullYear(),
        nextDate.getMonth() + 1,
        0,
      ).getDate();
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
      const rawMatches: MatchData[] = response.matches || [];

      // Store the current insurance provider and all quotes from the API response
      if (response.current_insurance_provider) {
        setCurrentInsuranceProvider(response.current_insurance_provider);
        currentProviderRef.current = response.current_insurance_provider;
      }
      if (response.all_quotes_basic) {
        setAllQuotesBasic(response.all_quotes_basic);
      }

      // Filter out quotes from the current provider (no point switching to the same insurer)
      const currentProvider =
        currentProviderRef.current || response.current_insurance_provider || "";
      const allMatches = currentProvider
        ? rawMatches.filter((match) => {
            const matchInsurer = (
              match.insurer ||
              match.financial_breakdown?.new_quote_insurer ||
              ""
            ).toLowerCase();
            return matchInsurer !== currentProvider.toLowerCase();
          })
        : rawMatches;

      // Filter matches based on minimum savings threshold using 12-month annual savings
      const matches = allMatches.filter((match) => {
        return match.financial_breakdown.annual_savings >= minSavingsThreshold;
      });

      console.log(
        `[Timelapse] Week ${dateStr}: ${rawMatches.length} total quotes, ${rawMatches.length - allMatches.length} excluded (same provider: ${currentProvider}), ${allMatches.length} other-provider matches, ${matches.length} above £${minSavingsThreshold} threshold`,
      );

      // Track price data for the live graph - aggregate per month+year
      const monthLabel = searchDate.toLocaleDateString("en-GB", {
        month: "short",
        year: "2-digit",
      });
      const lowestPrice =
        allMatches.length > 0
          ? Math.min(...allMatches.map((m) => m.price))
          : null;
      const allQuotePrices: number[] = response.all_quote_prices || [];
      const marketLowestPrice =
        allQuotePrices.length >= 3
          ? Math.round(
              [...allQuotePrices]
                .sort((a, b) => a - b)
                .slice(0, 3)
                .reduce((sum, p) => sum + p, 0) / 3,
            )
          : allQuotePrices.length > 0
            ? Math.round(
                allQuotePrices.reduce((sum, p) => sum + p, 0) /
                  allQuotePrices.length,
              )
            : null;

      const bestMatch =
        allMatches.length > 0
          ? allMatches.reduce(
              (best, m) => (m.price < best.price ? m : best),
              allMatches[0],
            )
          : null;
      const matchedInsurer =
        bestMatch?.insurer || bestMatch?.financial_breakdown?.new_quote_insurer;
      const matchedFeatures = bestMatch?.features;

      setPriceHistory((prev) => {
        const existing = prev.find((p) => p.month === monthLabel);
        if (existing) {
          const updatedEntry = { ...existing };
          if (lowestPrice !== null) {
            if (
              updatedEntry.lowestPrice === null ||
              lowestPrice < updatedEntry.lowestPrice
            ) {
              updatedEntry.lowestPrice = lowestPrice;
              updatedEntry.insurer = matchedInsurer;
              updatedEntry.features = matchedFeatures;
              updatedEntry.status = "matched";
            }
          }
          if (marketLowestPrice !== null) {
            updatedEntry.marketLowestPrice = marketLowestPrice;
          }
          if (
            updatedEntry.lowestPrice !== existing.lowestPrice ||
            updatedEntry.marketLowestPrice !== existing.marketLowestPrice
          ) {
            return prev.map((p) => (p.month === monthLabel ? updatedEntry : p));
          }
          return prev;
        }
        return [
          ...prev,
          {
            month: monthLabel,
            lowestPrice,
            marketLowestPrice,
            status: lowestPrice !== null ? ("matched" as const) : undefined,
            insurer: matchedInsurer,
            features: matchedFeatures,
          },
        ];
      });

      if (matches.length > 0) {
        flushSync(() => {
          setCurrentWeekMatches(matches);
          setCurrentMatchIndex(0);
          setState("notification_slide");
          setShowNotification(true);
          setIsSearching(false);
        });
      } else {
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
    currentProviderRef.current = "";

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
      setVehicleMake(currentPolicy.vehicle_manufacturer_name || "");
      setVehicleModel(currentPolicy.vehicle_model || "");
      setVehicleYear(currentPolicy.vehicle_year || 0);
      setNoClaimBonusYears(currentPolicy.no_claim_bonus_years || 0);
      setVoluntaryExcess(currentPolicy.voluntary_excess || 0);
      if (currentPolicy.current_policy_cost) {
        setCurrentPolicyPrice(Number(currentPolicy.current_policy_cost));
      }

      const whisperText = currentPolicy.whisper_preferences || "";
      const budgetMatch = whisperText.match(/£\s*(\d+(?:[.,]\d+)?)/i);
      setWhisperBudget(
        budgetMatch ? parseFloat(budgetMatch[1].replace(",", "")) : null,
      );

      console.log(
        `[Timelapse] Using real policy end date: ${endDate.toISOString().split("T")[0]}`,
      );

      // Start searching from policy start date + 1 interval (1 week or 1 month)
      const startDate = new Date(currentPolicy.policy_start_date);
      setPolicyStartDate(startDate);
      const firstSearchDate = calculateNextDate(startDate, frequency);
      console.log(
        `[Timelapse] Policy start: ${startDate.toISOString().split("T")[0]}, first search: ${firstSearchDate.toISOString().split("T")[0]} (${frequency})`,
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
        const newProvider =
          currentMatch.insurer ||
          currentMatch.financial_breakdown.new_quote_insurer;
        setPreviousProvider(
          currentProviderRef.current || currentInsuranceProvider,
        );
        setCurrentInsuranceProvider(newProvider);
        currentProviderRef.current = newProvider;

        // Mark the corresponding price history entry as "purchased" (green dot)
        // Update price, insurer, and features to reflect the actual selected match
        const purchaseMonthLabel = new Date(currentDate).toLocaleDateString(
          "en-GB",
          { month: "short", year: "2-digit" },
        );
        const purchasedInsurer =
          currentMatch.insurer ||
          currentMatch.financial_breakdown.new_quote_insurer;
        const purchasedPrice = currentMatch.price;
        const purchasedFeatures = currentMatch.features;
        setPriceHistory((prev) =>
          prev.map((p) =>
            p.month === purchaseMonthLabel
              ? {
                  ...p,
                  status: "purchased" as const,
                  lowestPrice: purchasedPrice,
                  insurer: purchasedInsurer,
                  features: purchasedFeatures,
                }
              : p,
          ),
        );

        queryClient.invalidateQueries({
          queryKey: ["/api/vehicle-policies", userEmail],
        });
      } catch (purchaseError) {
        console.error(
          "[Timelapse] Failed to update policy in DB:",
          purchaseError,
        );
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
      console.error(
        "[Timelapse] policyEndDate is null in handleContinueTimelapse",
      );
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
      console.log(
        "[Timelapse] Reached policy end date after continuing timelapse.",
      );
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
    setPolicyStartDate(null);
    setIsSearching(false);
    setVehicleName("");
    setVehicleRegNumber("");
    setShowNotification(false);
    setPriceHistory([]);
    setCurrentPolicyPrice(0);
    setStayProvider(null);
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
          <div className="flex flex-col items-center justify-center h-full p-6 md:p-8">
            <div className="max-w-lg w-full space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
              <div className="text-center space-y-3">
                <h2 className="text-2xl md:text-3xl font-bold text-foreground leading-tight" data-testid="text-intro-heading">
                  Experience{" "}
                  <span className="text-primary">Auto-Annie's</span> Scheduled Market Monitoring
                </h2>
                <p className="text-sm md:text-base text-muted-foreground leading-relaxed" data-testid="text-intro-description">
                  Auto-Annie scans the UK insurance market monthly during your policy period and alerts you only when a financially meaningful opportunity appears.
                </p>
              </div>

              <div className="space-y-3 px-2">
                <div className="flex items-center gap-3">
                  <div className="flex-shrink-0 w-8 h-8 rounded-md bg-primary/10 flex items-center justify-center">
                    <TrendingUp className="w-4 h-4 text-primary" />
                  </div>
                  <span className="text-sm font-medium text-foreground" data-testid="text-feature-pricing">Market-driven pricing simulation</span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex-shrink-0 w-8 h-8 rounded-md bg-primary/10 flex items-center justify-center">
                    <SlidersHorizontal className="w-4 h-4 text-primary" />
                  </div>
                  <span className="text-sm font-medium text-foreground" data-testid="text-feature-threshold">Threshold-based switching logic</span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex-shrink-0 w-8 h-8 rounded-md bg-primary/10 flex items-center justify-center">
                    <Clock className="w-4 h-4 text-primary" />
                  </div>
                  <span className="text-sm font-medium text-foreground" data-testid="text-feature-lifecycle">Full 12-month lifecycle monitoring</span>
                </div>
              </div>

              <div className="flex flex-col items-center gap-3 pt-2 animate-in fade-in slide-in-from-bottom-4 duration-700 delay-150">
                <Button
                  size="lg"
                  onClick={handleStartTimelapse}
                  disabled={!selectedVehicleId || isSearching}
                  data-testid="button-start-timelapse"
                >
                  <Sparkles className="mr-2 h-5 w-5" />
                  Start
                </Button>

                {currentPolicyPrice > 0 && policyStartDate && policyEndDate && (
                  <p className="text-xs text-muted-foreground text-center" data-testid="text-policy-summary">
                    Policy:{" "}
                    <span className="font-semibold text-primary">
                      £{Math.round(currentPolicyPrice)}
                    </span>
                    {" | "}
                    <span className="font-semibold text-primary">
                      {policyStartDate.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}
                    </span>
                    {" – "}
                    <span className="font-semibold text-primary">
                      {policyEndDate.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}
                    </span>
                    {" | Threshold: "}
                    <span className="font-semibold text-primary">
                      £{minSavingsThreshold}
                    </span>
                  </p>
                )}
              </div>
            </div>
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
              consecutiveNoMatchMonths={consecutiveNoMatchMonths}
              whisperBudget={whisperBudget}
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
              consecutiveNoMatchMonths={consecutiveNoMatchMonths}
              whisperBudget={whisperBudget}
            />
          </div>
        )}

        {/* Match Found State */}
        {state === "match_found" && currentWeekMatches.length > 0 && (
          <MatchFoundState
            matchData={currentWeekMatches[currentMatchIndex]}
            matchNumber={currentMatchIndex + 1}
            totalMatches={currentWeekMatches.length}
            onConfirmPurchase={() => {
              if (negotiationMode === "live_agent") {
                setState("negotiate_prompt");
              } else {
                setState("negotiating");
              }
            }}
            onDirectSwitch={handleConfirmPurchase}
            onKeepSearching={handleKeepSearching}
            onPreviousMatch={() =>
              setCurrentMatchIndex((prev) => Math.max(0, prev - 1))
            }
            onNextMatch={() =>
              setCurrentMatchIndex((prev) =>
                Math.min(currentWeekMatches.length - 1, prev + 1),
              )
            }
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

        {/* Negotiate Prompt - Live Agent mode asks if customer wants to negotiate */}
        {state === "negotiate_prompt" && currentWeekMatches.length > 0 && (
          <NegotiatePromptState
            currentProvider={currentProviderRef.current || currentInsuranceProvider}
            competitorName={currentWeekMatches[currentMatchIndex].financial_breakdown.new_quote_insurer}
            competitorQuote={currentWeekMatches[currentMatchIndex].financial_breakdown.new_quote_price}
            currentPolicyPrice={currentPolicyPrice}
            voluntaryExcess={voluntaryExcess}
            upfrontImpact={currentWeekMatches[currentMatchIndex].financial_breakdown?.upfront_impact ?? 0}
            switchCost12m={currentWeekMatches[currentMatchIndex].financial_breakdown?.switch_cost_12m ?? 0}
            onYes={async (tolerance: number, mode: "text" | "voice", voluntaryExcessFlexibility: number) => {
              if (!userEmail) {
                toast({ title: "Error", description: "No email found. Please set up your profile first.", variant: "destructive" });
                return;
              }
              setToleranceAmount(tolerance);
              setLiveNegotiationMode(mode);
              const roomId = `live-nego-${Date.now()}-${Math.random().toString(36).substring(7)}`;
              setLiveNegotiationRoomId(roomId);
              try {
                const res = await apiRequest("POST", "/api/live-negotiations", {
                  provider_name: currentProviderRef.current || currentInsuranceProvider,
                  customer_name: userName || "Customer",
                  customer_email: userEmail,
                  policy_number: policyNumber,
                  current_premium: currentPolicyPrice,
                  competitor_name: currentWeekMatches[currentMatchIndex].financial_breakdown.new_quote_insurer,
                  competitor_quote: currentWeekMatches[currentMatchIndex].financial_breakdown.new_quote_price,
                  tolerance_amount: tolerance,
                  vehicle_make: vehicleMake,
                  vehicle_model: vehicleModel,
                  vehicle_year: vehicleYear,
                  no_claim_bonus_years: noClaimBonusYears,
                  voluntary_excess: voluntaryExcess,
                  voluntary_excess_flexibility: voluntaryExcessFlexibility,
                  policy_start_date: policyStartDate?.toISOString().split("T")[0] || "",
                  policy_end_date: policyEndDate?.toISOString().split("T")[0] || "",
                  socket_room_id: roomId,
                  mode: mode,
                });
                const negotiation = await res.json();
                setLiveNegotiationId(negotiation.id);
                setState("live_negotiating");
              } catch (error) {
                console.error("[LiveNego] Failed to create negotiation:", error);
                toast({ title: "Error", description: "Failed to start live negotiation", variant: "destructive" });
              }
            }}
            onNo={() => handleConfirmPurchase()}
            onBack={() => setState("match_found")}
            onCancel={handleKeepSearching}
          />
        )}

        {/* Live Agent Negotiation Chat */}
        {state === "live_negotiating" && liveNegotiationId && liveNegotiationMode === "text" && (
          <LiveNegotiationChat
            negotiationId={liveNegotiationId}
            roomId={liveNegotiationRoomId}
            currentProvider={currentProviderRef.current || currentInsuranceProvider}
            competitorName={currentWeekMatches[currentMatchIndex]?.financial_breakdown?.new_quote_insurer || ""}
            competitorQuote={currentWeekMatches[currentMatchIndex]?.financial_breakdown?.new_quote_price || 0}
            matchData={currentWeekMatches[currentMatchIndex]}
            onOutcome={(outcome) => {
              setLiveNegotiationOutcome(outcome);
            }}
            onStay={async (renewalCost: number) => {
              if (!userEmail || !vehicleRegNumber) return;
              const provider = currentProviderRef.current || currentInsuranceProvider;
              await apiRequest("POST", "/api/purchase-policy", {
                email_id: userEmail,
                vehicle_registration_number: vehicleRegNumber,
                insurer_name: provider,
                policy_cost: renewalCost,
              });
              setCurrentPolicyPrice(renewalCost);
              const stayMonthLabel = new Date(currentDate).toLocaleDateString("en-GB", { month: "short", year: "2-digit" });
              setPriceHistory((prev) =>
                prev.map((p) =>
                  p.month === stayMonthLabel
                    ? { ...p, status: "purchased" as const, lowestPrice: renewalCost, insurer: provider }
                    : p,
                ),
              );
              queryClient.invalidateQueries({ queryKey: ["/api/vehicle-policies", userEmail] });
              setStayProvider(provider);
              setState("celebration");
            }}
            onSwitch={() => handleConfirmPurchase()}
          />
        )}

        {state === "live_negotiating" && liveNegotiationId && liveNegotiationMode === "voice" && (
          <LiveNegotiationVoice
            negotiationId={liveNegotiationId}
            roomId={liveNegotiationRoomId}
            currentProvider={currentProviderRef.current || currentInsuranceProvider}
            competitorName={currentWeekMatches[currentMatchIndex]?.financial_breakdown?.new_quote_insurer || ""}
            competitorQuote={currentWeekMatches[currentMatchIndex]?.financial_breakdown?.new_quote_price || 0}
            matchData={currentWeekMatches[currentMatchIndex]}
            onOutcome={(outcome) => {
              setLiveNegotiationOutcome(outcome);
            }}
            onStay={async (renewalCost: number) => {
              if (!userEmail || !vehicleRegNumber) return;
              const provider = currentProviderRef.current || currentInsuranceProvider;
              await apiRequest("POST", "/api/purchase-policy", {
                email_id: userEmail,
                vehicle_registration_number: vehicleRegNumber,
                insurer_name: provider,
                policy_cost: renewalCost,
              });
              setCurrentPolicyPrice(renewalCost);
              const stayMonthLabel = new Date(currentDate).toLocaleDateString("en-GB", { month: "short", year: "2-digit" });
              setPriceHistory((prev) =>
                prev.map((p) =>
                  p.month === stayMonthLabel
                    ? { ...p, status: "purchased" as const, lowestPrice: renewalCost, insurer: provider }
                    : p,
                ),
              );
              queryClient.invalidateQueries({ queryKey: ["/api/vehicle-policies", userEmail] });
              setStayProvider(provider);
              setState("celebration");
            }}
            onSwitch={() => handleConfirmPurchase()}
          />
        )}

        {/* Negotiation State */}
        {state === "negotiating" && currentWeekMatches.length > 0 && (
          <NegotiationScreen
            matchData={currentWeekMatches[currentMatchIndex]}
            currentProvider={currentProviderRef.current || currentInsuranceProvider}
            allQuotesBasic={allQuotesBasic}
            userEmail={userEmail || ""}
            vehicleRegNumber={vehicleRegNumber || ""}
            negotiationMode={negotiationMode}
            policyNumber={policyNumber}
            userName={userName}
            originalPolicyCost={currentPolicyPrice}
            onStay={async (renewalCost: number) => {
              if (!userEmail || !vehicleRegNumber) {
                throw new Error("Missing user email or vehicle registration");
              }
              const provider = currentProviderRef.current || currentInsuranceProvider;
              await apiRequest("POST", "/api/purchase-policy", {
                email_id: userEmail,
                vehicle_registration_number: vehicleRegNumber,
                insurer_name: provider,
                policy_cost: renewalCost,
              });
              setCurrentPolicyPrice(renewalCost);
              const stayMonthLabel = new Date(currentDate).toLocaleDateString("en-GB", { month: "short", year: "2-digit" });
              setPriceHistory((prev) =>
                prev.map((p) =>
                  p.month === stayMonthLabel
                    ? { ...p, status: "purchased" as const, lowestPrice: renewalCost, insurer: provider }
                    : p,
                ),
              );
              queryClient.invalidateQueries({ queryKey: ["/api/vehicle-policies", userEmail] });
            }}
            onSwitch={() => handleConfirmPurchase()}
            onStayComplete={(provider: string) => {
              setStayProvider(provider);
              setState("celebration");
            }}
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
              consecutiveNoMatchMonths={consecutiveNoMatchMonths}
              whisperBudget={whisperBudget}
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
            oldProvider={previousProvider}
            onComplete={() => setState("celebration")}
          />
        )}

        {/* Celebration State */}
        {state === "celebration" && (stayProvider || currentWeekMatches.length > 0) && (
          <CelebrationState
            provider={
              stayProvider ||
              currentWeekMatches[currentMatchIndex]?.financial_breakdown
                ?.new_quote_insurer || ""
            }
            message={stayProvider ? "Auto-Annie has kept your insurance policy" : undefined}
            onClose={handleClose}
            onContinueTimelapse={() => {
              setStayProvider(null);
              handleContinueTimelapse();
            }}
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

// Negotiation Chat Message type
let msgIdCounter = 0;
interface ChatMessage {
  id: number;
  sender: "autoannie" | "agent";
  text: string;
  isTyping?: boolean;
  isThinking?: boolean;
  revealedWords?: number;
}

// Negotiation Screen Component
function NegotiationScreen({
  matchData,
  currentProvider,
  allQuotesBasic,
  userEmail,
  vehicleRegNumber,
  negotiationMode = "ai",
  policyNumber = "",
  userName = "",
  originalPolicyCost = 0,
  onStay,
  onSwitch,
  onStayComplete,
}: {
  matchData: MatchData;
  currentProvider: string;
  allQuotesBasic: { insurer: string; price: number; features: string[] }[];
  userEmail: string;
  vehicleRegNumber: string;
  negotiationMode?: "human" | "ai";
  policyNumber?: string;
  userName?: string;
  originalPolicyCost?: number;
  onStay: (renewalCost: number) => Promise<void>;
  onSwitch: () => void;
  onStayComplete: (provider: string) => void;
}) {
  const [phase, setPhase] = useState<"contacting" | "chatting" | "done">("contacting");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [negotiationResult, setNegotiationResult] = useState<"matched" | "rejected" | null>(null);
  const [showButtons, setShowButtons] = useState(false);
  const [stayConfirmed, setStayConfirmed] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [humanAgentOverridePrice, setHumanAgentOverridePrice] = useState<number | null>(null);
  const negotiationIdRef = useRef<number | null>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const hasStartedRef = useRef(false);

  const newProviderName = matchData.insurer || matchData.financial_breakdown.new_quote_insurer;
  const newProviderCost = matchData.price;

  const currentProviderQuote = allQuotesBasic.find(
    (q) => q.insurer.toLowerCase() === currentProvider.toLowerCase()
  );
  const currentProviderRenewalCost = humanAgentOverridePrice ?? (currentProviderQuote?.price || matchData.financial_breakdown.current_cost);

  useEffect(() => {
    if (hasStartedRef.current) return;
    hasStartedRef.current = true;

    const timer = setTimeout(() => {
      setPhase("chatting");
      runNegotiationChat();
    }, 2500);

    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const addMessage = (msg: Omit<ChatMessage, "id">): Promise<void> => {
    const id = ++msgIdCounter;
    return new Promise((resolve) => {
      setMessages((prev) => [...prev, { ...msg, id, isTyping: true }]);
      setTimeout(() => {
        const words = msg.text.split(" ");
        const totalWords = words.length;
        let revealed = 0;
        setMessages((prev) =>
          prev.map((m) => m.id === id ? { ...m, isTyping: false, revealedWords: 0 } : m)
        );
        const wordInterval = setInterval(() => {
          revealed += 2;
          if (revealed >= totalWords) {
            clearInterval(wordInterval);
            setMessages((prev) =>
              prev.map((m) => m.id === id ? { ...m, revealedWords: undefined } : m)
            );
            resolve();
          } else {
            setMessages((prev) =>
              prev.map((m) => m.id === id ? { ...m, revealedWords: revealed } : m)
            );
          }
        }, 60);
      }, 500);
    });
  };

  const showThinking = (thinkingText: string): Promise<void> => {
    const id = ++msgIdCounter;
    const delay = 2500 + Math.random() * 2000;
    return new Promise((resolve) => {
      setMessages((prev) => [...prev, { id, sender: "agent", text: thinkingText, isThinking: true }]);
      setTimeout(() => {
        setMessages((prev) => prev.filter((m) => m.id !== id));
        resolve();
      }, delay);
    });
  };

  const runNegotiationChat = async () => {
    await addMessage({
      sender: "autoannie",
      text: `Detected competitor quote from ${newProviderName} at £${newProviderCost.toFixed(2)}`,
    });

    await new Promise((r) => setTimeout(r, 600));

    await addMessage({
      sender: "autoannie",
      text: `Contacting ${currentProvider} retention desk...`,
    });

    await new Promise((r) => setTimeout(r, 1200));

    if (negotiationMode === "human") {
      await addMessage({
        sender: "autoannie",
        text: `Sending retention request to ${currentProvider} customer agent...`,
      });
      await new Promise((r) => setTimeout(r, 800));

      try {
        const negoRes = await fetch("/api/negotiations", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            provider_name: currentProvider,
            customer_name: userName || "Customer",
            policy_number: policyNumber || "N/A",
            current_renewal_cost: currentProviderRenewalCost,
            original_policy_cost: originalPolicyCost || null,
            competitor_name: newProviderName,
            competitor_quote: newProviderCost,
          }),
        });
        if (!negoRes.ok) throw new Error("Failed to create negotiation");
        const negoData = await negoRes.json();
        const negotiationId = negoData.id;
        negotiationIdRef.current = negotiationId;

        await addMessage({
          sender: "autoannie",
          text: `Retention request sent to ${currentProvider}. Waiting for their customer agent to respond...`,
        });

        const pollForResponse = async (): Promise<any> => {
          const maxAttempts = 300;
          for (let i = 0; i < maxAttempts; i++) {
            await new Promise((r) => setTimeout(r, 2500));
            const checkRes = await fetch(`/api/negotiations/${negotiationId}`);
            if (checkRes.ok) {
              const data = await checkRes.json();
              if (data.status !== "pending") return data;
            }
          }
          throw new Error("Timed out waiting for agent response");
        };

        const agentResponse = await pollForResponse();

        const agentPrice = agentResponse.agent_offer_price || currentProviderRenewalCost;
        setHumanAgentOverridePrice(agentPrice);

        const decision = agentResponse.decision_type as "match" | "partial" | "unable";

        if (decision === "match") {
          setNegotiationResult("matched");
          await addMessage({
            sender: "agent",
            text: `We can match that offer. ${currentProvider} will retain your policy at £${agentPrice.toFixed(2)}.`,
          });
          await new Promise((r) => setTimeout(r, 600));
          await addMessage({
            sender: "autoannie",
            text: `${currentProvider} has matched the offer at £${agentPrice.toFixed(2)}. Staying avoids the £${matchData.financial_breakdown.cancellation_fee.toFixed(2)} cancellation fee.`,
          });
        } else if (decision === "partial") {
          setNegotiationResult("matched");
          await addMessage({
            sender: "agent",
            text: `We can offer a reduced rate of £${agentPrice.toFixed(2)}, though we cannot fully match the competitor's quote.`,
          });
          await new Promise((r) => setTimeout(r, 600));
          await addMessage({
            sender: "autoannie",
            text: `${currentProvider} has offered a partial match at £${agentPrice.toFixed(2)}. The competitor quote from ${newProviderName} is £${newProviderCost.toFixed(2)}.`,
          });
        } else {
          setNegotiationResult("rejected");
          await addMessage({
            sender: "agent",
            text: `Unable to match. Our renewal rate of £${agentPrice.toFixed(2)} is the best we can offer at this time.`,
          });
          await new Promise((r) => setTimeout(r, 600));
          const switchCost12m = matchData.financial_breakdown.switch_cost_12m;
          const actualSavings = agentPrice - switchCost12m;
          const rejectedMsg = actualSavings > 0.01
            ? `${currentProvider} could not match the offer. Switching to ${newProviderName} (£${switchCost12m.toFixed(2)} including cancellation fee) would save you £${actualSavings.toFixed(2)} over 12 months.`
            : `${currentProvider} could not match the offer but their renewal rate of £${agentPrice.toFixed(2)} is still cheaper than switching to ${newProviderName} (£${switchCost12m.toFixed(2)} including cancellation fee).`;
          await addMessage({
            sender: "autoannie",
            text: rejectedMsg,
          });
        }

        setPhase("done");
        await new Promise((r) => setTimeout(r, 400));
        setShowButtons(true);
      } catch (err) {
        await addMessage({
          sender: "autoannie",
          text: `Unable to reach ${currentProvider}'s customer agent at this time. Please try again later.`,
        });
        setNegotiationResult("rejected");
        setPhase("done");
        await new Promise((r) => setTimeout(r, 400));
        setShowButtons(true);
      }
      return;
    }

    try {
      const response = await fetch("/api/negotiate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          renewal_cost_new_provider: newProviderCost,
          renewal_cost_current_provider: currentProviderRenewalCost,
        }),
      });
      if (!response.ok) {
        throw new Error(`Negotiation request failed: ${response.status}`);
      }
      const result = await response.json();
      if (result.status !== "matched" && result.status !== "rejected") {
        throw new Error("Invalid negotiation response");
      }
      setNegotiationResult(result.status);

      await showThinking(`${currentProvider} agent reviewing retention options`);

      if (result.status === "matched") {
        await addMessage({
          sender: "agent",
          text: `We can match that offer. ${currentProvider} will retain your policy at the competitive rate.`,
        });

        await new Promise((r) => setTimeout(r, 600));

        await addMessage({
          sender: "autoannie",
          text: `${currentProvider} has matched the offer at £${currentProviderRenewalCost.toFixed(2)}. Staying avoids the £${matchData.financial_breakdown.cancellation_fee.toFixed(2)} cancellation fee.`,
        });
      } else {
        await addMessage({
          sender: "agent",
          text: `Unable to match. Our renewal rate of £${currentProviderRenewalCost.toFixed(2)} is the best we can offer at this time.`,
        });

        await new Promise((r) => setTimeout(r, 600));

        const switchCost12m = matchData.financial_breakdown.switch_cost_12m;
        const actualSavings = currentProviderRenewalCost - switchCost12m;
        const rejectedMsg = actualSavings > 0.01
          ? `${currentProvider} could not match the offer. Switching to ${newProviderName} (£${switchCost12m.toFixed(2)} including cancellation fee) would save you £${actualSavings.toFixed(2)} over 12 months.`
          : `${currentProvider} could not match the offer but their renewal rate of £${currentProviderRenewalCost.toFixed(2)} is still cheaper than switching to ${newProviderName} (£${switchCost12m.toFixed(2)} including cancellation fee).`;
        await addMessage({
          sender: "autoannie",
          text: rejectedMsg,
        });
      }
    } catch {
      await addMessage({
        sender: "agent",
        text: `Unable to reach the retention desk at this time. Please try again later.`,
      });
      setNegotiationResult("rejected");
    }

    setPhase("done");
    await new Promise((r) => setTimeout(r, 400));
    setShowButtons(true);
  };


  return (
    <div className="flex h-full overflow-hidden" data-testid="negotiation-screen">
      {/* Left side - greyed out match summary */}
      <div className="flex-1 overflow-y-auto p-6 opacity-30 pointer-events-none select-none">
        <div className="text-center mb-6">
          <CheckCircle2 className="h-16 w-16 text-green-500 mx-auto mb-3" />
          <h2 className="text-2xl font-bold text-foreground mb-1">Quote Match Found!</h2>
          <p className="text-muted-foreground">{newProviderName} - £{newProviderCost.toFixed(2)}/year</p>
        </div>
        <div className="space-y-3">
          <div className="bg-muted/30 rounded-lg p-4">
            <div className="flex justify-between gap-2 items-center mb-2">
              <span className="text-sm font-medium">Current cost</span>
              <span className="font-bold">£{matchData.financial_breakdown.current_cost.toFixed(2)}</span>
            </div>
            <div className="flex justify-between gap-2 items-center">
              <span className="text-sm font-medium">New quote</span>
              <span className="font-bold text-green-600 dark:text-green-400">£{newProviderCost.toFixed(2)}</span>
            </div>
          </div>
          <div className="bg-muted/30 rounded-lg p-4">
            <div className="flex justify-between gap-2 items-center">
              <span className="text-sm font-medium">Annual Savings</span>
              <span className="font-bold text-green-600 dark:text-green-400">£{matchData.financial_breakdown.annual_savings.toFixed(2)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Right side - Negotiation chatbot */}
      <div
        className="w-[380px] border-l border-border flex flex-col bg-background animate-in slide-in-from-right-full duration-500"
        data-testid="negotiation-chatbot"
      >
        {/* Chatbot header */}
        <div className="px-4 py-3 border-b border-border bg-primary/5">
          <div className="flex items-center gap-3">
            <div className="relative">
              <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center">
                <Bot className="w-5 h-5 text-primary" />
              </div>
              <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-green-500 border-2 border-background" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-foreground">AutoAnnie Negotiator</h3>
              <p className="text-xs text-muted-foreground">AI-powered retention negotiation</p>
            </div>
          </div>
        </div>

        {/* Contacting overlay */}
        {phase === "contacting" && (
          <div className="flex-1 flex flex-col items-center justify-center gap-4 p-6">
            <div className="relative">
              <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
                <MessageSquare className="w-8 h-8 text-primary" />
              </div>
              <div className="absolute inset-0 rounded-full border-2 border-primary/30 animate-ping" />
            </div>
            <p className="text-sm font-medium text-foreground animate-pulse text-center" data-testid="text-contacting-message">
              Contacting {currentProvider}'s negotiation agent...
            </p>
            <div className="flex gap-1.5 mt-2">
              <div className="w-2 h-2 rounded-full bg-primary animate-bounce" style={{ animationDelay: "0ms" }} />
              <div className="w-2 h-2 rounded-full bg-primary animate-bounce" style={{ animationDelay: "150ms" }} />
              <div className="w-2 h-2 rounded-full bg-primary animate-bounce" style={{ animationDelay: "300ms" }} />
            </div>
          </div>
        )}

        {/* Chat messages */}
        {phase !== "contacting" && (
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {messages.map((msg, i) => (
              <div
                key={msg.id}
                className={`flex gap-2.5 ${msg.sender === "agent" ? "flex-row-reverse" : ""} animate-in fade-in slide-in-from-bottom-2 duration-300`}
                data-testid={`chat-message-${i}`}
              >
                <div
                  className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 ${
                    msg.sender === "autoannie"
                      ? "bg-primary/10"
                      : "bg-orange-100 dark:bg-orange-900/30"
                  }`}
                >
                  {msg.sender === "autoannie" ? (
                    <Bot className="w-4 h-4 text-primary" />
                  ) : (
                    <Shield className="w-4 h-4 text-orange-600 dark:text-orange-400" />
                  )}
                </div>
                <div className={`flex flex-col gap-1 max-w-[85%] ${msg.sender === "agent" ? "items-end" : ""}`}>
                  <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
                    {msg.sender === "autoannie" ? "AutoAnnie" : `${currentProvider} Agent`}
                  </span>
                  <div
                    className={`px-3 py-2 rounded-lg text-sm leading-relaxed ${
                      msg.sender === "autoannie"
                        ? "bg-primary/10 text-foreground rounded-tl-none"
                        : "bg-orange-50 dark:bg-orange-900/20 text-foreground rounded-tr-none"
                    }`}
                  >
                    {msg.isThinking ? (
                      <span className="flex gap-2 items-center py-1 text-xs text-muted-foreground italic">
                        <span className="animate-pulse">{msg.text}</span>
                        <span className="flex gap-0.5">
                          <span className="w-1 h-1 rounded-full bg-muted-foreground animate-bounce" style={{ animationDelay: "0ms" }} />
                          <span className="w-1 h-1 rounded-full bg-muted-foreground animate-bounce" style={{ animationDelay: "200ms" }} />
                          <span className="w-1 h-1 rounded-full bg-muted-foreground animate-bounce" style={{ animationDelay: "400ms" }} />
                        </span>
                      </span>
                    ) : msg.isTyping ? (
                      <span className="flex gap-1 items-center py-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground animate-bounce" style={{ animationDelay: "0ms" }} />
                        <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground animate-bounce" style={{ animationDelay: "150ms" }} />
                        <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground animate-bounce" style={{ animationDelay: "300ms" }} />
                      </span>
                    ) : msg.revealedWords !== undefined ? (
                      <span>{msg.text.split(" ").slice(0, msg.revealedWords).join(" ")}<span className="inline-block w-0.5 h-3.5 bg-muted-foreground animate-pulse ml-0.5 align-text-bottom" /></span>
                    ) : msg.text.startsWith("CONFIRMED_STAY:") ? (
                      (() => {
                        const parts = msg.text.split(":");
                        const provider = parts[1];
                        const cost = parts[2];
                        return (
                          <div className="space-y-2" data-testid="stay-confirmation">
                            <div className="flex items-center gap-2">
                              <CheckCircle2 className="w-5 h-5 text-green-600 dark:text-green-400 shrink-0" />
                              <span className="font-semibold text-green-700 dark:text-green-300">Policy Confirmed</span>
                            </div>
                            <p className="text-foreground leading-relaxed">
                              You are staying with <span className="font-bold">{provider}</span> for the yearly premium of{" "}
                              <span className="font-bold text-lg text-green-700 dark:text-green-300">£{cost}</span>/year
                            </p>
                            <p className="text-xs text-muted-foreground">Your policy has been updated.</p>
                          </div>
                        );
                      })()
                    ) : (
                      msg.text
                    )}
                  </div>
                </div>
              </div>
            ))}
            <div ref={chatEndRef} />
          </div>
        )}

        {/* Cost comparison card */}
        {showButtons && !stayConfirmed && (() => {
          const fb = matchData.financial_breakdown;
          const stayCost = currentProviderRenewalCost;
          const switchCost = fb.switch_cost_12m;
          const stayIsCheaper = stayCost <= switchCost;
          const switchIsCheaper = switchCost < stayCost;
          const savings = Math.abs(stayCost - switchCost);

          return (
            <div className="mx-4 mt-3 mb-1 animate-in fade-in slide-in-from-bottom-4 duration-500" data-testid="cost-comparison">
              <div className="rounded-md border border-border bg-card p-3 space-y-3">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Cost over next 12 months</p>

                <div className={`flex items-start justify-between gap-2 p-2 rounded-md ${stayIsCheaper ? "bg-green-50 dark:bg-green-900/20" : ""}`}>
                  <div className="space-y-0.5">
                    <p className="text-sm font-semibold">If you stay with {currentProvider}</p>
                    <p className="text-xs text-muted-foreground">
                      {negotiationResult === "matched" ? "Matched renewal rate" : "Best renewal offer"}
                    </p>
                  </div>
                  <p className={`text-sm font-bold whitespace-nowrap ${stayIsCheaper ? "text-green-700 dark:text-green-400" : ""}`}>
                    £{stayCost.toFixed(2)}
                  </p>
                </div>

                <div className={`flex items-start justify-between gap-2 p-2 rounded-md ${switchIsCheaper ? "bg-green-50 dark:bg-green-900/20" : ""}`}>
                  <div className="space-y-0.5">
                    <p className="text-sm font-semibold">If you switch to {newProviderName}</p>
                    {fb.cancellation_fee > 0 && (
                      <p className="text-xs text-muted-foreground">
                        Includes £{fb.cancellation_fee.toFixed(2)} cancellation fee
                      </p>
                    )}
                    {fb.upfront_impact !== 0 && (
                      <p className="text-xs text-muted-foreground">
                        {fb.upfront_impact < 0
                          ? `£${Math.abs(fb.upfront_impact).toFixed(2)} to pay today`
                          : `£${fb.upfront_impact.toFixed(2)} refund today`}
                      </p>
                    )}
                  </div>
                  <p className={`text-sm font-bold whitespace-nowrap ${switchIsCheaper ? "text-green-700 dark:text-green-400" : ""}`}>
                    £{switchCost.toFixed(2)}
                  </p>
                </div>

                {savings > 0.01 && (
                  <p className="text-xs text-center text-green-700 dark:text-green-400 font-medium">
                    {stayIsCheaper ? "Staying" : "Switching"} saves £{savings.toFixed(2)} over 12 months
                  </p>
                )}
              </div>
            </div>
          );
        })()}

        {/* Action buttons */}
        {showButtons && !stayConfirmed && (
          <div className="p-4 border-t-0 border-border space-y-2" data-testid="negotiation-actions">
            <Button
              size="lg"
              variant={negotiationResult === "matched" ? "default" : "outline"}
              className="w-full"
              disabled={isProcessing}
              onClick={async () => {
                setIsProcessing(true);
                try {
                  await onStay(currentProviderRenewalCost);
                  if (negotiationIdRef.current) {
                    fetch(`/api/negotiations/${negotiationIdRef.current}/outcome`, {
                      method: "PATCH",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ outcome: "stayed" }),
                    }).catch(() => {});
                  }
                  await addMessage({
                    sender: "autoannie",
                    text: `CONFIRMED_STAY:${currentProvider}:${currentProviderRenewalCost.toFixed(2)}`,
                  });
                  setStayConfirmed(true);
                } catch {
                  await addMessage({
                    sender: "autoannie",
                    text: "Sorry, there was an error updating your policy. Please try again.",
                  });
                }
                setIsProcessing(false);
              }}
              data-testid="button-stay-provider"
            >
              Stay with {currentProvider}
            </Button>
            <Button
              size="lg"
              variant={negotiationResult === "rejected" ? "default" : "outline"}
              className="w-full"
              disabled={isProcessing}
              onClick={() => {
                if (negotiationIdRef.current) {
                  fetch(`/api/negotiations/${negotiationIdRef.current}/outcome`, {
                    method: "PATCH",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ outcome: "switched" }),
                  }).catch(() => {});
                }
                onSwitch();
              }}
              data-testid="button-switch-provider"
            >
              Switch to {newProviderName}
            </Button>
          </div>
        )}

        {/* Stay confirmed - done button */}
        {stayConfirmed && (
          <div className="p-4 border-t border-border animate-in fade-in slide-in-from-bottom-4 duration-500">
            <Button
              size="lg"
              className="w-full"
              onClick={() => onStayComplete(currentProvider)}
              data-testid="button-close-negotiation"
            >
              Done
            </Button>
          </div>
        )}
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
  onDirectSwitch,
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
  onDirectSwitch: () => void;
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
  const formatFeatureName = (name: string) =>
    name.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
  const [showAllFeatures, setShowAllFeatures] = useState(false);
  const [showDeltaBreakdown, setShowDeltaBreakdown] = useState(true);
  const [showSwitchCostBreakdown, setShowSwitchCostBreakdown] = useState(true);
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
          <span
            className="text-base font-medium"
            data-testid="text-search-month-year"
          >
            {(() => {
              const d = searchDate ? new Date(searchDate) : new Date();
              return d.toLocaleDateString("en-GB", {
                month: "long",
                year: "numeric",
              });
            })()}
          </span>
        </div>
        <div className="mt-2 space-y-1.5">
          <p
            className="text-lg text-green-600 dark:text-green-400"
            data-testid="text-savings-headline"
          >
            By cancelling your current policy and starting a new 12-month policy with{" "}
            <span className="font-bold">
              {matchData.financial_breakdown.new_quote_insurer}
            </span>
            , you would save{" "}
            <span className="font-bold">
              £{matchData.financial_breakdown.annual_savings.toFixed(2)}
            </span>
          </p>
          <p
            className="text-xs text-muted-foreground"
            data-testid="text-upfront-cost"
          >
            {matchData.financial_breakdown.upfront_impact !== 0 ? (
              <>
                {matchData.financial_breakdown.upfront_impact < 0
                  ? "You would pay "
                  : "You would receive "}
                <span className="font-bold">
                  £
                  {Math.abs(
                    matchData.financial_breakdown.upfront_impact,
                  ).toFixed(2)}
                </span>
                {matchData.financial_breakdown.upfront_impact < 0
                  ? " today to make this change."
                  : " back today."}
              </>
            ) : (
              "No upfront cost to make this change."
            )}
          </p>
        </div>
        {totalMatches > 1 && (
          <div
            className="flex items-center justify-center gap-3 mt-3"
            data-testid="match-navigation"
          >
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
                  <div
                    className="flex items-center gap-1.5"
                    data-testid="rating-section"
                  >
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
              onClick={() =>
                setShowSwitchCostBreakdown(!showSwitchCostBreakdown)
              }
              className="flex justify-between items-center w-full py-2 text-left"
              data-testid="button-toggle-switch-cost"
            >
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground">Cost to switch</span>
              </div>
              <div className="flex items-center gap-2">
                <span
                  className={`text-lg font-semibold ${financial_breakdown.upfront_impact < 0 ? "" : "text-green-600 dark:text-green-400"}`}
                >
                  {financial_breakdown.upfront_impact < 0 ? "" : "+ "}£
                  {Math.abs(financial_breakdown.upfront_impact).toFixed(2)}
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
                <p className="text-xs text-muted-foreground mb-2">
                  Upfront impact if you switch today
                </p>
                <div className="ml-2 pl-3 border-l-2 border-border space-y-1">
                  <div className="flex justify-between">
                    <span>Pro-rata refund from old policy</span>
                    <span className="text-green-600 dark:text-green-400">
                      + £{financial_breakdown.pro_rata_refund.toFixed(2)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>Cancellation fee</span>
                    <span className="text-red-600 dark:text-red-400">
                      - £{financial_breakdown.cancellation_fee.toFixed(2)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>New policy cost (12 months)</span>
                    <span className="text-red-600 dark:text-red-400">
                      - £{financial_breakdown.new_policy_cost.toFixed(2)}
                    </span>
                  </div>
                  <div className="border-t border-border pt-1.5 mt-1.5 flex justify-between font-medium text-foreground">
                    <span>
                      You would{" "}
                      {financial_breakdown.upfront_impact < 0
                        ? "pay"
                        : "receive"}{" "}
                      today
                    </span>
                    <span
                      className={
                        financial_breakdown.upfront_impact > 0
                          ? "text-green-600 dark:text-green-400"
                          : ""
                      }
                    >
                      £{Math.abs(financial_breakdown.upfront_impact).toFixed(2)}
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* 12-month cost comparison */}
          <div className="rounded-lg border bg-white p-5 mt-4" data-testid="section-annual-savings">
            <div className="text-sm text-slate-500 mb-2">12-month cost comparison</div>

            <div className="flex justify-between py-2 border-b">
              <span className="text-slate-600">Stay with your current insurer</span>
              <span className="font-semibold text-slate-900">
                £{financial_breakdown.current_cost.toFixed(2)}
              </span>
            </div>

            <div className="flex justify-between py-2 border-b">
              <span className="text-slate-600">
                Switch to {financial_breakdown.new_quote_insurer}
                <div className="text-xs text-slate-400">
                  (£{financial_breakdown.new_quote_price.toFixed(2)} new policy + £{financial_breakdown.cancellation_fee.toFixed(2)} cancellation fee)
                </div>
              </span>
              <span className="font-semibold text-slate-900">
                £{financial_breakdown.switch_cost_12m.toFixed(2)}
              </span>
            </div>

            <div className="mt-4 text-center">
              <span className="text-green-600 font-semibold text-lg" data-testid="text-annual-savings">
                Switching saves £{Math.abs(financial_breakdown.annual_savings).toFixed(2)} over 12 months
              </span>
            </div>
          </div>
        </div>

        {/* Features Section - Compact themed design */}
        <div className="bg-muted/30 rounded-lg" data-testid="features-section">
          {/* Header */}
          <div className="px-4 py-3 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-primary shrink-0" />
            <span className="text-sm font-semibold">Feature Coverage</span>
            {requestedFeatures.length > 0 && (
              <span
                className="ml-auto text-xs text-muted-foreground"
                data-testid="text-feature-match-count"
              >
                {requestedFeatures.length}/
                {requestedFeatures.length + missingFeatures.length} matched
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
                      <span className="text-foreground truncate">
                        {formatFeatureName(feature)}
                      </span>
                    </div>
                  ))}
                  {missingFeatures.map((feature, idx) => (
                    <div
                      key={`miss-${idx}`}
                      className="flex items-center gap-1.5 text-xs px-2 py-1.5 rounded-md bg-background"
                      data-testid={`missing-feature-${idx}`}
                    >
                      <XCircle className="w-3.5 h-3.5 text-red-500 shrink-0" />
                      <span className="text-muted-foreground truncate">
                        {formatFeatureName(feature)}
                      </span>
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
                  <span className="text-xs">
                    {showAllFeatures ? "Hide" : "Show"}
                  </span>
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
                          {formatFeatureName(feature)}
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
            onClick={onDirectSwitch}
            className="flex-1 text-lg py-6"
            data-testid="button-confirm-purchase"
          >
            Switch Policy
          </Button>
          <Button
            size="lg"
            variant="outline"
            onClick={onConfirmPurchase}
            className="flex-1 text-lg py-6"
            data-testid="button-negotiate"
          >
            Negotiate
          </Button>
          <Button
            size="lg"
            variant="outline"
            onClick={onKeepSearching}
            disabled={!canSearchMoreMonths}
            className="flex-1 text-lg py-6"
            data-testid="button-keep-searching"
          >
            {canSearchMoreMonths ? "Continue Demo" : "End of policy period"}
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
  message,
  onClose,
  onContinueTimelapse,
}: {
  provider: string;
  message?: string;
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
          {message || "Auto-Annie has successfully switched your insurance policy"}
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

function NegotiatePromptState({
  currentProvider,
  competitorName,
  competitorQuote,
  currentPolicyPrice,
  voluntaryExcess,
  upfrontImpact,
  switchCost12m,
  onYes,
  onNo,
  onBack,
  onCancel,
}: {
  currentProvider: string;
  competitorName: string;
  competitorQuote: number;
  currentPolicyPrice: number;
  voluntaryExcess: number;
  upfrontImpact: number;
  switchCost12m: number;
  onYes: (tolerance: number, mode: "text" | "voice", voluntaryExcessFlexibility: number) => void;
  onNo: () => void;
  onBack: () => void;
  onCancel: () => void;
}) {
  const sliderMin = competitorQuote;
  const sliderMax = currentPolicyPrice > competitorQuote ? currentPolicyPrice : competitorQuote + 100;
  const defaultTolerance = Math.round(competitorQuote * 0.02 * 100) / 100;
  const defaultSliderValue = Math.min(sliderMin + defaultTolerance, sliderMax);
  const [sliderValue, setSliderValue] = useState<number>(defaultSliderValue);
  const [negotiationMode, setNegotiationMode] = useState<"text" | "voice">("voice");
  const [voluntaryExcessFlexibility, setVoluntaryExcessFlexibility] = useState<number>(voluntaryExcess);
  const [isAdvancedOpen, setIsAdvancedOpen] = useState<boolean>(false);

  const tolerance = Math.round((sliderValue - sliderMin) * 100) / 100;
  const tolerancePct = sliderMax > sliderMin
    ? Math.round(((sliderValue - sliderMin) / (sliderMax - sliderMin)) * 100)
    : 0;

  const cancellationFee = switchCost12m - competitorQuote || 0;
  const effectiveSwitchCost = competitorQuote + cancellationFee;
  const breakEvenDifference = effectiveSwitchCost - sliderValue;
  const currentPremiumDifference = currentPolicyPrice - sliderValue;
  const isBelowBreakEven = sliderValue <= effectiveSwitchCost;
  const markerPct = currentPolicyPrice > competitorQuote
    ? Math.min(100, Math.max(0,
        ((effectiveSwitchCost - competitorQuote) / (currentPolicyPrice - competitorQuote)) * 100
      ))
    : 0;

  const handleYes = () => {
    onYes(tolerance, negotiationMode, voluntaryExcessFlexibility);
  };

  return (
    <div className="flex flex-col items-center justify-center h-full space-y-6 p-8 bg-gradient-to-br from-background via-background to-blue-500/5 overflow-y-auto">
      <div className="w-full flex items-center">
        <Button
          variant="ghost"
          size="sm"
          onClick={onBack}
          className="gap-1 text-muted-foreground"
          data-testid="button-negotiate-back"
        >
          <ChevronLeft className="w-4 h-4" />
          Back
        </Button>
      </div>
      <div className="text-center space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
        <Scale className="h-16 w-16 text-blue-500 mx-auto" />
        <h2 className="text-2xl md:text-3xl font-bold text-foreground" data-testid="text-negotiate-heading">
          Negotiate with {currentProvider} before switching?
        </h2>
        <p className="text-base text-muted-foreground max-w-md mx-auto">
          AutoAnnie can contact <span className="font-semibold text-foreground">{currentProvider}</span> to match your{" "}
          <span className="font-semibold text-green-600 dark:text-green-400">£{competitorQuote.toFixed(2)}</span>{" "}
          <span className="font-semibold text-foreground">{competitorName}</span> quote.
        </p>
        <p className="text-base font-bold text-foreground max-w-md mx-auto">
          By continuing, you authorise AutoAnnie to negotiate with {currentProvider} on your behalf using your policy details.
        </p>
      </div>

      <div className="flex gap-2 p-1 bg-muted rounded-lg" data-testid="mode-toggle">
        <Button
          variant={negotiationMode === "voice" ? "default" : "ghost"}
          size="sm"
          onClick={() => setNegotiationMode("voice")}
          className="gap-2"
          data-testid="button-mode-voice"
        >
          <Mic className="w-4 h-4" />
          Voice
        </Button>
        <Button
          variant={negotiationMode === "text" ? "default" : "ghost"}
          size="sm"
          onClick={() => setNegotiationMode("text")}
          className="gap-2"
          data-testid="button-mode-text"
        >
          <MessageSquare className="w-4 h-4" />
          Text
        </Button>
      </div>

      <div className="w-full max-w-sm space-y-4" data-testid="tolerance-section">
        <div className="space-y-1 text-center">
          <p className="text-sm font-medium text-foreground">Your tolerance threshold</p>
          <p className="text-xs text-muted-foreground">
            At what price would you stay?
          </p>
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between text-xs text-muted-foreground px-0.5">
            <span>{competitorName}</span>
            <span>Current rate</span>
          </div>

          <div className="relative">
            <div
              className="absolute inset-0 rounded-full pointer-events-none"
              style={{ background: 'linear-gradient(to right, #3b82f6 0%, #e5e7eb 50%, #7c3aed 100%)' }}
            />
            <Slider
              min={sliderMin}
              max={sliderMax}
              step={0.5}
              value={[sliderValue]}
              onValueChange={([v]) => setSliderValue(v)}
              data-testid="slider-tolerance"
            />
            <div
              className="absolute top-0 bottom-0 w-0.5 bg-slate-400 opacity-60 pointer-events-none"
              style={{ left: `${markerPct}%` }}
            />
            <div
              className="absolute -top-6 text-xs text-slate-500 -translate-x-1/2 pointer-events-none text-center leading-tight"
              style={{ left: `${markerPct}%` }}
            >
              <div className="font-medium">Break-even</div>
              <div className="text-[11px] text-slate-400">
                £{competitorQuote.toFixed(2)} + £{cancellationFee.toFixed(2)} fee
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between text-xs font-medium px-0.5">
            <span className="text-green-600 dark:text-green-400">£{sliderMin.toFixed(2)}</span>
            <span className="text-muted-foreground">£{sliderMax.toFixed(2)}</span>
          </div>
        </div>

        <div className="mt-8 text-center space-y-4" data-testid="decision-impact-block">
          <div className="text-lg text-slate-600">
            If <span className="font-semibold">{currentProvider.toUpperCase()}</span> agrees to
            <span className="font-semibold"> £{sliderValue.toFixed(2)}</span>
          </div>

          {breakEvenDifference > 0 ? (
            <div className="space-y-1">
              <div className="text-5xl font-bold text-green-600">
                £{breakEvenDifference.toFixed(2)}
              </div>
              <div className="text-lg text-slate-600">
                Saved vs switching
              </div>
            </div>
          ) : breakEvenDifference < 0 ? (
            <div className="space-y-1">
              <div className="text-5xl font-bold text-red-600">
                £{Math.abs(breakEvenDifference).toFixed(2)}
              </div>
              <div className="text-lg text-slate-600">
                Switching would save this amount
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              <div className="text-5xl font-bold text-slate-700">
                £0
              </div>
              <div className="text-lg text-slate-600">
                Switching and staying cost the same
              </div>
              <div className="text-sm text-slate-400">
                Consider service, coverage and convenience when deciding
              </div>
            </div>
          )}

          <div className="pt-2">
            <div className="text-3xl font-semibold text-slate-800">
              £{Math.abs(currentPremiumDifference).toFixed(2)}
            </div>
            <div className="text-md text-slate-500">
              Less than your current premium
            </div>
          </div>
        </div>
      </div>

      <div className="w-full max-w-sm">
        <button
          type="button"
          className="flex items-center justify-between w-full text-sm font-medium text-foreground py-2"
          onClick={() => setIsAdvancedOpen(prev => !prev)}
          data-testid="button-advanced-preferences-toggle"
        >
          <span>Advanced negotiation preferences</span>
          <ChevronDown className={`w-4 h-4 transition-transform duration-200 ${isAdvancedOpen ? "rotate-180" : ""}`} />
        </button>
        <div style={{ visibility: isAdvancedOpen ? "visible" : "hidden", height: isAdvancedOpen ? "auto" : 0, overflow: "hidden" }}>
          <p className="text-xs text-muted-foreground mb-3">
            AutoAnnie may adjust voluntary excess within this limit if it improves your premium.
          </p>
          <div className="space-y-1">
            <label className="text-xs font-medium text-foreground">Voluntary excess flexibility</label>
            <Select
              value={String(voluntaryExcessFlexibility)}
              onValueChange={(v) => setVoluntaryExcessFlexibility(Number(v))}
            >
              <SelectTrigger data-testid="select-voluntary-excess-flexibility">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Array.from(new Set([voluntaryExcess, ...[100, 200, 300, 400, 500].filter(v => v >= voluntaryExcess)])).sort((a, b) => a - b).map((v) => (
                  <SelectItem key={v} value={String(v)}>£{v}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      <div className="flex flex-col items-center gap-3 w-full pt-2">
        <div className="flex flex-row gap-3 justify-center w-full max-w-xs mx-auto">
          <Button
            size="default"
            onClick={handleYes}
            className="flex-1"
            data-testid="button-negotiate-yes"
          >
            Authorise & Negotiate
          </Button>
          <Button
            size="default"
            variant="outline"
            onClick={onNo}
            className="flex-1"
            data-testid="button-negotiate-no"
          >
            Switch Directly
          </Button>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={onCancel}
          className="text-muted-foreground"
          data-testid="button-negotiate-cancel"
        >
          Cancel
        </Button>
        <p className="text-xs text-muted-foreground text-center max-w-xs mx-auto">
          AutoAnnie will never accept a quote, purchase a policy, or make any changes without your explicit confirmation.
        </p>
      </div>
    </div>
  );
}

interface LiveChatMessage {
  id: number;
  negotiation_id: number;
  sender: string;
  message: string;
  created_at: string;
}

function LiveNegotiationChat({
  negotiationId,
  roomId,
  currentProvider,
  competitorName,
  competitorQuote,
  matchData,
  onOutcome,
  onStay,
  onSwitch,
}: {
  negotiationId: number;
  roomId: string;
  currentProvider: string;
  competitorName: string;
  competitorQuote: number;
  matchData: MatchData;
  onOutcome: (outcome: {
    outcome: string;
    finalOfferPrice: number;
    competitorQuote: number;
    providerName: string;
    competitorName: string;
  }) => void;
  onStay: (renewalCost: number) => void;
  onSwitch: () => void;
}) {
  const [messages, setMessages] = useState<LiveChatMessage[]>([]);
  const [isAutoAnnieTyping, setIsAutoAnnieTyping] = useState(false);
  const [agentJoined, setAgentJoined] = useState(false);
  const [outcome, setOutcome] = useState<{
    outcome: string;
    finalOfferPrice: number;
  } | null>(null);
  const socketRef = useRef<Socket | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [customerDecisionMade, setCustomerDecisionMade] = useState(false);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isAutoAnnieTyping]);

  useEffect(() => {
    const socket = socketIO({
      path: "/socket.io",
      transports: ["websocket"],
    });
    socketRef.current = socket;

    socket.on("connect", () => {
      console.log("[LiveNego] Socket connected:", socket.id);
      socket.emit("join_negotiation", { roomId, role: "customer" });
    });

    socket.on("message_history", (history: LiveChatMessage[]) => {
      setMessages(history);
    });

    socket.on("agent_joined", () => {
      setAgentJoined(true);
    });

    socket.on("new_message", (msg: LiveChatMessage) => {
      setMessages((prev) => {
        if (prev.some(m => m.id === msg.id)) return prev;
        return [...prev, msg];
      });
    });

    socket.on("autoannie_typing", (typing: boolean) => {
      setIsAutoAnnieTyping(typing);
    });

    socket.on("negotiation_outcome", (data: any) => {
      setOutcome({
        outcome: data.outcome,
        finalOfferPrice: data.finalOfferPrice,
      });
      onOutcome(data);
    });

    socket.on("negotiation_closed", () => {
      setCustomerDecisionMade(true);
    });

    return () => {
      socket.disconnect();
    };
  }, [roomId, negotiationId]);

  const handleStay = () => {
    if (!outcome) return;
    socketRef.current?.emit("customer_decision", { roomId, decision: "stay" });
    onStay(outcome.finalOfferPrice);
  };

  const handleSwitch = () => {
    socketRef.current?.emit("customer_decision", { roomId, decision: "switch" });
    onSwitch();
  };

  return (
    <div className="flex flex-col h-full overflow-hidden p-4 sm:p-6" data-testid="live-negotiation-chat">
      <div className="flex items-center gap-3 pb-4 border-b border-border mb-4 shrink-0">
        <div className="relative">
          <Avatar className="h-10 w-10">
            <AvatarFallback className="bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-400 text-sm font-semibold">
              AA
            </AvatarFallback>
          </Avatar>
          <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-green-500 rounded-full border-2 border-background" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-base font-semibold text-foreground" data-testid="text-live-chat-title">
            Live Negotiation with {currentProvider}
          </h3>
          <p className="text-xs text-muted-foreground">
            {agentJoined ? (
              <span className="text-green-600 dark:text-green-400">Agent connected</span>
            ) : (
              <span className="animate-pulse">Waiting for agent to join...</span>
            )}
          </p>
        </div>
        {outcome && (
          <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${
            outcome.outcome === "matched" ? "bg-green-100 dark:bg-green-900/50 text-green-700 dark:text-green-400" :
            outcome.outcome === "partially_matched" ? "bg-yellow-100 dark:bg-yellow-900/50 text-yellow-700 dark:text-yellow-400" :
            "bg-red-100 dark:bg-red-900/50 text-red-700 dark:text-red-400"
          }`} data-testid="text-negotiation-status">
            {outcome.outcome === "matched" ? "Matched" :
             outcome.outcome === "partially_matched" ? "Partially Matched" :
             "Not Matched"}
          </span>
        )}
      </div>

      <div className="flex-1 overflow-y-auto space-y-3 min-h-0" data-testid="chat-messages-container">
        {!agentJoined && messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full space-y-3 text-center animate-pulse">
            <MessageSquare className="w-12 h-12 text-muted-foreground/50" />
            <p className="text-sm text-muted-foreground">
              Waiting for a {currentProvider} agent to join the chat...
            </p>
            <p className="text-xs text-muted-foreground/70">
              AutoAnnie will begin negotiating once the agent connects.
            </p>
          </div>
        )}

        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex gap-2.5 ${msg.sender === "autoannie" ? "justify-start" : "justify-end"}`}
            data-testid={`chat-message-${msg.sender}-${msg.id}`}
          >
            {msg.sender === "autoannie" && (
              <Avatar className="h-7 w-7 shrink-0 mt-0.5">
                <AvatarFallback className="bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-400 text-[10px] font-semibold">
                  AA
                </AvatarFallback>
              </Avatar>
            )}
            <div
              className={`max-w-[80%] rounded-lg px-3 py-2 text-sm ${
                msg.sender === "autoannie"
                  ? "bg-muted text-foreground"
                  : "bg-primary text-primary-foreground"
              }`}
            >
              <p className="whitespace-pre-wrap">{msg.message}</p>
              <p className={`text-[10px] mt-1 ${
                msg.sender === "autoannie" ? "text-muted-foreground" : "text-primary-foreground/70"
              }`}>
                {msg.sender === "autoannie" ? "AutoAnnie" : `${currentProvider} Agent`}
                {" · "}
                {new Date(msg.created_at).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}
              </p>
            </div>
            {msg.sender === "agent" && (
              <Avatar className="h-7 w-7 shrink-0 mt-0.5">
                <AvatarFallback className="bg-orange-100 dark:bg-orange-900 text-orange-600 dark:text-orange-400 text-[10px] font-semibold">
                  {currentProvider.substring(0, 2).toUpperCase()}
                </AvatarFallback>
              </Avatar>
            )}
          </div>
        ))}

        {isAutoAnnieTyping && (
          <div className="flex gap-2.5 justify-start" data-testid="autoannie-typing-indicator">
            <Avatar className="h-7 w-7 shrink-0 mt-0.5">
              <AvatarFallback className="bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-400 text-[10px] font-semibold">
                AA
              </AvatarFallback>
            </Avatar>
            <div className="bg-muted rounded-lg px-3 py-2">
              <div className="flex gap-1">
                <span className="w-2 h-2 bg-muted-foreground/50 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                <span className="w-2 h-2 bg-muted-foreground/50 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                <span className="w-2 h-2 bg-muted-foreground/50 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {outcome && !customerDecisionMade && (() => {
        const fb = matchData.financial_breakdown;
        const stayCost = outcome.finalOfferPrice;
        const switchCost = fb.switch_cost_12m;
        const stayIsCheaper = stayCost <= switchCost;
        const switchIsCheaper = switchCost < stayCost;
        const savings = Math.abs(stayCost - switchCost);
        const isMatchedOrPartial = outcome.outcome === "matched" || outcome.outcome === "partially_matched";

        return (
          <div className="mt-4 pt-4 border-t border-border shrink-0 animate-in fade-in slide-in-from-bottom-4 duration-500" data-testid="stay-switch-decision">
            <div className="rounded-md border border-border bg-card p-3 space-y-3">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                {currentProvider} has offered £{stayCost.toFixed(2)} after review.
              </p>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Cost over next 12 months</p>

              <div className={`flex items-start justify-between gap-2 p-2 rounded-md ${stayIsCheaper ? "bg-green-50 dark:bg-green-900/20" : ""}`}>
                <div className="space-y-0.5">
                  <p className="text-sm font-semibold" data-testid="text-stay-label">If you stay with {currentProvider}</p>
                  <p className="text-xs text-muted-foreground">Best reviewed offer</p>
                </div>
                <p className={`text-sm font-bold whitespace-nowrap ${stayIsCheaper ? "text-green-700 dark:text-green-400" : ""}`} data-testid="text-stay-price">
                  £{stayCost.toFixed(2)}
                </p>
              </div>

              <div className={`flex items-start justify-between gap-2 p-2 rounded-md ${switchIsCheaper ? "bg-green-50 dark:bg-green-900/20" : ""}`}>
                <div className="space-y-0.5">
                  <p className="text-sm font-semibold" data-testid="text-switch-label">If you switch to {competitorName}</p>
                  {fb.cancellation_fee > 0 && (
                    <p className="text-xs text-muted-foreground">
                      Includes £{fb.cancellation_fee.toFixed(2)} cancellation fee
                    </p>
                  )}
                  {fb.upfront_impact !== 0 && (
                    <p className="text-xs text-muted-foreground">
                      {fb.upfront_impact < 0
                        ? `£${Math.abs(fb.upfront_impact).toFixed(2)} to pay today`
                        : `£${fb.upfront_impact.toFixed(2)} refund today`}
                    </p>
                  )}
                </div>
                <p className={`text-sm font-bold whitespace-nowrap ${switchIsCheaper ? "text-green-700 dark:text-green-400" : ""}`} data-testid="text-switch-price">
                  £{switchCost.toFixed(2)}
                </p>
              </div>

              {savings > 0.01 && (
                <div className="text-green-700 font-semibold text-center mt-4" data-testid="text-savings-summary">
                  {stayIsCheaper ? "Staying" : "Switching"} saves £{savings.toFixed(2)} over 12 months.
                </div>
              )}

              <div className="text-sm text-slate-600 text-center mt-2">
                ✔ No cancellation fee &nbsp;&nbsp; ✔ No policy change &nbsp;&nbsp; ✔ No payment disruption
              </div>

              <div className="flex flex-col gap-2 pt-1">
                <Button
                  size="lg"
                  variant={stayIsCheaper ? "default" : "outline"}
                  className="w-full"
                  onClick={handleStay}
                  data-testid="button-live-stay"
                >
                  Stay with {currentProvider}
                </Button>
                <Button
                  size="lg"
                  variant={switchIsCheaper ? "default" : "outline"}
                  className="w-full"
                  onClick={handleSwitch}
                  data-testid="button-live-switch"
                >
                  Switch to {competitorName}
                </Button>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}

function LiveNegotiationVoice({
  negotiationId,
  roomId,
  currentProvider,
  competitorName,
  competitorQuote,
  matchData,
  onOutcome,
  onStay,
  onSwitch,
}: {
  negotiationId: number;
  roomId: string;
  currentProvider: string;
  competitorName: string;
  competitorQuote: number;
  matchData: MatchData;
  onOutcome: (outcome: {
    outcome: string;
    finalOfferPrice: number;
    competitorQuote: number;
    providerName: string;
    competitorName: string;
  }) => void;
  onStay: (renewalCost: number) => void;
  onSwitch: () => void;
}) {
  const [transcript, setTranscript] = useState<{ sender: string; text: string; id: string }[]>([]);
  const [agentJoined, setAgentJoined] = useState(false);
  const [outcome, setOutcome] = useState<{
    outcome: string;
    finalOfferPrice: number;
  } | null>(null);
  const socketRef = useRef<Socket | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [customerDecisionMade, setCustomerDecisionMade] = useState(false);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [transcript]);

  useEffect(() => {
    const socket = socketIO({
      path: "/socket.io",
      transports: ["websocket"],
    });
    socketRef.current = socket;

    socket.on("connect", () => {
      socket.emit("join_negotiation", { roomId, role: "customer" });
    });

    socket.on("agent_joined", () => {
      setAgentJoined(true);
    });

    socket.on("message_history", (history: { id: number; sender: string; message: string }[]) => {
      if (history.length > 0) {
        setAgentJoined(true);
        const mapped = history.map((m) => ({
          sender: m.sender,
          text: m.message,
          id: `history-${m.id}`,
        }));
        setTranscript(mapped);
      }
    });

    socket.on("voice_transcript", (data: { sender: string; text: string; isFinal: boolean }) => {
      if (data.isFinal && data.text.trim()) {
        const clean = data.text
          .replace(/\[OUTCOME:(ACCEPTED|REJECTED|CONSIDERING):£[\d.]+\]/g, "")
          .trim();
        if (clean) {
          const id = `${data.sender}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
          setTranscript((prev) => [...prev, { sender: data.sender, text: clean, id }]);
        }
      }
    });

    socket.on("negotiation_outcome", (data: any) => {
      setOutcome({
        outcome: data.outcome,
        finalOfferPrice: data.finalOfferPrice,
      });
      onOutcome(data);
    });

    socket.on("negotiation_closed", () => {
      setCustomerDecisionMade(true);
    });

    return () => {
      socket.disconnect();
    };
  }, [roomId, negotiationId]);

  const handleStay = () => {
    if (!outcome) return;
    socketRef.current?.emit("customer_decision", { roomId, decision: "stay" });
    onStay(outcome.finalOfferPrice);
  };

  const handleSwitch = () => {
    socketRef.current?.emit("customer_decision", { roomId, decision: "switch" });
    onSwitch();
  };

  return (
    <div className="flex flex-col h-full overflow-hidden p-4 sm:p-6" data-testid="live-negotiation-voice">
      <div className="flex items-center gap-3 pb-4 border-b border-border mb-4 shrink-0">
        <div className="relative">
          <Avatar className="h-10 w-10">
            <AvatarFallback className="bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-400 text-sm font-semibold">
              AA
            </AvatarFallback>
          </Avatar>
          <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-green-500 rounded-full border-2 border-background" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-base font-semibold text-foreground" data-testid="text-voice-nego-title">
            Voice Negotiation with {currentProvider}
          </h3>
          <p className="text-xs text-muted-foreground">
            {agentJoined ? (
              <span className="text-green-600 dark:text-green-400 flex items-center gap-1">
                <Mic className="w-3 h-3" /> Agent on voice call
              </span>
            ) : (
              <span className="animate-pulse">Waiting for agent to join voice call...</span>
            )}
          </p>
        </div>
        {agentJoined && !outcome && (
          <div className="flex items-center gap-1.5">
            <div className="flex items-end gap-0.5 h-4">
              <span className="w-1 bg-primary rounded-full animate-pulse" style={{ height: "40%", animationDelay: "0ms" }} />
              <span className="w-1 bg-primary rounded-full animate-pulse" style={{ height: "80%", animationDelay: "150ms" }} />
              <span className="w-1 bg-primary rounded-full animate-pulse" style={{ height: "60%", animationDelay: "300ms" }} />
              <span className="w-1 bg-primary rounded-full animate-pulse" style={{ height: "100%", animationDelay: "450ms" }} />
              <span className="w-1 bg-primary rounded-full animate-pulse" style={{ height: "50%", animationDelay: "600ms" }} />
            </div>
          </div>
        )}
        {outcome && (
          <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${
            outcome.outcome === "matched" ? "bg-green-100 dark:bg-green-900/50 text-green-700 dark:text-green-400" :
            outcome.outcome === "partially_matched" ? "bg-yellow-100 dark:bg-yellow-900/50 text-yellow-700 dark:text-yellow-400" :
            "bg-red-100 dark:bg-red-900/50 text-red-700 dark:text-red-400"
          }`} data-testid="text-voice-negotiation-status">
            {outcome.outcome === "matched" ? "Matched" :
             outcome.outcome === "partially_matched" ? "Partially Matched" :
             "Not Matched"}
          </span>
        )}
      </div>

      <div className="flex-1 overflow-y-auto space-y-3 min-h-0" data-testid="voice-transcript-container">
        {!agentJoined && transcript.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full space-y-3 text-center">
            <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center animate-pulse">
              <Mic className="w-8 h-8 text-primary/60" />
            </div>
            <p className="text-sm text-muted-foreground">
              Waiting for the {currentProvider} agent to join the voice call...
            </p>
            <p className="text-xs text-muted-foreground/70">
              AutoAnnie will negotiate on your behalf by voice. You'll see the live transcript here.
            </p>
          </div>
        )}

        {agentJoined && transcript.length === 0 && !outcome && (
          <div className="flex flex-col items-center justify-center h-full space-y-3 text-center animate-in fade-in duration-500">
            <div className="flex items-end gap-1 h-8">
              <span className="w-1.5 bg-primary/40 rounded-full animate-pulse" style={{ height: "30%", animationDelay: "0ms" }} />
              <span className="w-1.5 bg-primary/40 rounded-full animate-pulse" style={{ height: "70%", animationDelay: "100ms" }} />
              <span className="w-1.5 bg-primary/40 rounded-full animate-pulse" style={{ height: "50%", animationDelay: "200ms" }} />
              <span className="w-1.5 bg-primary/40 rounded-full animate-pulse" style={{ height: "90%", animationDelay: "300ms" }} />
              <span className="w-1.5 bg-primary/40 rounded-full animate-pulse" style={{ height: "40%", animationDelay: "400ms" }} />
            </div>
            <p className="text-sm text-muted-foreground">
              Voice call in progress — transcript will appear shortly...
            </p>
          </div>
        )}

        {transcript.map((entry) => (
          <div
            key={entry.id}
            className={`flex gap-2.5 ${entry.sender === "autoannie" ? "justify-start" : "justify-end"}`}
            data-testid={`voice-transcript-${entry.sender}-${entry.id}`}
          >
            {entry.sender === "autoannie" && (
              <Avatar className="h-7 w-7 shrink-0 mt-0.5">
                <AvatarFallback className="bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-400 text-[10px] font-semibold">
                  AA
                </AvatarFallback>
              </Avatar>
            )}
            <div
              className={`max-w-[80%] rounded-lg px-3 py-2 text-sm ${
                entry.sender === "autoannie"
                  ? "bg-muted text-foreground"
                  : "bg-primary text-primary-foreground"
              }`}
            >
              <p className="whitespace-pre-wrap">{entry.text}</p>
              <p className={`text-[10px] mt-1 ${
                entry.sender === "autoannie" ? "text-muted-foreground" : "text-primary-foreground/70"
              }`}>
                {entry.sender === "autoannie" ? "AutoAnnie" : `${currentProvider} Agent`}
              </p>
            </div>
            {entry.sender === "agent" && (
              <Avatar className="h-7 w-7 shrink-0 mt-0.5">
                <AvatarFallback className="bg-orange-100 dark:bg-orange-900 text-orange-600 dark:text-orange-400 text-[10px] font-semibold">
                  {currentProvider.substring(0, 2).toUpperCase()}
                </AvatarFallback>
              </Avatar>
            )}
          </div>
        ))}

        <div ref={messagesEndRef} />
      </div>

      {outcome && !customerDecisionMade && (() => {
        const fb = matchData.financial_breakdown;
        const stayCost = outcome.finalOfferPrice;
        const switchCost = fb.switch_cost_12m;
        const stayIsCheaper = stayCost <= switchCost;
        const switchIsCheaper = switchCost < stayCost;
        const savings = Math.abs(stayCost - switchCost);
        const isMatchedOrPartial = outcome.outcome === "matched" || outcome.outcome === "partially_matched";

        return (
          <div className="mt-4 pt-4 border-t border-border shrink-0 animate-in fade-in slide-in-from-bottom-4 duration-500" data-testid="voice-stay-switch-decision">
            <div className="rounded-md border border-border bg-card p-3 space-y-3">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                {currentProvider} has offered £{stayCost.toFixed(2)} after review.
              </p>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Cost over next 12 months</p>

              <div className={`flex items-start justify-between gap-2 p-2 rounded-md ${stayIsCheaper ? "bg-green-50 dark:bg-green-900/20" : ""}`}>
                <div className="space-y-0.5">
                  <p className="text-sm font-semibold" data-testid="text-voice-stay-label">If you stay with {currentProvider}</p>
                  <p className="text-xs text-muted-foreground">Best reviewed offer</p>
                </div>
                <p className={`text-sm font-bold whitespace-nowrap ${stayIsCheaper ? "text-green-700 dark:text-green-400" : ""}`} data-testid="text-voice-stay-price">
                  £{stayCost.toFixed(2)}
                </p>
              </div>

              <div className={`flex items-start justify-between gap-2 p-2 rounded-md ${switchIsCheaper ? "bg-green-50 dark:bg-green-900/20" : ""}`}>
                <div className="space-y-0.5">
                  <p className="text-sm font-semibold" data-testid="text-voice-switch-label">If you switch to {competitorName}</p>
                  {fb.cancellation_fee > 0 && (
                    <p className="text-xs text-muted-foreground">
                      Includes £{fb.cancellation_fee.toFixed(2)} cancellation fee
                    </p>
                  )}
                  {fb.upfront_impact !== 0 && (
                    <p className="text-xs text-muted-foreground">
                      {fb.upfront_impact < 0
                        ? `£${Math.abs(fb.upfront_impact).toFixed(2)} to pay today`
                        : `£${fb.upfront_impact.toFixed(2)} refund today`}
                    </p>
                  )}
                </div>
                <p className={`text-sm font-bold whitespace-nowrap ${switchIsCheaper ? "text-green-700 dark:text-green-400" : ""}`} data-testid="text-voice-switch-price">
                  £{switchCost.toFixed(2)}
                </p>
              </div>

              {savings > 0.01 && (
                <div className="text-green-700 font-semibold text-center mt-4" data-testid="text-voice-savings-summary">
                  {stayIsCheaper ? "Staying" : "Switching"} saves £{savings.toFixed(2)} over 12 months.
                </div>
              )}

              <div className="text-sm text-slate-600 text-center mt-2">
                ✔ No cancellation fee &nbsp;&nbsp; ✔ No policy change &nbsp;&nbsp; ✔ No payment disruption
              </div>

              <div className="flex flex-col gap-2 pt-1">
                <Button
                  size="lg"
                  variant={stayIsCheaper ? "default" : "outline"}
                  className="w-full"
                  onClick={handleStay}
                  data-testid="button-voice-stay"
                >
                  Stay with {currentProvider}
                </Button>
                <Button
                  size="lg"
                  variant={switchIsCheaper ? "default" : "outline"}
                  className="w-full"
                  onClick={handleSwitch}
                  data-testid="button-voice-switch"
                >
                  Switch to {competitorName}
                </Button>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
