import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useEffect, useMemo } from "react";
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

const isValidPositiveNumber = (val: string) => {
  const n = Number(val.trim());
  return !isNaN(n) && n >= 0;
};

// Internal form schema — cost/excess fields are text to avoid browser NaN issues with type="number"
const manualEntryFormSchema = z.object({
  // Policy fields
  policy_number: z.string().min(1, "Policy number is required").trim(),
  policy_start_date: z.string().min(1, "Policy start date is required"),
  policy_end_date: z.string().min(1, "Policy end date is required"),
  current_insurance_provider: z.string().min(1, "Insurance provider is required").trim(),
  current_policy_cost: z.string()
    .min(1, "Policy cost is required")
    .refine(isValidPositiveNumber, "Please enter a valid positive amount"),
  // Vehicle details fields
  driver_age: z.coerce.number().int().min(18, "Driver must be at least 18 years old").max(100, "Age must be 100 or less"),
  vehicle_registration_number: z.string().min(1, "Registration number is required").trim(),
  vehicle_manufacturer_name: z.string().min(1, "Manufacturer name is required").trim(),
  vehicle_model: z.string().min(1, "Vehicle model is required").trim(),
  vehicle_year: z.coerce.number().int().min(1900, "Year must be 1900 or later").max(new Date().getFullYear() + 1, "Year cannot be in the future"),
  type_of_fuel: z.enum(["Electric", "Hybrid", "Petrol", "Diesel"], {
    errorMap: () => ({ message: "Please select a fuel type" })
  }),
  type_of_cover_needed: z.string().min(1, "Please select a cover type"),
  no_claim_bonus_years: z.coerce.number().int().min(0, "Must be 0 or more").max(20, "Maximum 20 years"),
  voluntary_excess: z.string()
    .min(1, "Voluntary excess is required")
    .refine(isValidPositiveNumber, "Please enter a valid positive amount"),
}).refine((data) => {
  if (data.policy_start_date && data.policy_end_date) {
    const start = new Date(data.policy_start_date);
    const end = new Date(data.policy_end_date);
    return end > start;
  }
  return true;
}, {
  message: "End date must be after start date",
  path: ["policy_end_date"],
}).refine((data) => {
  if (data.policy_start_date && data.policy_end_date) {
    const start = new Date(data.policy_start_date);
    const end = new Date(data.policy_end_date);
    const diffDays = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
    return diffDays <= 365;
  }
  return true;
}, {
  message: "Policy duration cannot exceed 365 days (12 months). This demo supports annual policies only.",
  path: ["policy_end_date"],
});

type FormValues = z.infer<typeof manualEntryFormSchema>;

// Public type that callers receive — cost/excess are numbers
export type VehiclePolicyFormData = Omit<FormValues, "current_policy_cost" | "voluntary_excess"> & {
  current_policy_cost: number;
  voluntary_excess: number;
};

interface ManualEntryFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userEmail: string;
  initialValues?: Partial<VehiclePolicyFormData>;
  missingFields?: string[];
  onSubmit: (formData: VehiclePolicyFormData) => void;
  onCancel: () => void;
  isEditMode?: boolean;
}

