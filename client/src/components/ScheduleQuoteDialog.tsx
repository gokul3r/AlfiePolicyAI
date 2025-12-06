import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Button } from "@/components/ui/button";
import { Calendar, Sparkles } from "lucide-react";
import type { VehiclePolicy } from "@shared/schema";
import { TimelapseDialog } from "./TimelapseDialog";

interface ScheduleQuoteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  policies: VehiclePolicy[];
  initialFrequency?: "monthly" | "weekly";
  userEmail: string;
}

export function ScheduleQuoteDialog({
  open,
  onOpenChange,
  policies,
  initialFrequency = "monthly",
  userEmail,
}: ScheduleQuoteDialogProps) {
  const [selectedVehicle, setSelectedVehicle] = useState<string>("");
  const [frequency, setFrequency] = useState<"monthly" | "weekly">(initialFrequency);
  const [timelapseOpen, setTimelapseOpen] = useState(false);
  
  // Store both the validated number and the raw text for editing
  const [minSavingsThreshold, setMinSavingsThreshold] = useState<number>(() => {
    const stored = localStorage.getItem("minSavingsThreshold");
    if (stored) {
      const parsed = parseInt(stored, 10);
      // Validate stored value - clamp to 0-1000 or fallback to 50 if NaN
      if (isNaN(parsed)) return 50;
      if (parsed < 0) return 0;
      if (parsed > 1000) return 1000;
      return parsed;
    }
    return 50;
  });
  const [thresholdInput, setThresholdInput] = useState<string>(() => {
    const stored = localStorage.getItem("minSavingsThreshold");
    if (stored) {
      const parsed = parseInt(stored, 10);
      if (!isNaN(parsed) && parsed >= 0 && parsed <= 1000) return stored;
    }
    return "50";
  });
  const [thresholdError, setThresholdError] = useState<string>("");

  // Reset and sync state when dialog opens or frequency changes
  useEffect(() => {
    if (open && policies.length > 0) {
      // Always set first vehicle when opening
      setSelectedVehicle(policies[0].vehicle_id);
      // Sync with parent frequency
      setFrequency(initialFrequency);
    }
  }, [open, policies, initialFrequency]);

  // Reset state when dialog closes
  useEffect(() => {
    if (!open) {
      setSelectedVehicle("");
    }
  }, [open]);

  // Calculate next scheduled search date
  const calculateNextSearchDate = (): string => {
    const now = new Date();
    const next = new Date(now);
    
    if (frequency === "weekly") {
      next.setDate(now.getDate() + 7);
    } else {
      next.setMonth(now.getMonth() + 1);
    }
    
    return next.toLocaleDateString("en-GB", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  // Auto-save when frequency changes
  const handleFrequencyChange = (value: string) => {
    if (value === "monthly" || value === "weekly") {
      setFrequency(value);
      // TODO: Implement backend API for schedule persistence
      // For now, this updates local state only
      // Future: POST to /api/schedule-quote-search with { vehicle_id, frequency }
    }
  };

  // Handle minimum savings threshold change with validation
  const handleThresholdChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    
    // Always update the text input to allow free editing
    setThresholdInput(value);
    
    // Allow empty input for editing (will validate on blur)
    if (value === "") {
      setThresholdError("");
      return;
    }
    
    // Strip non-numeric characters for validation
    const cleanValue = value.replace(/[^0-9]/g, "");
    
    // Check if input contains non-numeric characters
    if (value !== cleanValue) {
      setThresholdError("Please enter numbers only");
      return;
    }
    
    const numValue = parseInt(cleanValue, 10);
    
    // Validate range 0-1000
    if (isNaN(numValue)) {
      setThresholdError("Please enter a valid number");
      return;
    }
    
    if (numValue < 0 || numValue > 1000) {
      setThresholdError("Value must be between 0 and 1000");
      return;
    }
    
    // Valid value - save it
    setThresholdError("");
    setMinSavingsThreshold(numValue);
    localStorage.setItem("minSavingsThreshold", numValue.toString());
  };

  // Handle blur to ensure we have a valid value
  const handleThresholdBlur = () => {
    const cleanValue = thresholdInput.replace(/[^0-9]/g, "");
    const numValue = parseInt(cleanValue, 10);
    
    let finalValue: number;
    if (isNaN(numValue) || thresholdInput === "") {
      finalValue = 50; // Default to 50 if empty or invalid
    } else if (numValue < 0) {
      finalValue = 0;
    } else if (numValue > 1000) {
      finalValue = 1000;
    } else {
      finalValue = numValue;
    }
    
    // Update both states and localStorage
    setMinSavingsThreshold(finalValue);
    setThresholdInput(finalValue.toString());
    setThresholdError("");
    localStorage.setItem("minSavingsThreshold", finalValue.toString());
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl" data-testid="dialog-schedule-search">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Calendar className="w-5 h-5" />
            Schedule Quote Search
          </DialogTitle>
        </DialogHeader>

        <div className="grid md:grid-cols-2 gap-6 py-4">
          {/* Left Column: Vehicle Selector */}
          <div className="space-y-2">
            <Label htmlFor="vehicle-select">Select Vehicle</Label>
            <Select value={selectedVehicle} onValueChange={setSelectedVehicle}>
              <SelectTrigger id="vehicle-select" data-testid="select-vehicle">
                <SelectValue placeholder="Choose a vehicle" />
              </SelectTrigger>
              <SelectContent>
                {policies.map((policy) => (
                  <SelectItem 
                    key={policy.vehicle_id} 
                    value={policy.vehicle_id}
                    data-testid={`select-item-vehicle-${policy.vehicle_id}`}
                  >
                    {policy.vehicle_manufacturer_name} {policy.vehicle_model} ({policy.vehicle_registration_number})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Choose which vehicle to search quotes for
            </p>
          </div>

          {/* Right Column: Frequency Toggle */}
          <div className="space-y-2">
            <Label>Search Frequency</Label>
            <div className="flex flex-wrap gap-2 items-center">
              <ToggleGroup
                type="single"
                value={frequency}
                onValueChange={handleFrequencyChange}
                className="justify-start"
                data-testid="toggle-frequency"
              >
                <ToggleGroupItem value="monthly" data-testid="toggle-monthly">
                  Monthly
                </ToggleGroupItem>
                <ToggleGroupItem value="weekly" data-testid="toggle-weekly">
                  Weekly
                </ToggleGroupItem>
              </ToggleGroup>

              {/* Magical Timelapse button */}
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setTimelapseOpen(true)}
                className="group relative overflow-visible hover-elevate active-elevate-2"
                data-testid="button-timelapse"
              >
                <Sparkles className="w-4 h-4 mr-1.5 text-purple-500 group-hover:text-purple-600 transition-colors" />
                <span className="shimmer-text font-semibold">Timelapse</span>
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              How often should we search for quotes?
            </p>
          </div>
        </div>

        {/* Next Search Preview with Savings Threshold */}
        <div className="bg-muted/50 rounded-md p-4 border border-border space-y-4">
          {/* Next scheduled search - always visible */}
          <div>
            <p className="text-sm font-medium text-foreground mb-1">
              Next scheduled search:
            </p>
            <p className="text-sm text-muted-foreground">
              {calculateNextSearchDate()}
            </p>
          </div>
          
          {/* Savings threshold - stacks below on mobile, inline on larger screens */}
          <div className="flex flex-col gap-2">
            <div className="flex flex-col sm:flex-row sm:items-center gap-2">
              <Label htmlFor="savings-threshold" className="text-xs text-muted-foreground">
                Alert me only if annual saving is above:
              </Label>
              <div className="flex items-center gap-1">
                <span className="text-sm font-medium">£</span>
                <Input
                  id="savings-threshold"
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  value={thresholdInput}
                  onChange={handleThresholdChange}
                  onBlur={handleThresholdBlur}
                  className={`w-24 h-8 text-sm ${thresholdError ? "border-red-500 focus-visible:ring-red-500" : ""}`}
                  placeholder="0-1000"
                  data-testid="input-savings-threshold"
                />
              </div>
            </div>
            {thresholdError && (
              <p className="text-xs text-red-500" data-testid="text-threshold-error">
                {thresholdError}
              </p>
            )}
          </div>
        </div>

        <p className="text-xs text-muted-foreground text-center">
          Preferences stored locally (backend integration coming soon)
        </p>

        {/* Timelapse Dialog */}
        <TimelapseDialog 
          open={timelapseOpen} 
          onOpenChange={setTimelapseOpen}
          selectedVehicleId={selectedVehicle}
          frequency={frequency}
          userEmail={userEmail}
          minSavingsThreshold={minSavingsThreshold}
        />
      </DialogContent>
    </Dialog>
  );
}
