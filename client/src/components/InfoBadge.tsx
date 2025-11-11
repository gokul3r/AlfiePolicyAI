import { Info } from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { LucideIcon } from "lucide-react";

interface InfoBadgeProps {
  icon?: LucideIcon;
  title: string;
  description: string;
  tip?: string;
}

export function InfoBadge({ icon: Icon, title, description, tip }: InfoBadgeProps) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          className="inline-flex items-center justify-center min-h-11 min-w-11 rounded-full hover-elevate active-elevate-2 ml-1.5 shrink-0"
          data-testid={`info-badge-${title.toLowerCase().replace(/\s+/g, '-')}`}
        >
          <Info className="h-5 w-5 text-muted-foreground" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-80" align="start">
        <div className="space-y-2">
          <div className="flex items-start gap-3">
            {Icon && (
              <div className="shrink-0 mt-0.5">
                <Icon className="h-5 w-5 text-primary" />
              </div>
            )}
            <div className="flex-1 space-y-1">
              <h4 className="font-semibold text-sm">{title}</h4>
              <p className="text-sm text-muted-foreground leading-relaxed">
                {description}
              </p>
              {tip && (
                <p className="text-xs text-muted-foreground mt-2 pt-2 border-t">
                  <span className="font-medium">Tip:</span> {tip}
                </p>
              )}
            </div>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
