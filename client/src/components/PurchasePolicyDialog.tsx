import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { CheckCircle2, Shield, Loader2 } from "lucide-react";

interface PurchasePolicyDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  insurerName: string;
  policyPrice: number;
  onConfirmClose: () => void;
  isPurchasing: boolean;
  purchaseComplete: boolean;
  policyNumber?: string;
}

export default function PurchasePolicyDialog({
  open,
  onOpenChange,
  insurerName,
  policyPrice,
  onConfirmClose,
  isPurchasing,
  purchaseComplete,
  policyNumber,
}: PurchasePolicyDialogProps) {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    if (isPurchasing && !purchaseComplete) {
      setProgress(0);
      const interval = setInterval(() => {
        setProgress((prev) => {
          if (prev >= 100) {
            clearInterval(interval);
            return 100;
          }
          return prev + 3.33; // Reaches 100 in ~3 seconds (30 steps * 100ms)
        });
      }, 100);

      return () => clearInterval(interval);
    }
  }, [isPurchasing, purchaseComplete]);

  useEffect(() => {
    if (purchaseComplete) {
      setProgress(100);
    }
  }, [purchaseComplete]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md" aria-describedby="purchase-dialog-description">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Shield className="w-5 h-5 text-primary" />
            {purchaseComplete ? "Policy Purchased!" : "Processing Purchase"}
          </DialogTitle>
          <DialogDescription id="purchase-dialog-description">
            {purchaseComplete 
              ? "Your new insurance policy has been successfully purchased."
              : "Please wait while we process your policy purchase."
            }
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {!purchaseComplete ? (
            <>
              <div className="flex items-center justify-center py-4">
                <Loader2 className="w-12 h-12 text-primary animate-spin" />
              </div>
              <div className="space-y-2">
                <Progress value={progress} className="h-2" />
                <p className="text-sm text-center text-muted-foreground">
                  Processing your {insurerName} policy...
                </p>
              </div>
            </>
          ) : (
            <>
              <div className="flex flex-col items-center justify-center py-4 space-y-4">
                <div className="w-16 h-16 rounded-full bg-green-100 dark:bg-green-900 flex items-center justify-center">
                  <CheckCircle2 className="w-10 h-10 text-green-600 dark:text-green-400" />
                </div>
                <div className="text-center space-y-2">
                  <h3 className="text-lg font-semibold text-foreground">
                    Congratulations!
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    Your policy with <span className="font-medium text-foreground">{insurerName}</span> is now active.
                  </p>
                </div>
              </div>

              <div className="bg-muted/50 rounded-lg p-4 space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Policy Number</span>
                  <span className="font-mono font-medium text-foreground" data-testid="text-new-policy-number">
                    {policyNumber}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Provider</span>
                  <span className="font-medium text-foreground">{insurerName}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Annual Premium</span>
                  <span className="font-medium text-primary">£{policyPrice.toFixed(2)}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Status</span>
                  <span className="inline-flex items-center gap-1 text-sm font-medium text-green-600 dark:text-green-400">
                    <CheckCircle2 className="w-4 h-4" />
                    Active
                  </span>
                </div>
              </div>

              <Button 
                onClick={onConfirmClose} 
                className="w-full"
                data-testid="button-close-purchase-confirmation"
              >
                Close
              </Button>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
