import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Mail, Scan } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

interface ConfigureAutoSageDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userEmail: string;
}

export function ConfigureAutoSageDialog({ open, onOpenChange, userEmail }: ConfigureAutoSageDialogProps) {
  const { toast } = useToast();

  // Gmail scan mutation
  const scanGmailMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("POST", "/api/gmail/scan", { email_id: userEmail });
    },
    onSuccess: (data: any) => {
      const count = data.notificationsCreated || 0;
      toast({
        title: "Scan Complete",
        description: count > 0 
          ? `Found ${count} new travel notification${count !== 1 ? 's' : ''}!` 
          : "No new travel emails found.",
      });
    },
    onError: (error) => {
      toast({
        title: "Scan Failed",
        description: error instanceof Error ? error.message : "Failed to scan Gmail",
        variant: "destructive",
      });
    },
  });

  const handleScanGmail = () => {
    scanGmailMutation.mutate();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Configure AutoSage</DialogTitle>
          <DialogDescription>
            Manage your AutoSage settings and scan for travel notifications
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Mail className="h-4 w-4" />
                Email Scan
              </CardTitle>
              <CardDescription>
                Scan your connected Gmail for travel booking emails
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div>
                  <Label className="text-sm text-muted-foreground">
                    AutoSage will scan your Gmail for flight tickets, hotel bookings, and travel itineraries.
                    When found, you'll get notifications to find travel insurance for your trips.
                  </Label>
                </div>
                <Button
                  onClick={handleScanGmail}
                  disabled={scanGmailMutation.isPending}
                  className="w-full"
                  data-testid="button-scan-gmail"
                >
                  <Scan className="h-4 w-4 mr-2" />
                  {scanGmailMutation.isPending ? "Scanning..." : "Scan Now"}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </DialogContent>
    </Dialog>
  );
}