export default function ManualEntryForm({
  open,
  onOpenChange,
  userEmail,
  initialValues,
  missingFields = [],
  onSubmit,
  onCancel,
  isEditMode = false,
}: ManualEntryFormProps) {
  const buildFormValues = (vals?: Partial<VehiclePolicyFormData>): FormValues => ({
    policy_number: vals?.policy_number ?? "",
    policy_start_date: vals?.policy_start_date ?? "",
    policy_end_date: vals?.policy_end_date ?? "",
    current_insurance_provider: vals?.current_insurance_provider ?? "",
    current_policy_cost: vals?.current_policy_cost != null ? String(vals.current_policy_cost) : "",
    driver_age: vals?.driver_age ?? (undefined as unknown as number),
    vehicle_registration_number: vals?.vehicle_registration_number ?? "",
    vehicle_manufacturer_name: vals?.vehicle_manufacturer_name ?? "",
    vehicle_model: vals?.vehicle_model ?? "",
    vehicle_year: vals?.vehicle_year ?? (undefined as unknown as number),
    type_of_fuel: vals?.type_of_fuel ?? (undefined as unknown as "Electric" | "Hybrid" | "Petrol" | "Diesel"),
    type_of_cover_needed: vals?.type_of_cover_needed ?? "",
    no_claim_bonus_years: vals?.no_claim_bonus_years ?? (undefined as unknown as number),
    voluntary_excess: vals?.voluntary_excess != null ? String(vals.voluntary_excess) : "",
  });

  const form = useForm<FormValues>({
    resolver: zodResolver(manualEntryFormSchema),
    defaultValues: buildFormValues(initialValues),
  });

  // Reset form when initialValues change
  useEffect(() => {
    if (initialValues) {
      form.reset(buildFormValues(initialValues));
    }
  }, [initialValues, form]);

  // Helper to check if a field is missing
  const isFieldMissing = (fieldName: string) => {
    return missingFields.includes(fieldName);
  };

  const watchedCost = form.watch("current_policy_cost");
  const watchedExcess = form.watch("voluntary_excess");

  const policyCostWarning = useMemo(() => {
    const n = Number(watchedCost);
    if (!isNaN(n) && watchedCost !== "" && n > 10000) return "This seems unusually high — please double-check.";
    return null;
  }, [watchedCost]);

  const voluntaryExcessWarning = useMemo(() => {
    const n = Number(watchedExcess);
    if (!isNaN(n) && watchedExcess !== "" && n > 2000) return "This seems unusually high — please double-check.";
    return null;
  }, [watchedExcess]);

  const handleSubmit = (data: FormValues) => {
    const processedData: VehiclePolicyFormData = {
      ...data,
      current_policy_cost: Number(data.current_policy_cost),
      voluntary_excess: Number(data.voluntary_excess),
    };
    onSubmit(processedData);
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
            {isEditMode ? "Edit Vehicle Policy" : "Enter Vehicle Policy Details"}
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
                name="policy_number"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Policy Number</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="e.g., POL-123456"
                        {...field}
                        className="h-11 rounded-lg"
                        data-testid="input-policy-number"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="current_insurance_provider"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Current Insurance Provider</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="e.g., Admiral, AXA"
                        {...field}
                        className="h-11 rounded-lg"
                        data-testid="input-insurance-provider"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="current_policy_cost"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Current Policy Cost (£)</FormLabel>
                    <FormControl>
                      <Input
                        type="text"
                        inputMode="decimal"
                        placeholder="e.g., 1200.00"
                        {...field}
                        className={cn(
                          "h-11 rounded-lg",
                          (isFieldMissing("Current_Policy_Cost") || isFieldMissing("current_policy_cost")) && "border-destructive border-2"
                        )}
                        data-testid="input-policy-cost"
                      />
                    </FormControl>
                    <FormMessage />
                    {policyCostWarning && !form.formState.errors.current_policy_cost && (
                      <p className="text-sm text-amber-600 dark:text-amber-400" data-testid="warning-policy-cost">{policyCostWarning}</p>
                    )}
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="policy_start_date"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Policy Start Date</FormLabel>
                    <FormControl>
                      <Input
                        type="date"
                        {...field}
                        className="h-11 rounded-lg"
                        data-testid="input-policy-start-date"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="policy_end_date"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Policy End Date</FormLabel>
                    <FormControl>
                      <Input
                        type="date"
                        {...field}
                        className="h-11 rounded-lg"
                        data-testid="input-policy-end-date"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

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
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger className="h-11 rounded-lg" data-testid="select-fuel-type">
                          <SelectValue placeholder="Select fuel type" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="Electric" data-testid="option-electric">
                          Electric
                        </SelectItem>
                        <SelectItem value="Hybrid" data-testid="option-hybrid">
                          Hybrid
                        </SelectItem>
                        <SelectItem value="Petrol" data-testid="option-petrol">
                          Petrol
                        </SelectItem>
                        <SelectItem value="Diesel" data-testid="option-diesel">
                          Diesel
                        </SelectItem>
                      </SelectContent>
                    </Select>
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
                        type="text"
                        inputMode="decimal"
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
                    {voluntaryExcessWarning && !form.formState.errors.voluntary_excess && (
                      <p className="text-sm text-amber-600 dark:text-amber-400" data-testid="warning-voluntary-excess">{voluntaryExcessWarning}</p>
                    )}
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
