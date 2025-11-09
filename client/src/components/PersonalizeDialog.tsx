import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface PersonalizeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userEmail: string;
}

export function PersonalizeDialog({ open, onOpenChange, userEmail }: PersonalizeDialogProps) {
  const { toast } = useToast();
  const [emailEnabled, setEmailEnabled] = useState(false);
  const [calendarEnabled, setCalendarEnabled] = useState(false);
  const [gmailId, setGmailId] = useState("");
  const [showGmailInput, setShowGmailInput] = useState(false);

  // Fetch current personalization settings
  const { data: settings } = useQuery({
    queryKey: ["/api/personalization", userEmail],
    enabled: open,
  });

  // Enable email integration mutation
  const enableEmailMutation = useMutation({
    mutationFn: async (gmail: string) => {
      const response = await fetch("/api/personalization/enable-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email_id: userEmail, gmail_id: gmail }),
      });
      if (!response.ok) throw new Error("Failed to enable email integration");
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Email integration enabled",
        description: "Redirecting to Google OAuth...",
      });
      // Will redirect to OAuth in response
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to enable email integration",
        variant: "destructive",
      });
    },
  });

  const handleEmailToggle = (enabled: boolean) => {
    if (enabled) {
      setShowGmailInput(true);
      setEmailEnabled(true);
    } else {
      setShowGmailInput(false);
      setEmailEnabled(false);
      setGmailId("");
    }
  };

  const handleConnectGmail = () => {
    if (!gmailId.trim()) {
      toast({
        title: "Error",
        description: "Please enter your Gmail ID",
        variant: "destructive",
      });
      return;
    }

    enableEmailMutation.mutate(gmailId);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Personalization Settings</DialogTitle>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Email Integration */}
          <div className="flex items-center justify-between">
            <Label htmlFor="email-toggle" className="text-base">
              Email
            </Label>
            <Switch
              id="email-toggle"
              checked={emailEnabled}
              onCheckedChange={handleEmailToggle}
              data-testid="switch-email"
            />
          </div>

          {showGmailInput && (
            <div className="space-y-3 pl-4">
              <Input
                type="email"
                placeholder="Enter your Gmail ID"
                value={gmailId}
                onChange={(e) => setGmailId(e.target.value)}
                data-testid="input-gmail"
              />
              <Button
                onClick={handleConnectGmail}
                disabled={enableEmailMutation.isPending}
                className="w-full"
                data-testid="button-connect-gmail"
              >
                {enableEmailMutation.isPending ? "Connecting..." : "Connect Gmail"}
              </Button>
            </div>
          )}

          {/* Calendar Integration (Inactive for now) */}
          <div className="flex items-center justify-between opacity-50">
            <Label htmlFor="calendar-toggle" className="text-base">
              Calendar
            </Label>
            <Switch
              id="calendar-toggle"
              checked={calendarEnabled}
              onCheckedChange={setCalendarEnabled}
              disabled
              data-testid="switch-calendar"
            />
          </div>
          <p className="text-xs text-muted-foreground pl-4">
            Calendar integration coming soon
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
