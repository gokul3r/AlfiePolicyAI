import { Dialog, DialogContent, DialogClose, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { X, Sparkles, Search, Plane, Calendar, Users, Heart, User, Camera, Snowflake, Ship, Star, StarHalf, CheckCircle2, Shield, PartyPopper, Home, Phone, FileCheck, Stethoscope, Smartphone, XCircle, Luggage, Clock, Mountain, Anchor, Scale, AlertTriangle, Briefcase, ThumbsUp } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { AIThinkingStep } from "./AIThinkingStep";

interface PersonalizationTimelapseDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type TimelapseState = 
  | "intro" 
  | "iphone_home" 
  | "notification_slide" 
  | "extracting_email" 
  | "travel_form" 
  | "starting_search"
  | "gadget_cover_popup"
  | "searching_quotes" 
  | "travel_quotes_results"
  | "purchasing_policy";

interface TravelFormData {
  name: string;
  age: number;
  destination: string;
  startDate: string;
  endDate: string;
  travellers: number;
  medicalCondition: boolean;
  gadgetCover: boolean;
  winterSportsCover: boolean;
  cruiseCover: boolean;
}

export function PersonalizationTimelapseDialog({
  open,
  onOpenChange,
}: PersonalizationTimelapseDialogProps) {
  const [state, setState] = useState<TimelapseState>("intro");
  const [showNotification, setShowNotification] = useState(false);
  const [selectedInsurer, setSelectedInsurer] = useState<string>("");
  const [formData, setFormData] = useState<TravelFormData>({
    name: "",
    age: 0,
    destination: "",
    startDate: "",
    endDate: "",
    travellers: 1,
    medicalCondition: false,
    gadgetCover: false,
    winterSportsCover: false,
    cruiseCover: false,
  });
  
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (!open) {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    }
  }, [open]);

  const handleStartTimelapse = useCallback(() => {
    setState("iphone_home");
    timerRef.current = setTimeout(() => {
      if (isMountedRef.current) {
        setState("notification_slide");
        setShowNotification(true);
      }
    }, 1500);
  }, []);

  const handleNotificationTap = useCallback(() => {
    setShowNotification(false);
    setState("extracting_email");
  }, []);

  const handleExtractionComplete = useCallback(() => {
    setFormData({
      name: "James Wilson",
      age: 34,
      destination: "Sydney, Australia",
      startDate: "2025-12-06",
      endDate: "2026-01-02",
      travellers: 1,
      medicalCondition: false,
      gadgetCover: false,
      winterSportsCover: false,
      cruiseCover: false,
    });
    setState("travel_form");
  }, []);

  const handleSearchQuotes = useCallback(() => {
    setState("starting_search");
  }, []);

  const handleStartingSearchComplete = useCallback(() => {
    setState("gadget_cover_popup");
  }, []);

  const handleGadgetCoverResponse = useCallback(() => {
    setState("searching_quotes");
  }, []);

  const handleSearchComplete = useCallback(() => {
    setState("travel_quotes_results");
  }, []);

  const handleProceedToBuy = useCallback((insurerName: string) => {
    setSelectedInsurer(insurerName);
    setState("purchasing_policy");
  }, []);

  const handleClose = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    setState("intro");
    setShowNotification(false);
    setFormData({
      name: "",
      age: 0,
      destination: "",
      startDate: "",
      endDate: "",
      travellers: 1,
      medicalCondition: false,
      gadgetCover: false,
      winterSportsCover: false,
      cruiseCover: false,
    });
    onOpenChange(false);
  }, [onOpenChange]);

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent
        className="max-w-full max-h-full w-screen h-screen p-0 m-0 border-0"
        data-testid="dialog-personalization-timelapse"
      >
        <DialogTitle className="sr-only">Timelapse Demo - Auto-Annie Email Integration</DialogTitle>

        <DialogClose asChild>
          <Button
            variant="ghost"
            size="icon"
            className="absolute right-6 top-6 z-50 hover-elevate active-elevate-2"
            data-testid="button-close-personalization-timelapse"
          >
            <X className="h-5 w-5" />
            <span className="sr-only">Close</span>
          </Button>
        </DialogClose>

        {state === "intro" && (
          <IntroState onStart={handleStartTimelapse} />
        )}

        {(state === "iphone_home" || state === "notification_slide") && (
          <IPhoneHomeState
            showNotification={showNotification}
            onNotificationTap={handleNotificationTap}
          />
        )}

        {state === "extracting_email" && (
          <ExtractingEmailState onComplete={handleExtractionComplete} />
        )}

        {state === "travel_form" && (
          <TravelFormState
            formData={formData}
            onSearchQuotes={handleSearchQuotes}
          />
        )}

        {state === "starting_search" && (
          <StartingSearchState onComplete={handleStartingSearchComplete} />
        )}

        {state === "gadget_cover_popup" && (
          <GadgetCoverPopup onRespond={handleGadgetCoverResponse} />
        )}

        {state === "searching_quotes" && (
          <SearchingQuotesState 
            destination={formData.destination}
            onComplete={handleSearchComplete}
          />
        )}

        {state === "travel_quotes_results" && (
          <TravelQuotesResultsState
            destination={formData.destination}
            onClose={handleClose}
            onProceedToBuy={handleProceedToBuy}
          />
        )}

        {state === "purchasing_policy" && (
          <PurchasingPolicyState
            insurerName={selectedInsurer}
            destination={formData.destination}
            onClose={handleClose}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

function IntroState({ onStart }: { onStart: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center h-full space-y-8 p-8 bg-gradient-to-br from-background via-background to-purple-500/5">
      <div className="text-center space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-700">
        <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-purple-500 to-pink-600 flex items-center justify-center mx-auto mb-6 shadow-lg">
          <Plane className="w-10 h-10 text-white" />
        </div>
        <h2 className="text-3xl md:text-4xl font-bold text-foreground leading-relaxed">
          Experience how <span className="text-primary">Auto-Annie</span> detects your travel bookings
        </h2>
        <p className="text-lg text-muted-foreground max-w-2xl">
          Watch as Auto-Annie reads your Gmail, finds travel confirmations, and offers personalized insurance
        </p>
      </div>

      <Button
        size="lg"
        onClick={onStart}
        className="px-12 py-7 text-xl animate-in fade-in slide-in-from-bottom-4 duration-700 delay-300"
        data-testid="button-start-personalization-timelapse"
      >
        <Sparkles className="mr-2 h-5 w-5" />
        Start
      </Button>
    </div>
  );
}

function TravelNotification({ onTap }: { onTap: () => void }) {
  return (
    <motion.div
      initial={{ y: -200, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      exit={{ y: -200, opacity: 0 }}
      transition={{ type: "spring", damping: 25, stiffness: 300 }}
      className="absolute top-2 left-4 right-4 z-50 cursor-pointer"
      onClick={onTap}
      data-testid="travel-notification"
    >
      <div className="bg-white/95 backdrop-blur-md rounded-2xl shadow-2xl p-4 border border-gray-200">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-purple-500 to-pink-600 flex items-center justify-center flex-shrink-0">
            <Plane className="w-6 h-6 text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between mb-1">
              <p className="text-sm font-semibold text-gray-900">Auto-Annie</p>
              <p className="text-xs text-gray-500">now</p>
            </div>
            <p className="text-sm font-medium text-gray-900 mb-0.5">Upcoming trip to Sydney</p>
            <p className="text-xs text-gray-600 line-clamp-2">
              Get travel insurance for your upcoming trip
            </p>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

function IPhoneHomeState({ 
  showNotification, 
  onNotificationTap 
}: { 
  showNotification: boolean;
  onNotificationTap: () => void;
}) {
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const timeString = currentTime.toLocaleTimeString('en-US', { 
    hour: 'numeric', 
    minute: '2-digit',
    hour12: false 
  });

  return (
    <div className="flex flex-col items-center justify-center h-full p-8">
      <div className="flex flex-col items-center gap-6" data-testid="iphone-travel-mockup">
        <div className="relative">
          <div className="relative w-[340px] h-[680px] bg-gray-900 rounded-[55px] shadow-2xl p-3">
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[150px] h-[30px] bg-gray-900 rounded-b-3xl z-20" />
            
            <div className="relative w-full h-full bg-gradient-to-br from-purple-50 to-pink-50 rounded-[45px] overflow-hidden">
              <div className="absolute top-0 left-0 right-0 h-12 bg-gradient-to-b from-black/10 to-transparent z-10 px-8 pt-3 flex items-start justify-between text-xs font-semibold text-gray-700">
                <span>{timeString}</span>
                <div className="flex items-center gap-1">
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M2 11a1 1 0 011-1h2a1 1 0 011 1v5a1 1 0 01-1 1H3a1 1 0 01-1-1v-5zM8 7a1 1 0 011-1h2a1 1 0 011 1v9a1 1 0 01-1 1H9a1 1 0 01-1-1V7zM14 4a1 1 0 011-1h2a1 1 0 011 1v12a1 1 0 01-1 1h-2a1 1 0 01-1-1V4z" />
                  </svg>
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                  </svg>
                </div>
              </div>

              <div className="absolute inset-0 flex flex-col items-center justify-center p-8 pt-16">
                <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-purple-500 to-pink-600 flex items-center justify-center mb-4 shadow-lg">
                  <Plane className="w-12 h-12 text-white" />
                </div>
                <h2 className="text-2xl font-bold text-gray-800 mb-2">Auto-Annie</h2>
                <p className="text-sm text-gray-600 text-center mb-6">Your insurance policy assistant</p>
                
                {!showNotification && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="mt-4 bg-white/80 backdrop-blur-sm rounded-xl px-6 py-3 border border-gray-200 shadow-md"
                  >
                    <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">Scanning Gmail</p>
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 bg-purple-500 rounded-full animate-pulse" />
                      <p className="text-sm font-medium text-gray-800">Looking for travel bookings...</p>
                    </div>
                  </motion.div>
                )}
              </div>

              <AnimatePresence>
                {showNotification && (
                  <TravelNotification onTap={onNotificationTap} />
                )}
              </AnimatePresence>

              <div className="absolute bottom-2 left-1/2 -translate-x-1/2 w-32 h-1 bg-gray-800 rounded-full" />
            </div>
          </div>
        </div>

        <motion.p
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-sm text-muted-foreground text-center max-w-md"
        >
          {showNotification ? "Tap the notification to view details" : "Auto-Annie is scanning your Gmail..."}
        </motion.p>
      </div>
    </div>
  );
}

const EXTRACTION_STEPS = [
  { text: "Extracting details from email...", blinks: 2, duration: 1800 },
  { text: "Reading ticket_2309323.pdf from Skyscanner", blinks: 2, duration: 2200 },
];

function ExtractingEmailState({ onComplete }: { onComplete: () => void }) {
  const [currentStep, setCurrentStep] = useState(0);
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (currentStep >= EXTRACTION_STEPS.length) {
      const timer = setTimeout(() => {
        if (isMountedRef.current) {
          onComplete();
        }
      }, 500);
      return () => clearTimeout(timer);
    }

    const timer = setTimeout(() => {
      if (isMountedRef.current) {
        setCurrentStep(prev => prev + 1);
      }
    }, EXTRACTION_STEPS[currentStep].duration);

    return () => clearTimeout(timer);
  }, [currentStep, onComplete]);

  return (
    <div className="flex flex-col items-center justify-center h-full p-8 bg-gradient-to-br from-background via-background to-purple-500/5">
      <div className="max-w-2xl w-full space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
        <div className="text-center mb-12">
          <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-3">
            Reading your travel booking...
          </h2>
          <p className="text-lg text-muted-foreground">
            Auto-Annie is extracting trip details
          </p>
        </div>

        <div className="bg-card border border-border rounded-xl p-8 space-y-3" data-testid="email-extraction-steps">
          {EXTRACTION_STEPS.map((step, index) => (
            <AIThinkingStep
              key={index}
              text={step.text}
              status={
                index < currentStep 
                  ? "completed" 
                  : index === currentStep 
                  ? "processing" 
                  : "pending"
              }
            />
          ))}
        </div>
      </div>
    </div>
  );
}

function TravelFormState({ 
  formData, 
  onSearchQuotes 
}: { 
  formData: TravelFormData;
  onSearchQuotes: () => void;
}) {
  const [gadgetCover, setGadgetCover] = useState(formData.gadgetCover);
  const [winterSportsCover, setWinterSportsCover] = useState(formData.winterSportsCover);
  const [cruiseCover, setCruiseCover] = useState(formData.cruiseCover);
  const [medicalCondition, setMedicalCondition] = useState(formData.medicalCondition);

  const formatDate = (dateStr: string) => {
    if (!dateStr) return "";
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  };

  return (
    <div className="flex flex-col items-center justify-center h-full p-8 overflow-y-auto">
      <div className="max-w-lg w-full space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
        <div className="text-center mb-8">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-purple-500 to-pink-600 flex items-center justify-center mx-auto mb-4 shadow-lg">
            <Plane className="w-8 h-8 text-white" />
          </div>
          <h2 className="text-2xl md:text-3xl font-bold text-foreground mb-2">
            Travel Insurance Details
          </h2>
          <p className="text-muted-foreground">
            Auto-Annie extracted these details from your booking
          </p>
        </div>

        <div className="bg-card border border-border rounded-xl p-6 space-y-5">
          {/* Name and Age fields */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="flex items-center gap-2 text-sm font-medium">
                <User className="h-4 w-4 text-primary" />
                Name
              </Label>
              <Input
                value={formData.name}
                readOnly
                className="bg-muted/50"
                data-testid="input-traveller-name"
              />
            </div>
            <div className="space-y-2">
              <Label className="flex items-center gap-2 text-sm font-medium">
                <User className="h-4 w-4 text-primary" />
                Age
              </Label>
              <Input
                type="number"
                value={formData.age}
                readOnly
                className="bg-muted/50"
                data-testid="input-traveller-age"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label className="flex items-center gap-2 text-sm font-medium">
              <Plane className="h-4 w-4 text-primary" />
              Destination
            </Label>
            <Input
              value={formData.destination}
              readOnly
              className="bg-muted/50"
              data-testid="input-destination"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="flex items-center gap-2 text-sm font-medium">
                <Calendar className="h-4 w-4 text-primary" />
                Trip Start
              </Label>
              <Input
                value={formatDate(formData.startDate)}
                readOnly
                className="bg-muted/50"
                data-testid="input-start-date"
              />
            </div>
            <div className="space-y-2">
              <Label className="flex items-center gap-2 text-sm font-medium">
                <Calendar className="h-4 w-4 text-primary" />
                Trip End
              </Label>
              <Input
                value={formatDate(formData.endDate)}
                readOnly
                className="bg-muted/50"
                data-testid="input-end-date"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label className="flex items-center gap-2 text-sm font-medium">
              <Users className="h-4 w-4 text-primary" />
              Number of Travellers
            </Label>
            <Input
              type="number"
              value={formData.travellers}
              readOnly
              className="bg-muted/50"
              data-testid="input-travellers"
            />
          </div>

          {/* Coverage options checkboxes */}
          <div className="space-y-3">
            <Label className="text-sm font-medium text-muted-foreground">Optional Coverage</Label>
            
            <div className="flex items-center space-x-3 p-3 rounded-lg bg-muted/30">
              <Checkbox
                id="gadgetCover"
                checked={gadgetCover}
                onCheckedChange={(checked) => setGadgetCover(checked === true)}
                data-testid="checkbox-gadget-cover"
              />
              <Label htmlFor="gadgetCover" className="flex items-center gap-2 text-sm cursor-pointer">
                <Camera className="h-4 w-4 text-primary" />
                Gadget cover
              </Label>
            </div>

            <div className="flex items-center space-x-3 p-3 rounded-lg bg-muted/30">
              <Checkbox
                id="winterSportsCover"
                checked={winterSportsCover}
                onCheckedChange={(checked) => setWinterSportsCover(checked === true)}
                data-testid="checkbox-winter-sports-cover"
              />
              <Label htmlFor="winterSportsCover" className="flex items-center gap-2 text-sm cursor-pointer">
                <Snowflake className="h-4 w-4 text-primary" />
                Winter sports cover
              </Label>
            </div>

            <div className="flex items-center space-x-3 p-3 rounded-lg bg-muted/30">
              <Checkbox
                id="cruiseCover"
                checked={cruiseCover}
                onCheckedChange={(checked) => setCruiseCover(checked === true)}
                data-testid="checkbox-cruise-cover"
              />
              <Label htmlFor="cruiseCover" className="flex items-center gap-2 text-sm cursor-pointer">
                <Ship className="h-4 w-4 text-primary" />
                Cruise cover
              </Label>
            </div>
          </div>

          <div className="flex items-center space-x-3 p-3 rounded-lg bg-muted/30">
            <Checkbox
              id="medical"
              checked={medicalCondition}
              onCheckedChange={(checked) => setMedicalCondition(checked === true)}
              data-testid="checkbox-medical"
            />
            <Label htmlFor="medical" className="flex items-center gap-2 text-sm cursor-pointer">
              <Heart className="h-4 w-4 text-primary" />
              Any pre-existing medical conditions
            </Label>
          </div>
        </div>

        <Button
          size="lg"
          onClick={onSearchQuotes}
          className="w-full py-6 text-lg"
          data-testid="button-search-travel-quotes"
        >
          <Search className="mr-2 h-5 w-5" />
          Search Quotes
        </Button>
      </div>
    </div>
  );
}

function SearchingQuotesState({ 
  destination, 
  onComplete 
}: { 
  destination: string;
  onComplete: () => void;
}) {
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (isMountedRef.current) {
        onComplete();
      }
    }, 3000);
    return () => clearTimeout(timer);
  }, [onComplete]);

  return (
    <div className="flex flex-col items-center justify-center h-full p-8 bg-gradient-to-br from-background via-background to-purple-500/5">
      <div className="text-center space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
        <div className="w-24 h-24 rounded-full bg-gradient-to-br from-purple-500 to-pink-600 flex items-center justify-center mx-auto shadow-lg">
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
          >
            <Search className="w-12 h-12 text-white" />
          </motion.div>
        </div>
        
        <div className="space-y-3">
          <h2 className="text-3xl md:text-4xl font-bold text-foreground">
            Searching quotes for your travel
          </h2>
          <p className="text-xl text-primary font-semibold">
            to {destination.split(",")[0]}
          </p>
          <p className="text-muted-foreground">
            Finding the best travel insurance for you...
          </p>
        </div>

        <div className="flex items-center justify-center gap-2">
          {[0, 1, 2].map((i) => (
            <motion.div
              key={i}
              className="w-3 h-3 bg-primary rounded-full"
              animate={{
                opacity: [0.3, 1, 0.3],
                scale: [0.8, 1.2, 0.8],
              }}
              transition={{
                duration: 0.6,
                repeat: Infinity,
                delay: i * 0.15,
                ease: "easeInOut",
              }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

const MOCK_TRAVEL_QUOTES = [
  {
    insurer_name: "Admiral",
    price: 89.99,
    trustpilot_rating: 4.6,
    trustpilot_reviews: 45230,
    features: ["Medical Cover", "Cancellation", "Baggage"],
    autoannie_score: 4.5,
    message: "Admiral offers comprehensive medical cover up to £10M, ideal for long-haul trips to Australia."
  },
  {
    insurer_name: "CoverMoor",
    price: 76.50,
    trustpilot_rating: 4.4,
    trustpilot_reviews: 32100,
    features: ["Medical Cover", "Gadget Cover", "Delays"],
    autoannie_score: 4.3,
    message: "Great value option with gadget cover included - perfect for protecting your camera gear."
  },
  {
    insurer_name: "WorldNomeds",
    price: 112.00,
    trustpilot_rating: 4.7,
    trustpilot_reviews: 67890,
    features: ["Adventure Sports", "Medical Cover", "Cancellation", "Baggage"],
    autoannie_score: 4.7,
    message: "Best choice for adventure travelers with extensive activity coverage and 24/7 assistance."
  },
  {
    insurer_name: "Allianze Travel",
    price: 95.25,
    trustpilot_rating: 4.3,
    trustpilot_reviews: 89450,
    features: ["Medical Cover", "Trip Interruption", "Emergency Evac"],
    autoannie_score: 4.2,
    message: "Trusted global brand with reliable claims handling and emergency evacuation services."
  },
  {
    insurer_name: "InsureandGoe",
    price: 62.99,
    trustpilot_rating: 4.1,
    trustpilot_reviews: 28700,
    features: ["Medical Cover", "Cancellation"],
    autoannie_score: 3.8,
    message: "Budget-friendly option covering essentials. Good for shorter trips with basic coverage needs."
  },
  {
    insurer_name: "Colombus Direct",
    price: 84.50,
    trustpilot_rating: 4.5,
    trustpilot_reviews: 41200,
    features: ["Medical Cover", "Gadget Cover", "Cruise Cover"],
    autoannie_score: 4.4,
    message: "Strong all-rounder with cruise-specific coverage and gadget protection up to £2,500."
  },
  {
    insurer_name: "Staysafe",
    price: 108.00,
    trustpilot_rating: 4.2,
    trustpilot_reviews: 35600,
    features: ["Medical Cover", "Pre-existing Conditions", "Cancellation"],
    autoannie_score: 4.0,
    message: "Specialist in covering pre-existing medical conditions with no upper age limit."
  },
  {
    insurer_name: "Postt Office",
    price: 71.25,
    trustpilot_rating: 4.0,
    trustpilot_reviews: 52400,
    features: ["Medical Cover", "Baggage", "Delays"],
    autoannie_score: 3.9,
    message: "Reliable high-street option with straightforward coverage and good value pricing."
  },
  {
    insurer_name: "Avivo",
    price: 99.99,
    trustpilot_rating: 4.4,
    trustpilot_reviews: 78900,
    features: ["Medical Cover", "Cancellation", "Winter Sports"],
    autoannie_score: 4.3,
    message: "Established insurer with winter sports add-on available and excellent customer service."
  },
  {
    insurer_name: "LW=",
    price: 87.50,
    trustpilot_rating: 4.5,
    trustpilot_reviews: 61200,
    features: ["Medical Cover", "Gadget Cover", "Cancellation", "Legal Expenses"],
    autoannie_score: 4.4,
    message: "Comprehensive policy including legal expenses cover and 24-hour emergency helpline."
  }
];

const FEATURE_CONFIG: Record<string, { icon: typeof Stethoscope; color: string; bgColor: string }> = {
  "Medical Cover": { icon: Stethoscope, color: "text-emerald-600 dark:text-emerald-400", bgColor: "bg-emerald-50 dark:bg-emerald-950/50" },
  "Gadget Cover": { icon: Smartphone, color: "text-blue-600 dark:text-blue-400", bgColor: "bg-blue-50 dark:bg-blue-950/50" },
  "Cancellation": { icon: XCircle, color: "text-orange-600 dark:text-orange-400", bgColor: "bg-orange-50 dark:bg-orange-950/50" },
  "Baggage": { icon: Luggage, color: "text-purple-600 dark:text-purple-400", bgColor: "bg-purple-50 dark:bg-purple-950/50" },
  "Delays": { icon: Clock, color: "text-amber-600 dark:text-amber-400", bgColor: "bg-amber-50 dark:bg-amber-950/50" },
  "Adventure Sports": { icon: Mountain, color: "text-rose-600 dark:text-rose-400", bgColor: "bg-rose-50 dark:bg-rose-950/50" },
  "Winter Sports": { icon: Snowflake, color: "text-cyan-600 dark:text-cyan-400", bgColor: "bg-cyan-50 dark:bg-cyan-950/50" },
  "Cruise Cover": { icon: Anchor, color: "text-indigo-600 dark:text-indigo-400", bgColor: "bg-indigo-50 dark:bg-indigo-950/50" },
  "Trip Interruption": { icon: AlertTriangle, color: "text-red-600 dark:text-red-400", bgColor: "bg-red-50 dark:bg-red-950/50" },
  "Emergency Evac": { icon: Plane, color: "text-sky-600 dark:text-sky-400", bgColor: "bg-sky-50 dark:bg-sky-950/50" },
  "Pre-existing Conditions": { icon: Heart, color: "text-pink-600 dark:text-pink-400", bgColor: "bg-pink-50 dark:bg-pink-950/50" },
  "Legal Expenses": { icon: Scale, color: "text-slate-600 dark:text-slate-400", bgColor: "bg-slate-50 dark:bg-slate-950/50" },
};

function TravelQuotesResultsState({ 
  destination, 
  onClose,
  onProceedToBuy
}: { 
  destination: string;
  onClose: () => void;
  onProceedToBuy: (insurerName: string) => void;
}) {
  const getFeatureConfig = (feature: string) => {
    return FEATURE_CONFIG[feature] || { icon: CheckCircle2, color: "text-gray-600 dark:text-gray-400", bgColor: "bg-gray-50 dark:bg-gray-900/50" };
  };

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

  return (
    <div className="flex flex-col h-full p-4 md:p-8 overflow-y-auto">
      <div className="max-w-4xl mx-auto w-full space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
        <div className="text-center mb-6 sticky top-0 bg-background/95 backdrop-blur-sm py-4 z-10">
          <div className="flex items-center justify-center gap-3 mb-2">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-500 to-pink-600 flex items-center justify-center shadow-lg">
              <Plane className="w-6 h-6 text-white" />
            </div>
            <div className="text-left">
              <h2 className="text-xl md:text-2xl font-bold text-foreground">
                Travel Quotes for {destination.split(",")[0]}
              </h2>
              <p className="text-sm text-muted-foreground">
                {MOCK_TRAVEL_QUOTES.length} quotes found
              </p>
            </div>
          </div>
        </div>

        <div className="space-y-4">
          {MOCK_TRAVEL_QUOTES.map((quote, index) => (
            <Card key={index} className="shadow-md" data-testid={`card-travel-quote-${index}`}>
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="bg-primary/10 p-2 rounded-lg">
                      <Shield className="w-6 h-6 text-primary" />
                    </div>
                    <div>
                      <CardTitle className="text-lg text-foreground" data-testid={`text-travel-insurer-${index}`}>
                        {quote.insurer_name}
                      </CardTitle>
                      <p className="text-lg font-bold text-primary mt-1" data-testid={`text-travel-price-${index}`}>
                        £{quote.price.toFixed(2)}
                      </p>
                    </div>
                  </div>
                </div>

              </CardHeader>

              <CardContent className="space-y-4">
                {/* Enhanced Features Section */}
                <div className="bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-950/30 dark:to-emerald-950/30 rounded-xl p-4 border border-green-100 dark:border-green-900">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="bg-green-500 p-1.5 rounded-lg">
                      <CheckCircle2 className="w-4 h-4 text-white" />
                    </div>
                    <span className="text-sm font-semibold text-foreground">Coverage Included</span>
                    <Badge variant="secondary" className="ml-auto text-xs bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300">
                      {quote.features.length} features
                    </Badge>
                  </div>
                  <div className="grid grid-cols-2 gap-2" data-testid={`features-travel-${index}`}>
                    {quote.features.map((feature, fIndex) => {
                      const config = getFeatureConfig(feature);
                      const FeatureIcon = config.icon;
                      return (
                        <div 
                          key={fIndex} 
                          className={`flex items-center gap-2 ${config.bgColor} rounded-lg px-3 py-2 border border-transparent hover:border-current/10 transition-colors`}
                          data-testid={`badge-feature-${index}-${fIndex}`}
                        >
                          <FeatureIcon className={`w-4 h-4 ${config.color} shrink-0`} />
                          <span className={`text-xs font-medium ${config.color}`}>{feature}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Enhanced Rating Section */}
                <div className="bg-gradient-to-r from-amber-50 to-yellow-50 dark:from-amber-950/30 dark:to-yellow-950/30 rounded-xl p-4 border border-amber-100 dark:border-amber-900">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="bg-amber-500 p-1.5 rounded-lg">
                      <Star className="w-4 h-4 text-white fill-white" />
                    </div>
                    <span className="text-sm font-semibold text-foreground">TrustPilot Rating</span>
                  </div>
                  <div className="flex items-center gap-4" data-testid={`rating-section-${index}`}>
                    {/* Circular Score Badge */}
                    <div className="relative">
                      <svg className="w-16 h-16 transform -rotate-90">
                        <circle
                          cx="32"
                          cy="32"
                          r="28"
                          stroke="currentColor"
                          strokeWidth="6"
                          fill="none"
                          className="text-amber-100 dark:text-amber-900"
                        />
                        <circle
                          cx="32"
                          cy="32"
                          r="28"
                          stroke="currentColor"
                          strokeWidth="6"
                          fill="none"
                          strokeDasharray={`${(quote.trustpilot_rating / 5) * 175.9} 175.9`}
                          strokeLinecap="round"
                          className="text-amber-500"
                        />
                      </svg>
                      <div className="absolute inset-0 flex items-center justify-center">
                        <span className="text-lg font-bold text-amber-600 dark:text-amber-400">{quote.trustpilot_rating.toFixed(1)}</span>
                      </div>
                    </div>
                    {/* Rating Details */}
                    <div className="flex-1 space-y-2">
                      <div className="flex items-center gap-1">
                        {renderStars(quote.trustpilot_rating)}
                      </div>
                      <div className="flex items-center gap-2">
                        <ThumbsUp className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                        <span className="text-xs text-muted-foreground">
                          <span className="font-semibold text-amber-700 dark:text-amber-300">{quote.trustpilot_reviews.toLocaleString()}</span> verified reviews
                        </span>
                      </div>
                      <div className="w-full">
                        <div className="flex justify-between text-xs mb-1">
                          <span className="text-muted-foreground">Trust Score</span>
                          <span className="font-medium text-amber-600 dark:text-amber-400">{((quote.trustpilot_rating / 5) * 100).toFixed(0)}%</span>
                        </div>
                        <Progress value={(quote.trustpilot_rating / 5) * 100} className="h-1.5 bg-amber-100 dark:bg-amber-900" />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Enhanced AutoAnnie Insight Section */}
                <div className="relative overflow-hidden rounded-xl border border-purple-200 dark:border-purple-800">
                  <div className="bg-gradient-to-r from-purple-600 via-indigo-600 to-blue-600 px-4 py-2.5 flex items-center gap-2">
                    <motion.div
                      animate={{ rotate: [0, 15, -15, 0], scale: [1, 1.1, 1] }}
                      transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
                    >
                      <Sparkles className="w-4 h-4 text-yellow-300" />
                    </motion.div>
                    <span className="text-sm font-semibold text-white">AutoAnnie's Insight</span>
                    <div className="ml-auto flex items-center gap-1.5 bg-white/20 px-2 py-0.5 rounded-full">
                      <Shield className="w-3 h-3 text-white" />
                      <span className="text-xs font-medium text-white" data-testid={`score-travel-${index}`}>
                        {quote.autoannie_score.toFixed(1)}/5
                      </span>
                    </div>
                  </div>
                  <div className="bg-gradient-to-br from-purple-50 via-white to-indigo-50 dark:from-purple-950/50 dark:via-background dark:to-indigo-950/50 p-4">
                    <div className="flex items-start gap-3">
                      <div className="bg-purple-100 dark:bg-purple-900 p-2 rounded-lg shrink-0">
                        <Briefcase className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                      </div>
                      <p className="text-sm text-foreground leading-relaxed" data-testid={`text-travel-analysis-${index}`}>
                        {quote.message}
                      </p>
                    </div>
                    {/* Coverage Match Indicator */}
                    <div className="mt-3 pt-3 border-t border-purple-100 dark:border-purple-800">
                      <div className="flex items-center justify-between text-xs mb-1.5">
                        <span className="text-muted-foreground">Coverage Match</span>
                        <span className="font-semibold text-purple-600 dark:text-purple-400">{((quote.autoannie_score / 5) * 100).toFixed(0)}%</span>
                      </div>
                      <div className="h-2 bg-purple-100 dark:bg-purple-900 rounded-full overflow-hidden">
                        <motion.div
                          className="h-full bg-gradient-to-r from-purple-500 to-indigo-500 rounded-full"
                          initial={{ width: 0 }}
                          animate={{ width: `${(quote.autoannie_score / 5) * 100}%` }}
                          transition={{ duration: 1, ease: "easeOut" }}
                        />
                      </div>
                    </div>
                  </div>
                </div>

                <Button
                  className="w-full"
                  onClick={() => onProceedToBuy(quote.insurer_name)}
                  data-testid={`button-proceed-buy-${index}`}
                >
                  Proceed and Buy
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="flex justify-center pt-6 pb-4">
          <Button
            size="lg"
            onClick={onClose}
            className="px-12 py-6 text-lg"
            data-testid="button-close-travel-quotes"
          >
            Close
          </Button>
        </div>
      </div>
    </div>
  );
}

function PurchasingPolicyState({
  insurerName,
  destination,
  onClose
}: {
  insurerName: string;
  destination: string;
  onClose: () => void;
}) {
  const [currentStep, setCurrentStep] = useState(0);
  const [showCelebration, setShowCelebration] = useState(false);
  const isMountedRef = useRef(true);

  const PURCHASE_STEPS = [
    { text: "AutoAnnie Contacting insurer", icon: Phone, duration: 2000 },
    { text: `Buying policy from ${insurerName}`, icon: Shield, duration: 2500 },
    { text: "Verifying policy document received", icon: FileCheck, duration: 2000 },
  ];

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (currentStep >= PURCHASE_STEPS.length) {
      const timer = setTimeout(() => {
        if (isMountedRef.current) {
          setShowCelebration(true);
        }
      }, 500);
      return () => clearTimeout(timer);
    }

    const timer = setTimeout(() => {
      if (isMountedRef.current) {
        setCurrentStep(prev => prev + 1);
      }
    }, PURCHASE_STEPS[currentStep].duration);

    return () => clearTimeout(timer);
  }, [currentStep]);

  const destinationCity = destination.split(",")[0];

  if (showCelebration) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-8 bg-white">
        <div className="max-w-2xl w-full space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
          <div className="text-center">
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: "spring", stiffness: 200, damping: 15, delay: 0.2 }}
              className="w-24 h-24 rounded-full bg-gradient-to-br from-green-400 to-emerald-600 flex items-center justify-center mx-auto mb-6 shadow-lg"
            >
              <PartyPopper className="w-12 h-12 text-white" />
            </motion.div>
            
            <motion.h2
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
              className="text-3xl md:text-4xl font-bold text-foreground mb-4"
            >
              Your {destinationCity} travel is covered!
            </motion.h2>
            
            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.6 }}
              className="text-xl text-primary font-medium"
            >
              Policy purchased from {insurerName}
            </motion.p>
          </div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.8 }}
            className="flex justify-center pt-6"
          >
            <Button
              size="lg"
              onClick={onClose}
              className="px-12 py-6 text-lg"
              data-testid="button-close-celebration"
            >
              Done
            </Button>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 1.2 }}
            className="bg-blue-50 border border-blue-100 rounded-xl p-4 mt-8"
          >
            <div className="flex items-start gap-3">
              <div className="bg-blue-100 p-2 rounded-lg shrink-0">
                <Home className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-blue-800">
                  Adding <span className="font-medium">Home Emergency Extra</span> cover in your home insurance can help your family when you are away.
                </p>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center h-full p-8 bg-white">
      <div className="max-w-2xl w-full space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
        <div className="text-center mb-8">
          <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-3">
            Completing Purchase
          </h2>
          <p className="text-muted-foreground">
            AutoAnnie is handling everything for you...
          </p>
        </div>

        <div className="space-y-4">
          {PURCHASE_STEPS.map((step, index) => {
            const StepIcon = step.icon;
            const isActive = index === currentStep;
            const isCompleted = index < currentStep;
            
            return (
              <motion.div
                key={index}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.1 }}
                className={`flex items-center gap-4 p-4 rounded-xl border transition-all duration-300 ${
                  isActive 
                    ? "bg-primary/5 border-primary shadow-sm" 
                    : isCompleted 
                      ? "bg-green-50 border-green-200" 
                      : "bg-muted/30 border-border"
                }`}
                data-testid={`step-purchase-${index}`}
              >
                <div className={`p-2 rounded-lg ${
                  isActive 
                    ? "bg-primary/10" 
                    : isCompleted 
                      ? "bg-green-100" 
                      : "bg-muted"
                }`}>
                  {isCompleted ? (
                    <CheckCircle2 className="w-6 h-6 text-green-600" />
                  ) : (
                    <StepIcon className={`w-6 h-6 ${isActive ? "text-primary" : "text-muted-foreground"}`} />
                  )}
                </div>
                
                <span className={`text-lg font-medium ${
                  isActive 
                    ? "text-foreground" 
                    : isCompleted 
                      ? "text-green-700" 
                      : "text-muted-foreground"
                }`}>
                  {step.text}
                </span>

                {isActive && (
                  <div className="ml-auto flex gap-1">
                    {[0, 1, 2].map((i) => (
                      <motion.div
                        key={i}
                        className="w-2 h-2 bg-primary rounded-full"
                        animate={{
                          opacity: [0.3, 1, 0.3],
                          scale: [0.8, 1.2, 0.8],
                        }}
                        transition={{
                          duration: 0.6,
                          repeat: Infinity,
                          delay: i * 0.15,
                          ease: "easeInOut",
                        }}
                      />
                    ))}
                  </div>
                )}
              </motion.div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function StartingSearchState({ onComplete }: { onComplete: () => void }) {
  const [currentStep, setCurrentStep] = useState(0);
  const isMountedRef = useRef(true);

  const STARTING_STEPS = [
    { text: "Starting quote search...", duration: 1500 },
    { text: "Preparing your travel details...", duration: 1200 },
  ];

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (currentStep >= STARTING_STEPS.length) {
      const timer = setTimeout(() => {
        if (isMountedRef.current) {
          onComplete();
        }
      }, 500);
      return () => clearTimeout(timer);
    }

    const timer = setTimeout(() => {
      if (isMountedRef.current) {
        setCurrentStep(prev => prev + 1);
      }
    }, STARTING_STEPS[currentStep].duration);

    return () => clearTimeout(timer);
  }, [currentStep, onComplete]);

  return (
    <div className="flex flex-col items-center justify-center h-full p-8 bg-gradient-to-br from-background via-background to-purple-500/5">
      <div className="max-w-2xl w-full space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
        <div className="text-center mb-12">
          <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-3">
            Starting quote search...
          </h2>
          <p className="text-lg text-muted-foreground">
            Auto-Annie is preparing to find the best quotes for you
          </p>
        </div>

        <div className="bg-card border border-border rounded-xl p-8 space-y-3" data-testid="starting-search-steps">
          {STARTING_STEPS.map((step, index) => (
            <AIThinkingStep
              key={index}
              text={step.text}
              status={
                index < currentStep 
                  ? "completed" 
                  : index === currentStep 
                  ? "processing" 
                  : "pending"
              }
            />
          ))}
        </div>
      </div>
    </div>
  );
}

function GadgetCoverPopup({ onRespond }: { onRespond: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center h-full p-8 bg-gradient-to-br from-background via-background to-purple-500/5">
      <motion.div 
        className="max-w-md w-full animate-in fade-in slide-in-from-bottom-4 duration-500"
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.3 }}
      >
        <div className="bg-card border border-border rounded-2xl p-8 shadow-xl space-y-6">
          <div className="flex items-center justify-center">
            <div className="w-16 h-16 rounded-full bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center shadow-lg">
              <Camera className="w-8 h-8 text-white" />
            </div>
          </div>

          <div className="text-center space-y-3">
            <h2 className="text-xl font-bold text-foreground">
              Gadget Cover Recommendation
            </h2>
            <p className="text-muted-foreground">
              Do you want to add gadget cover for the{" "}
              <span className="font-semibold text-foreground">
                'Sony Alpha 7IV Full-Frame Mirrorless Camera'
              </span>{" "}
              during the trip?
            </p>
            <p className="text-xs text-muted-foreground italic">
              Based on your recent purchase detected via email
            </p>
          </div>

          <div className="flex gap-4">
            <Button
              variant="outline"
              size="lg"
              onClick={onRespond}
              className="flex-1 py-6"
              data-testid="button-gadget-cover-no"
            >
              No
            </Button>
            <Button
              size="lg"
              onClick={onRespond}
              className="flex-1 py-6"
              data-testid="button-gadget-cover-yes"
            >
              Yes
            </Button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

function formatDate(dateStr: string) {
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}
