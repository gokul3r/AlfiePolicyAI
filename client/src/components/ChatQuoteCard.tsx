import { motion } from "framer-motion";
import { Star, Trophy, ChevronRight } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";

export interface ChatQuote {
  insurer_name: string;
  alfie_touch_score: number;
  alfie_message: string;
  isTopMatch?: boolean;
}

interface ChatQuoteCardProps {
  quote: ChatQuote;
  index: number;
}

export default function ChatQuoteCard({ quote, index }: ChatQuoteCardProps) {
  const { toast } = useToast();

  const handleClick = () => {
    toast({
      title: "Feature in Progress",
      description: `Purchasing ${quote.insurer_name} policy will be available soon!`,
    });
  };

  const getScoreColor = (score: number) => {
    if (score >= 4.0) return "from-emerald-500 to-green-600";
    if (score >= 3.0) return "from-amber-500 to-yellow-600";
    return "from-gray-400 to-gray-500";
  };

  const getScoreBgColor = (score: number) => {
    if (score >= 4.0) return "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400";
    if (score >= 3.0) return "bg-amber-500/10 text-amber-700 dark:text-amber-400";
    return "bg-gray-500/10 text-gray-700 dark:text-gray-400";
  };

  const truncateMessage = (message: string, maxLength: number = 80) => {
    if (message.length <= maxLength) return message;
    return message.substring(0, maxLength).trim() + "...";
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ 
        duration: 0.3, 
        delay: index * 0.1,
        ease: "easeOut"
      }}
    >
      <Card
        onClick={handleClick}
        className="relative overflow-visible cursor-pointer transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] hover:shadow-lg border-2 hover:border-primary/30"
        data-testid={`chat-quote-card-${quote.insurer_name.toLowerCase().replace(/\s+/g, '-')}`}
      >
        {quote.isTopMatch && (
          <div className="absolute -top-3 left-4 z-10">
            <Badge 
              className={`bg-gradient-to-r ${getScoreColor(quote.alfie_touch_score)} text-white border-0 shadow-md px-2 py-0.5 text-xs`}
            >
              <Trophy className="w-3 h-3 mr-1" />
              Best Match
            </Badge>
          </div>
        )}
        
        <div className="p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-lg text-foreground">
              {quote.insurer_name}
            </h3>
            <ChevronRight className="w-5 h-5 text-muted-foreground" />
          </div>

          <div className="flex items-center gap-2">
            <div className={`flex items-center gap-1 px-2 py-1 rounded-full ${getScoreBgColor(quote.alfie_touch_score)}`}>
              <Star className="w-4 h-4 fill-current" />
              <span className="font-semibold text-sm">
                {quote.alfie_touch_score.toFixed(1)}/5
              </span>
            </div>
            <span className="text-xs text-muted-foreground">Auto Annie Score</span>
          </div>

          <p className="text-sm text-muted-foreground leading-relaxed">
            "{truncateMessage(quote.alfie_message)}"
          </p>

          <div className="pt-2 border-t border-border/50">
            <p className="text-xs text-primary font-medium flex items-center gap-1">
              Tap to select
              <ChevronRight className="w-3 h-3" />
            </p>
          </div>
        </div>
      </Card>
    </motion.div>
  );
}
