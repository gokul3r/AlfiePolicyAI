import { useState, useEffect, useCallback, useRef } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Bell, Mail, Shield, CheckCircle2, XCircle, Clock, ArrowRight, AlertTriangle, X, ChevronRight, LayoutDashboard, ArrowLeft, Users, UserMinus, TrendingDown, DollarSign, MessageCircle, Send, Mic, MicOff, Phone, PhoneOff } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Toaster } from "@/components/ui/toaster";
import type { Negotiation, LiveNegotiation } from "@shared/schema";
import { io as socketIO, type Socket } from "socket.io-client";

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

type StatFilter = null | "pending" | "matched" | "partial" | "declined";

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
  const [activeFilter, setActiveFilter] = useState<StatFilter>(null);
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

  const filteredNegotiations = activeFilter === null ? [] : negotiations.filter((n) => {
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
                    onClick={() => { setActiveFilter(isActive ? null : stat.key); if (isActive) setSelectedNegotiationId(null); }}
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

            {activeFilter !== null && (
              <div className="flex items-center gap-2">
                <p className="text-sm text-muted-foreground" data-testid="text-active-filter">
                  Showing: <span className="font-medium text-foreground">{statCards.find(s => s.key === activeFilter)?.label}</span>
                </p>
                <Button size="sm" variant="ghost" onClick={() => { setActiveFilter(null); setSelectedNegotiationId(null); }} data-testid="button-clear-filter">
                  <X className="w-3 h-3 mr-1" /> Clear
                </Button>
              </div>
            )}

            {activeFilter === null ? (
              negotiations.length === 0 ? (
                <div className="flex items-center justify-center py-16">
                  <div className="text-center space-y-3">
                    <Bell className="w-10 h-10 mx-auto text-muted-foreground/40" />
                    <h2 className="text-base font-semibold text-foreground">No Retention Requests Yet</h2>
                    <p className="text-sm text-muted-foreground max-w-xs mx-auto">
                      When a customer receives a competitive quote, retention requests will appear here.
                    </p>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-4" data-testid="text-select-prompt">
                  Select a category above to view requests
                </p>
              )
            ) : filteredNegotiations.length === 0 ? (
              <div className="flex items-center justify-center py-16">
                <div className="text-center space-y-3">
                  <Bell className="w-10 h-10 mx-auto text-muted-foreground/40" />
                  <h2 className="text-base font-semibold text-foreground">No Results</h2>
                  <p className="text-sm text-muted-foreground max-w-xs mx-auto">
                    No negotiations match the selected filter.
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

function HomeScreen({ provider, onNavigate, liveChatCount }: { provider: string; onNavigate: (view: "retention" | "dashboard" | "livechat") => void; liveChatCount: number }) {
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
      badge: 0,
    },
    {
      key: "livechat" as const,
      title: "Live Chat",
      description: "Join live negotiation chats with AutoAnnie, an AI insurance advisor representing customers in real time.",
      icon: MessageCircle,
      colorClass: "text-violet-600 dark:text-violet-400",
      bgClass: "bg-violet-50 dark:bg-violet-950/30",
      badge: liveChatCount,
    },
    {
      key: "dashboard" as const,
      title: "Dashboard",
      description: "View performance analytics, trends, and key metrics for your retention operations.",
      icon: LayoutDashboard,
      colorClass: "text-emerald-600 dark:text-emerald-400",
      bgClass: "bg-emerald-50 dark:bg-emerald-950/30",
      badge: 0,
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
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="text-lg font-semibold text-foreground">{section.title}</h3>
                      {section.badge > 0 && (
                        <Badge variant="outline" className="text-xs bg-violet-50 dark:bg-violet-950/30 text-violet-700 dark:text-violet-300 border-violet-300 dark:border-violet-700" data-testid={`badge-${section.key}-count`}>
                          {section.badge} active
                        </Badge>
                      )}
                    </div>
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
  const [negotiations, setNegotiations] = useState<Negotiation[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchNegotiations = useCallback(async () => {
    try {
      const res = await fetch(`/api/negotiations?provider=${encodeURIComponent(provider)}`);
      if (res.ok) {
        const data = await res.json();
        setNegotiations(data);
      }
    } catch {
    } finally {
      setIsLoading(false);
    }
  }, [provider]);

  useEffect(() => {
    fetchNegotiations();
    const interval = setInterval(fetchNegotiations, 5000);
    return () => clearInterval(interval);
  }, [fetchNegotiations]);

  const retained = negotiations.filter((n) => n.customer_outcome === "stayed").length;
  const lost = negotiations.filter((n) => n.customer_outcome === "switched").length;

  let marginConceded = 0;
  negotiations.forEach((n) => {
    if (
      n.original_policy_cost &&
      n.agent_offer_price &&
      n.agent_offer_price < n.original_policy_cost &&
      n.status !== "pending"
    ) {
      marginConceded += n.original_policy_cost - n.agent_offer_price;
    }
  });

  let revenueLost = 0;
  negotiations.forEach((n) => {
    if (n.customer_outcome === "switched" && n.original_policy_cost) {
      revenueLost += n.original_policy_cost;
    }
  });

  const retentionMetrics = [
    {
      label: "Customers Retained",
      value: retained,
      icon: Users,
      colorClass: "text-green-600 dark:text-green-400",
      bgClass: "bg-green-50 dark:bg-green-950/30",
    },
    {
      label: "Customers Lost",
      value: lost,
      icon: UserMinus,
      colorClass: "text-red-600 dark:text-red-400",
      bgClass: "bg-red-50 dark:bg-red-950/30",
    },
  ];

  const financialMetrics = [
    {
      label: "Margin Conceded",
      value: `£${marginConceded.toFixed(2)}`,
      icon: TrendingDown,
      colorClass: "text-amber-600 dark:text-amber-400",
      bgClass: "bg-amber-50 dark:bg-amber-950/30",
    },
    {
      label: "Revenue Lost",
      value: `£${revenueLost.toFixed(2)}`,
      icon: DollarSign,
      colorClass: "text-red-600 dark:text-red-400",
      bgClass: "bg-red-50 dark:bg-red-950/30",
    },
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

      <main className="max-w-5xl mx-auto px-4 py-6 space-y-8">
        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <div className="text-center space-y-3">
              <div className="w-8 h-8 border-2 border-muted-foreground/30 border-t-muted-foreground rounded-full animate-spin mx-auto" />
              <p className="text-sm text-muted-foreground">Loading dashboard...</p>
            </div>
          </div>
        ) : (
          <>
            <div data-testid="section-retention-outcomes">
              <div className="flex items-center gap-2 mb-4">
                <div className="p-1.5 rounded-md bg-blue-50 dark:bg-blue-950/30">
                  <Users className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                </div>
                <h2 className="text-base font-semibold text-foreground" data-testid="text-section-retention">Retention Outcomes</h2>
              </div>
              <div className="grid grid-cols-2 gap-3">
                {retentionMetrics.map((metric) => {
                  const Icon = metric.icon;
                  return (
                    <Card key={metric.label} className="p-5 overflow-visible" data-testid={`metric-${metric.label.toLowerCase().replace(/\s+/g, "-")}`}>
                      <div className="flex items-start justify-between gap-2">
                        <div className="space-y-2 min-w-0">
                          <p className="text-xs font-medium text-muted-foreground">{metric.label}</p>
                          <p className="text-3xl font-bold text-foreground">{metric.value}</p>
                        </div>
                        <div className={`p-2.5 rounded-md ${metric.bgClass}`}>
                          <Icon className={`w-5 h-5 ${metric.colorClass}`} />
                        </div>
                      </div>
                    </Card>
                  );
                })}
              </div>
            </div>

            <div data-testid="section-financial-impact">
              <div className="flex items-center gap-2 mb-4">
                <div className="p-1.5 rounded-md bg-amber-50 dark:bg-amber-950/30">
                  <TrendingDown className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                </div>
                <h2 className="text-base font-semibold text-foreground" data-testid="text-section-financial">Financial Impact</h2>
              </div>
              <div className="grid grid-cols-2 gap-3">
                {financialMetrics.map((metric) => {
                  const Icon = metric.icon;
                  return (
                    <Card key={metric.label} className="p-5 overflow-visible" data-testid={`metric-${metric.label.toLowerCase().replace(/\s+/g, "-")}`}>
                      <div className="flex items-start justify-between gap-2">
                        <div className="space-y-2 min-w-0">
                          <p className="text-xs font-medium text-muted-foreground">{metric.label}</p>
                          <p className="text-3xl font-bold text-foreground">{metric.value}</p>
                        </div>
                        <div className={`p-2.5 rounded-md ${metric.bgClass}`}>
                          <Icon className={`w-5 h-5 ${metric.colorClass}`} />
                        </div>
                      </div>
                    </Card>
                  );
                })}
              </div>
              {(retained + lost) > 0 && (
                <div className="mt-3 px-1 flex items-center gap-2" data-testid="metric-retention-rate">
                  <span className="text-sm text-muted-foreground">Retention Rate:</span>
                  <span className="text-sm font-semibold text-foreground">
                    {Math.round((retained / (retained + lost)) * 100)}%
                  </span>
                  <span className="text-xs text-muted-foreground">
                    ({retained} retained / {retained + lost} total)
                  </span>
                </div>
              )}
            </div>

            {retained === 0 && lost === 0 && (
              <p className="text-sm text-muted-foreground text-center pt-2" data-testid="text-no-outcomes">
                No customer outcomes recorded yet. Metrics will update as customers make their decisions.
              </p>
            )}
          </>
        )}
      </main>
      <Toaster />
    </div>
  );
}

interface LiveChatMsg {
  id: number;
  negotiation_id: number;
  sender: string;
  message: string;
  created_at: string;
}

function AgentChatRoom({
  negotiation,
  providerColors,
}: {
  negotiation: LiveNegotiation;
  providerColors: ReturnType<typeof getProviderColors>;
}) {
  const [messages, setMessages] = useState<LiveChatMsg[]>([]);
  const [inputText, setInputText] = useState("");
  const [isAutoAnnieTyping, setIsAutoAnnieTyping] = useState(false);
  const [isClosed, setIsClosed] = useState(negotiation.status === "completed");
  const [outcome, setOutcome] = useState<string | null>(negotiation.outcome);
  const socketRef = useRef<Socket | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

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
      socket.emit("join_negotiation", { roomId: negotiation.socket_room_id, role: "agent" });
    });

    socket.on("message_history", (history: LiveChatMsg[]) => {
      setMessages(history);
    });

    socket.on("new_message", (msg: LiveChatMsg) => {
      setMessages((prev) => {
        if (prev.some(m => m.id === msg.id)) return prev;
        return [...prev, msg];
      });
    });

    socket.on("autoannie_typing", (typing: boolean) => {
      setIsAutoAnnieTyping(typing);
    });

    socket.on("negotiation_outcome", (data: any) => {
      setOutcome(data.outcome);
    });

    socket.on("negotiation_closed", () => {
      setIsClosed(true);
    });

    return () => {
      socket.disconnect();
    };
  }, [negotiation.socket_room_id]);

  const handleSend = () => {
    const text = inputText.trim();
    if (!text || isClosed) return;
    socketRef.current?.emit("agent_message", { roomId: negotiation.socket_room_id, message: text });
    setInputText("");
  };

  return (
    <div className="flex flex-col h-full" data-testid={`agent-chatroom-${negotiation.id}`}>
      <div className={`px-4 py-3 border-b ${providerColors.accent} ${providerColors.bg} flex items-center justify-between gap-2 flex-wrap shrink-0`}>
        <div className="flex items-center gap-3 min-w-0">
          <Avatar className="h-8 w-8 shrink-0">
            <AvatarFallback className="bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-400 text-xs font-semibold">
              AA
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <h4 className="text-sm font-semibold text-foreground truncate" data-testid="text-chat-customer-name">
              {negotiation.customer_name} — Policy {negotiation.policy_number}
            </h4>
            <p className="text-xs text-muted-foreground">
              AutoAnnie representing customer · {negotiation.vehicle_make} {negotiation.vehicle_model} ({negotiation.vehicle_year})
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {outcome && (
            <Badge variant="outline" className={`text-xs ${
              outcome === "matched" ? "bg-green-50 dark:bg-green-950/30 text-green-700 dark:text-green-300 border-green-300 dark:border-green-700" :
              outcome === "partially_matched" ? "bg-yellow-50 dark:bg-yellow-950/30 text-yellow-700 dark:text-yellow-300 border-yellow-300 dark:border-yellow-700" :
              "bg-red-50 dark:bg-red-950/30 text-red-700 dark:text-red-300 border-red-300 dark:border-red-700"
            }`} data-testid={`badge-outcome-${negotiation.id}`}>
              {outcome === "matched" ? "Matched" : outcome === "partially_matched" ? "Partial Match" : "Declined"}
            </Badge>
          )}
          {isClosed && (
            <Badge variant="outline" className="text-xs" data-testid={`badge-closed-${negotiation.id}`}>
              Closed
            </Badge>
          )}
        </div>
      </div>

      <div className="px-4 py-2 border-b border-border bg-muted/30 text-xs text-muted-foreground flex items-center justify-between gap-2 flex-wrap shrink-0">
        <span>Current: £{negotiation.current_premium.toFixed(2)}</span>
        <span>Competitor ({negotiation.competitor_name}): £{negotiation.competitor_quote.toFixed(2)}</span>
        {negotiation.final_offer_price && <span>Your Offer: £{negotiation.final_offer_price.toFixed(2)}</span>}
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-3 min-h-0">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-center space-y-2">
            <MessageCircle className="w-10 h-10 text-muted-foreground/40" />
            <p className="text-sm text-muted-foreground">Connecting to AutoAnnie...</p>
          </div>
        )}

        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex gap-2.5 ${msg.sender === "agent" ? "justify-end" : "justify-start"}`}
            data-testid={`agent-msg-${msg.sender}-${msg.id}`}
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
                msg.sender === "agent"
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-foreground"
              }`}
            >
              <p className="whitespace-pre-wrap">{msg.message}</p>
              <p className={`text-[10px] mt-1 ${
                msg.sender === "agent" ? "text-primary-foreground/70" : "text-muted-foreground"
              }`}>
                {msg.sender === "agent" ? "You" : "AutoAnnie"}
                {" · "}
                {new Date(msg.created_at).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}
              </p>
            </div>
            {msg.sender === "agent" && (
              <Avatar className="h-7 w-7 shrink-0 mt-0.5">
                <AvatarFallback className={`${providerColors.bg} ${providerColors.primary} text-[10px] font-semibold`}>
                  AG
                </AvatarFallback>
              </Avatar>
            )}
          </div>
        ))}

        {isAutoAnnieTyping && (
          <div className="flex gap-2.5 justify-start" data-testid="agent-autoannie-typing">
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

      {!isClosed && (
        <div className="px-4 py-3 border-t border-border bg-background shrink-0">
          <div className="flex gap-2">
            <Input
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && handleSend()}
              placeholder="Type your response..."
              disabled={isClosed}
              data-testid={`input-agent-chat-${negotiation.id}`}
            />
            <Button
              size="icon"
              onClick={handleSend}
              disabled={!inputText.trim() || isClosed}
              data-testid={`button-send-${negotiation.id}`}
            >
              <Send className="w-4 h-4" />
            </Button>
          </div>
        </div>
      )}

      {isClosed && (
        <div className="px-4 py-3 border-t border-border bg-muted/30 text-center shrink-0">
          <p className="text-sm text-muted-foreground" data-testid={`text-chat-closed-${negotiation.id}`}>
            This negotiation has been closed.
          </p>
        </div>
      )}
    </div>
  );
}

