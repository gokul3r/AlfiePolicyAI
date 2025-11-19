import { Mic } from "lucide-react";
import { motion } from "framer-motion";

interface AnimatedMicProps {
  onClick?: () => void;
  className?: string;
}

export function AnimatedMic({ onClick, className = "" }: AnimatedMicProps) {
  return (
    <motion.div
      className={`cursor-pointer ${className}`}
      onClick={onClick}
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
    </motion.div>
  );
}
