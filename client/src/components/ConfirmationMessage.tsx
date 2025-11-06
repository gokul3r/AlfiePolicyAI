import { CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

interface ConfirmationMessageProps {
  message: string;
  onContinue?: () => void;
}

export default function ConfirmationMessage({ message, onContinue }: ConfirmationMessageProps) {
  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-md mx-auto">
        <div className="bg-card rounded-2xl p-8 space-y-6 text-center shadow-lg animate-in fade-in zoom-in-95 duration-400">
          <div className="flex justify-center">
            <div className="bg-primary/10 p-4 rounded-full animate-in zoom-in duration-400 delay-150">
              <CheckCircle className="w-16 h-16 text-primary" strokeWidth={2} />
            </div>
          </div>
          
          <div className="space-y-2">
            <h2 className="text-xl font-semibold text-foreground" data-testid="text-confirmation">
              {message}
            </h2>
          </div>

          {onContinue && (
            <Button
              onClick={onContinue}
              className="w-full py-6 text-base font-medium rounded-xl mt-4"
              size="lg"
              data-testid="button-continue-confirmation"
            >
              Continue
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
