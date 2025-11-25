import { MessageSquare, Mic } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface ChatModeSelectorProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelectMode: (mode: "text" | "voice") => void;
}

export function ChatModeSelector({ open, onOpenChange, onSelectMode }: ChatModeSelectorProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Chat with AutoAnnie</DialogTitle>
          <DialogDescription>
            Choose how you'd like to interact
          </DialogDescription>
        </DialogHeader>
        
        <div className="grid grid-cols-2 gap-4 py-4">
          <Button
            variant="outline"
            className="h-32 flex flex-col gap-3"
            onClick={() => {
              onSelectMode("text");
              onOpenChange(false);
            }}
            data-testid="button-mode-chat"
          >
            <MessageSquare className="h-8 w-8" />
            <div className="text-center">
              <div className="font-semibold">Chat</div>
              <div className="text-xs text-muted-foreground mt-1">
                Type your questions
              </div>
            </div>
          </Button>

          <Button
            variant="outline"
            className="h-32 flex flex-col gap-3"
            onClick={() => {
              onSelectMode("voice");
              onOpenChange(false);
            }}
            data-testid="button-mode-talk"
          >
            <Mic className="h-8 w-8" />
            <div className="text-center">
              <div className="font-semibold">Talk</div>
              <div className="text-xs text-muted-foreground mt-1">
                Speak naturally
              </div>
            </div>
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
