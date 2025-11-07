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
import type { User } from "@shared/schema";
import { apiRequest } from "./lib/queryClient";

type AppState = "home" | "confirmation" | "welcome" | "onboarding";

function AppContent() {
  const [appState, setAppState] = useState<AppState>("home");
  const [newUserDialogOpen, setNewUserDialogOpen] = useState(false);
  const [existingUserDialogOpen, setExistingUserDialogOpen] = useState(false);
  const [confirmationMessage, setConfirmationMessage] = useState("");
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
          onUploadDocuments={() => {}}
          onEnterManually={() => {}}
        />
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
