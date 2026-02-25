import { useState, useEffect, useCallback } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Bell, Mail, Shield, CheckCircle2, XCircle, Clock, ArrowRight, AlertTriangle, X, ChevronRight, LayoutDashboard, ArrowLeft } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Toaster } from "@/components/ui/toaster";
import type { Negotiation } from "@shared/schema";

const PROVIDER_COLORS: Record<string, { primary: string; bg: string; headerBg: string; accent: string }> = {
  admiral: { primary: "text-blue-700 dark:text-blue-300", bg: "bg-blue-50 dark:bg-blue-950/30", headerBg: "bg-blue-700 dark:bg-blue-900", accent: "border-blue-200 dark:border-blue-800" },
  paxa: { primary: "text-teal-700 dark:text-teal-300", bg: "bg-teal-50 dark:bg-teal-950/30", headerBg: "bg-teal-700 dark:bg-teal-900", accent: "border-teal-200 dark:border-teal-800" },
  baviva: { primary: "text-purple-700 dark:text-purple-300", bg: "bg-purple-50 dark:bg-purple-950/30", headerBg: "bg-purple-700 dark:bg-purple-900", accent: "border-purple-200 dark:border-purple-800" },
  indirectlane: { primary: "text-orange-700 dark:text-orange-300", bg: "bg-orange-50 dark:bg-orange-950/30", headerBg: "bg-orange-700 dark:bg-orange-900", accent: "border-orange-200 dark:border-orange-800" },
  churchwell: { primary: "text-rose-700 dark:text-rose-300", bg: "bg-rose-50 dark:bg-rose-950/30", headerBg: "bg-rose-700 dark:bg-rose-900", accent: "border-rose-200 dark:border-rose-800" },
  ventura: { primary: "text-emerald-700 dark:text-emerald-300", bg: "bg-emerald-50 dark:bg-emerald-950/30", headerBg: "bg-emerald-700 dark:bg-emerald-900", accent: "border-emerald-200 dark:border-emerald-800" },
  zorich: { primary: "text-cyan-700 dark:text-cyan-300", bg: "bg-cyan-50 dark:bg-cyan-950/30", headerBg: "bg-cyan-700 dark:bg-cyan-900", accent: "border-cyan-200 dark:border-cyan-800" },
  hestingsdrive: { primary: "text-amber-700 dark:text-amber-300", bg: "bg-amber-50 dark:bg-amber-950/30", headerBg: "bg-amber-700 dark:bg-amber-900", accent: "border-amber-200 dark:border-amber-800" },
  assureon: { primary: "text-indigo-700 dark:text-indigo-300", bg: "bg-indigo-50 dark:bg-indigo-950/30", headerBg: "bg-indigo-700 dark:bg-indigo-900", accent: "border-indigo-200 dark:border-indigo-800" },
  soga: { primary: "text-slate-700 dark:text-slate-300", bg: "bg-slate-50 dark:bg-slate-950/30", headerBg: "bg-slate-700 dark:bg-slate-900", accent: "border-slate-200 dark:border-slate-800" },
};

const DEFAULT_COLORS = { primary: "text-blue-700 dark:text-blue-300", bg: "bg-blue-50 dark:bg-blue-950/30", headerBg: "bg-blue-700 dark:bg-blue-900", accent: "border-blue-200 dark:border-blue-800" };

function extractProviderFromEmail(email: string): string {
  const domain = email.split("@")[1] || "";
  const provider = domain.split(".")[0] || "";
  return provider.charAt(0).toUpperCase() + provider.slice(1);
}

function getProviderColors(provider: string) {
  return PROVIDER_COLORS[provider.toLowerCase()] || DEFAULT_COLORS;
}

function formatProviderDisplayName(provider: string): string {
  const displayNames: Record<string, string> = {
    admiral: "Admiral Insurance",
    paxa: "PAXA Insurance",
    baviva: "Baviva Insurance",
    indirectlane: "IndirectLane Insurance",
    churchwell: "Churchwell Insurance",
    ventura: "Ventura Insurance",
    zorich: "Zorich Insurance",
    hestingsdrive: "HestingsDrive Insurance",
    assureon: "Assureon Insurance",
    soga: "Soga Insurance",
  };
  return displayNames[provider.toLowerCase()] || `${provider} Insurance`;
}

