import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Star, Info, CheckCircle2, XCircle, Shield, StarHalf } from "lucide-react";
import type { QuoteWithInsights } from "@shared/schema";

interface QuoteCardProps {
  quote: QuoteWithInsights;
  index: number;
}

export default function QuoteCard({ quote, index }: QuoteCardProps) {
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
            className="w-4 h-4 fill-yellow-400 text-yellow-400"
          />
        );
      } else if (i === fullStars && hasHalfStar) {
        stars.push(
          <StarHalf
            key={i}
            className="w-4 h-4 fill-yellow-400 text-yellow-400"
          />
        );
      } else {
        stars.push(
          <Star
            key={i}
            className="w-4 h-4 text-muted-foreground"
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
    <Card className="shadow-md" data-testid={`card-quote-${index}`}>
      <CardHeader className="pb-4">
        {/* Provider name and icon */}
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="bg-primary/10 p-2 rounded-lg">
              <Shield className="w-6 h-6 text-primary" />
            </div>
            <div>
              <CardTitle className="text-xl text-foreground" data-testid={`text-insurer-name-${index}`}>
                {insurer_name}
              </CardTitle>
              {policyPrice && (
                <p className="text-lg font-bold text-primary mt-1">
                  £{policyPrice.toFixed(2)}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Trustpilot rating */}
        {trustPilot.rating && (
          <div className="mt-4 space-y-2">
            <div className="flex items-center gap-2 flex-wrap">
              <div className="flex items-center gap-1">
                {renderStars(trustPilot.rating)}
              </div>
              <span className="text-sm font-medium text-foreground">
                {trustPilot.rating.toFixed(1)} stars
              </span>
              {trustPilot.reviews_count && (
                <span className="text-sm text-muted-foreground">
                  ({trustPilot.reviews_count.toLocaleString()} reviews)
                </span>
              )}
            </div>

            {/* Pros & Cons Tooltip */}
            {((trustPilot.pros && trustPilot.pros.length > 0) || (trustPilot.cons && trustPilot.cons.length > 0)) && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    className="text-sm text-primary hover:underline flex items-center gap-1"
                    data-testid={`button-pros-cons-${index}`}
                  >
                    <Info className="w-4 h-4" />
                    View Pros & Cons
                  </button>
                </TooltipTrigger>
                <TooltipContent className="max-w-md max-h-96 overflow-y-auto p-4" side="bottom">
                  <div className="space-y-3">
                    {trustPilot.pros && trustPilot.pros.length > 0 && (
                      <div>
                        <h4 className="font-semibold text-sm mb-2 text-green-600 dark:text-green-400">
                          Pros
                        </h4>
                        <ul className="space-y-1 text-xs">
                          {trustPilot.pros.slice(0, 5).map((pro: string, i: number) => (
                            <li key={i} className="flex gap-2">
                              <CheckCircle2 className="w-3 h-3 text-green-600 dark:text-green-400 flex-shrink-0 mt-0.5" />
                              <span className="break-words">{pro}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {trustPilot.cons && trustPilot.cons.length > 0 && (
                      <div>
                        <h4 className="font-semibold text-sm mb-2 text-red-600 dark:text-red-400">
                          Cons
                        </h4>
                        <ul className="space-y-1 text-xs">
                          {trustPilot.cons.slice(0, 5).map((con: string, i: number) => (
                            <li key={i} className="flex gap-2">
                              <XCircle className="w-3 h-3 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
                              <span className="break-words">{con}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                </TooltipContent>
              </Tooltip>
            )}
          </div>
        )}
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Features section - two columns */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Matching Features */}
          <div>
            <h4 className="text-sm font-semibold text-foreground mb-2 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-green-600 dark:text-green-400" />
              Matching Features
            </h4>
            <div className="space-y-1">
              {matchedFeatures.length > 0 ? (
                matchedFeatures.map((feature: string, i: number) => (
                  <Badge
                    key={i}
                    variant="outline"
                    className="mr-1 mb-1 bg-green-50 dark:bg-green-950 border-green-200 dark:border-green-800 text-green-700 dark:text-green-300"
                  >
                    {formatFeatureName(feature)}
                  </Badge>
                ))
              ) : (
                <p className="text-xs text-muted-foreground">None</p>
              )}
            </div>
          </div>

          {/* Missing Features */}
          <div>
            <h4 className="text-sm font-semibold text-foreground mb-2 flex items-center gap-2">
              <XCircle className="w-4 h-4 text-red-600 dark:text-red-400" />
              Missing Features
            </h4>
            <div className="space-y-1">
              {missingFeatures.length > 0 ? (
                missingFeatures.map((feature: string, i: number) => (
                  <Badge
                    key={i}
                    variant="outline"
                    className="mr-1 mb-1 bg-red-50 dark:bg-red-950 border-red-200 dark:border-red-800 text-red-700 dark:text-red-300"
                  >
                    {formatFeatureName(feature)}
                  </Badge>
                ))
              ) : (
                <p className="text-xs text-green-600 dark:text-green-400">
                  All features included!
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Alfie insights section */}
        <div className="border-t border-border pt-4 space-y-2">
          <div className="flex items-center justify-between gap-4">
            <h4 className="text-sm font-semibold text-foreground">
              Alfie Touch Score
            </h4>
            <div className="flex items-center gap-2">
              <div className="bg-primary/10 px-3 py-1 rounded-full">
                <span className="text-lg font-bold text-primary">
                  {(alfie_touch_score || 0).toFixed(1)}
                </span>
                <span className="text-sm text-muted-foreground"> / 5</span>
              </div>
            </div>
          </div>

          {alfie_message && (
            <div className="bg-primary/5 rounded-lg p-3">
              <p className="text-sm text-foreground" data-testid={`text-alfie-message-${index}`}>
                {alfie_message}
              </p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
