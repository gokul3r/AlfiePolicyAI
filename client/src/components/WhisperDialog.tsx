import { useState, useEffect } from "react";
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

const AVAILABLE_FEATURES = [
  "legal cover",
  "windshield cover",
  "courtesy car",
  "breakdown cover",
  "personal accident cover",
  "european cover",
  "no claim bonus protection",
] as const;

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
  const [selectedFeatures, setSelectedFeatures] = useState<Set<string>>(new Set());
  const [interactedFeatures, setInteractedFeatures] = useState<string[]>([]);

  const detectFeaturesInText = (text: string): string[] => {
    const lowerText = text.toLowerCase();
    return AVAILABLE_FEATURES.filter(feature => 
      lowerText.includes(feature.toLowerCase())
    );
  };

  const calculateRecommendations = (text: string) => {
    const mentionedFeatures = detectFeaturesInText(text);
    const remaining = AVAILABLE_FEATURES.filter(
      feature => !mentionedFeatures.includes(feature)
    );
    return remaining.slice(0, 3);
  };

  const getDisplayedFeatures = (): string[] => {
    const mentionedFeatures = detectFeaturesInText(preferences);
    const mentionedSet = new Set(mentionedFeatures);
    
    const selectedArray = Array.from(selectedFeatures);
    const interactedSet = new Set(interactedFeatures);
    
    const newSelections = selectedArray.filter(f => !interactedSet.has(f));
    const allRelevant = [...interactedFeatures, ...newSelections];
    
    const recentThree = allRelevant.slice(-3);
    
    if (recentThree.length >= 3) {
      return recentThree;
    }
    
    const remaining = AVAILABLE_FEATURES.filter(
      f => !mentionedSet.has(f) && !allRelevant.includes(f)
    );
    
    const slotsAvailable = Math.max(0, 3 - recentThree.length);
    const newRecommendations = remaining.slice(0, slotsAvailable);
    
    return [...recentThree, ...newRecommendations];
  };

  useEffect(() => {
    if (selectedVehicle) {
      const lines = preferences.split('\n');
      const selectedFromText = new Set<string>();
      
      lines.forEach(line => {
        const trimmed = line.trim();
        if (trimmed.startsWith('*')) {
          const feature = trimmed.substring(1).trim().toLowerCase();
          const matchedFeature = AVAILABLE_FEATURES.find(f => f.toLowerCase() === feature);
          if (matchedFeature) {
            selectedFromText.add(matchedFeature);
          }
        }
      });
      
      const mentionedFeatures = detectFeaturesInText(preferences);
      mentionedFeatures.forEach(f => selectedFromText.add(f));
      
      setSelectedFeatures(selectedFromText);
    }
  }, [preferences, selectedVehicle]);

  const handleVehicleSelect = (vehicle: VehiclePolicy) => {
    setSelectedVehicle(vehicle);
    const prefs = vehicle.whisper_preferences || "";
    setPreferences(prefs);
    
    const lines = prefs.split('\n');
    const interacted: string[] = [];
    lines.forEach(line => {
      const trimmed = line.trim();
      if (trimmed.startsWith('*')) {
        const feature = trimmed.substring(1).trim().toLowerCase();
        const matchedFeature = AVAILABLE_FEATURES.find(f => f.toLowerCase() === feature);
        if (matchedFeature && !interacted.includes(matchedFeature)) {
          interacted.push(matchedFeature);
        }
      }
    });
    setInteractedFeatures(interacted);
  };

  const handleFeatureToggle = (feature: string) => {
    const isSelected = selectedFeatures.has(feature);
    
    const newInteracted = interactedFeatures.filter(f => f !== feature);
    newInteracted.push(feature);
    setInteractedFeatures(newInteracted);
    
    if (isSelected) {
      const lines = preferences.split('\n');
      const filteredLines = lines.filter(line => {
        const trimmed = line.trim();
        if (trimmed.startsWith('*')) {
          const lineFeature = trimmed.substring(1).trim().toLowerCase();
          return lineFeature !== feature.toLowerCase();
        }
        return true;
      });
      setPreferences(filteredLines.join('\n'));
    } else {
      const newPrefs = preferences.trim() 
        ? `${preferences}\n* ${feature}` 
        : `* ${feature}`;
      setPreferences(newPrefs);
    }
  };

  const handleBack = () => {
    setSelectedVehicle(null);
    setPreferences("");
    setSelectedFeatures(new Set());
    setInteractedFeatures([]);
  };

  const handleSubmit = async () => {
    if (!selectedVehicle) return;
    
    setIsSubmitting(true);
    try {
      await onSubmit(selectedVehicle.vehicle_id, preferences);
      setSelectedVehicle(null);
      setPreferences("");
      setSelectedFeatures(new Set());
      setInteractedFeatures([]);
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
      setSelectedFeatures(new Set());
      setInteractedFeatures([]);
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

            {getDisplayedFeatures().length > 0 && (
              <div className="space-y-3">
                <p className="text-xs font-medium text-muted-foreground">
                  Popular among drivers with similar vehicles and coverage preferences
                </p>
                <div className="flex flex-wrap gap-2">
                  {getDisplayedFeatures().map((feature: string) => {
                    const isSelected = selectedFeatures.has(feature);
                    return (
                      <Button
                        key={feature}
                        variant={isSelected ? "default" : "outline"}
                        onClick={() => handleFeatureToggle(feature)}
                        className="min-h-11 text-sm"
                        data-testid={`button-feature-${feature.toLowerCase().replace(/\s+/g, '-')}`}
                      >
                        {feature}
                      </Button>
                    );
                  })}
                </div>
              </div>
            )}

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
