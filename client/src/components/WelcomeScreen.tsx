import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useQuery } from "@tanstack/react-query";
import { Shield, Plus, Car, MessageCircle, Search, MessageSquare, Bell, Menu, Mic, SearchCheck, Bot, Calendar, Send, Sparkles } from "lucide-react";
import type { VehiclePolicy } from "@shared/schema";
import { ChatModeSelector } from "./ChatModeSelector";
import ChatDialog from "./ChatDialog";
import { VoiceChatDialog } from "./VoiceChatDialog";
import { PersonalizeDialog } from "./PersonalizeDialog";
import { NotificationPanel } from "./NotificationPanel";
import { ConfigureAutoSageDialog } from "./ConfigureAutoSageDialog";
import { InfoBadge } from "./InfoBadge";
import logoImage from "@assets/image_1763588796393.png";
import { AnimatedMic } from "./AnimatedMic";
import { useTypewriter } from "@/hooks/useTypewriter";

// Time-based greeting utility
function getTimeBasedGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

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
  const [aiInputMessage, setAiInputMessage] = useState("");
  const [initialChatMessage, setInitialChatMessage] = useState<string | undefined>(undefined);
  
  // Typewriter effect for placeholder
  const { displayedText: placeholderText } = useTypewriter({
    text: "How can I help you today?",
    speed: 50,
    startDelay: 500,
  });
  
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

  const handleAiInputSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!aiInputMessage.trim()) return;
    
    // Set initial message and open chat dialog
    setInitialChatMessage(aiInputMessage);
    setShowTextChat(true);
    setAiInputMessage("");
  };

  return (
    <div className="min-h-screen bg-background flex flex-col p-6">
      {/* Top Navigation Bar */}
      <div className="w-full max-w-md mx-auto mb-4">
        <div className="flex items-center justify-between gap-2">
          <img 
            src={logoImage} 
            alt="AutoSage Logo" 
            className="h-12 w-auto"
            data-testid="img-logo"
          />
          <div className="flex items-center gap-2">
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
      </div>

      {/* Main Content */}
      <div className="w-full max-w-md mx-auto space-y-6 flex-1 flex flex-col items-center justify-center">
        {/* AI Hero Section with Greeting and Input */}
        <div className="w-full space-y-6">
          {/* Greeting */}
          <div className="text-center space-y-1">
            <h1 className="text-3xl font-bold text-foreground flex items-center justify-center gap-2" data-testid="text-welcome-message">
              <Sparkles className="w-6 h-6 text-primary" />
              {getTimeBasedGreeting()}, {userName}
            </h1>
            <p className="text-sm text-muted-foreground">{userEmail}</p>
          </div>

          {/* Large AI Input Box with Voice */}
          <form onSubmit={handleAiInputSubmit} className="w-full">
            <div className="relative">
              <Input
                value={aiInputMessage}
                onChange={(e) => setAiInputMessage(e.target.value)}
                placeholder={placeholderText}
                className="flex-1 text-base pr-24 py-6"
                data-testid="input-ai-chat"
              />
              <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-2">
                <AnimatedMic 
                  onClick={() => setShowModeSelector(true)}
                  className="p-2"
                />
                <Button
                  type="submit"
                  size="icon"
                  disabled={!aiInputMessage.trim()}
                  data-testid="button-ai-submit"
                >
                  <Send className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </form>
        </div>

        {/* Action Buttons */}
        <div className="w-full bg-card rounded-md p-6 space-y-3 shadow-lg">
          <Button
            onClick={onAddPolicy}
            className="w-full"
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
              className="w-full"
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
                    className="w-full"
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
                    className="w-full"
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
            </>
          )}
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
        onOpenChange={(open) => {
          setShowTextChat(open);
          if (!open) {
            setInitialChatMessage(undefined);
          }
        }}
        userEmail={userEmail}
        initialMessage={initialChatMessage}
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
