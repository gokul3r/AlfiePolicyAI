import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { MessageCircle, Car } from "lucide-react";
import type { VehiclePolicy } from "@shared/schema";

interface WhisperDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  vehicles: VehiclePolicy[];
  onSubmit: (vehicleId: string, preferences: string) => Promise<void>;
}

export default function WhisperDialog({
  open,
  onOpenChange,
  vehicles,
  onSubmit,
}: WhisperDialogProps) {
  const [selectedVehicle, setSelectedVehicle] = useState<VehiclePolicy | null>(null);
  const [preferences, setPreferences] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleVehicleSelect = (vehicle: VehiclePolicy) => {
    setSelectedVehicle(vehicle);
    setPreferences(vehicle.whisper_preferences || "");
  };

  const handleBack = () => {
    setSelectedVehicle(null);
    setPreferences("");
  };

  const handleSubmit = async () => {
    if (!selectedVehicle) return;
    
    setIsSubmitting(true);
    try {
      await onSubmit(selectedVehicle.vehicle_id, preferences);
      setSelectedVehicle(null);
      setPreferences("");
      onOpenChange(false);
    } catch (error) {
      console.error("Error saving whisper preferences:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDialogClose = (open: boolean) => {
    if (!open) {
      setSelectedVehicle(null);
      setPreferences("");
    }
    onOpenChange(open);
  };

  return (
    <Dialog open={open} onOpenChange={handleDialogClose}>
      <DialogContent className="sm:max-w-md" data-testid="dialog-whisper">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl">
            <MessageCircle className="w-6 h-6 text-primary" />
            Whisper
          </DialogTitle>
          <DialogDescription>
            Record your insurance buying preferences
          </DialogDescription>
        </DialogHeader>

        {!selectedVehicle ? (
          <div className="space-y-4 py-4">
            <p className="text-sm font-medium text-foreground">Choose the vehicle</p>
            <div className="space-y-2">
              {vehicles.map((vehicle) => (
                <button
                  key={vehicle.vehicle_id}
                  onClick={() => handleVehicleSelect(vehicle)}
                  className="w-full text-left p-4 rounded-lg border border-border hover-elevate active-elevate-2 transition-all"
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
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="space-y-4 py-4">
            <div className="p-3 rounded-lg bg-muted/50">
              <p className="text-sm text-muted-foreground">Selected vehicle</p>
              <p className="font-semibold text-foreground">
                {selectedVehicle.vehicle_manufacturer_name} {selectedVehicle.vehicle_model}
              </p>
              <p className="text-sm text-muted-foreground">
                {selectedVehicle.vehicle_registration_number}
              </p>
            </div>

            <div className="space-y-2">
              <label htmlFor="whisper-preferences" className="text-sm font-medium text-foreground">
                Whisper your preferences
              </label>
              <Textarea
                id="whisper-preferences"
                placeholder="I need legal cover, windshield and breakdown, budget £420, prefer good reviews..."
                value={preferences}
                onChange={(e) => setPreferences(e.target.value)}
                className="min-h-[150px] text-base"
                data-testid="textarea-whisper-preferences"
              />
            </div>

            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={handleBack}
                className="flex-1"
                disabled={isSubmitting}
                data-testid="button-back"
              >
                Back
              </Button>
              <Button
                onClick={handleSubmit}
                className="flex-1"
                disabled={isSubmitting}
                data-testid="button-submit-whisper"
              >
                {isSubmitting ? "Saving..." : "Submit"}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
