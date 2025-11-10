import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { X, Plane } from "lucide-react";

interface Notification {
  id: number;
  email_id: string;
  message: string;
  destination: string | null;
  email_subject: string | null;
  email_date: string | null;
  departure_date: string | null;
  dismissed: boolean;
  created_at: string;
}

interface NotificationPanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userEmail: string;
}

export function NotificationPanel({ open, onOpenChange, userEmail }: NotificationPanelProps) {
  const { toast } = useToast();

  const { data: allNotifications = [], isLoading } = useQuery<Notification[]>({
    queryKey: ["/api/notifications", userEmail],
    queryFn: async () => {
      const response = await fetch(`/api/notifications/${encodeURIComponent(userEmail)}`);
      if (!response.ok) throw new Error("Failed to fetch notifications");
      return response.json();
    },
    enabled: open,
  });

  // Filter out dismissed notifications
  const notifications = allNotifications.filter(n => !n.dismissed);

  // Dismiss notification mutation
  const dismissMutation = useMutation({
    mutationFn: async (notificationId: number) => {
      return apiRequest("POST", `/api/notifications/${notificationId}/dismiss`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/notifications", userEmail] });
      queryClient.invalidateQueries({ queryKey: ["/api/notifications/count", userEmail] });
      toast({
        title: "Notification Dismissed",
        description: "The notification has been dismissed.",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to dismiss notification",
        variant: "destructive",
      });
    },
  });

  const handleDismiss = (notificationId: number) => {
    dismissMutation.mutate(notificationId);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md h-[80vh] flex flex-col p-0">
        <DialogHeader className="px-6 py-4 border-b">
          <div className="flex items-center justify-between">
            <DialogTitle>Notifications</DialogTitle>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => onOpenChange(false)}
              data-testid="button-close-notifications"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </DialogHeader>

        <ScrollArea className="flex-1 px-6">
          <div className="space-y-4 py-4">
            {isLoading ? (
              <div className="text-center text-muted-foreground py-8">
                Loading notifications...
              </div>
            ) : notifications.length === 0 ? (
              <div className="text-center text-muted-foreground py-8">
                <Plane className="h-12 w-12 mx-auto mb-4 opacity-20" />
                <p>No notifications yet</p>
                <p className="text-sm mt-2">
                  Enable Email integration to get travel insurance suggestions
                </p>
              </div>
            ) : (
              notifications.map((notification) => (
                <div
                  key={notification.id}
                  className="p-4 rounded-lg border border-border bg-card hover-elevate transition-all"
                  data-testid={`notification-${notification.id}`}
                >
                  <div className="flex gap-3">
                    <div className="flex-shrink-0">
                      <div className="bg-primary/10 p-2 rounded-full">
                        <Plane className="h-5 w-5 text-primary" />
                      </div>
                    </div>
                    <div className="flex-1 space-y-1">
                      <p className="text-sm text-foreground">
                        {notification.message}
                      </p>
                      {notification.destination && (
                        <p className="text-xs text-muted-foreground">
                          Destination: {notification.destination}
                        </p>
                      )}
                      {notification.departure_date && (
                        <p className="text-xs text-muted-foreground">
                          Date: {new Date(notification.departure_date).toLocaleDateString()}
                        </p>
                      )}
                      <p className="text-xs text-muted-foreground">
                        {new Date(notification.created_at).toLocaleString()}
                      </p>
                      <div className="mt-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleDismiss(notification.id)}
                          disabled={dismissMutation.isPending}
                          className="text-xs"
                          data-testid={`button-dismiss-${notification.id}`}
                        >
                          {dismissMutation.isPending ? "Dismissing..." : "Dismiss"}
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