function VoiceAgentChatRoom({
  negotiation,
  providerColors,
}: {
  negotiation: LiveNegotiation;
  providerColors: ReturnType<typeof getProviderColors>;
}) {
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isMicActive, setIsMicActive] = useState(false);
  const [transcript, setTranscript] = useState<{ sender: string; text: string }[]>([]);
  const [isClosed, setIsClosed] = useState(negotiation.status === "completed");
  const wsRef = useRef<WebSocket | null>(null);
  const micContextRef = useRef<AudioContext | null>(null);
  const playbackContextRef = useRef<AudioContext | null>(null);
  const nextPlayTimeRef = useRef(0);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const socketRef = useRef<Socket | null>(null);
  const currentAgentTextRef = useRef("");
  const currentAATextRef = useRef("");

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [transcript]);

  useEffect(() => {
    const socket = socketIO({ path: "/socket.io", transports: ["websocket"] });
    socketRef.current = socket;
    socket.on("connect", () => {
      socket.emit("join_negotiation", { roomId: negotiation.socket_room_id, role: "agent" });
    });
    socket.on("negotiation_closed", () => setIsClosed(true));
    return () => { socket.disconnect(); };
  }, [negotiation.socket_room_id]);

  const connectVoice = async () => {
    if (isConnecting || isConnected) return;
    setIsConnecting(true);
    try {
      const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
      const ws = new WebSocket(
        `${protocol}//${window.location.host}/api/voice-negotiation?negotiationId=${negotiation.id}&roomId=${encodeURIComponent(negotiation.socket_room_id)}`
      );
      wsRef.current = ws;

      ws.onopen = () => {
        console.log("[VoiceNego] WebSocket connected");
      };

      ws.onmessage = (event) => {
        const msg = JSON.parse(event.data);

        if (msg.type === "session_ready") {
          setIsConnecting(false);
          setIsConnected(true);
          startMicrophone();
        }

        if (msg.type === "audio") {
          playAudio(msg.audio);
        }

        if (msg.type === "user_transcript_delta") {
          currentAgentTextRef.current += msg.delta;
        }

        if (msg.type === "assistant_transcript_delta") {
          currentAATextRef.current += msg.delta;
        }

        if (msg.type === "turn_complete") {
          if (msg.userTranscript) {
            setTranscript((prev) => [...prev, { sender: "agent", text: msg.userTranscript }]);
          }
          if (msg.assistantTranscript) {
            const clean = msg.assistantTranscript
              .replace(/\[OUTCOME:(ACCEPTED|REJECTED|CONSIDERING):£[\d.]+\]/g, "")
              .trim();
            if (clean) {
              setTranscript((prev) => [...prev, { sender: "autoannie", text: clean }]);
            }
          }
          currentAgentTextRef.current = "";
          currentAATextRef.current = "";
        }

        if (msg.type === "session_closed" || msg.type === "error") {
          setIsConnecting(false);
          setIsConnected(false);
          setIsMicActive(false);
        }
      };

      ws.onclose = () => {
        setIsConnecting(false);
        setIsConnected(false);
        setIsMicActive(false);
        stopMicrophone();
      };

      ws.onerror = () => {
        setIsConnecting(false);
        setIsConnected(false);
      };
    } catch (error) {
      console.error("[VoiceNego] Connection error:", error);
      setIsConnecting(false);
    }
  };

  const startMicrophone = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { sampleRate: 16000, channelCount: 1, echoCancellation: true, noiseSuppression: true }
      });
      mediaStreamRef.current = stream;

      const micCtx = new AudioContext({ sampleRate: 16000 });
      micContextRef.current = micCtx;
      const source = micCtx.createMediaStreamSource(stream);
      const processor = micCtx.createScriptProcessor(4096, 1, 1);
      processorRef.current = processor;

      processor.onaudioprocess = (e) => {
        if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;
        const inputData = e.inputBuffer.getChannelData(0);
        const pcm16 = new Int16Array(inputData.length);
        for (let i = 0; i < inputData.length; i++) {
          const s = Math.max(-1, Math.min(1, inputData[i]));
          pcm16[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
        }
        const base64 = btoa(String.fromCharCode(...new Uint8Array(pcm16.buffer)));
        wsRef.current.send(JSON.stringify({ type: "audio", audio: base64 }));
      };

      source.connect(processor);
      processor.connect(micCtx.destination);

      if (!playbackContextRef.current || playbackContextRef.current.state === "closed") {
        playbackContextRef.current = new AudioContext({ sampleRate: 24000 });
      }
      nextPlayTimeRef.current = 0;

      setIsMicActive(true);
    } catch (error) {
      console.error("[VoiceNego] Mic error:", error);
    }
  };

  const stopMicrophone = () => {
    processorRef.current?.disconnect();
    mediaStreamRef.current?.getTracks().forEach((t) => t.stop());
    if (micContextRef.current && micContextRef.current.state !== "closed") {
      micContextRef.current.close();
    }
    setIsMicActive(false);
  };

  const playAudio = (base64Audio: string) => {
    try {
      if (!playbackContextRef.current || playbackContextRef.current.state === "closed") {
        playbackContextRef.current = new AudioContext({ sampleRate: 24000 });
        nextPlayTimeRef.current = 0;
      }
      const ctx = playbackContextRef.current;
      const binaryString = atob(base64Audio);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      const pcm16 = new Int16Array(bytes.buffer);
      const float32 = new Float32Array(pcm16.length);
      for (let i = 0; i < pcm16.length; i++) {
        float32[i] = pcm16[i] / 32768;
      }
      const buffer = ctx.createBuffer(1, float32.length, 24000);
      buffer.getChannelData(0).set(float32);
      const source = ctx.createBufferSource();
      source.buffer = buffer;
      source.connect(ctx.destination);
      const startTime = Math.max(ctx.currentTime, nextPlayTimeRef.current);
      source.start(startTime);
      nextPlayTimeRef.current = startTime + buffer.duration;
    } catch {
    }
  };

  const handleDisconnect = () => {
    wsRef.current?.close();
    stopMicrophone();
    if (playbackContextRef.current && playbackContextRef.current.state !== "closed") {
      playbackContextRef.current.close();
    }
    nextPlayTimeRef.current = 0;
    setIsConnected(false);
  };

  useEffect(() => {
    return () => {
      wsRef.current?.close();
      stopMicrophone();
      if (playbackContextRef.current && playbackContextRef.current.state !== "closed") {
        playbackContextRef.current.close();
      }
    };
  }, []);

  return (
    <div className="flex flex-col h-full" data-testid={`voice-chatroom-${negotiation.id}`}>
      <div className={`px-4 py-3 border-b ${providerColors.accent} ${providerColors.bg} flex items-center justify-between gap-2 flex-wrap shrink-0`}>
        <div className="flex items-center gap-3 min-w-0">
          <Avatar className="h-8 w-8 shrink-0">
            <AvatarFallback className="bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-400 text-xs font-semibold">
              AA
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <h4 className="text-sm font-semibold text-foreground truncate">
              {negotiation.customer_name} — Policy {negotiation.policy_number}
            </h4>
            <p className="text-xs text-muted-foreground">
              Voice Negotiation · {negotiation.vehicle_make} {negotiation.vehicle_model} ({negotiation.vehicle_year})
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className={`text-xs ${isConnected ? "bg-green-50 dark:bg-green-950/30 text-green-700 dark:text-green-300 border-green-300 dark:border-green-700" : "bg-muted text-muted-foreground"}`}>
            {isConnected ? "Connected" : "Disconnected"}
          </Badge>
          {isMicActive && (
            <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {!isConnected && !isConnecting && !isClosed && transcript.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full space-y-4">
            <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center">
              <Phone className="w-10 h-10 text-primary" />
            </div>
            <p className="text-sm text-muted-foreground text-center max-w-xs">
              Click the button below to connect and start the voice negotiation with AutoAnnie
            </p>
            <Button onClick={connectVoice} className="gap-2" data-testid="button-connect-voice">
              <Phone className="w-4 h-4" />
              Join Voice Call
            </Button>
          </div>
        )}

        {transcript.map((entry, i) => (
          <div
            key={i}
            className={`flex gap-2 ${entry.sender === "agent" ? "flex-row-reverse" : "flex-row"}`}
          >
            <Avatar className="h-7 w-7 shrink-0 mt-1">
              <AvatarFallback className={`text-[10px] font-semibold ${
                entry.sender === "agent"
                  ? "bg-indigo-100 dark:bg-indigo-900 text-indigo-600 dark:text-indigo-400"
                  : "bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-400"
              }`}>
                {entry.sender === "agent" ? "AG" : "AA"}
              </AvatarFallback>
            </Avatar>
            <div className={`max-w-[75%] rounded-lg px-3 py-2 text-sm ${
              entry.sender === "agent"
                ? "bg-primary text-primary-foreground"
                : "bg-muted"
            }`}>
              <p>{entry.text}</p>
            </div>
          </div>
        ))}

        <div ref={messagesEndRef} />
      </div>

      {(isConnecting || isConnected) && !isClosed && (
        <div className="px-4 py-3 border-t border-border flex items-center justify-center gap-4 shrink-0">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            {isConnecting ? (
              <><div className="w-3 h-3 rounded-full bg-yellow-500 animate-pulse" /> Connecting to AutoAnnie...</>
            ) : isMicActive ? (
              <><Mic className="w-4 h-4 text-red-500 animate-pulse" /> Mic active — speak to AutoAnnie</>
            ) : (
              <><MicOff className="w-4 h-4" /> Mic off</>
            )}
          </div>
          <Button size="icon" variant="destructive" onClick={handleDisconnect} data-testid="button-end-voice-call">
            <PhoneOff className="w-4 h-4" />
          </Button>
        </div>
      )}

      {isClosed && (
        <div className="px-4 py-3 border-t border-border bg-muted/30 text-center shrink-0">
          <p className="text-sm text-muted-foreground">
            This voice negotiation has been closed.
          </p>
        </div>
      )}
    </div>
  );
}

