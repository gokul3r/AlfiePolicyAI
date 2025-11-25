import { Dialog, DialogContent, DialogClose, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { X, Sparkles, Search, Plane, Calendar, Users, Heart, User, Camera, Snowflake, Ship } from "lucide-react";
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
  | "travel_quotes_results";

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

function TravelQuotesResultsState({ 
  destination, 
  onClose 
}: { 
  destination: string;
  onClose: () => void;
}) {
  return (
    <div className="flex flex-col h-full p-8 overflow-y-auto">
      <div className="max-w-4xl mx-auto w-full space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
        <div className="text-center mb-8">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-purple-500 to-pink-600 flex items-center justify-center mx-auto mb-4 shadow-lg">
            <Plane className="w-8 h-8 text-white" />
          </div>
          <h2 className="text-2xl md:text-3xl font-bold text-foreground mb-2">
            Travel Quotes for {destination.split(",")[0]}
          </h2>
          <p className="text-muted-foreground">
            {formatDate(new Date().toISOString())}
          </p>
        </div>

        <div className="bg-card border border-border rounded-xl p-8 min-h-[300px] flex flex-col items-center justify-center">
          <div className="text-center space-y-4">
            <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mx-auto">
              <Search className="w-8 h-8 text-muted-foreground" />
            </div>
            <h3 className="text-xl font-semibold text-muted-foreground">
              Travel quotes will appear here
            </h3>
            <p className="text-sm text-muted-foreground max-w-md">
              Once the travel quote search API is ready, this section will display personalized insurance quotes for your trip.
            </p>
          </div>
        </div>

        <div className="flex justify-center pt-6">
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
