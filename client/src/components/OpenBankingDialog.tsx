import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Landmark, Lock, Zap, PiggyBank } from "lucide-react";
import { motion } from "framer-motion";

interface OpenBankingDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function OpenBankingDialog({
  open,
  onOpenChange,
}: OpenBankingDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <motion.div 
            className="flex items-center justify-center mb-4"
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.3 }}
          >
            <div className="h-16 w-16 rounded-full bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-lg">
              <Landmark className="h-8 w-8 text-white" />
            </div>
          </motion.div>
          <DialogTitle className="text-center text-xl">
            OpenBanking Integration
          </DialogTitle>
          <DialogDescription className="sr-only">
            OpenBanking integration coming soon - connect your bank for smarter insurance recommendations
          </DialogDescription>
        </DialogHeader>
        
        <motion.div 
          className="space-y-4 pt-2"
          initial={{ y: 10, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.1, duration: 0.3 }}
        >
          <div className="text-center">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 text-sm font-medium">
              <Zap className="h-3.5 w-3.5" />
              Coming Soon
            </span>
          </div>
          
          <p className="text-center text-muted-foreground">
            AutoAnnie is preparing something exciting! Soon you'll be able to securely connect your bank account for smarter insurance recommendations.
          </p>
          
          <div className="bg-muted/50 rounded-lg p-4 space-y-3">
            <h4 className="font-medium text-sm flex items-center gap-2">
              <Lock className="h-4 w-4 text-emerald-600" />
              What to expect:
            </h4>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li className="flex items-start gap-2">
                <PiggyBank className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
                <span>Automatic premium payment tracking</span>
              </li>
              <li className="flex items-start gap-2">
                <Zap className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
                <span>Smarter savings recommendations based on your spending</span>
              </li>
              <li className="flex items-start gap-2">
                <Lock className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
                <span>Bank-level security with read-only access</span>
              </li>
            </ul>
          </div>
          
          <p className="text-center text-xs text-muted-foreground italic">
            We're building this with care. Stay tuned!
          </p>
        </motion.div>
        
        <div className="flex justify-center pt-4">
          <Button
            onClick={() => onOpenChange(false)}
            className="w-full sm:w-auto"
            data-testid="button-openbanking-close"
          >
            Got it, I'll wait!
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
