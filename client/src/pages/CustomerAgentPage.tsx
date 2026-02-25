import { useState, useEffect, useCallback } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Bell, Lock, Mail, Shield, CheckCircle2, XCircle, Clock, ArrowRight } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Toaster } from "@/components/ui/toaster";
import type { Negotiation } from "@shared/schema";

const ACCESS_KEY = "AA@ITCTO";

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

function GatePage({ onAccess }: { onAccess: () => void }) {
  const [key, setKey] = useState("");
  const [error, setError] = useState("");
  const [isShaking, setIsShaking] = useState(false);

  const handleSubmit = () => {
    if (key === ACCESS_KEY) {
      sessionStorage.setItem("customer_agent_access_granted", "true");
      onAccess();
    } else {
      setError("Invalid access key. Please try again.");
      setIsShaking(true);
      setTimeout(() => setIsShaking(false), 500);
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
      <div className="w-full max-w-sm space-y-6 text-center">
        <div className="flex items-center justify-center gap-2 mb-2">
          <Shield className="w-8 h-8 text-blue-400" />
          <h1 className="text-2xl font-bold text-white">Provider Portal</h1>
        </div>
        <p className="text-sm text-slate-400">Customer Support Agent Access</p>
        <div className={`space-y-3 ${isShaking ? "animate-shake" : ""}`}>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
            <Input
              type="password"
              placeholder="Enter access key"
              value={key}
              onChange={(e) => { setKey(e.target.value); setError(""); }}
              onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
              className="pl-10 bg-slate-800 border-slate-700 text-white placeholder:text-slate-500"
              data-testid="input-agent-access-key"
            />
          </div>
          {error && <p className="text-xs text-red-400" data-testid="text-agent-gate-error">{error}</p>}
          <Button onClick={handleSubmit} className="w-full" data-testid="button-agent-access-submit">
            Access Portal
          </Button>
        </div>
      </div>
    </div>
  );
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
          <div className="pt-2 border-t border-border/50">
            <p className="text-xs text-muted-foreground">Your Response</p>
            <p className="text-sm font-medium text-foreground">
              {negotiation.decision_type === "match" ? "Matched" : negotiation.decision_type === "partial" ? "Partially Matched" : "Unable to Match"} at £{negotiation.agent_offer_price?.toFixed(2)}
            </p>
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

function AgentDashboard({ provider }: { provider: string }) {
  const [negotiations, setNegotiations] = useState<Negotiation[]>([]);
  const [pendingCount, setPendingCount] = useState(0);
  const [showNotifications, setShowNotifications] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
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
      setShowNotifications(false);
    } catch (error: any) {
      toast({ title: "Error", description: error.message || "Failed to submit response", variant: "destructive" });
    }
  };

  const pendingNegotiations = negotiations.filter((n) => n.status === "pending");
  const respondedNegotiations = negotiations.filter((n) => n.status !== "pending");

  return (
    <div className="min-h-screen bg-background">
      <header className={`${colors.headerBg} text-white shadow-md sticky top-0 z-50`}>
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between gap-2">
          <div className="flex items-center gap-3">
            <Shield className="w-6 h-6" />
            <div>
              <h1 className="text-lg font-bold leading-tight" data-testid="text-provider-name">{displayName}</h1>
              <p className="text-xs opacity-80">Customer Support Portal</p>
            </div>
          </div>
          <div className="relative">
            <Button
              size="icon"
              variant="ghost"
              className="text-white hover:bg-white/20 no-default-hover-elevate"
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
                {pendingNegotiations.length === 0 ? (
                  <div className="p-4 text-center text-sm text-muted-foreground">
                    No pending requests
                  </div>
                ) : (
                  <div className="p-2 space-y-2">
                    {pendingNegotiations.map((n) => (
                      <div
                        key={n.id}
                        className="p-3 rounded-md hover-elevate cursor-pointer bg-yellow-50/50 dark:bg-yellow-950/20 border border-yellow-200 dark:border-yellow-800"
                        onClick={() => { setShowNotifications(false); }}
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

      <main className="max-w-4xl mx-auto px-4 py-6 space-y-6">
        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <div className="text-center space-y-3">
              <div className="w-8 h-8 border-2 border-muted-foreground/30 border-t-muted-foreground rounded-full animate-spin mx-auto" />
              <p className="text-sm text-muted-foreground">Loading negotiations...</p>
            </div>
          </div>
        ) : negotiations.length === 0 ? (
          <div className="flex items-center justify-center py-20">
            <div className="text-center space-y-3">
              <Bell className="w-12 h-12 mx-auto text-muted-foreground/40" />
              <h2 className="text-lg font-semibold text-foreground">No Negotiations Yet</h2>
              <p className="text-sm text-muted-foreground max-w-xs mx-auto">
                When a customer receives a competitive quote, you'll see retention requests here.
              </p>
            </div>
          </div>
        ) : (
          <>
            {pendingNegotiations.length > 0 && (
              <section className="space-y-3">
                <h2 className="text-base font-semibold text-foreground flex items-center gap-2">
                  <Clock className="w-4 h-4 text-yellow-600 dark:text-yellow-400" />
                  Pending Requests ({pendingNegotiations.length})
                </h2>
                <div className="space-y-3">
                  {pendingNegotiations.map((n) => (
                    <NegotiationCard key={n.id} negotiation={n} providerColors={colors} onRespond={handleRespond} />
                  ))}
                </div>
              </section>
            )}
            {respondedNegotiations.length > 0 && (
              <section className="space-y-3">
                <h2 className="text-base font-semibold text-muted-foreground flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4" />
                  Previous Responses ({respondedNegotiations.length})
                </h2>
                <div className="space-y-3">
                  {respondedNegotiations.map((n) => (
                    <NegotiationCard key={n.id} negotiation={n} providerColors={colors} onRespond={handleRespond} />
                  ))}
                </div>
              </section>
            )}
          </>
        )}
      </main>
      <Toaster />
    </div>
  );
}

export default function CustomerAgentPage() {
  const [stage, setStage] = useState<"gate" | "login" | "dashboard">(() => {
    const hasAccess = sessionStorage.getItem("customer_agent_access_granted") === "true";
    const hasProvider = sessionStorage.getItem("customer_agent_provider");
    if (hasAccess && hasProvider) return "dashboard";
    if (hasAccess) return "login";
    return "gate";
  });
  const [provider, setProvider] = useState(() => sessionStorage.getItem("customer_agent_provider") || "");

  if (stage === "gate") {
    return <GatePage onAccess={() => setStage("login")} />;
  }

  if (stage === "login") {
    return (
      <EmailLoginPage
        onLogin={(_email, prov) => {
          setProvider(prov);
          setStage("dashboard");
        }}
      />
    );
  }

  return <AgentDashboard provider={provider} />;
}
