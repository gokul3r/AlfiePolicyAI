import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Mail, CheckCircle2, XCircle, Shield } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

interface PersonalizeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userEmail: string;
}

export function PersonalizeDialog({ open, onOpenChange, userEmail }: PersonalizeDialogProps) {
  const { toast } = useToast();

  // Fetch Gmail connection status
  const { data: gmailStatus, isLoading, refetch } = useQuery({
    queryKey: ["/api/personalization/gmail/status", userEmail],
    queryFn: async () => {
      const response = await fetch(`/api/personalization/gmail/status?email=${encodeURIComponent(userEmail)}`);
      if (!response.ok) throw new Error("Failed to fetch Gmail status");
      return response.json();
    },
    enabled: open,
  });

  // Check for OAuth success/error in URL params
  useEffect(() => {
    if (open) {
      const params = new URLSearchParams(window.location.search);
      const gmailParam = params.get('gmail');
      
      if (gmailParam === 'success') {
        toast({
          title: "Gmail Connected",
          description: "Your Gmail account has been successfully connected!",
        });
        refetch();
        // Clear URL params
        window.history.replaceState({}, '', window.location.pathname);
      } else if (gmailParam === 'error') {
        toast({
          title: "Connection Failed",
          description: "Failed to connect Gmail. Please try again.",
          variant: "destructive",
        });
        // Clear URL params
        window.history.replaceState({}, '', window.location.pathname);
      }
    }
  }, [open, toast, refetch]);

  // Connect Gmail mutation
  const connectGmailMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch(`/api/personalization/gmail/authorize?email=${encodeURIComponent(userEmail)}`);
      if (!response.ok) throw new Error("Failed to start OAuth flow");
      return response.json();
    },
    onSuccess: (data) => {
      // Redirect to Google OAuth
      if (data.authUrl) {
        window.location.href = data.authUrl;
      }
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to connect Gmail",
        variant: "destructive",
      });
    },
  });

  // Disconnect Gmail mutation
  const disconnectGmailMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("POST", "/api/personalization/gmail/disconnect", { email: userEmail });
    },
    onSuccess: () => {
      toast({
        title: "Gmail Disconnected",
        description: "Your Gmail account has been disconnected.",
      });
      refetch();
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to disconnect Gmail",
        variant: "destructive",
      });
    },
  });

  const handleConnectGmail = () => {
    connectGmailMutation.mutate();
  };

  const handleDisconnectGmail = () => {
    if (confirm("Are you sure you want to disconnect your Gmail account? You will stop receiving travel insurance notifications.")) {
      disconnectGmailMutation.mutate();
    }
  };

  const isConnected = gmailStatus?.isConnected || false;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Personalization Settings</DialogTitle>
          <DialogDescription>
            Connect your Gmail to receive personalized travel insurance notifications
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Gmail Integration Card */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-full bg-primary/10">
                  <Mail className="h-5 w-5 text-primary" />
                </div>
                <div className="flex-1">
                  <CardTitle className="text-base">Gmail Integration</CardTitle>
                  <CardDescription className="text-xs">
                    Scan your emails for travel bookings
                  </CardDescription>
                </div>
                {isConnected ? (
                  <Badge variant="default" className="gap-1">
                    <CheckCircle2 className="h-3 w-3" />
                    Connected
                  </Badge>
                ) : (
                  <Badge variant="outline" className="gap-1">
                    <XCircle className="h-3 w-3" />
                    Not Connected
                  </Badge>
                )}
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Privacy Notice */}
              <div className="flex gap-2 p-3 rounded-lg bg-muted/50">
                <Shield className="h-4 w-4 text-muted-foreground flex-shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <p className="text-xs font-medium">Your Privacy Matters</p>
                  <p className="text-xs text-muted-foreground">
                    We only access your emails to find travel bookings. We use read-only permissions and never send emails on your behalf.
                  </p>
                </div>
              </div>

              {/* Connection Status */}
              {isLoading ? (
                <p className="text-sm text-muted-foreground">Loading connection status...</p>
              ) : isConnected ? (
                <div className="space-y-3">
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Connected Account</Label>
                    <p className="text-sm font-medium">{gmailStatus?.gmail_id}</p>
                  </div>
                  {gmailStatus?.last_scan && (
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">Last Scanned</Label>
                      <p className="text-sm">{new Date(gmailStatus.last_scan).toLocaleString()}</p>
                    </div>
                  )}
                  <Button
                    variant="outline"
                    onClick={handleDisconnectGmail}
                    disabled={disconnectGmailMutation.isPending}
                    className="w-full"
                    data-testid="button-disconnect-gmail"
                  >
                    {disconnectGmailMutation.isPending ? "Disconnecting..." : "Disconnect Gmail"}
                  </Button>
                </div>
              ) : (
                <div className="space-y-3">
                  <p className="text-sm text-muted-foreground">
                    Connect your Gmail to automatically get notified when you book travel and need insurance coverage.
                  </p>
                  <Button
                    onClick={handleConnectGmail}
                    disabled={connectGmailMutation.isPending}
                    className="w-full"
                    data-testid="button-connect-gmail"
                  >
                    {connectGmailMutation.isPending ? "Connecting..." : "Connect Gmail"}
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Calendar Integration (Coming Soon) */}
          <Card className="opacity-60">
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-full bg-muted">
                  <Mail className="h-5 w-5 text-muted-foreground" />
                </div>
                <div className="flex-1">
                  <CardTitle className="text-base">Calendar Integration</CardTitle>
                  <CardDescription className="text-xs">
                    Coming soon
                  </CardDescription>
                </div>
                <Badge variant="outline">Soon</Badge>
              </div>
            </CardHeader>
          </Card>
        </div>
      </DialogContent>
    </Dialog>
  );
}
