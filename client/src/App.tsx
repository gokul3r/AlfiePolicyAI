import { useState } from "react";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import HomePage from "@/components/HomePage";
import NewUserDialog from "@/components/NewUserDialog";
import ExistingUserDialog from "@/components/ExistingUserDialog";
import ConfirmationMessage from "@/components/ConfirmationMessage";

type AppState = "home" | "confirmation" | "welcome";

function App() {
  const [appState, setAppState] = useState<AppState>("home");
  const [newUserDialogOpen, setNewUserDialogOpen] = useState(false);
  const [existingUserDialogOpen, setExistingUserDialogOpen] = useState(false);
  const [confirmationMessage, setConfirmationMessage] = useState("");

  const handleNewUser = () => {
    setNewUserDialogOpen(true);
  };

  const handleExistingUser = () => {
    setExistingUserDialogOpen(true);
  };

  const handleNewUserSubmit = (userName: string, email: string) => {
    console.log("New user created:", { userName, email });
    setNewUserDialogOpen(false);
    setConfirmationMessage("User ID Created");
    setAppState("confirmation");
  };

  const handleExistingUserSubmit = (email: string) => {
    console.log("Existing user login:", email);
    setExistingUserDialogOpen(false);
    const userName = "John Doe";
    setConfirmationMessage(`Welcome - ${userName}`);
    setAppState("welcome");
  };

  const handleContinue = () => {
    setAppState("home");
    setConfirmationMessage("");
  };

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
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

        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
