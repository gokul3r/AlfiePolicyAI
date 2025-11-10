import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Mail, Scan, Star } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { DEFAULT_TRUSTPILOT_DATA, DEFAULT_DEFACTO_RATINGS, PROVIDER_NAMES } from "@/lib/defaultRatings";
import type { TrustPilotData, DefactoRatings } from "@shared/schema";

interface ConfigureAutoSageDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userEmail: string;
}

export function ConfigureAutoSageDialog({ open, onOpenChange, userEmail }: ConfigureAutoSageDialogProps) {
  const { toast } = useToast();
  
  // State for custom ratings
  const [useCustomRatings, setUseCustomRatings] = useState(false);
  const [trustpilotRatings, setTrustpilotRatings] = useState<Record<string, number>>({});
  const [defactoRatings, setDefactoRatings] = useState<Record<string, number>>({});

  // Fetch existing custom ratings
  const { data: existingRatings } = useQuery({
    queryKey: ["/api/custom-ratings", userEmail],
    queryFn: async () => {
      try {
        const response = await fetch(`/api/custom-ratings/${encodeURIComponent(userEmail)}`);
        if (response.status === 404) return null;
        if (!response.ok) throw new Error("Failed to fetch ratings");
        return response.json();
      } catch (error) {
        return null;
      }
    },
    enabled: open,
  });

  // Initialize ratings from existing data or defaults
  useEffect(() => {
    if (existingRatings) {
      // Load existing custom ratings
      const trustpilotData = existingRatings.trustpilot_data as TrustPilotData;
      const defactoData = existingRatings.defacto_ratings as DefactoRatings;
      
      const tpRatings: Record<string, number> = {};
      const dfRatings: Record<string, number> = {};
      
      PROVIDER_NAMES.forEach((provider) => {
        tpRatings[provider] = trustpilotData[provider]?.rating || DEFAULT_TRUSTPILOT_DATA[provider].rating;
        dfRatings[provider] = defactoData[provider] || DEFAULT_DEFACTO_RATINGS[provider];
      });
      
      setTrustpilotRatings(tpRatings);
      setDefactoRatings(dfRatings);
      setUseCustomRatings(existingRatings.use_custom_ratings);
    } else {
      // Initialize with defaults
      const tpRatings: Record<string, number> = {};
      const dfRatings: Record<string, number> = {};
      
      PROVIDER_NAMES.forEach((provider) => {
        tpRatings[provider] = DEFAULT_TRUSTPILOT_DATA[provider].rating;
        dfRatings[provider] = DEFAULT_DEFACTO_RATINGS[provider];
      });
      
      setTrustpilotRatings(tpRatings);
      setDefactoRatings(dfRatings);
    }
  }, [existingRatings]);

  // Gmail scan mutation
  const scanGmailMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("POST", "/api/gmail/scan", { email_id: userEmail });
    },
    onSuccess: (data: any) => {
      const count = data.notificationsCreated || 0;
      toast({
        title: "Scan Complete",
        description: count > 0 
          ? `Found ${count} new travel notification${count !== 1 ? 's' : ''}!` 
          : "No new travel emails found.",
      });
    },
    onError: (error) => {
      toast({
        title: "Scan Failed",
        description: error instanceof Error ? error.message : "Failed to scan Gmail",
        variant: "destructive",
      });
    },
  });

  // Save custom ratings mutation
  const saveRatingsMutation = useMutation({
    mutationFn: async () => {
      // Construct full trustpilot_data with rating and other fields from defaults
      const trustpilot_data: TrustPilotData = {} as TrustPilotData;
      PROVIDER_NAMES.forEach((provider) => {
        trustpilot_data[provider] = {
          rating: trustpilotRatings[provider],
          reviews_count: DEFAULT_TRUSTPILOT_DATA[provider].reviews_count,
          pros: DEFAULT_TRUSTPILOT_DATA[provider].pros,
          cons: DEFAULT_TRUSTPILOT_DATA[provider].cons,
        };
      });

      // Construct defacto_ratings
      const defacto_ratings: DefactoRatings = {} as DefactoRatings;
      PROVIDER_NAMES.forEach((provider) => {
        defacto_ratings[provider] = defactoRatings[provider];
      });

      return apiRequest("POST", "/api/custom-ratings", {
        email_id: userEmail,
        trustpilot_data,
        defacto_ratings,
        use_custom_ratings: useCustomRatings,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/custom-ratings", userEmail] });
      toast({
        title: "Settings Saved",
        description: "Your custom ratings have been saved successfully.",
      });
    },
    onError: (error) => {
      toast({
        title: "Save Failed",
        description: error instanceof Error ? error.message : "Failed to save custom ratings",
        variant: "destructive",
      });
    },
  });

  const handleScanGmail = () => {
    scanGmailMutation.mutate();
  };

  const handleSaveRatings = () => {
    saveRatingsMutation.mutate();
  };

  const handleTrustpilotChange = (provider: string, value: string) => {
    const numValue = parseFloat(value);
    if (!isNaN(numValue) && numValue >= 0 && numValue <= 5.0) {
      setTrustpilotRatings(prev => ({ ...prev, [provider]: numValue }));
    }
  };

  const handleDefactoChange = (provider: string, value: string) => {
    const numValue = parseFloat(value);
    if (!isNaN(numValue) && numValue >= 0 && numValue <= 5.0) {
      setDefactoRatings(prev => ({ ...prev, [provider]: numValue }));
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-4xl h-[90vh] flex flex-col p-0">
        <DialogHeader className="px-6 py-4 border-b shrink-0">
          <DialogTitle>Configure AutoSage</DialogTitle>
          <DialogDescription>
            Manage your AutoSage settings, scan for travel notifications, and customize insurance ratings
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-auto px-6">
          <div className="space-y-4 py-4">
            {/* Email Scan Card */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Mail className="h-4 w-4" />
                  Email Scan
                </CardTitle>
                <CardDescription>
                  Scan your connected Gmail for travel booking emails
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div>
                    <Label className="text-sm text-muted-foreground">
                      AutoSage will scan your Gmail for flight tickets, hotel bookings, and travel itineraries.
                      When found, you'll get notifications to find travel insurance for your trips.
                    </Label>
                  </div>
                  <Button
                    onClick={handleScanGmail}
                    disabled={scanGmailMutation.isPending}
                    className="w-full"
                    data-testid="button-scan-gmail"
                  >
                    <Scan className="h-4 w-4 mr-2" />
                    {scanGmailMutation.isPending ? "Scanning..." : "Scan Now"}
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Custom Ratings Card */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Star className="h-4 w-4" />
                  Custom Ratings
                </CardTitle>
                <CardDescription>
                  Customize Trustpilot and Defacto ratings to see how they affect quote rankings
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {/* Toggle */}
                  <div className="flex items-center justify-between p-3 rounded-lg border">
                    <div>
                      <Label className="text-sm font-medium">Use Custom Ratings</Label>
                      <p className="text-xs text-muted-foreground mt-1">
                        When enabled, your custom ratings will be used for quote searches
                      </p>
                    </div>
                    <Switch
                      checked={useCustomRatings}
                      onCheckedChange={setUseCustomRatings}
                      data-testid="switch-use-custom-ratings"
                    />
                  </div>

                  {/* Ratings Grid */}
                  <div className="space-y-3">
                    <Label className="text-sm font-medium">Provider Ratings (0-5.0)</Label>
                    <div className="grid gap-3">
                      {PROVIDER_NAMES.map((provider) => (
                        <div
                          key={provider}
                          className="grid grid-cols-[1fr,auto,auto] gap-3 items-center p-3 rounded-lg border"
                        >
                          <div className="font-medium text-sm">{provider}</div>
                          <div className="flex items-center gap-2">
                            <Label className="text-xs text-muted-foreground w-20">Trustpilot</Label>
                            <Input
                              type="number"
                              step="0.1"
                              min="0"
                              max="5.0"
                              value={trustpilotRatings[provider] || 0}
                              onChange={(e) => handleTrustpilotChange(provider, e.target.value)}
                              disabled={!useCustomRatings}
                              className="w-20"
                              data-testid={`input-trustpilot-${provider.toLowerCase()}`}
                            />
                          </div>
                          <div className="flex items-center gap-2">
                            <Label className="text-xs text-muted-foreground w-20">Defacto</Label>
                            <Input
                              type="number"
                              step="0.1"
                              min="0"
                              max="5.0"
                              value={defactoRatings[provider] || 0}
                              onChange={(e) => handleDefactoChange(provider, e.target.value)}
                              disabled={!useCustomRatings}
                              className="w-20"
                              data-testid={`input-defacto-${provider.toLowerCase()}`}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Save Button */}
                  <Button
                    onClick={handleSaveRatings}
                    disabled={saveRatingsMutation.isPending}
                    className="w-full"
                    data-testid="button-save-ratings"
                  >
                    {saveRatingsMutation.isPending ? "Saving..." : "Save Ratings"}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
