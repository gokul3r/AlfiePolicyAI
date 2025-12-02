import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  ChevronDown, 
  ChevronUp, 
  Shield, 
  Star, 
  CheckCircle2, 
  XCircle,
  StarHalf
} from "lucide-react";
import type { QuoteWithInsights } from "@shared/schema";

interface QuoteChatCardProps {
  quote: QuoteWithInsights;
  index: number;
  onSelect?: (quote: QuoteWithInsights) => void;
}

export default function QuoteChatCard({ quote, index, onSelect }: QuoteChatCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  
  const {
    insurer_name,
    trust_pilot_context,
    features_matching_requirements,
    alfie_touch_score,
    alfie_message,
    original_quote,
  } = quote;

  const trustPilot = trust_pilot_context || {};
  const matchedFeatures = features_matching_requirements?.matched_required || [];
  const missingFeatures = features_matching_requirements?.missing_required || [];
  const policyPrice = original_quote?.output?.policy_cost;

  const renderStars = (rating: number) => {
    const stars = [];
    const fullStars = Math.floor(rating);
    const hasHalfStar = rating % 1 >= 0.5;
    
    for (let i = 0; i < 5; i++) {
      if (i < fullStars) {
        stars.push(
          <Star
            key={i}
            className="w-3 h-3 fill-yellow-400 text-yellow-400"
          />
        );
      } else if (i === fullStars && hasHalfStar) {
        stars.push(
          <StarHalf
            key={i}
            className="w-3 h-3 fill-yellow-400 text-yellow-400"
          />
        );
      } else {
        stars.push(
          <Star
            key={i}
            className="w-3 h-3 text-muted-foreground"
          />
        );
      }
    }
    return stars;
  };

  const formatFeatureName = (feature: string) => {
    return feature
      .replace(/_/g, " ")
      .replace(/included/g, "")
      .trim()
      .split(" ")
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(" ");
  };

  return (
    <Card 
      className="bg-background/80 border shadow-sm cursor-pointer transition-all hover:shadow-md"
      onClick={() => setIsExpanded(!isExpanded)}
      data-testid={`card-chat-quote-${index}`}
    >
      <CardContent className="p-4">
        {/* Collapsed Header - Always visible */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <div className="bg-primary/10 p-2 rounded-lg shrink-0">
              <Shield className="w-5 h-5 text-primary" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <h4 className="font-semibold text-foreground truncate" data-testid={`text-chat-insurer-${index}`}>
                  {insurer_name}
                </h4>
                {trustPilot.rating && (
                  <div className="flex items-center gap-1">
                    {renderStars(trustPilot.rating)}
                    <span className="text-xs text-muted-foreground">
                      {trustPilot.rating.toFixed(1)}
                    </span>
                  </div>
                )}
              </div>
              {/* AutoAnnie Message - Truncated in collapsed view */}
              {alfie_message && (
                <p className={`text-sm text-muted-foreground mt-1 ${!isExpanded ? "line-clamp-2" : ""}`}>
                  {alfie_message}
                </p>
              )}
            </div>
          </div>
          
          {/* Price and expand button */}
          <div className="flex flex-col items-end gap-2 shrink-0">
            {policyPrice && (
              <span className="text-lg font-bold text-primary" data-testid={`text-chat-price-${index}`}>
                £{policyPrice.toFixed(2)}
              </span>
            )}
            <Button 
              variant="ghost" 
              size="icon"
              className="h-6 w-6"
              onClick={(e) => {
                e.stopPropagation();
                setIsExpanded(!isExpanded);
              }}
              data-testid={`button-expand-quote-${index}`}
            >
              {isExpanded ? (
                <ChevronUp className="w-4 h-4" />
              ) : (
                <ChevronDown className="w-4 h-4" />
              )}
            </Button>
          </div>
        </div>

        {/* Expanded Content */}
        {isExpanded && (
          <div className="mt-4 pt-4 border-t space-y-4">
            {/* AutoAnnie Score */}
            {alfie_touch_score && (
              <div className="flex items-center gap-2">
                <Badge variant="secondary" className="bg-primary/10 text-primary">
                  AutoAnnie Score: {alfie_touch_score}/100
                </Badge>
              </div>
            )}

            {/* Matched Features */}
            {matchedFeatures.length > 0 && (
              <div>
                <p className="text-sm font-medium text-foreground mb-2 flex items-center gap-1">
                  <CheckCircle2 className="w-4 h-4 text-green-500" />
                  Included Features
                </p>
                <div className="flex flex-wrap gap-1">
                  {matchedFeatures.slice(0, 5).map((feature, i) => (
                    <Badge 
                      key={i} 
                      variant="outline" 
                      className="text-xs bg-green-50 text-green-700 border-green-200"
                    >
                      {formatFeatureName(feature)}
                    </Badge>
                  ))}
                  {matchedFeatures.length > 5 && (
                    <Badge variant="outline" className="text-xs">
                      +{matchedFeatures.length - 5} more
                    </Badge>
                  )}
                </div>
              </div>
            )}

            {/* Missing Features */}
            {missingFeatures.length > 0 && (
              <div>
                <p className="text-sm font-medium text-foreground mb-2 flex items-center gap-1">
                  <XCircle className="w-4 h-4 text-red-500" />
                  Missing from Preferences
                </p>
                <div className="flex flex-wrap gap-1">
                  {missingFeatures.slice(0, 5).map((feature, i) => (
                    <Badge 
                      key={i} 
                      variant="outline" 
                      className="text-xs bg-red-50 text-red-700 border-red-200"
                    >
                      {formatFeatureName(feature)}
                    </Badge>
                  ))}
                  {missingFeatures.length > 5 && (
                    <Badge variant="outline" className="text-xs">
                      +{missingFeatures.length - 5} more
                    </Badge>
                  )}
                </div>
              </div>
            )}

            {/* Trustpilot details */}
            {trustPilot.reviews_count && (
              <p className="text-xs text-muted-foreground">
                Based on {trustPilot.reviews_count.toLocaleString()} Trustpilot reviews
              </p>
            )}

            {/* Select button */}
            {onSelect && (
              <Button
                className="w-full mt-2"
                onClick={(e) => {
                  e.stopPropagation();
                  onSelect(quote);
                }}
                data-testid={`button-select-quote-${index}`}
              >
                Select {insurer_name}
              </Button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