function EmailLoginPage({ onLogin }: { onLogin: (email: string, provider: string) => void }) {
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");

  const handleSubmit = () => {
    if (!email.includes("@") || !email.includes(".")) {
      setError("Please enter a valid email address");
      return;
    }
    if (!email.toLowerCase().startsWith("customer_agent@")) {
      setError("Please use a customer_agent@ email address");
      return;
    }
    const provider = extractProviderFromEmail(email);
    if (!provider) {
      setError("Could not determine provider from email");
      return;
    }
    sessionStorage.setItem("customer_agent_email", email);
    sessionStorage.setItem("customer_agent_provider", provider);
    onLogin(email, provider);
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 flex items-center justify-center p-4">
      <Card className="w-full max-w-sm p-6 space-y-6">
        <div className="text-center space-y-2">
          <Mail className="w-10 h-10 mx-auto text-muted-foreground" />
          <h1 className="text-xl font-semibold text-foreground">Agent Sign In</h1>
          <p className="text-sm text-muted-foreground">Enter your provider agent email</p>
        </div>
        <div className="space-y-3">
          <Input
            type="email"
            placeholder="customer_agent@admiral.com"
            value={email}
            onChange={(e) => { setEmail(e.target.value); setError(""); }}
            onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
            data-testid="input-agent-email"
          />
          {error && <p className="text-xs text-red-500" data-testid="text-agent-email-error">{error}</p>}
          <Button onClick={handleSubmit} className="w-full" data-testid="button-agent-email-submit">
            <ArrowRight className="w-4 h-4 mr-2" />
            Sign In
          </Button>
        </div>
      </Card>
    </div>
  );
}