function LiveChatView({ provider, onBack }: { provider: string; onBack: () => void }) {
  const colors = getProviderColors(provider);
  const displayName = formatProviderDisplayName(provider);
  const [negotiations, setNegotiations] = useState<LiveNegotiation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedNegotiation, setSelectedNegotiation] = useState<LiveNegotiation | null>(null);
  const [activeFilter, setActiveFilter] = useState<"pending" | "completed" | null>(null);
  const [resolvingId, setResolvingId] = useState<number | null>(null);

  const fetchNegotiations = useCallback(async () => {
    try {
      const res = await fetch(`/api/live-negotiations/provider/${encodeURIComponent(provider)}`);
      if (res.ok) {
        const data = await res.json();
        setNegotiations(data);
      }
    } catch {
    } finally {
      setIsLoading(false);
    }
  }, [provider]);

  useEffect(() => {
    fetchNegotiations();
    const interval = setInterval(fetchNegotiations, 5000);
    return () => clearInterval(interval);
  }, [fetchNegotiations]);

  const isPending = (n: LiveNegotiation) => n.status === "pending" || n.status === "active";
  const isCompleted = (n: LiveNegotiation) => !isPending(n);

  const handleResolve = async (e: React.MouseEvent, negoId: number) => {
    e.stopPropagation();
    setResolvingId(negoId);
    try {
      await fetch(`/api/live-negotiations/${negoId}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "completed" }),
      });
      await fetchNegotiations();
    } finally {
      setResolvingId(null);
    }
  };

  const formatRequestTime = (createdAt: string | Date) => {
    const date = new Date(createdAt);
    return date.toLocaleString("en-GB", {
      day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit", hour12: true
    });
  };

  const counts = {
    pending: negotiations.filter(isPending).length,
    completed: negotiations.filter(isCompleted).length,
  };

  const filteredNegotiations = activeFilter === null ? [] : negotiations.filter(
    activeFilter === "pending" ? isPending : isCompleted
  );

  const statCards = [
    {
      key: "pending" as const,
      label: "Pending Requests",
      count: counts.pending,
      icon: Clock,
      colorClass: "text-yellow-600 dark:text-yellow-400",
      bgClass: "bg-yellow-50 dark:bg-yellow-950/30",
      borderClass: "border-yellow-200 dark:border-yellow-800",
      actionLabel: counts.pending > 0 ? "Action Required" : undefined,
    },
    {
      key: "completed" as const,
      label: "Completed Requests",
      count: counts.completed,
      icon: CheckCircle2,
      colorClass: "text-green-600 dark:text-green-400",
      bgClass: "bg-green-50 dark:bg-green-950/30",
      borderClass: "border-green-200 dark:border-green-800",
    },
  ];

  if (selectedNegotiation) {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        <header className={`${colors.headerBg} text-white shadow-md sticky top-0 z-50`}>
          <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between gap-2">
            <div className="flex items-center gap-3">
              <Button size="icon" variant="ghost" className="text-white" onClick={() => setSelectedNegotiation(null)} data-testid="button-back-to-chat-list">
                <ArrowLeft className="w-5 h-5" />
              </Button>
              <div>
                <h1 className="text-lg font-bold leading-tight" data-testid="text-chat-title">
                  {selectedNegotiation.mode === "voice" ? "Voice Call" : "Live Chat"}
                </h1>
                <p className="text-xs opacity-80">{selectedNegotiation.customer_name} — {selectedNegotiation.vehicle_make} {selectedNegotiation.vehicle_model}</p>
              </div>
            </div>
          </div>
        </header>
        <div className="flex-1 max-w-5xl mx-auto w-full overflow-hidden">
          {selectedNegotiation.mode === "voice" ? (
            <VoiceAgentChatRoom negotiation={selectedNegotiation} providerColors={colors} />
          ) : (
            <AgentChatRoom negotiation={selectedNegotiation} providerColors={colors} />
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className={`${colors.headerBg} text-white shadow-md sticky top-0 z-50`}>
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between gap-2">
          <div className="flex items-center gap-3">
            <Button size="icon" variant="ghost" className="text-white" onClick={onBack} data-testid="button-back-from-livechat">
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div>
              <h1 className="text-lg font-bold leading-tight" data-testid="text-livechat-heading">{displayName}</h1>
              <p className="text-xs opacity-80">Live Chat Negotiations</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <MessageCircle className="w-5 h-5" />
            {counts.pending > 0 && (
              <span className="bg-white/20 rounded-full px-2 py-0.5 text-xs font-semibold" data-testid="text-live-chat-count">
                {counts.pending}
              </span>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-6 space-y-4">
        {isLoading ? (
          <div className="grid grid-cols-2 gap-3">
            {[1, 2].map((i) => (
              <Card key={i} className="p-4 animate-pulse overflow-visible">
                <div className="h-4 bg-muted rounded w-1/2 mb-3" />
                <div className="h-7 bg-muted rounded w-1/4" />
              </Card>
            ))}
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3" data-testid="live-chat-stat-cards">
              {statCards.map((stat) => {
                const Icon = stat.icon;
                const isActive = activeFilter === stat.key;
                return (
                  <Card
                    key={stat.key}
                    className={`p-4 cursor-pointer hover-elevate transition-colors overflow-visible ${isActive ? `${stat.bgClass} border ${stat.borderClass}` : ""}`}
                    onClick={() => setActiveFilter(isActive ? null : stat.key)}
                    data-testid={`stat-card-livechat-${stat.key}`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="space-y-1 min-w-0">
                        <p className="text-xs font-medium text-muted-foreground truncate">{stat.label}</p>
                        <p className="text-2xl font-bold text-foreground" data-testid={`stat-count-livechat-${stat.key}`}>{stat.count}</p>
                      </div>
                      <div className={`p-2 rounded-md ${stat.bgClass}`}>
                        <Icon className={`w-4 h-4 ${stat.colorClass}`} />
                      </div>
                    </div>
                    {stat.actionLabel && (
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

            {activeFilter !== null && (
              <div className="flex items-center gap-2">
                <p className="text-sm text-muted-foreground" data-testid="text-livechat-active-filter">
                  Showing: <span className="font-medium text-foreground">{statCards.find(s => s.key === activeFilter)?.label}</span>
                </p>
                <Button size="sm" variant="ghost" onClick={() => setActiveFilter(null)} data-testid="button-livechat-clear-filter">
                  <X className="w-3 h-3 mr-1" /> Clear
                </Button>
              </div>
            )}

            {activeFilter === null ? (
              negotiations.length === 0 ? (
                <div className="text-center py-16">
                  <MessageCircle className="w-16 h-16 text-muted-foreground/30 mx-auto mb-4" />
                  <h2 className="text-base font-semibold text-foreground" data-testid="text-no-live-chats">No Active Live Chats</h2>
                  <p className="text-sm text-muted-foreground mt-1 max-w-sm mx-auto">
                    When a customer initiates a live negotiation, it will appear here for you to join and respond.
                  </p>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-4" data-testid="text-select-prompt">
                  Select a category above to view negotiations
                </p>
              )
            ) : filteredNegotiations.length === 0 ? (
              <div className="text-center py-12">
                <MessageCircle className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
                <p className="text-sm text-muted-foreground">
                  No {activeFilter === "pending" ? "pending" : "completed"} negotiations
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {filteredNegotiations.map((nego) => (
                  <Card
                    key={nego.id}
                    className="overflow-visible cursor-pointer hover-elevate"
                    onClick={() => setSelectedNegotiation(nego)}
                    data-testid={`card-live-nego-${nego.id}`}
                  >
                    <div className={`px-4 py-3 border-b ${colors.accent} ${colors.bg} rounded-t-md`}>
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <div className="flex items-center gap-2">
                          {nego.mode === "voice" ? (
                            <Mic className="w-4 h-4 text-muted-foreground" />
                          ) : (
                            <MessageCircle className="w-4 h-4 text-muted-foreground" />
                          )}
                          <span className="text-sm font-semibold text-foreground">
                            {nego.mode === "voice" ? "Voice Negotiation" : "Live Negotiation"}
                          </span>
                          <span className="text-xs text-muted-foreground" data-testid={`text-nego-time-${nego.id}`}>
                            {formatRequestTime(nego.created_at)}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className={`text-xs ${
                            nego.status === "pending" ? "bg-yellow-50 dark:bg-yellow-950/30 text-yellow-700 dark:text-yellow-300 border-yellow-300 dark:border-yellow-700" :
                            nego.status === "active" ? "bg-green-50 dark:bg-green-950/30 text-green-700 dark:text-green-300 border-green-300 dark:border-green-700" :
                            "bg-muted text-muted-foreground"
                          }`} data-testid={`badge-status-${nego.id}`}>
                            {nego.status === "pending" ? (
                              <><Clock className="w-3 h-3 mr-1" /> Waiting</>
                            ) : nego.status === "active" ? (
                              <><CheckCircle2 className="w-3 h-3 mr-1" /> Active</>
                            ) : (
                              <><CheckCircle2 className="w-3 h-3 mr-1" /> {nego.status}</>
                            )}
                          </Badge>
                          {isPending(nego) && (
                            <Button
                              size="icon"
                              variant="ghost"
                              className="text-green-600 dark:text-green-400"
                              onClick={(e) => handleResolve(e, nego.id)}
                              disabled={resolvingId === nego.id}
                              data-testid={`button-resolve-${nego.id}`}
                              title="Mark as resolved"
                            >
                              <CheckCircle2 className="w-4 h-4" />
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="p-4 space-y-2">
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <span className="text-sm font-medium text-foreground" data-testid={`text-nego-customer-${nego.id}`}>
                          {nego.customer_name}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {nego.vehicle_make} {nego.vehicle_model} ({nego.vehicle_year})
                        </span>
                      </div>
                      <div className="flex items-center justify-between gap-2 flex-wrap text-xs text-muted-foreground">
                        <span>Current: £{nego.current_premium.toFixed(2)}</span>
                        <span>Competitor: £{nego.competitor_quote.toFixed(2)} ({nego.competitor_name})</span>
                      </div>
                      <div className="flex items-center gap-1 text-sm font-medium text-muted-foreground mt-2">
                        {nego.mode === "voice"
                          ? (nego.status === "pending" ? "Join Voice Call" : "Open Voice Call")
                          : (nego.status === "pending" ? "Join Chat" : "Open Chat")
                        } <ChevronRight className="w-4 h-4" />
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </>
        )}
      </main>
      <Toaster />
    </div>
  );
}

export default function CustomerAgentPage() {
  const [stage, setStage] = useState<"login" | "home" | "retention" | "dashboard" | "livechat">(() => {
    const hasProvider = sessionStorage.getItem("customer_agent_provider");
    if (hasProvider) return "home";
    return "login";
  });
  const [provider, setProvider] = useState(() => sessionStorage.getItem("customer_agent_provider") || "");
  const [liveChatCount, setLiveChatCount] = useState(0);

  useEffect(() => {
    if (!provider) return;
    const fetchCount = async () => {
      try {
        const res = await fetch(`/api/live-negotiations/provider/${encodeURIComponent(provider)}`);
        if (res.ok) {
          const data = await res.json();
          setLiveChatCount(data.length);
        }
      } catch {}
    };
    fetchCount();
    const interval = setInterval(fetchCount, 5000);
    return () => clearInterval(interval);
  }, [provider]);

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
    return <HomeScreen provider={provider} onNavigate={(view) => setStage(view)} liveChatCount={liveChatCount} />;
  }

  if (stage === "dashboard") {
    return <DashboardView provider={provider} onBack={() => setStage("home")} />;
  }

  if (stage === "livechat") {
    return <LiveChatView provider={provider} onBack={() => setStage("home")} />;
  }

  return <AgentDashboard provider={provider} onBack={() => setStage("home")} />;
}
