import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useQuery } from "@tanstack/react-query";
import { X, Plane } from "lucide-react";

interface Notification {
  id: number;
  email_id: string;
  message: string;
  destination: string | null;
  departure_date: string | null;
  created_at: string;
  is_read: boolean;
}

interface NotificationPanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userEmail: string;
}

export function NotificationPanel({ open, onOpenChange, userEmail }: NotificationPanelProps) {
  const { data: notifications = [], isLoading } = useQuery<Notification[]>({
    queryKey: ["/api/notifications", userEmail],
    enabled: open,
  });

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
