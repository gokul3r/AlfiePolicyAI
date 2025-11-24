import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { AlertTriangle } from "lucide-react";

interface CancelConfirmationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
  policyNumber: string;
  isLoading?: boolean;
}

export function CancelConfirmationDialog({
  open,
  onOpenChange,
  onConfirm,
  policyNumber,
  isLoading = false,
}: CancelConfirmationDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md" data-testid="dialog-cancel-confirmation">
        <DialogHeader>
          <div className="flex items-center justify-center mb-4">
            <div className="h-12 w-12 rounded-full bg-destructive/10 flex items-center justify-center">
              <AlertTriangle className="h-6 w-6 text-destructive" />
            </div>
          </div>
          <DialogTitle className="text-center text-xl">
            Cancel Policy?
          </DialogTitle>
          <DialogDescription className="text-center text-base pt-2">
            Cancelling policy <span className="font-semibold">{policyNumber}</span> will incur cancellation charges of <span className="font-semibold">£20</span>. 
            <br /><br />
            Would you like to continue?
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="flex-row gap-2 sm:gap-2">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="flex-1"
            disabled={isLoading}
            data-testid="button-cancel-no"
          >
            No, Keep Policy
          </Button>
          <Button
            variant="destructive"
            onClick={onConfirm}
            className="flex-1"
            disabled={isLoading}
            data-testid="button-cancel-yes"
          >
            {isLoading ? "Cancelling..." : "Yes, Cancel Policy"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