function NegotiationCard({
  negotiation,
  providerColors,
  onRespond,
}: {
  negotiation: Negotiation;
  providerColors: ReturnType<typeof getProviderColors>;
  onRespond: (id: number, decision: string, price: number) => void;
}) {
  const [offerPrice, setOfferPrice] = useState("");
  const [priceError, setPriceError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleAction = async (decision: string) => {
    const price = parseFloat(offerPrice);
    if (isNaN(price) || price <= 0) {
      setPriceError("Please enter a valid price");
      return;
    }
    setPriceError("");
    setIsSubmitting(true);
    await onRespond(negotiation.id, decision, price);
    setIsSubmitting(false);
  };

  const isPending = negotiation.status === "pending";
  const timeSince = Math.round((Date.now() - new Date(negotiation.created_at).getTime()) / 1000);
  const timeLabel = timeSince < 60 ? `${timeSince}s ago` : timeSince < 3600 ? `${Math.round(timeSince / 60)}m ago` : `${Math.round(timeSince / 3600)}h ago`;

  return (
    <Card className={`overflow-visible ${!isPending ? "opacity-70" : ""}`} data-testid={`card-negotiation-${negotiation.id}`}>
      <div className={`px-4 py-3 border-b ${providerColors.accent} ${providerColors.bg} rounded-t-md`}>
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2">
            <Shield className="w-4 h-4 text-muted-foreground" />
            <span className="text-sm font-semibold text-foreground">Retention Request</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">{timeLabel}</span>
            {isPending ? (
              <Badge variant="outline" className="text-xs bg-yellow-50 dark:bg-yellow-950/30 text-yellow-700 dark:text-yellow-300 border-yellow-300 dark:border-yellow-700">
                <Clock className="w-3 h-3 mr-1" /> Pending
              </Badge>
            ) : negotiation.status === "rejected" ? (
              <Badge variant="outline" className="text-xs bg-red-50 dark:bg-red-950/30 text-red-700 dark:text-red-300 border-red-300 dark:border-red-700">
                <XCircle className="w-3 h-3 mr-1" /> Declined
              </Badge>
            ) : (
              <Badge variant="outline" className="text-xs bg-green-50 dark:bg-green-950/30 text-green-700 dark:text-green-300 border-green-300 dark:border-green-700">
                <CheckCircle2 className="w-3 h-3 mr-1" /> Responded
              </Badge>
            )}
          </div>
        </div>
      </div>

      <div className="p-4 space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <p className="text-xs text-muted-foreground">Customer</p>
            <p className="text-sm font-medium text-foreground" data-testid={`text-customer-name-${negotiation.id}`}>{negotiation.customer_name}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Policy No.</p>
            <p className="text-sm font-medium text-foreground" data-testid={`text-policy-number-${negotiation.id}`}>{negotiation.policy_number}</p>
          </div>
          {negotiation.original_policy_cost && (
            <div>
              <p className="text-xs text-muted-foreground">Original Policy Cost</p>
              <p className="text-sm font-medium text-foreground" data-testid={`text-original-cost-${negotiation.id}`}>£{negotiation.original_policy_cost.toFixed(2)}</p>
            </div>
          )}
          <div>
            <p className="text-xs text-muted-foreground">Current Renewal</p>
            <p className="text-sm font-semibold text-foreground" data-testid={`text-renewal-cost-${negotiation.id}`}>£{negotiation.current_renewal_cost.toFixed(2)}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Competitor ({negotiation.competitor_name})</p>
            <p className="text-sm font-semibold text-green-700 dark:text-green-400" data-testid={`text-competitor-quote-${negotiation.id}`}>£{negotiation.competitor_quote.toFixed(2)}</p>
          </div>
        </div>

        {!isPending && negotiation.agent_offer_price !== null && (
          <div className="pt-2 border-t border-border/50 space-y-2">
            <div>
              <p className="text-xs text-muted-foreground">Your Response</p>
              <p className="text-sm font-medium text-foreground">
                {negotiation.decision_type === "match" ? "Matched" : negotiation.decision_type === "partial" ? "Partially Matched" : "Unable to Match"} at £{negotiation.agent_offer_price?.toFixed(2)}
              </p>
            </div>
            {negotiation.customer_outcome && (
              <div>
                <p className="text-xs text-muted-foreground">Customer Outcome</p>
                <p className="text-sm font-medium text-foreground" data-testid={`text-outcome-${negotiation.id}`}>
                  {negotiation.customer_outcome === "stayed" ? "Stayed with provider" : "Switched to competitor"}
                </p>
              </div>
            )}
          </div>
        )}

        {isPending && (
          <div className="pt-2 border-t border-border/50 space-y-3">
            <div className="flex flex-col gap-2">
              <label className="text-xs font-medium text-muted-foreground">Your offer price:</label>
              <div className="flex items-center gap-1">
                <span className="text-sm font-medium text-foreground">£</span>
                <Input
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9.]*"
                  placeholder="Enter price"
                  value={offerPrice}
                  onChange={(e) => { setOfferPrice(e.target.value); setPriceError(""); }}
                  className={`text-sm ${priceError ? "border-red-500 focus-visible:ring-red-500" : ""}`}
                  data-testid={`input-offer-price-${negotiation.id}`}
                />
              </div>
              {priceError && <p className="text-xs text-red-500" data-testid={`text-price-error-${negotiation.id}`}>{priceError}</p>}
            </div>
            <div className="flex gap-2">
              <Button
                size="sm"
                className="flex-1"
                onClick={() => handleAction("match")}
                disabled={isSubmitting}
                data-testid={`button-match-${negotiation.id}`}
              >
                Match
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="flex-1"
                onClick={() => handleAction("partial")}
                disabled={isSubmitting}
                data-testid={`button-partial-${negotiation.id}`}
              >
                Partially Match
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="flex-1"
                onClick={() => handleAction("unable")}
                disabled={isSubmitting}
                data-testid={`button-unable-${negotiation.id}`}
              >
                Unable to Match
              </Button>
            </div>
          </div>
        )}
      </div>
    </Card>
  );
}

type StatFilter = "all" | "pending" | "matched" | "partial" | "declined";

function formatTimestamp(dateStr: string): string {
  const d = new Date(dateStr);
  const day = d.getDate().toString().padStart(2, "0");
  const month = d.toLocaleDateString("en-GB", { month: "short" });
  const year = d.getFullYear();
  const time = d.toLocaleTimeString("en-GB", { hour: "numeric", minute: "2-digit", hour12: true }).toUpperCase();
  return `${day}-${month}-${year} ${time}`;
}

