import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ArrowLeft, Shield } from "lucide-react";
import QuoteCard from "@/components/QuoteCard";
import type { VehiclePolicy, QuotesApiResponse } from "@shared/schema";

interface QuotesScreenProps {
  vehicle: VehiclePolicy;
  quotesData: QuotesApiResponse;
  onBack: () => void;
}

export default function QuotesScreen({
  vehicle,
  quotesData,
  onBack,
}: QuotesScreenProps) {
  const quotes = quotesData?.quotes_with_insights || [];

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
              <QuoteCard key={index} quote={quote} index={index} />
            ))
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
