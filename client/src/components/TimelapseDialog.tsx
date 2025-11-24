import { Dialog, DialogContent, DialogClose, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { X } from "lucide-react";

interface TimelapseDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function TimelapseDialog({ open, onOpenChange }: TimelapseDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent 
        className="max-w-lg p-8"
        data-testid="dialog-timelapse"
      >
        {/* Hidden title for accessibility */}
        <DialogTitle className="sr-only">Timelapse Demo</DialogTitle>

        {/* Close X button using DialogClose primitive */}
        <DialogClose asChild>
          <Button
            variant="ghost"
            size="icon"
            className="absolute right-4 top-4 hover-elevate active-elevate-2"
            data-testid="button-close-timelapse"
          >
            <X className="h-4 w-4" />
            <span className="sr-only">Close</span>
          </Button>
        </DialogClose>

        {/* Animated intro text */}
        <div className="flex flex-col items-center justify-center min-h-[300px] space-y-8">
          <div 
            className="text-center space-y-2 animate-in fade-in slide-in-from-bottom-4 duration-700"
            data-testid="text-timelapse-intro"
          >
            <h2 className="text-2xl md:text-3xl font-bold text-foreground leading-relaxed">
              Experience how <span className="text-primary">Auto-Annie's</span> scheduled quote search works
            </h2>
          </div>

          {/* Placeholder Start button */}
          <Button
            size="lg"
            className="px-8 py-6 text-lg animate-in fade-in slide-in-from-bottom-4 duration-700 delay-300"
            data-testid="button-start-timelapse"
          >
            Start
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
