import { useState } from "react";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider, useMutation } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useToast } from "@/hooks/use-toast";
import HomePage from "@/components/HomePage";
import NewUserDialog from "@/components/NewUserDialog";
import ExistingUserDialog from "@/components/ExistingUserDialog";
import ConfirmationMessage from "@/components/ConfirmationMessage";
import WelcomeScreen from "@/components/WelcomeScreen";
import OnboardingDialog from "@/components/OnboardingDialog";
import UploadDialog from "@/components/UploadDialog";
import ManualEntryForm, { type VehiclePolicyFormData } from "@/components/ManualEntryForm";
import WhisperDialog from "@/components/WhisperDialog";
import QuoteSearchDialog from "@/components/QuoteSearchDialog";
import QuotesScreen from "@/components/QuotesScreen";
import type { User, InsertVehiclePolicy, VehiclePolicy, QuotesApiResponse } from "@shared/schema";
import { apiRequest } from "./lib/queryClient";
import { useQuery } from "@tanstack/react-query";

type AppState = "home" | "confirmation" | "welcome" | "onboarding" | "quotes";

const ALLOWED_FUEL_TYPES = ["Electric", "Hybrid", "Petrol", "Diesel"] as const;

function sanitizePolicyForForm(policy: VehiclePolicy | Partial<VehiclePolicyFormData> | null): Partial<VehiclePolicyFormData> | undefined {
  if (!policy) return undefined;
  
  const sanitized: Partial<VehiclePolicyFormData> = {
    // New policy fields
    policy_number: policy.policy_number,
    policy_start_date: policy.policy_start_date,
    policy_end_date: policy.policy_end_date,
    current_policy_cost: policy.current_policy_cost,
    current_insurance_provider: policy.current_insurance_provider,
    // Vehicle detail fields
    driver_age: policy.driver_age,
    vehicle_registration_number: policy.vehicle_registration_number,
    vehicle_manufacturer_name: policy.vehicle_manufacturer_name,
    vehicle_model: policy.vehicle_model,
    vehicle_year: policy.vehicle_year,
    type_of_cover_needed: policy.type_of_cover_needed,
    no_claim_bonus_years: policy.no_claim_bonus_years,
    voluntary_excess: policy.voluntary_excess,
  };
  
  if (policy.type_of_fuel && ALLOWED_FUEL_TYPES.includes(policy.type_of_fuel as any)) {
    sanitized.type_of_fuel = policy.type_of_fuel as "Electric" | "Hybrid" | "Petrol" | "Diesel";
  }
  
  return sanitized;
}

