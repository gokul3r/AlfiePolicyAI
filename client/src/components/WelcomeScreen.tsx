import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useQuery } from "@tanstack/react-query";
import { Shield, Plus, Car, MessageCircle, Search, MessageSquare, Bell, Menu, Mic, SearchCheck, Bot, Calendar } from "lucide-react";
import type { VehiclePolicy } from "@shared/schema";
import { ChatModeSelector } from "./ChatModeSelector";
import ChatDialog from "./ChatDialog";
import { VoiceChatDialog } from "./VoiceChatDialog";
import { PersonalizeDialog } from "./PersonalizeDialog";
import { NotificationPanel } from "./NotificationPanel";
import { ConfigureAutoSageDialog } from "./ConfigureAutoSageDialog";
import { InfoBadge } from "./InfoBadge";

interface WelcomeScreenProps {
  userName: string;
  userEmail: string;
  onAddPolicy: () => void;
  onEditPolicy: (policy: VehiclePolicy) => void;
  onWhisper: () => void;
  onSearchQuotes: () => void;
}

export default function WelcomeScreen({ 
  userName, 
  userEmail, 
  onAddPolicy,
  onEditPolicy,
  onWhisper,
  onSearchQuotes,
}: WelcomeScreenProps) {
  const [showVehicleList, setShowVehicleList] = useState(false);
  const [showModeSelector, setShowModeSelector] = useState(false);
  const [showTextChat, setShowTextChat] = useState(false);
  const [showVoiceChat, setShowVoiceChat] = useState(false);
  const [showPersonalize, setShowPersonalize] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [showConfigureAutoSage, setShowConfigureAutoSage] = useState(false);
  const [scheduleFrequency, setScheduleFrequency] = useState<"monthly" | "weekly">("monthly");
  
  const { data: policies = [], isLoading } = useQuery<VehiclePolicy[]>({
    queryKey: ["/api/vehicle-policies", userEmail],
  });

  // Fetch notification count
  const { data: notificationCount = 0 } = useQuery<number>({
    queryKey: ["/api/notifications/count", userEmail],
  });

  const hasPolicies = policies.length > 0;

  const handlePolicyDetailsClick = () => {
    setShowVehicleList(!showVehicleList);
  };

  const handleEditPolicy = (policy: VehiclePolicy) => {
    onEditPolicy(policy);
    setShowVehicleList(false);
  };

  const handleLogout = () => {
    window.location.href = "/";
  };

  return (
    <div className="min-h-screen bg-background flex flex-col p-6">
      {/* Top Navigation Bar */}
      <div className="w-full max-w-md mx-auto mb-4">
        <div className="flex items-center justify-end gap-2">
          {/* Bell Icon with Notification Badge */}
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setShowNotifications(true)}
            className="relative"
            data-testid="button-notifications"
          >
            <Bell className="h-5 w-5" />
            {notificationCount > 0 && (
              <Badge 
                className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 text-xs"
                data-testid="badge-notification-count"
              >
                {notificationCount}
              </Badge>
            )}
          </Button>

          {/* Hamburger Menu */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button 
                variant="ghost" 
                size="icon" 
                data-testid="button-menu"
              >
                <Menu className="h-5 w-5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem 
                onClick={() => setShowPersonalize(true)}
                data-testid="menu-item-personalize"
              >
                Personalize
              </DropdownMenuItem>
              <DropdownMenuItem 
                onClick={handleLogout}
                data-testid="menu-item-logout"
              >
                Logout
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Main Content */}
      <div className="w-full max-w-md mx-auto space-y-6 flex-1 flex flex-col items-center justify-center">
        <div className="bg-card rounded-2xl p-8 space-y-6 text-center shadow-lg">
          <div className="flex justify-center">
            <div className="bg-primary/10 p-4 rounded-full">
              <Shield className="w-16 h-16 text-primary" strokeWidth={2} />
            </div>
          </div>
          
          <div className="space-y-2">
            <h1 className="text-2xl font-bold text-foreground" data-testid="text-welcome-message">
              Welcome, {userName}
            </h1>
            <p className="text-sm text-muted-foreground">{userEmail}</p>
          </div>

          <div className="space-y-3 pt-2">
            <Button
              onClick={onAddPolicy}
              className="w-full py-6 text-base font-medium rounded-xl"
              size="lg"
              data-testid="button-add-policy"
            >
              <Plus className="w-5 h-5 mr-2" />
              Add Policy
            </Button>

            {hasPolicies && (
              <Button
                variant="outline"
                onClick={handlePolicyDetailsClick}
                className="w-full py-6 text-base font-medium rounded-xl"
                size="lg"
                data-testid="button-policy-details"
                disabled={isLoading}
              >
                <Car className="w-5 h-5 mr-2" />
                {showVehicleList ? "Hide Policy Details" : "Policy Details"}
              </Button>
            )}

            {hasPolicies && (
              <>
                <div className="space-y-1">
                  <div className="flex items-center justify-center">
                    <Button
                      variant="outline"
                      onClick={onWhisper}
                      className="w-full py-6 text-base font-medium rounded-xl"
                      size="lg"
                      data-testid="button-whisper"
                      disabled={isLoading}
                    >
                      <MessageCircle className="w-5 h-5 mr-2" />
                      <span className="font-bold">Whisper</span>
                    </Button>
                    <InfoBadge
                      icon={Mic}
                      title="Record User Preferences"
                      description="Tell AutoSage what matters most to you in an insurance policy. Your preferences help find quotes that match your needs."
                      tip="Set preferences for each vehicle to get personalized quote recommendations"
                    />
                  </div>
                  <p className="text-xs text-center text-muted-foreground">
                    Record user preferences
                  </p>
                </div>

                <div className="space-y-1">
                  <div className="flex items-center justify-center">
                    <Button
                      variant="outline"
                      onClick={onSearchQuotes}
                      className="w-full py-6 text-base font-medium rounded-xl"
                      size="lg"
                      data-testid="button-search-quotes"
                      disabled={isLoading}
                    >
                      <Search className="w-5 h-5 mr-2" />
                      <span className="font-bold">Search Quotes</span>
                    </Button>
                    <InfoBadge
                      icon={SearchCheck}
                      title="Find Best Insurance Quotes"
                      description="Search and compare insurance quotes from top UK providers. Get instant results with AutoSage Score ratings to help you choose."
                      tip="Make sure to set your preferences first for better quote matches"
                    />
                  </div>
                  <p className="text-xs text-center text-muted-foreground">
                    Find best insurance deals
                  </p>
                </div>

                {/* Schedule Quote Search Toggle */}
                <Card className="p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2 flex-1">
                      <Calendar className="h-4 w-4 text-muted-foreground shrink-0" />
                      <Label className="text-sm font-medium cursor-pointer flex-1" htmlFor="schedule-toggle">
                        Schedule Quote Search
                      </Label>
                      <InfoBadge
                        icon={Calendar}
                        title="Scheduled Quote Search"
                        description="Let AutoSage do the quote search for you. Choose how often you want to receive updated insurance quotes via email."
                        tip="Coming soon: Automated quote searches delivered to your inbox"
                      />
                    </div>
                  </div>
                  <div className="flex items-center justify-center gap-3 mt-3">
                    <span className={`text-sm ${scheduleFrequency === "monthly" ? "font-semibold text-foreground" : "text-muted-foreground"}`}>
                      Monthly
                    </span>
                    <Switch
                      id="schedule-toggle"
                      checked={scheduleFrequency === "weekly"}
                      onCheckedChange={(checked) => setScheduleFrequency(checked ? "weekly" : "monthly")}
                      data-testid="switch-schedule-frequency"
                    />
                    <span className={`text-sm ${scheduleFrequency === "weekly" ? "font-semibold text-foreground" : "text-muted-foreground"}`}>
                      Weekly
                    </span>
                  </div>
                </Card>

                <div className="space-y-1">
                  <div className="flex items-center justify-center">
                    <Button
                      variant="outline"
                      onClick={() => setShowModeSelector(true)}
                      className="w-full py-6 text-base font-medium rounded-xl"
                      size="lg"
                      data-testid="button-chat-autosage"
                      disabled={isLoading}
                    >
                      <MessageSquare className="w-5 h-5 mr-2" />
                      <span className="font-bold">Chat with AutoSage</span>
                    </Button>
                    <InfoBadge
                      icon={Bot}
                      title="AI Insurance Assistant"
                      description="Chat with AutoSage AI to get instant answers about insurance policies, coverage options, and claims. Available in text or voice mode."
                      tip="Ask questions like 'How can I lower my premium?' or 'Explain my coverage'"
                    />
                  </div>
                  <p className="text-xs text-center text-muted-foreground">
                    AI insurance assistant
                  </p>
                </div>
              </>
            )}
          </div>
        </div>

        {hasPolicies && showVehicleList && (
          <Card className="shadow-lg" data-testid="card-vehicle-list">
            <CardHeader>
              <CardTitle className="text-lg">Your Vehicles</CardTitle>
            </CardHeader>
            <CardContent>
              <ScrollArea className="max-h-[300px]">
                <div className="space-y-2">
                  {policies.map((policy) => (
                    <button
                      key={policy.vehicle_id}
                      onClick={() => handleEditPolicy(policy)}
                      className="w-full text-left p-4 rounded-lg border border-border hover-elevate active-elevate-2 transition-all"
                      data-testid={`button-vehicle-${policy.vehicle_id}`}
                    >
                      <div className="flex items-start justify-between">
                        <div>
                          <h3 className="font-semibold text-foreground">
                            {policy.vehicle_manufacturer_name} {policy.vehicle_model}
                          </h3>
                          <p className="text-sm text-muted-foreground">
                            {policy.vehicle_registration_number}
                          </p>
                          <p className="text-xs text-muted-foreground mt-1">
                            {policy.vehicle_year} • {policy.type_of_fuel}
                          </p>
                        </div>
                        <div className="text-right">
                          <span className="text-xs font-medium text-primary">
                            {policy.type_of_cover_needed}
                          </span>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Chat Mode Selector */}
      <ChatModeSelector
        open={showModeSelector}
        onOpenChange={setShowModeSelector}
        onSelectMode={(mode) => {
          if (mode === "text") {
            setShowTextChat(true);
          } else {
            setShowVoiceChat(true);
          }
        }}
      />

      {/* Text Chat Dialog */}
      <ChatDialog
        open={showTextChat}
        onOpenChange={setShowTextChat}
        userEmail={userEmail}
      />

      {/* Voice Chat Dialog */}
      <VoiceChatDialog
        open={showVoiceChat}
        onOpenChange={setShowVoiceChat}
        userEmail={userEmail}
      />

      {/* Personalize Dialog */}
      <PersonalizeDialog
        open={showPersonalize}
        onOpenChange={setShowPersonalize}
        userEmail={userEmail}
      />

      {/* Notification Panel */}
      <NotificationPanel
        open={showNotifications}
        onOpenChange={setShowNotifications}
        userEmail={userEmail}
      />

      {/* Configure AutoSage Dialog */}
      <ConfigureAutoSageDialog
        open={showConfigureAutoSage}
        onOpenChange={setShowConfigureAutoSage}
        userEmail={userEmail}
      />

      {/* Fixed Configure AutoSage Link at Bottom */}
      <button
        className="fixed bottom-4 left-1/2 -translate-x-1/2 text-xs text-muted-foreground underline hover-elevate cursor-pointer"
        onClick={() => setShowConfigureAutoSage(true)}
        data-testid="link-configure-autosage"
      >
        Configure AutoSage
      </button>
    </div>
  );
}
