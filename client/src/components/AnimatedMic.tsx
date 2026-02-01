import { Mic } from "lucide-react";
import { motion } from "framer-motion";
import { MouseEvent } from "react";

interface AnimatedMicProps {
  onClick?: () => void;
  className?: string;
  disabled?: boolean;
}

export function AnimatedMic({ onClick, className = "", disabled = false }: AnimatedMicProps) {
  const handleClick = (e: MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    e.stopPropagation();
    if (!disabled) {
      onClick?.();
    }
  };

  if (disabled) {
    return (
      <button
        type="button"
        className={`cursor-not-allowed border-0 bg-transparent opacity-40 ${className}`}
        disabled
        data-testid="button-voice-mic"
        title="Voice chat temporarily unavailable"
      >
        <div className="relative">
          <Mic className="h-5 w-5 text-muted-foreground" />
        </div>
      </button>
    );
  }

  return (
    <motion.button
      type="button"
      className={`cursor-pointer border-0 bg-transparent ${className}`}
      onClick={handleClick}
      whileHover={{ scale: 1.1 }}
      whileTap={{ scale: 0.95 }}
      data-testid="button-voice-mic"
    >
      <motion.div
        className="relative"
        animate={{
          scale: [1, 1.15, 1],
        }}
        transition={{
          duration: 2,
          repeat: Infinity,
          ease: "easeInOut",
        }}
      >
        <Mic className="h-5 w-5 text-primary" />
        
        {/* Pulse effect */}
        <motion.div
          className="absolute inset-0 rounded-full bg-primary/20"
          animate={{
            scale: [1, 1.8, 1],
            opacity: [0.5, 0, 0.5],
          }}
          transition={{
            duration: 2,
            repeat: Infinity,
            ease: "easeInOut",
          }}
        />
      </motion.div>
    </motion.button>
  );
}
