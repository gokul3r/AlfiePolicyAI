import { motion } from "framer-motion";
import { Check } from "lucide-react";

interface AIThinkingStepProps {
  text: string;
  status: "pending" | "processing" | "completed";
}

export function AIThinkingStep({ text, status }: AIThinkingStepProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex items-center gap-3 py-2"
      data-testid={`ai-step-${status}`}
    >
      {status === "completed" ? (
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: "spring", stiffness: 300, damping: 20 }}
          className="flex-shrink-0 w-5 h-5 rounded-full bg-green-500 flex items-center justify-center"
          data-testid="step-checkmark"
        >
          <Check className="w-3 h-3 text-white" />
        </motion.div>
      ) : (
        <div className="flex-shrink-0 flex items-center gap-1" data-testid="step-dots">
          {[0, 1, 2].map((i) => (
            <motion.div
              key={i}
              className={`w-1.5 h-1.5 rounded-full ${
                status === "processing" ? "bg-blue-500" : "bg-gray-300"
              }`}
              animate={
                status === "processing"
                  ? {
                      opacity: [0.3, 1, 0.3],
                      scale: [0.8, 1.2, 0.8],
                    }
                  : { opacity: 0.3, scale: 0.8 }
              }
              transition={
                status === "processing"
                  ? {
                      duration: 0.6,
                      repeat: Infinity,
                      delay: i * 0.15,
                      ease: "easeInOut",
                    }
                  : {}
              }
            />
          ))}
        </div>
      )}

      <span
        className={`text-sm transition-colors duration-300 ${
          status === "completed"
            ? "text-gray-700 font-medium"
            : status === "processing"
            ? "text-gray-900 font-medium"
            : "text-gray-400"
        }`}
        data-testid="step-text"
      >
        {text}
      </span>
    </motion.div>
  );
}
