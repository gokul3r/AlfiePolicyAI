import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Star, Trophy, ChevronDown, ChevronUp, Check, X, List } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export interface ChatQuote {
  insurer_name: string;
  alfie_touch_score: number;
  alfie_message: string;
  isTopMatch?: boolean;
  quote_price?: number | null;
  available_features?: string[];
  features_matched?: string[];
  features_missing?: string[];
}

interface ChatQuoteCardProps {
  quote: ChatQuote;
  index: number;
}

export default function ChatQuoteCard({ quote, index }: ChatQuoteCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  const handleCardClick = () => {
    setIsExpanded(!isExpanded);
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

  const formatPrice = (price: number | null | undefined) => {
    if (price === null || price === undefined) return "N/A";
    return `£${price.toFixed(2)}`;
  };

  const formatFeatureName = (feature: string) => {
    return feature
      .replace(/_/g, ' ')
      .replace(/\b\w/g, c => c.toUpperCase());
  };

  const featuresMatched = quote.features_matched || [];
  const featuresMissing = quote.features_missing || [];
  const allFeatures = quote.available_features || [];

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
          <div className="flex items-center justify-between mb-3 gap-2">
            <h3 className="font-bold text-lg text-foreground flex-shrink-0">
              {quote.insurer_name}
            </h3>
            <div className="flex items-center gap-2 flex-shrink-0">
              <span className="font-bold text-primary text-lg">
                {formatPrice(quote.quote_price)}
              </span>
              <div className={`flex items-center gap-1 px-2 py-1 rounded-full ${getScoreBgColor(quote.alfie_touch_score)}`}>
                <Star className="w-4 h-4 fill-current" />
                <span className="font-semibold text-sm">
                  {quote.alfie_touch_score.toFixed(1)}
                </span>
              </div>
            </div>
          </div>

          <div className="relative">
            <AnimatePresence mode="wait">
              {isExpanded ? (
                <motion.div
                  key="expanded"
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.2 }}
                  className="space-y-3"
                >
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    "{quote.alfie_message}"
                  </p>

                  {featuresMatched.length > 0 && (
                    <div className="space-y-1">
                      <div className="flex items-center gap-1 text-xs font-medium text-emerald-600 dark:text-emerald-400">
                        <Check className="w-3 h-3" />
                        <span>Matched ({featuresMatched.length})</span>
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {featuresMatched.map((feature, i) => (
                          <Badge 
                            key={i} 
                            variant="outline" 
                            className="text-xs px-1.5 py-0 bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-300 dark:border-emerald-800"
                          >
                            {formatFeatureName(feature)}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}

                  {featuresMissing.length > 0 && (
                    <div className="space-y-1">
                      <div className="flex items-center gap-1 text-xs font-medium text-red-600 dark:text-red-400">
                        <X className="w-3 h-3" />
                        <span>Missing ({featuresMissing.length})</span>
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {featuresMissing.map((feature, i) => (
                          <Badge 
                            key={i} 
                            variant="outline" 
                            className="text-xs px-1.5 py-0 bg-red-50 text-red-700 border-red-200 dark:bg-red-950 dark:text-red-300 dark:border-red-800"
                          >
                            {formatFeatureName(feature)}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}

                  {allFeatures.length > 0 && (
                    <div className="space-y-1">
                      <div className="flex items-center gap-1 text-xs font-medium text-muted-foreground">
                        <List className="w-3 h-3" />
                        <span>All Features ({allFeatures.length})</span>
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {allFeatures.map((feature, i) => (
                          <Badge 
                            key={i} 
                            variant="outline" 
                            className="text-xs px-1.5 py-0"
                          >
                            {formatFeatureName(feature)}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}
                </motion.div>
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
