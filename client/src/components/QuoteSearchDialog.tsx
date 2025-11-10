import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Search, Car, Loader2 } from "lucide-react";
import type { VehiclePolicy, QuotesApiResponse } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";

interface QuoteSearchDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  vehicles: VehiclePolicy[];
  onQuotesFound: (vehicle: VehiclePolicy, quotes: QuotesApiResponse) => void;
}

export default function QuoteSearchDialog({
  open,
  onOpenChange,
  vehicles,
  onQuotesFound,
}: QuoteSearchDialogProps) {
  const [selectedVehicle, setSelectedVehicle] = useState<VehiclePolicy | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  const { toast } = useToast();

  const MAX_RETRIES = 3;

  const handleVehicleSelect = async (vehicle: VehiclePolicy) => {
    setSelectedVehicle(vehicle);
    await searchQuotes(vehicle, 0);
  };

  const searchQuotes = async (vehicle: VehiclePolicy, attempt: number) => {
    setIsSearching(true);
    setRetryCount(attempt);

    try {
      // Prepare the base request payload
      const requestPayload: any = {
        insurance_details: {
          email_id: vehicle.email_id,
          driver_age: vehicle.driver_age,
          vehicle_registration_number: vehicle.vehicle_registration_number,
          vehicle_manufacturer_name: vehicle.vehicle_manufacturer_name,
          vehicle_model: vehicle.vehicle_model,
          vehicle_year: vehicle.vehicle_year,
          type_of_fuel: vehicle.type_of_fuel,
          type_of_Cover_needed: vehicle.type_of_cover_needed,
          No_Claim_bonus_years: vehicle.no_claim_bonus_years,
          Voluntary_Excess: vehicle.voluntary_excess,
        },
        user_preferences: vehicle.whisper_preferences || "",
      };

      // Fetch custom ratings if available
      try {
        const ratingsResponse = await fetch(`/api/custom-ratings/${encodeURIComponent(vehicle.email_id)}`);
        if (ratingsResponse.ok) {
          const customRatings = await ratingsResponse.json();
          
          // Only include custom ratings if the toggle is enabled
          if (customRatings.use_custom_ratings) {
            requestPayload.trust_pilot_data = customRatings.trustpilot_data;
            requestPayload.defacto_ratings = customRatings.defacto_ratings;
          }
        }
      } catch (ratingsError) {
        // If fetching custom ratings fails, continue with default ratings
        console.log("Custom ratings not available, using defaults");
      }

      // Use backend proxy endpoint to avoid CORS issues
      const response = await fetch("/api/search-quotes", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestPayload),
      });

      if (!response.ok) {
        throw new Error(`API request failed with status ${response.status}`);
      }

      const data = await response.json() as QuotesApiResponse;
      
      // Success - pass data to parent and close dialog
      setIsSearching(false);
      onQuotesFound(vehicle, data);
      resetDialog();

    } catch (error) {
      console.error("Quote search error:", error);
      
      const nextAttempt = attempt + 1;
      
      // Retry logic - max 3 total attempts (0, 1, 2)
      if (nextAttempt < MAX_RETRIES) {
        toast({
          title: "Search Failed",
          description: `Retrying... (Attempt ${nextAttempt + 1} of ${MAX_RETRIES})`,
          variant: "destructive",
        });
        
        // Wait 1 second before retrying
        await new Promise(resolve => setTimeout(resolve, 1000));
        await searchQuotes(vehicle, nextAttempt);
      } else {
        // Max retries exceeded
        setIsSearching(false);
        toast({
          title: "Service Unavailable",
          description: "Application under maintenance. Please come back later.",
          variant: "destructive",
        });
        resetDialog();
      }
    }
  };

  const resetDialog = () => {
    setSelectedVehicle(null);
    setIsSearching(false);
    setRetryCount(0);
    onOpenChange(false);
  };

  const handleDialogClose = (open: boolean) => {
    // Prevent closing while searching
    if (!open) {
      if (isSearching) {
        return; // Don't allow closing during search
      }
      resetDialog();
    }
    onOpenChange(open);
  };

  return (
    <Dialog open={open} onOpenChange={handleDialogClose}>
      <DialogContent className="sm:max-w-md" data-testid="dialog-quote-search">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl">
            <Search className="w-6 h-6 text-primary" />
            Search Quotes
          </DialogTitle>
          <DialogDescription>
            Find the best insurance deals for your vehicle
          </DialogDescription>
        </DialogHeader>

        {isSearching ? (
          <div className="flex flex-col items-center justify-center py-8 space-y-4">
            <Loader2 className="w-12 h-12 text-primary animate-spin" />
            <div className="text-center">
              <p className="text-sm font-medium text-foreground">
                Searching for quotes...
              </p>
              {retryCount > 0 && (
                <p className="text-xs text-muted-foreground mt-1">
                  Attempt {retryCount + 1} of {MAX_RETRIES}
                </p>
              )}
            </div>
          </div>
        ) : (
          <div className="space-y-4 py-4">
            <p className="text-sm font-medium text-foreground">Choose the vehicle</p>
            <div className="space-y-2">
              {vehicles.map((vehicle) => (
                <Button
                  key={vehicle.vehicle_id}
                  variant="outline"
                  onClick={() => handleVehicleSelect(vehicle)}
                  className="w-full h-auto text-left p-4 justify-start"
                  data-testid={`button-select-vehicle-${vehicle.vehicle_id}`}
                >
                  <div className="flex items-center gap-3">
                    <Car className="w-5 h-5 text-primary" />
                    <div>
                      <h4 className="font-semibold text-foreground">
                        {vehicle.vehicle_manufacturer_name} {vehicle.vehicle_model}
                      </h4>
                      <p className="text-sm text-muted-foreground">
                        {vehicle.vehicle_registration_number}
                      </p>
                    </div>
                  </div>
                </Button>
              ))}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
