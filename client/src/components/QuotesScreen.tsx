import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ArrowLeft, Shield } from "lucide-react";
import QuoteCard from "@/components/QuoteCard";
import PurchasePolicyDialog from "@/components/PurchasePolicyDialog";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { VehiclePolicy, QuotesApiResponse, QuoteWithInsights } from "@shared/schema";

interface QuotesScreenProps {
  vehicle: VehiclePolicy;
  quotesData: QuotesApiResponse;
  userEmail: string;
  onBack: () => void;
  onPurchaseComplete: () => void;
}

export default function QuotesScreen({
  vehicle,
  quotesData,
  userEmail,
  onBack,
  onPurchaseComplete,
}: QuotesScreenProps) {
  const quotes = quotesData?.quotes_with_insights || [];
  const [purchaseDialogOpen, setPurchaseDialogOpen] = useState(false);
  const [selectedQuote, setSelectedQuote] = useState<QuoteWithInsights | null>(null);
  const [purchaseComplete, setPurchaseComplete] = useState(false);
  const [purchasedPolicyNumber, setPurchasedPolicyNumber] = useState<string | undefined>();

  const purchaseMutation = useMutation({
    mutationFn: async (quote: QuoteWithInsights) => {
      const policyPrice = quote.original_quote?.output?.policy_cost || 0;
      const res = await apiRequest("POST", "/api/purchase-policy", {
        email_id: userEmail,
        vehicle_registration_number: vehicle.vehicle_registration_number,
        insurer_name: quote.insurer_name,
        policy_cost: policyPrice,
      });
      return await res.json();
    },
    onSuccess: (data) => {
      setPurchasedPolicyNumber(data.policy_number);
      setPurchaseComplete(true);
      // Invalidate policies cache so the home screen shows updated data
      queryClient.invalidateQueries({ queryKey: ["/api/vehicle-policies", userEmail] });
    },
    onError: (error) => {
      console.error("Purchase error:", error);
      setPurchaseDialogOpen(false);
    },
  });

  const handleProceed = (quote: QuoteWithInsights) => {
    setSelectedQuote(quote);
    setPurchaseComplete(false);
    setPurchasedPolicyNumber(undefined);
    setPurchaseDialogOpen(true);
    
    // Start the purchase after a brief delay to show the progress
    setTimeout(() => {
      purchaseMutation.mutate(quote);
    }, 500);
  };

  const handleConfirmClose = () => {
    setPurchaseDialogOpen(false);
    setPurchaseComplete(false);
    setSelectedQuote(null);
    onPurchaseComplete();
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header with back button */}
      <div className="sticky top-0 z-50 bg-card border-b border-border shadow-sm">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={onBack}
            data-testid="button-back-to-welcome"
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div className="flex-1">
            <h1 className="text-xl font-bold text-foreground flex items-center gap-2">
              <Shield className="w-6 h-6 text-primary" />
              Insurance Quotes
            </h1>
            <p className="text-sm text-muted-foreground">
              {vehicle.vehicle_manufacturer_name} {vehicle.vehicle_model}
            </p>
          </div>
        </div>
      </div>

      {/* Scrollable quotes container */}
      <ScrollArea className="flex-1">
        <div className="max-w-4xl mx-auto px-4 py-6 space-y-4">
          {quotes.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-muted-foreground">No quotes found</p>
            </div>
          ) : (
            quotes.map((quote, index) => (
              <QuoteCard 
                key={index} 
                quote={quote} 
                index={index} 
                onProceed={handleProceed}
              />
            ))
          )}
        </div>
      </ScrollArea>

      {/* Purchase Dialog */}
      {selectedQuote && (
        <PurchasePolicyDialog
          open={purchaseDialogOpen}
          onOpenChange={(open) => {
            if (!purchaseMutation.isPending) {
              setPurchaseDialogOpen(open);
            }
          }}
          insurerName={selectedQuote.insurer_name}
          policyPrice={selectedQuote.original_quote?.output?.policy_cost || 0}
          onConfirmClose={handleConfirmClose}
          isPurchasing={purchaseMutation.isPending}
          purchaseComplete={purchaseComplete}
          policyNumber={purchasedPolicyNumber}
        />
      )}
    </div>
  );
}
