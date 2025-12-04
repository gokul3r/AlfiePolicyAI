import { useState } from "react";
import { motion } from "framer-motion";
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
import { Shield, Plus, Car, MessageCircle, Search, MessageSquare, Bell, Menu, Mic, SearchCheck, Bot, Calendar, Send, Sparkles, FileEdit, XCircle, CalendarClock } from "lucide-react";
import type { VehiclePolicy } from "@shared/schema";
import ChatDialog from "./ChatDialog";
import { VoiceChatDialog } from "./VoiceChatDialog";
import { PersonalizeDialog } from "./PersonalizeDialog";
import { NotificationPanel } from "./NotificationPanel";
import { ConfigureAutoAnnieDialog } from "./ConfigureAutoAnnieDialog";
import { ComingSoonDialog } from "./ComingSoonDialog";
import { OpenBankingDialog } from "./OpenBankingDialog";
import { InsuranceTypeSelectorDialog } from "./InsuranceTypeSelectorDialog";
import { CancelPolicyDialog } from "./CancelPolicyDialog";
import { InfoBadge } from "./InfoBadge";
import logoImage from "@assets/generated_images/autoannie_ai_insurance_assistant_icon.png";
import { AnimatedMic } from "./AnimatedMic";
import { useTypewriter } from "@/hooks/useTypewriter";
import { AnimatedIconButton } from "./AnimatedIconButton";
import { ScheduleQuoteDialog } from "./ScheduleQuoteDialog";
import { FileText, Volume2, Umbrella } from "lucide-react";

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
  const [showTextChat, setShowTextChat] = useState(false);
  const [showVoiceChat, setShowVoiceChat] = useState(false);
  const [showPersonalize, setShowPersonalize] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [showConfigureAutoAnnie, setShowConfigureAutoAnnie] = useState(false);
  const [showScheduleDialog, setShowScheduleDialog] = useState(false);
  const [showComingSoon, setShowComingSoon] = useState(false);
  const [comingSoonFeature, setComingSoonFeature] = useState("");
  const [showInsuranceTypeSelector, setShowInsuranceTypeSelector] = useState(false);
  const [showCancelPolicy, setShowCancelPolicy] = useState(false);
  const [showOpenBanking, setShowOpenBanking] = useState(false);
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
            alt="AutoAnnie Logo" 
            className="h-12 w-auto rounded-lg"
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
                onClick={() => setShowOpenBanking(true)}
                data-testid="menu-item-openbanking"
              >
                Enroll - OpenBanking
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
                  onClick={() => setShowVoiceChat(true)}
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

        {/* Action Icon Grid */}
        <div className="w-full grid grid-cols-2 md:grid-cols-3 gap-3">
          <AnimatedIconButton
            icon={FileText}
            label="Policy Details"
            onClick={handlePolicyDetailsClick}
            disabled={!hasPolicies || isLoading}
            index={0}
            testId="button-policy-details"
          />
          
          <AnimatedIconButton
            icon={Volume2}
            label="Whisper"
            onClick={onWhisper}
            disabled={!hasPolicies || isLoading}
            index={1}
            testId="button-whisper"
          />
          
          <AnimatedIconButton
            icon={SearchCheck}
            label="Quote Search"
            onClick={onSearchQuotes}
            disabled={!hasPolicies || isLoading}
            index={2}
            testId="button-search-quotes"
          />
          
          <AnimatedIconButton
            icon={Umbrella}
            secondaryIcon={Plus}
            label="Add Policy"
            onClick={() => setShowInsuranceTypeSelector(true)}
            index={3}
            testId="button-add-policy"
          />
          
          <AnimatedIconButton
            icon={FileEdit}
            label="Update Policy"
            onClick={() => {
              setComingSoonFeature("Policy Updates");
              setShowComingSoon(true);
            }}
            disabled={!hasPolicies || isLoading}
            index={4}
            testId="button-update-policy"
          />
          
          <AnimatedIconButton
            icon={XCircle}
            label="Cancel Policy"
            onClick={() => setShowCancelPolicy(true)}
            disabled={!hasPolicies || isLoading}
            index={5}
            testId="button-cancel-policy"
          />
        </div>

        {/* Schedule Quote Search - Full Width Button */}
        <motion.button
          type="button"
          onClick={() => setShowScheduleDialog(true)}
          disabled={!hasPolicies || isLoading}
          className="w-full bg-card border border-border rounded-md px-4 py-2 flex items-center justify-center gap-3 hover-elevate active-elevate-2 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{
            duration: 0.2,
            delay: 6 * 0.05,
            ease: "easeOut",
          }}
          whileHover={(!hasPolicies || isLoading) ? {} : { scale: 1.01 }}
          whileTap={(!hasPolicies || isLoading) ? {} : { scale: 0.99 }}
          data-testid="button-schedule-quote-search"
        >
          <CalendarClock className="w-5 h-5 text-primary" strokeWidth={2} />
          <span className="text-sm font-medium text-foreground">Schedule Quote Search</span>
        </motion.button>

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

      {/* Configure AutoAnnie Dialog */}
      <ConfigureAutoAnnieDialog
        open={showConfigureAutoAnnie}
        onOpenChange={setShowConfigureAutoAnnie}
        userEmail={userEmail}
      />

      {/* Schedule Quote Search Dialog */}
      <ScheduleQuoteDialog
        open={showScheduleDialog}
        onOpenChange={setShowScheduleDialog}
        policies={policies}
        initialFrequency={scheduleFrequency}
        userEmail={userEmail}
      />

      {/* Insurance Type Selector Dialog */}
      <InsuranceTypeSelectorDialog
        open={showInsuranceTypeSelector}
        onOpenChange={setShowInsuranceTypeSelector}
        onSelectCar={() => {
          setShowInsuranceTypeSelector(false);
          onAddPolicy();
        }}
        onSelectInactive={(insuranceName) => {
          setShowInsuranceTypeSelector(false);
          setComingSoonFeature(`${insuranceName} Insurance`);
          setShowComingSoon(true);
        }}
      />

      {/* Coming Soon Dialog */}
      <ComingSoonDialog
        open={showComingSoon}
        onOpenChange={setShowComingSoon}
        featureName={comingSoonFeature}
      />

      {/* Cancel Policy Dialog */}
      <CancelPolicyDialog
        open={showCancelPolicy}
        onOpenChange={setShowCancelPolicy}
        userEmail={userEmail}
      />

      {/* OpenBanking Dialog */}
      <OpenBankingDialog
        open={showOpenBanking}
        onOpenChange={setShowOpenBanking}
      />

      {/* Fixed Configure AutoAnnie Link at Bottom */}
      <button
        className="fixed bottom-4 left-1/2 -translate-x-1/2 text-xs text-muted-foreground underline hover-elevate cursor-pointer"
        onClick={() => setShowConfigureAutoAnnie(true)}
        data-testid="link-configure-autoannie"
      >
        Configure AutoAnnie
      </button>
    </div>
  );
}