function getStatusBadge(status: string, decisionType: string | null) {
  if (status === "pending") {
    return (
      <Badge variant="outline" className="text-xs bg-yellow-50 dark:bg-yellow-950/30 text-yellow-700 dark:text-yellow-300 border-yellow-300 dark:border-yellow-700">
        <Clock className="w-3 h-3 mr-1" /> Pending
      </Badge>
    );
  }
  if (decisionType === "match") {
    return (
      <Badge variant="outline" className="text-xs bg-green-50 dark:bg-green-950/30 text-green-700 dark:text-green-300 border-green-300 dark:border-green-700">
        <CheckCircle2 className="w-3 h-3 mr-1" /> Matched
      </Badge>
    );
  }
  if (decisionType === "partial") {
    return (
      <Badge variant="outline" className="text-xs bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-300 border-amber-300 dark:border-amber-700">
        <AlertTriangle className="w-3 h-3 mr-1" /> Partial
      </Badge>
    );
  }
  return (
    <Badge variant="outline" className="text-xs bg-red-50 dark:bg-red-950/30 text-red-700 dark:text-red-300 border-red-300 dark:border-red-700">
      <XCircle className="w-3 h-3 mr-1" /> Declined
    </Badge>
  );
}

function AgentDashboard({ provider, onBack }: { provider: string; onBack: () => void }) {
  const [negotiations, setNegotiations] = useState<Negotiation[]>([]);
  const [pendingCount, setPendingCount] = useState(0);
  const [showNotifications, setShowNotifications] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState<StatFilter>("all");
  const [selectedNegotiationId, setSelectedNegotiationId] = useState<number | null>(null);
  const { toast } = useToast();
  const colors = getProviderColors(provider);
  const displayName = formatProviderDisplayName(provider);

  const fetchNegotiations = useCallback(async () => {
    try {
      const [negoRes, pendingRes] = await Promise.all([
        fetch(`/api/negotiations?provider=${encodeURIComponent(provider)}`),
        fetch(`/api/negotiations/pending?provider=${encodeURIComponent(provider)}`),
      ]);
      if (negoRes.ok) {
        const data = await negoRes.json();
        setNegotiations(data);
      }
      if (pendingRes.ok) {
        const data = await pendingRes.json();
        setPendingCount(data.count);
      }
    } catch {
    } finally {
      setIsLoading(false);
    }
  }, [provider]);

  useEffect(() => {
    fetchNegotiations();
    const interval = setInterval(fetchNegotiations, 3000);
    return () => clearInterval(interval);
  }, [fetchNegotiations]);

  const handleRespond = async (id: number, decision: string, price: number) => {
    try {
      const res = await fetch(`/api/negotiations/${id}/respond`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ decision, offer_price: price }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to submit response");
      }
      toast({ title: "Response Submitted", description: `Decision: ${decision === "match" ? "Matched" : decision === "partial" ? "Partially Matched" : "Unable to Match"} at £${price.toFixed(2)}` });
      fetchNegotiations();
    } catch (error: any) {
      toast({ title: "Error", description: error.message || "Failed to submit response", variant: "destructive" });
    }
  };

  const counts = {
    pending: negotiations.filter((n) => n.status === "pending").length,
    matched: negotiations.filter((n) => n.status !== "pending" && n.decision_type === "match").length,
    partial: negotiations.filter((n) => n.status !== "pending" && n.decision_type === "partial").length,
    declined: negotiations.filter((n) => n.status !== "pending" && (n.decision_type === "unable" || n.decision_type === "rejected" || n.status === "rejected")).length,
  };

  const filteredNegotiations = negotiations.filter((n) => {
    if (activeFilter === "all") return true;
    if (activeFilter === "pending") return n.status === "pending";
    if (activeFilter === "matched") return n.status !== "pending" && n.decision_type === "match";
    if (activeFilter === "partial") return n.status !== "pending" && n.decision_type === "partial";
    if (activeFilter === "declined") return n.status !== "pending" && (n.decision_type === "unable" || n.decision_type === "rejected" || n.status === "rejected");
    return true;
  });

  const selectedNegotiation = negotiations.find((n) => n.id === selectedNegotiationId) || null;

  const statCards: { key: StatFilter; label: string; count: number; icon: typeof Bell; colorClass: string; bgClass: string; borderClass: string; actionLabel?: string }[] = [
    { key: "pending", label: "Pending Requests", count: counts.pending, icon: Bell, colorClass: "text-yellow-600 dark:text-yellow-400", bgClass: "bg-yellow-50 dark:bg-yellow-950/30", borderClass: "border-yellow-200 dark:border-yellow-800", actionLabel: "Action Required" },
    { key: "matched", label: "Matched", count: counts.matched, icon: CheckCircle2, colorClass: "text-green-600 dark:text-green-400", bgClass: "bg-green-50 dark:bg-green-950/30", borderClass: "border-green-200 dark:border-green-800" },
    { key: "partial", label: "Partially Matched", count: counts.partial, icon: AlertTriangle, colorClass: "text-amber-600 dark:text-amber-400", bgClass: "bg-amber-50 dark:bg-amber-950/30", borderClass: "border-amber-200 dark:border-amber-800" },
    { key: "declined", label: "Declined", count: counts.declined, icon: XCircle, colorClass: "text-red-600 dark:text-red-400", bgClass: "bg-red-50 dark:bg-red-950/30", borderClass: "border-red-200 dark:border-red-800" },
  ];

  return (
    <div className="min-h-screen bg-background">
      <header className={`${colors.headerBg} text-white shadow-md sticky top-0 z-50`}>
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between gap-2">
          <div className="flex items-center gap-3">
            <Button
              size="icon"
              variant="ghost"
              className="text-white no-default-hover-elevate"
              onClick={onBack}
              data-testid="button-back-home"
            >
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div>
              <h1 className="text-lg font-bold leading-tight" data-testid="text-provider-name">{displayName}</h1>
              <p className="text-xs opacity-80">Retention Requests</p>
            </div>
          </div>
          <div className="relative">
            <Button
              size="icon"
              variant="ghost"
              className="text-white no-default-hover-elevate"
              onClick={() => setShowNotifications(!showNotifications)}
              data-testid="button-notification-bell"
            >
              <Bell className="w-5 h-5" />
            </Button>
            {pendingCount > 0 && (
              <span
                className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center"
                data-testid="badge-pending-count"
              >
                {pendingCount}
              </span>
            )}
            {showNotifications && (
              <div className="absolute right-0 top-full mt-2 w-80 max-h-[70vh] overflow-y-auto bg-card border border-border rounded-md shadow-lg z-50" data-testid="dropdown-notifications">
                <div className="p-3 border-b border-border">
                  <h3 className="text-sm font-semibold text-foreground">Notifications</h3>
                  <p className="text-xs text-muted-foreground">{pendingCount} pending request{pendingCount !== 1 ? "s" : ""}</p>
                </div>
                {negotiations.filter((n) => n.status === "pending").length === 0 ? (
                  <div className="p-4 text-center text-sm text-muted-foreground">No pending requests</div>
                ) : (
                  <div className="p-2 space-y-2">
                    {negotiations.filter((n) => n.status === "pending").map((n) => (
                      <div
                        key={n.id}
                        className="p-3 rounded-md hover-elevate cursor-pointer bg-yellow-50/50 dark:bg-yellow-950/20 border border-yellow-200 dark:border-yellow-800"
                        onClick={() => { setShowNotifications(false); setActiveFilter("pending"); setSelectedNegotiationId(n.id); }}
                        data-testid={`notification-item-${n.id}`}
                      >
                        <p className="text-sm font-medium text-foreground">{n.customer_name}</p>
                        <p className="text-xs text-muted-foreground">Policy: {n.policy_number}</p>
                        <p className="text-xs text-muted-foreground">Competitor quote: £{n.competitor_quote.toFixed(2)}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-6 space-y-6">
        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <div className="text-center space-y-3">
              <div className="w-8 h-8 border-2 border-muted-foreground/30 border-t-muted-foreground rounded-full animate-spin mx-auto" />
              <p className="text-sm text-muted-foreground">Loading dashboard...</p>
            </div>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3" data-testid="stat-cards-row">
              {statCards.map((stat) => {
                const Icon = stat.icon;
                const isActive = activeFilter === stat.key;
                return (
                  <Card
                    key={stat.key}
                    className={`p-4 cursor-pointer hover-elevate transition-colors overflow-visible ${isActive ? `${stat.bgClass} border ${stat.borderClass}` : ""}`}
                    onClick={() => setActiveFilter(isActive ? "all" : stat.key)}
                    data-testid={`stat-card-${stat.key}`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="space-y-1 min-w-0">
                        <p className="text-xs font-medium text-muted-foreground truncate">{stat.label}</p>
                        <p className="text-2xl font-bold text-foreground" data-testid={`stat-count-${stat.key}`}>{stat.count}</p>
                      </div>
                      <div className={`p-2 rounded-md ${stat.bgClass}`}>
                        <Icon className={`w-4 h-4 ${stat.colorClass}`} />
                      </div>
                    </div>
                    {stat.actionLabel && stat.count > 0 && (
                      <div className="mt-2">
                        <Badge variant="outline" className="text-[10px] bg-yellow-50 dark:bg-yellow-950/30 text-yellow-700 dark:text-yellow-300 border-yellow-300 dark:border-yellow-700">
                          {stat.actionLabel}
                        </Badge>
                      </div>
                    )}
                  </Card>
                );
              })}
            </div>

            {activeFilter !== "all" && (
              <div className="flex items-center gap-2">
                <p className="text-sm text-muted-foreground" data-testid="text-active-filter">
                  Showing: <span className="font-medium text-foreground">{statCards.find(s => s.key === activeFilter)?.label}</span>
                </p>
                <Button size="sm" variant="ghost" onClick={() => setActiveFilter("all")} data-testid="button-clear-filter">
                  <X className="w-3 h-3 mr-1" /> Clear filter
                </Button>
              </div>
            )}

            {filteredNegotiations.length === 0 ? (
              <div className="flex items-center justify-center py-16">
                <div className="text-center space-y-3">
                  <Bell className="w-10 h-10 mx-auto text-muted-foreground/40" />
                  <h2 className="text-base font-semibold text-foreground">
                    {negotiations.length === 0 ? "No Retention Requests Yet" : "No Results"}
                  </h2>
                  <p className="text-sm text-muted-foreground max-w-xs mx-auto">
                    {negotiations.length === 0
                      ? "When a customer receives a competitive quote, retention requests will appear here."
                      : "No negotiations match the selected filter."}
                  </p>
                </div>
              </div>
            ) : (
              <Card className="overflow-visible" data-testid="negotiations-table">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border">
                        <th className="text-left p-3 text-xs font-medium text-muted-foreground">Customer</th>
                        <th className="text-left p-3 text-xs font-medium text-muted-foreground hidden sm:table-cell">Policy No.</th>
                        <th className="text-left p-3 text-xs font-medium text-muted-foreground hidden lg:table-cell">Original Cost</th>
                        <th className="text-left p-3 text-xs font-medium text-muted-foreground hidden md:table-cell">Competitor</th>
                        <th className="text-left p-3 text-xs font-medium text-muted-foreground">Competitor Cost</th>
                        <th className="text-left p-3 text-xs font-medium text-muted-foreground hidden lg:table-cell">Matched Cost</th>
                        <th className="text-left p-3 text-xs font-medium text-muted-foreground hidden md:table-cell">Timestamp</th>
                        <th className="text-left p-3 text-xs font-medium text-muted-foreground">Status</th>
                        <th className="text-left p-3 text-xs font-medium text-muted-foreground hidden sm:table-cell">Outcome</th>
                        <th className="p-3 w-8"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredNegotiations.map((n) => {
                        const isSelected = selectedNegotiationId === n.id;
                        return (
                          <tr
                            key={n.id}
                            className={`border-b border-border/50 cursor-pointer hover-elevate ${isSelected ? "ring-1 ring-inset ring-border" : ""}`}
                            onClick={() => setSelectedNegotiationId(isSelected ? null : n.id)}
                            data-testid={`table-row-${n.id}`}
                          >
                            <td className="p-3">
                              <p className="font-medium text-foreground" data-testid={`table-customer-${n.id}`}>{n.customer_name}</p>
                            </td>
                            <td className="p-3 hidden sm:table-cell">
                              <span className="text-muted-foreground" data-testid={`table-policy-${n.id}`}>{n.policy_number}</span>
                            </td>
                            <td className="p-3 hidden lg:table-cell">
                              <span className="text-muted-foreground" data-testid={`table-original-cost-${n.id}`}>
                                {n.original_policy_cost ? `£${n.original_policy_cost.toFixed(2)}` : "—"}
                              </span>
                            </td>
                            <td className="p-3 hidden md:table-cell">
                              <span className="text-muted-foreground" data-testid={`table-competitor-${n.id}`}>{n.competitor_name}</span>
                            </td>
                            <td className="p-3">
                              <span className="font-medium text-green-700 dark:text-green-400" data-testid={`table-competitor-cost-${n.id}`}>£{n.competitor_quote.toFixed(2)}</span>
                            </td>
                            <td className="p-3 hidden lg:table-cell">
                              <span className="font-medium text-foreground" data-testid={`table-matched-cost-${n.id}`}>
                                {n.agent_offer_price ? `£${n.agent_offer_price.toFixed(2)}` : "—"}
                              </span>
                            </td>
                            <td className="p-3 hidden md:table-cell">
                              <span className="text-muted-foreground text-xs whitespace-nowrap" data-testid={`table-timestamp-${n.id}`}>{formatTimestamp(n.created_at)}</span>
                            </td>
                            <td className="p-3" data-testid={`table-status-${n.id}`}>
                              {getStatusBadge(n.status, n.decision_type)}
                            </td>
                            <td className="p-3 hidden sm:table-cell" data-testid={`table-outcome-${n.id}`}>
                              {n.customer_outcome === "stayed" ? (
                                <Badge variant="outline" className="text-xs bg-blue-50 dark:bg-blue-950/30 text-blue-700 dark:text-blue-300 border-blue-300 dark:border-blue-700">
                                  Stayed
                                </Badge>
                              ) : n.customer_outcome === "switched" ? (
                                <Badge variant="outline" className="text-xs bg-orange-50 dark:bg-orange-950/30 text-orange-700 dark:text-orange-300 border-orange-300 dark:border-orange-700">
                                  Switched
                                </Badge>
                              ) : (
                                <span className="text-muted-foreground">—</span>
                              )}
                            </td>
                            <td className="p-3">
                              <ChevronRight className={`w-4 h-4 text-muted-foreground transition-transform ${isSelected ? "rotate-90" : ""}`} />
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </Card>
            )}

            {selectedNegotiation && (
              <div className="space-y-3 pt-2" data-testid="detail-panel">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="text-sm font-semibold text-foreground" data-testid="text-detail-heading">Request Details</h3>
                  <Button size="sm" variant="ghost" onClick={() => setSelectedNegotiationId(null)} data-testid="button-close-detail">
                    <X className="w-3 h-3 mr-1" /> Close
                  </Button>
                </div>
                <NegotiationCard
                  negotiation={selectedNegotiation}
                  providerColors={colors}
                  onRespond={handleRespond}
                />
              </div>
            )}
          </>
        )}
      </main>
      <Toaster />
    </div>
  );
}

function HomeScreen({ provider, onNavigate }: { provider: string; onNavigate: (view: "retention" | "dashboard") => void }) {
  const colors = getProviderColors(provider);
  const displayName = formatProviderDisplayName(provider);

  const sections = [
    {
      key: "retention" as const,
      title: "Retention Requests",
      description: "Review and respond to customer retention negotiations. Match, partially match, or decline competitor quotes.",
      icon: Shield,
      colorClass: "text-blue-600 dark:text-blue-400",
      bgClass: "bg-blue-50 dark:bg-blue-950/30",
    },
    {
      key: "dashboard" as const,
      title: "Dashboard",
      description: "View performance analytics, trends, and key metrics for your retention operations.",
      icon: LayoutDashboard,
      colorClass: "text-emerald-600 dark:text-emerald-400",
      bgClass: "bg-emerald-50 dark:bg-emerald-950/30",
    },
  ];

  return (
    <div className="min-h-screen bg-background">
      <header className={`${colors.headerBg} text-white shadow-md sticky top-0 z-50`}>
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between gap-2">
          <div className="flex items-center gap-3">
            <Shield className="w-6 h-6" />
            <div>
              <h1 className="text-lg font-bold leading-tight" data-testid="text-provider-name-home">{displayName}</h1>
              <p className="text-xs opacity-80">Customer Retention Portal</p>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-8">
        <div className="mb-8">
          <h2 className="text-xl font-bold text-foreground" data-testid="text-home-welcome">Welcome back</h2>
          <p className="text-sm text-muted-foreground mt-1">Select a section to get started</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {sections.map((section) => {
            const Icon = section.icon;
            return (
              <Card
                key={section.key}
                className="p-6 cursor-pointer hover-elevate overflow-visible"
                onClick={() => onNavigate(section.key)}
                data-testid={`card-nav-${section.key}`}
              >
                <div className="flex flex-col gap-4">
                  <div className={`w-12 h-12 rounded-md ${section.bgClass} flex items-center justify-center`}>
                    <Icon className={`w-6 h-6 ${section.colorClass}`} />
                  </div>
                  <div className="space-y-1">
                    <h3 className="text-lg font-semibold text-foreground">{section.title}</h3>
                    <p className="text-sm text-muted-foreground leading-relaxed">{section.description}</p>
                  </div>
                  <div className="flex items-center gap-1 text-sm font-medium text-muted-foreground mt-2">
                    Open <ChevronRight className="w-4 h-4" />
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      </main>
      <Toaster />
    </div>
  );
}

function DashboardView({ provider, onBack }: { provider: string; onBack: () => void }) {
  const colors = getProviderColors(provider);
  const displayName = formatProviderDisplayName(provider);

  return (
    <div className="min-h-screen bg-background">
      <header className={`${colors.headerBg} text-white shadow-md sticky top-0 z-50`}>
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between gap-2">
          <div className="flex items-center gap-3">
            <Button
              size="icon"
              variant="ghost"
              className="text-white no-default-hover-elevate"
              onClick={onBack}
              data-testid="button-dashboard-back"
            >
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div>
              <h1 className="text-lg font-bold leading-tight" data-testid="text-provider-name-dashboard">{displayName}</h1>
              <p className="text-xs opacity-80">Dashboard</p>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-16">
        <div className="flex items-center justify-center">
          <div className="text-center space-y-4">
            <div className="w-16 h-16 rounded-md bg-emerald-50 dark:bg-emerald-950/30 flex items-center justify-center mx-auto">
              <LayoutDashboard className="w-8 h-8 text-emerald-600 dark:text-emerald-400" />
            </div>
            <h2 className="text-lg font-semibold text-foreground" data-testid="text-dashboard-title">Dashboard</h2>
            <p className="text-sm text-muted-foreground max-w-sm mx-auto" data-testid="text-dashboard-placeholder">
              Performance analytics and retention metrics will appear here.
            </p>
          </div>
        </div>
      </main>
      <Toaster />
    </div>
  );
}

export default function CustomerAgentPage() {
  const [stage, setStage] = useState<"login" | "home" | "retention" | "dashboard">(() => {
    const hasProvider = sessionStorage.getItem("customer_agent_provider");
    if (hasProvider) return "home";
    return "login";
  });
  const [provider, setProvider] = useState(() => sessionStorage.getItem("customer_agent_provider") || "");

  if (stage === "login") {
    return (
      <EmailLoginPage
        onLogin={(_email, prov) => {
          setProvider(prov);
          setStage("home");
        }}
      />
    );
  }

  if (stage === "home") {
    return <HomeScreen provider={provider} onNavigate={(view) => setStage(view)} />;
  }

  if (stage === "dashboard") {
    return <DashboardView provider={provider} onBack={() => setStage("home")} />;
  }

  return <AgentDashboard provider={provider} onBack={() => setStage("home")} />;
}
