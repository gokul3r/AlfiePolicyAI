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
import OnboardingDialog from "@/components/OnboardingDialog";
import UploadDialog from "@/components/UploadDialog";
import ManualEntryForm, { type VehiclePolicyFormData } from "@/components/ManualEntryForm";
import type { User, InsertVehiclePolicy, VehiclePolicy } from "@shared/schema";
import { apiRequest } from "./lib/queryClient";

type AppState = "home" | "confirmation" | "welcome" | "onboarding";

function AppContent() {
  const [appState, setAppState] = useState<AppState>("home");
  const [newUserDialogOpen, setNewUserDialogOpen] = useState(false);
  const [existingUserDialogOpen, setExistingUserDialogOpen] = useState(false);
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [manualEntryFormOpen, setManualEntryFormOpen] = useState(false);
  const [confirmationMessage, setConfirmationMessage] = useState("");
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [extractedData, setExtractedData] = useState<Partial<VehiclePolicyFormData> | null>(null);
  const [missingFields, setMissingFields] = useState<string[]>([]);
  const { toast } = useToast();

  const createUserMutation = useMutation({
    mutationFn: async ({ user_name, email_id }: { user_name: string; email_id: string }) => {
      const res = await apiRequest("POST", "/api/users", { user_name, email_id });
      return await res.json() as User;
    },
    onSuccess: () => {
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
      const res = await apiRequest("POST", "/api/vehicle-policies", policyData);
      return await res.json() as VehiclePolicy;
    },
    onSuccess: () => {
      setManualEntryFormOpen(false);
      setAppState("welcome");
      toast({
        title: "Success",
        description: "Vehicle policy details saved successfully!",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Submission Failed",
        description: "Unable to save vehicle policy. Please try again.",
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
    if (appState === "welcome") {
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
    // Map API field names to form field names (handle casing differences)
    const mappedData: Partial<VehiclePolicyFormData> = {
      vehicle_registration_number: extractedFields.vehicle_registration_number,
      vehicle_manufacturer_name: extractedFields.vehicle_manufacturer_name,
      vehicle_model: extractedFields.vehicle_model,
      vehicle_year: extractedFields.vehicle_year,
      type_of_fuel: extractedFields.type_of_fuel,
      type_of_cover_needed: extractedFields.type_of_Cover_needed, // Note: different casing in API
      no_claim_bonus_years: extractedFields.No_Claim_bonus_years, // Note: different casing in API
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

    // Generate vehicle_id from manufacturer name + random numbers
    const randomSuffix = Math.floor(Math.random() * 1000);
    const vehicle_id = `${formData.vehicle_manufacturer_name}${randomSuffix}`;

    const policyData = {
      vehicle_id,
      email_id: currentUser.email_id,
      ...formData,
    };

    createVehiclePolicyMutation.mutate(policyData);
    
    // Reset extracted data after submission
    setExtractedData(null);
    setMissingFields([]);
  };

  const handleManualEntryCancel = () => {
    setManualEntryFormOpen(false);
    setExtractedData(null);
    setMissingFields([]);
    setAppState("welcome");
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

      {(appState === "confirmation" || appState === "welcome") && (
        <ConfirmationMessage
          message={confirmationMessage}
          onContinue={handleContinue}
        />
      )}

      {appState === "onboarding" && (
        <OnboardingDialog
          onUploadDocuments={handleUploadDocument}
          onEnterManually={handleEnterManually}
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
            initialValues={extractedData || undefined}
            missingFields={missingFields}
            onSubmit={handleManualEntrySubmit}
            onCancel={handleManualEntryCancel}
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
