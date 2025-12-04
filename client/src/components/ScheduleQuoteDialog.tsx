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
  const [minSavingsThreshold, setMinSavingsThreshold] = useState<number>(() => {
    const stored = localStorage.getItem("minSavingsThreshold");
    if (stored) {
      const parsed = parseInt(stored, 10);
      // Validate stored value - clamp to 1-2000 or fallback to 50 if NaN
      if (isNaN(parsed)) return 50;
      if (parsed < 1) return 1;
      if (parsed > 2000) return 2000;
      return parsed;
    }
    return 50;
  });

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
    
    // Allow empty input for editing
    if (value === "") {
      return;
    }
    
    const numValue = parseInt(value, 10);
    
    // Only accept values between 1 and 2000
    if (!isNaN(numValue) && numValue >= 1 && numValue <= 2000) {
      setMinSavingsThreshold(numValue);
      localStorage.setItem("minSavingsThreshold", numValue.toString());
    }
  };

  // Handle blur to ensure we have a valid value
  const handleThresholdBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    const value = parseInt(e.target.value, 10);
    if (isNaN(value) || value < 1) {
      setMinSavingsThreshold(1);
      localStorage.setItem("minSavingsThreshold", "1");
    } else if (value > 2000) {
      setMinSavingsThreshold(2000);
      localStorage.setItem("minSavingsThreshold", "2000");
    }
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
        <div className="bg-muted/50 rounded-md p-4 border border-border flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-sm font-medium text-foreground mb-1">
              Next scheduled search:
            </p>
            <p className="text-sm text-muted-foreground">
              {calculateNextSearchDate()}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Label htmlFor="savings-threshold" className="text-xs text-muted-foreground whitespace-nowrap">
              Alert me only if annual saving is above:
            </Label>
            <div className="flex items-center gap-1">
              <span className="text-sm font-medium">£</span>
              <Input
                id="savings-threshold"
                type="number"
                min={1}
                max={2000}
                value={minSavingsThreshold}
                onChange={handleThresholdChange}
                onBlur={handleThresholdBlur}
                className="w-20 h-8 text-sm"
                data-testid="input-savings-threshold"
              />
            </div>
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
