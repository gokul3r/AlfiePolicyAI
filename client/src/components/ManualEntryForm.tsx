import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

// Form schema - excludes vehicle_id and email_id as they're handled separately
const manualEntryFormSchema = z.object({
  driver_age: z.coerce.number().int().min(18, "Driver must be at least 18 years old").max(100, "Age must be 100 or less"),
  vehicle_registration_number: z.string().min(1, "Registration number is required").trim(),
  vehicle_manufacturer_name: z.string().min(1, "Manufacturer name is required").trim(),
  vehicle_model: z.string().min(1, "Vehicle model is required").trim(),
  vehicle_year: z.coerce.number().int().min(1900, "Year must be 1900 or later").max(new Date().getFullYear() + 1, "Year cannot be in the future"),
  type_of_fuel: z.string().min(1, "Fuel type is required").trim(),
  type_of_cover_needed: z.string().min(1, "Please select a cover type"),
  no_claim_bonus_years: z.coerce.number().int().min(0, "Must be 0 or more").max(20, "Maximum 20 years"),
  voluntary_excess: z.coerce.number().min(0, "Must be 0 or more"),
});

export type VehiclePolicyFormData = z.infer<typeof manualEntryFormSchema>;

interface ManualEntryFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userEmail: string;
  initialValues?: Partial<VehiclePolicyFormData>;
  missingFields?: string[];
  onSubmit: (formData: VehiclePolicyFormData) => void;
  onCancel: () => void;
}

export default function ManualEntryForm({
  open,
  onOpenChange,
  userEmail,
  initialValues,
  missingFields = [],
  onSubmit,
  onCancel,
}: ManualEntryFormProps) {
  const form = useForm<VehiclePolicyFormData>({
    resolver: zodResolver(manualEntryFormSchema),
    defaultValues: {
      driver_age: initialValues?.driver_age ?? undefined,
      vehicle_registration_number: initialValues?.vehicle_registration_number ?? "",
      vehicle_manufacturer_name: initialValues?.vehicle_manufacturer_name ?? "",
      vehicle_model: initialValues?.vehicle_model ?? "",
      vehicle_year: initialValues?.vehicle_year ?? undefined,
      type_of_fuel: initialValues?.type_of_fuel ?? "",
      type_of_cover_needed: initialValues?.type_of_cover_needed ?? "",
      no_claim_bonus_years: initialValues?.no_claim_bonus_years ?? undefined,
      voluntary_excess: initialValues?.voluntary_excess ?? undefined,
    },
  });

  // Reset form when initialValues change
  useEffect(() => {
    if (initialValues) {
      form.reset({
        driver_age: initialValues?.driver_age ?? undefined,
        vehicle_registration_number: initialValues?.vehicle_registration_number ?? "",
        vehicle_manufacturer_name: initialValues?.vehicle_manufacturer_name ?? "",
        vehicle_model: initialValues?.vehicle_model ?? "",
        vehicle_year: initialValues?.vehicle_year ?? undefined,
        type_of_fuel: initialValues?.type_of_fuel ?? "",
        type_of_cover_needed: initialValues?.type_of_cover_needed ?? "",
        no_claim_bonus_years: initialValues?.no_claim_bonus_years ?? undefined,
        voluntary_excess: initialValues?.voluntary_excess ?? undefined,
      });
    }
  }, [initialValues, form]);

  // Helper to check if a field is missing
  const isFieldMissing = (fieldName: string) => {
    return missingFields.includes(fieldName);
  };

  const handleSubmit = (data: VehiclePolicyFormData) => {
    onSubmit(data);
    form.reset();
  };

  const handleCancel = () => {
    form.reset();
    onCancel();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md rounded-2xl p-6" data-testid="dialog-manual-entry">
        <DialogHeader className="space-y-3">
          <DialogTitle className="text-xl font-bold text-center" data-testid="text-manual-entry-title">
            Enter Vehicle Policy Details
          </DialogTitle>
        </DialogHeader>

        <ScrollArea className="max-h-[70vh] pr-4">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4 pt-4">
              <div className="space-y-2">
                <Label htmlFor="email" className="text-sm font-medium">
                  Email ID
                </Label>
                <Input
                  id="email"
                  type="email"
                  value={userEmail}
                  className="h-11 rounded-lg bg-muted"
                  disabled
                  readOnly
                  data-testid="input-email-readonly"
                />
              </div>

              <FormField
                control={form.control}
                name="driver_age"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Your Age</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        placeholder="Enter your age"
                        {...field}
                        className={cn(
                          "h-11 rounded-lg",
                          isFieldMissing("driver_age") && "border-destructive border-2"
                        )}
                        data-testid="input-driver-age"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="vehicle_registration_number"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Vehicle Registration Number</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="e.g., AB12 CDE"
                        {...field}
                        className="h-11 rounded-lg"
                        data-testid="input-registration-number"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="vehicle_manufacturer_name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Vehicle Manufacturer Name</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="e.g., Tesla, Honda"
                        {...field}
                        className="h-11 rounded-lg"
                        data-testid="input-manufacturer"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="vehicle_model"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Vehicle Model</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="e.g., Model 3, Civic"
                        {...field}
                        className="h-11 rounded-lg"
                        data-testid="input-model"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="vehicle_year"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Vehicle Year</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        placeholder="e.g., 2021"
                        {...field}
                        className="h-11 rounded-lg"
                        data-testid="input-year"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="type_of_fuel"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Type of Fuel</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="e.g., Petrol, Diesel, Electric"
                        {...field}
                        className="h-11 rounded-lg"
                        data-testid="input-fuel-type"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="type_of_cover_needed"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Type of Cover Needed</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger className="h-11 rounded-lg" data-testid="select-cover-type">
                          <SelectValue placeholder="Select cover type" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="comprehensive" data-testid="option-comprehensive">
                          Comprehensive
                        </SelectItem>
                        <SelectItem value="third_party_only" data-testid="option-third-party">
                          Third party only
                        </SelectItem>
                        <SelectItem value="third_party_fire_theft" data-testid="option-third-party-fire-theft">
                          Third-party, fire and theft
                        </SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="no_claim_bonus_years"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Number of No Claim Bonus Years</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        placeholder="e.g., 5"
                        {...field}
                        className="h-11 rounded-lg"
                        data-testid="input-bonus-years"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="voluntary_excess"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Voluntary Excess</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        step="0.01"
                        placeholder="e.g., 500.00"
                        {...field}
                        className={cn(
                          "h-11 rounded-lg",
                          (isFieldMissing("Voluntary_Excess") || isFieldMissing("voluntary_excess")) && "border-destructive border-2"
                        )}
                        data-testid="input-voluntary-excess"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="flex gap-3 pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleCancel}
                  className="flex-1 rounded-xl"
                  size="lg"
                  data-testid="button-cancel"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  className="flex-1 rounded-xl"
                  size="lg"
                  data-testid="button-submit"
                >
                  Submit
                </Button>
              </div>
            </form>
          </Form>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
