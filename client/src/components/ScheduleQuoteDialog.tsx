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
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Calendar } from "lucide-react";
import type { VehiclePolicy } from "@shared/schema";

interface ScheduleQuoteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  policies: VehiclePolicy[];
  initialFrequency?: "monthly" | "weekly";
}

export function ScheduleQuoteDialog({
  open,
  onOpenChange,
  policies,
  initialFrequency = "monthly",
}: ScheduleQuoteDialogProps) {
  const [selectedVehicle, setSelectedVehicle] = useState<string>("");
  const [frequency, setFrequency] = useState<"monthly" | "weekly">(initialFrequency);

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
            <p className="text-xs text-muted-foreground">
              How often should we search for quotes?
            </p>
          </div>
        </div>

        {/* Next Search Preview */}
        <div className="bg-muted/50 rounded-md p-4 border border-border">
          <p className="text-sm font-medium text-foreground mb-1">
            Next scheduled search:
          </p>
          <p className="text-sm text-muted-foreground">
            {calculateNextSearchDate()}
          </p>
        </div>

        <p className="text-xs text-muted-foreground text-center">
          Preferences stored locally (backend integration coming soon)
        </p>
      </DialogContent>
    </Dialog>
  );
}
