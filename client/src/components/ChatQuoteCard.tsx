import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Star, Trophy, ChevronDown, ChevronUp } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
  const [isExpanded, setIsExpanded] = useState(false);
  const { toast } = useToast();

  const handleCardClick = () => {
    toast({
      title: "Feature in Progress",
      description: `Purchasing ${quote.insurer_name} policy will be available soon!`,
    });
  };

  const handleExpandClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsExpanded(!isExpanded);
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
        onClick={handleCardClick}
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
        
        <div className={`p-4 ${quote.isTopMatch ? 'pt-5' : ''}`}>
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-bold text-lg text-foreground">
              {quote.insurer_name}
            </h3>
            <div className={`flex items-center gap-1 px-2 py-1 rounded-full ${getScoreBgColor(quote.alfie_touch_score)}`}>
              <Star className="w-4 h-4 fill-current" />
              <span className="font-semibold text-sm">
                {quote.alfie_touch_score.toFixed(1)}/5
              </span>
            </div>
          </div>

          <div className="relative">
            <AnimatePresence mode="wait">
              {isExpanded ? (
                <motion.p
                  key="expanded"
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.2 }}
                  className="text-sm text-muted-foreground leading-relaxed pr-8"
                >
                  "{quote.alfie_message}"
                </motion.p>
              ) : (
                <motion.p
                  key="collapsed"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  className="text-sm text-muted-foreground leading-relaxed line-clamp-2 pr-8"
                >
                  "{quote.alfie_message}"
                </motion.p>
              )}
            </AnimatePresence>

            <Button
              variant="ghost"
              size="icon"
              onClick={handleExpandClick}
              className="absolute bottom-0 right-0 h-6 w-6 hover:bg-muted"
              data-testid={`button-expand-${quote.insurer_name.toLowerCase().replace(/\s+/g, '-')}`}
            >
              {isExpanded ? (
                <ChevronUp className="w-4 h-4 text-muted-foreground" />
              ) : (
                <ChevronDown className="w-4 h-4 text-muted-foreground" />
              )}
            </Button>
          </div>
        </div>
      </Card>
    </motion.div>
  );
}
