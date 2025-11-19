import { motion } from "framer-motion";
import { LucideIcon } from "lucide-react";

interface AnimatedIconButtonProps {
  icon: LucideIcon;
  secondaryIcon?: LucideIcon;
  label: string;
  onClick: () => void;
  disabled?: boolean;
  index?: number;
  testId?: string;
}

export function AnimatedIconButton({
  icon: Icon,
  secondaryIcon: SecondaryIcon,
  label,
  onClick,
  disabled = false,
  index = 0,
  testId,
}: AnimatedIconButtonProps) {
  return (
    <motion.button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="relative bg-card border border-border rounded-md p-4 flex flex-col items-center justify-center gap-2 hover-elevate active-elevate-2 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        duration: 0.2,
        delay: index * 0.05,
        ease: "easeOut",
      }}
      whileHover={!disabled ? { scale: 1.02 } : {}}
      whileTap={!disabled ? { scale: 0.98 } : {}}
      data-testid={testId}
    >
      {/* Icon Container */}
      <div className="flex items-center justify-center gap-1">
        {SecondaryIcon && (
          <SecondaryIcon className="w-8 h-8 text-primary" strokeWidth={2} />
        )}
        <Icon className="w-12 h-12 text-primary" strokeWidth={2} />
      </div>

      {/* Label */}
      <span className="text-sm font-medium text-foreground text-center">
        {label}
      </span>
    </motion.button>
  );
}
