import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Sparkles } from "lucide-react";

interface ComingSoonDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  featureName: string;
}

export function ComingSoonDialog({
  open,
  onOpenChange,
  featureName,
}: ComingSoonDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center justify-center mb-4">
            <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
              <Sparkles className="h-6 w-6 text-primary" />
            </div>
          </div>
          <DialogTitle className="text-center text-xl">
            Coming Soon
          </DialogTitle>
          <DialogDescription className="text-center text-base pt-2">
            AutoAnnie will support {featureName} soon. We're working hard to bring you this feature with the same level of care and intelligence you've come to expect.
          </DialogDescription>
        </DialogHeader>
        <div className="flex justify-center pt-4">
          <Button
            onClick={() => onOpenChange(false)}
            className="w-full sm:w-auto"
            data-testid="button-coming-soon-ok"
          >
            OK, Got it
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