function AppContent() {
  const [appState, setAppState] = useState<AppState>("home");
  const [newUserDialogOpen, setNewUserDialogOpen] = useState(false);
  const [existingUserDialogOpen, setExistingUserDialogOpen] = useState(false);
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [manualEntryFormOpen, setManualEntryFormOpen] = useState(false);
  const [whisperDialogOpen, setWhisperDialogOpen] = useState(false);
  const [quoteSearchDialogOpen, setQuoteSearchDialogOpen] = useState(false);
  const [confirmationMessage, setConfirmationMessage] = useState("");
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [extractedData, setExtractedData] = useState<Partial<VehiclePolicyFormData> | null>(null);
  const [missingFields, setMissingFields] = useState<string[]>([]);
  const [editingPolicy, setEditingPolicy] = useState<VehiclePolicy | null>(null);
  const [quotesData, setQuotesData] = useState<QuotesApiResponse | null>(null);
  const [selectedVehicleForQuotes, setSelectedVehicleForQuotes] = useState<VehiclePolicy | null>(null);
  const { toast } = useToast();

  const { data: userPolicies = [] } = useQuery<VehiclePolicy[]>({
    queryKey: ["/api/vehicle-policies", currentUser?.email_id],
    enabled: !!currentUser?.email_id,
  });

  const createUserMutation = useMutation({
    mutationFn: async ({ user_name, email_id }: { user_name: string; email_id: string }) => {
      const res = await apiRequest("POST", "/api/users", { user_name, email_id });
      return await res.json() as User;
    },
    onSuccess: (user) => {
      setCurrentUser(user);
      setNewUserDialogOpen(false);
      setConfirmationMessage("User ID Created");
      setAppState("confirmation");
    },
    onError: (error: any) => {
      const errorMessage = error.message?.includes("Email already registered") || error.message?.includes("400")
        ? "This email is already registered. Please use the 'Existing User' option to login."
        : "Unable to create account. Please try again.";
      
      toast({
        title: "Registration Failed",
        description: errorMessage,
        variant: "destructive",
      });
    },
  });

  const loginMutation = useMutation({
    mutationFn: async (email_id: string) => {
      const res = await apiRequest("POST", "/api/users/login", { email_id });
      return await res.json() as User;
    },
    onSuccess: (user) => {
      setCurrentUser(user);
      setExistingUserDialogOpen(false);
      setConfirmationMessage(`Welcome - ${user.user_name}`);
      setAppState("welcome");
    },
    onError: (error: any) => {
      const errorMessage = error.message?.includes("User not found") || error.message?.includes("404")
        ? "User not found. Please check your email or create a new account."
        : "Unable to login. Please try again.";
      
      toast({
        title: "Login Failed",
        description: errorMessage,
        variant: "destructive",
      });
    },
  });

  const createVehiclePolicyMutation = useMutation({
    mutationFn: async (policyData: InsertVehiclePolicy) => {
      console.log("[createVehiclePolicy] Starting mutation with data:", policyData);
      const res = await apiRequest("POST", "/api/vehicle-policies", policyData);
      console.log("[createVehiclePolicy] API request successful, response status:", res.status);
      const data = await res.json();
      console.log("[createVehiclePolicy] Response parsed:", data);
      return data;
    },
    onSuccess: (data) => {
      console.log("[createVehiclePolicy] onSuccess called with:", data);
      setManualEntryFormOpen(false);
      setAppState("welcome");
      queryClient.invalidateQueries({ queryKey: ["/api/vehicle-policies", currentUser?.email_id] });
      toast({
        title: "Success",
        description: "Vehicle policy details saved successfully!",
      });
    },
    onError: (error: any) => {
      console.error("[createVehiclePolicy] onError called with:", error);
      
      // Check for duplicate policy error (409 Conflict)
      const errorMessage = error.message || "";
      if (errorMessage.includes("409")) {
        toast({
          title: "Vehicle Already Exists",
          description: "You already have a policy for this vehicle. Please edit the existing policy instead of creating a new one.",
          variant: "destructive",
        });
      } else {
        toast({
          title: "Submission Failed",
          description: "Unable to save vehicle policy. Please try again.",
          variant: "destructive",
        });
      }
    },
  });

  const updateVehiclePolicyMutation = useMutation({
    mutationFn: async ({ policyId, email, updates }: { policyId: string; email: string; updates: InsertVehiclePolicy }) => {
      const res = await apiRequest("PUT", `/api/vehicle-policies/${email}/${policyId}`, updates);
      return await res.json();
    },
    onSuccess: () => {
      setManualEntryFormOpen(false);
      setEditingPolicy(null);
      setAppState("welcome");
      queryClient.invalidateQueries({ queryKey: ["/api/vehicle-policies", currentUser?.email_id] });
      toast({
        title: "Success",
        description: "Vehicle policy updated successfully!",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Update Failed",
        description: "Unable to update vehicle policy. Please try again.",
        variant: "destructive",
      });
    },
  });

  const whisperUpdateMutation = useMutation({
    mutationFn: async ({ vehicleId, email, preferences }: { vehicleId: string; email: string; preferences: string }) => {
      // vehicleId is actually policy_id now, but keeping parameter name for component compatibility
      const res = await apiRequest("PUT", `/api/vehicle-policies/${email}/${vehicleId}`, { 
        policy: {
          email_id: email,
          policy_type: 'car' as const,
          whisper_preferences: preferences
        },
        details: {} // Empty details object, not updating vehicle details
      });
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/vehicle-policies", currentUser?.email_id] });
      toast({
        title: "Success",
        description: "Whisper preferences saved successfully!",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Failed",
        description: "Unable to save whisper preferences. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleNewUser = () => {
    setNewUserDialogOpen(true);
  };

  const handleExistingUser = () => {
    setExistingUserDialogOpen(true);
  };

  const handleNewUserSubmit = (userName: string, email: string) => {
    createUserMutation.mutate({ user_name: userName, email_id: email });
  };

  const handleExistingUserSubmit = (email: string) => {
    loginMutation.mutate(email);
  };

  const handleContinue = () => {
    if (appState === "confirmation") {
      setAppState("welcome");
    } else if (appState === "welcome") {
      setAppState("onboarding");
    } else {
      setAppState("home");
      setConfirmationMessage("");
    }
  };

  const handleUploadDocument = () => {
    setUploadDialogOpen(true);
  };

  const handleUploadCancel = () => {
    setUploadDialogOpen(false);
    setAppState("welcome");
  };

  const handleExtracted = (extractedFields: any, notExtractedFields: string[]) => {
    // Helper function to convert DD/MM/YYYY to YYYY-MM-DD format for HTML date inputs
    const convertDateFormat = (dateStr: string | undefined): string | undefined => {
      if (!dateStr) return undefined;
      // Check if date is in DD/MM/YYYY format
      const parts = dateStr.split('/');
      if (parts.length === 3) {
        const [day, month, year] = parts;
        return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
      }
      return dateStr; // Return as-is if not in expected format
    };

    // Helper function to normalize fuel type (API returns "Electric Vehicle" but form expects "Electric")
    const normalizeFuelType = (fuel: string | undefined): string | undefined => {
      if (!fuel) return undefined;
      const fuelLower = fuel.toLowerCase();
      if (fuelLower.includes('electric')) return 'Electric';
      if (fuelLower.includes('hybrid')) return 'Hybrid';
      if (fuelLower.includes('petrol')) return 'Petrol';
      if (fuelLower.includes('diesel')) return 'Diesel';
      return fuel;
    };

    // Map API field names to form field names (handle casing differences)
    const mappedData: Partial<VehiclePolicyFormData> = {
      // Vehicle details
      vehicle_registration_number: extractedFields.vehicle_registration_number,
      vehicle_manufacturer_name: extractedFields.vehicle_manufacturer_name,
      vehicle_model: extractedFields.vehicle_model?.replace(/\n/g, ' '), // Clean up newlines in model name
      vehicle_year: extractedFields.vehicle_year,
      type_of_fuel: normalizeFuelType(extractedFields.type_of_fuel),
      type_of_cover_needed: extractedFields.type_of_Cover_needed, // Note: different casing in API
      no_claim_bonus_years: extractedFields.No_Claim_bonus_years, // Note: different casing in API
      
      // New fields from updated API (5 additional fields)
      policy_number: extractedFields.Policy_Number,
      current_insurance_provider: extractedFields.Current_Insurance_Provider,
      policy_start_date: convertDateFormat(extractedFields.Policy_Start_Date),
      policy_end_date: convertDateFormat(extractedFields.Policy_End_Date),
      voluntary_excess: extractedFields.Voluntary_Excess,
      
      // Additional fields that might be extracted
      current_policy_cost: extractedFields.Current_Policy_Cost,
      driver_age: extractedFields.driver_age,
    };

    setExtractedData(mappedData);
    setMissingFields(notExtractedFields);
    setUploadDialogOpen(false);
    setManualEntryFormOpen(true);
  };

  const handleEnterManually = () => {
    // Reset extracted data for manual entry
    setExtractedData(null);
    setMissingFields([]);
    setManualEntryFormOpen(true);
  };

  const handleManualEntrySubmit = (formData: VehiclePolicyFormData) => {
    if (!currentUser) return;

    if (editingPolicy) {
      // Update existing policy - merge existing data with form updates to preserve all fields
      const policyData = {
        policy: {
          email_id: currentUser.email_id,
          policy_type: editingPolicy.policy_type || ('car' as const),
          // Use form values if provided, otherwise keep existing values
          policy_number: formData.policy_number ?? editingPolicy.policy_number,
          policy_start_date: formData.policy_start_date ?? editingPolicy.policy_start_date,
          policy_end_date: formData.policy_end_date ?? editingPolicy.policy_end_date,
          current_policy_cost: formData.current_policy_cost ?? editingPolicy.current_policy_cost,
          current_insurance_provider: formData.current_insurance_provider ?? editingPolicy.current_insurance_provider,
          whisper_preferences: editingPolicy.whisper_preferences,
        },
        details: {
          driver_age: formData.driver_age ?? editingPolicy.driver_age,
          vehicle_registration_number: formData.vehicle_registration_number ?? editingPolicy.vehicle_registration_number,
          vehicle_manufacturer_name: formData.vehicle_manufacturer_name ?? editingPolicy.vehicle_manufacturer_name,
          vehicle_model: formData.vehicle_model ?? editingPolicy.vehicle_model,
          vehicle_year: formData.vehicle_year ?? editingPolicy.vehicle_year,
          type_of_fuel: formData.type_of_fuel ?? editingPolicy.type_of_fuel,
          type_of_cover_needed: formData.type_of_cover_needed ?? editingPolicy.type_of_cover_needed,
          no_claim_bonus_years: formData.no_claim_bonus_years ?? editingPolicy.no_claim_bonus_years,
          voluntary_excess: formData.voluntary_excess ?? editingPolicy.voluntary_excess,
        },
      };

      updateVehiclePolicyMutation.mutate({
        policyId: editingPolicy.policy_id,
        email: currentUser.email_id,
        updates: policyData,
      });
    } else {
      // Create new policy - restructure for new API format
      const policyData = {
        policy: {
          email_id: currentUser.email_id,
          policy_type: 'car' as const,
          policy_number: formData.policy_number,
          policy_start_date: formData.policy_start_date,
          policy_end_date: formData.policy_end_date,
          current_policy_cost: formData.current_policy_cost,
          current_insurance_provider: formData.current_insurance_provider,
        },
        details: {
          driver_age: formData.driver_age,
          vehicle_registration_number: formData.vehicle_registration_number,
          vehicle_manufacturer_name: formData.vehicle_manufacturer_name,
          vehicle_model: formData.vehicle_model,
          vehicle_year: formData.vehicle_year,
          type_of_fuel: formData.type_of_fuel,
          type_of_cover_needed: formData.type_of_cover_needed,
          no_claim_bonus_years: formData.no_claim_bonus_years,
          voluntary_excess: formData.voluntary_excess,
        },
      };

      createVehiclePolicyMutation.mutate(policyData);
    }
    
    // Reset extracted data after submission
    setExtractedData(null);
    setMissingFields([]);
  };

  const handleManualEntryCancel = () => {
    setManualEntryFormOpen(false);
    setExtractedData(null);
    setMissingFields([]);
    setEditingPolicy(null);
    setAppState("welcome");
  };

  const handleAddPolicy = () => {
    setEditingPolicy(null);
    setExtractedData(null);
    setMissingFields([]);
    setAppState("onboarding");
  };

  const handleEditPolicy = (policy: VehiclePolicy) => {
    setEditingPolicy(policy);
    setExtractedData(null);
    setMissingFields([]);
    setManualEntryFormOpen(true);
  };

  const handleWhisper = () => {
    setWhisperDialogOpen(true);
  };

  const handleWhisperSubmit = async (vehicleId: string, preferences: string) => {
    if (!currentUser) return;

    await whisperUpdateMutation.mutateAsync({
      vehicleId,
      email: currentUser.email_id,
      preferences,
    });
  };

  const handleSearchQuotes = () => {
    setQuoteSearchDialogOpen(true);
  };

  const handleQuoteSearchSubmit = (vehicle: VehiclePolicy, quotes: QuotesApiResponse) => {
    setSelectedVehicleForQuotes(vehicle);
    setQuotesData(quotes);
    setQuoteSearchDialogOpen(false);
    setAppState("quotes");
  };

  const handleBackFromQuotes = () => {
    setAppState("welcome");
    setQuotesData(null);
    setSelectedVehicleForQuotes(null);
  };

  return (
    <>
      {appState === "home" && (
        <>
          <HomePage 
            onNewUser={handleNewUser}
            onExistingUser={handleExistingUser}
          />
          <NewUserDialog
            open={newUserDialogOpen}
            onOpenChange={setNewUserDialogOpen}
            onSubmit={handleNewUserSubmit}
          />
          <ExistingUserDialog
            open={existingUserDialogOpen}
            onOpenChange={setExistingUserDialogOpen}
            onSubmit={handleExistingUserSubmit}
          />
        </>
      )}

      {appState === "confirmation" && (
        <ConfirmationMessage
          message={confirmationMessage}
          onContinue={handleContinue}
        />
      )}

      {appState === "welcome" && currentUser && (
        <WelcomeScreen
          userName={currentUser.user_name}
          userEmail={currentUser.email_id}
          onAddPolicy={handleAddPolicy}
          onEditPolicy={handleEditPolicy}
          onWhisper={handleWhisper}
          onSearchQuotes={handleSearchQuotes}
        />
      )}

      {appState === "onboarding" && (
        <OnboardingDialog
          onUploadDocuments={handleUploadDocument}
          onEnterManually={handleEnterManually}
        />
      )}

      {appState === "quotes" && selectedVehicleForQuotes && quotesData && currentUser && (
        <QuotesScreen
          vehicle={selectedVehicleForQuotes}
          quotesData={quotesData}
          userEmail={currentUser.email_id}
          onBack={handleBackFromQuotes}
          onPurchaseComplete={() => setAppState("welcome")}
        />
      )}

      {currentUser && (
        <>
          <UploadDialog
            open={uploadDialogOpen}
            onOpenChange={setUploadDialogOpen}
            onExtracted={handleExtracted}
            onCancel={handleUploadCancel}
          />
          <ManualEntryForm
            open={manualEntryFormOpen}
            onOpenChange={setManualEntryFormOpen}
            userEmail={currentUser.email_id}
            initialValues={sanitizePolicyForForm(editingPolicy || extractedData || null)}
            missingFields={missingFields}
            onSubmit={handleManualEntrySubmit}
            onCancel={handleManualEntryCancel}
            isEditMode={!!editingPolicy}
          />
          <WhisperDialog
            open={whisperDialogOpen}
            onOpenChange={setWhisperDialogOpen}
            vehicles={userPolicies}
            onSubmit={handleWhisperSubmit}
          />
          <QuoteSearchDialog
            open={quoteSearchDialogOpen}
            onOpenChange={setQuoteSearchDialogOpen}
            vehicles={userPolicies}
            onQuotesFound={handleQuoteSearchSubmit}
          />
        </>
      )}

      <Toaster />
    </>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <AppContent />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
