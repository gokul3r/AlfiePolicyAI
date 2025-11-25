import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";

interface IPhoneNotificationProps {
  vehicle: string;
  savings: number;
  provider: string;
  onTap: () => void;
}

function IPhoneNotification({ vehicle, savings, provider, onTap }: IPhoneNotificationProps) {
  return (
    <motion.div
      initial={{ y: -200, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      exit={{ y: -200, opacity: 0 }}
      transition={{ type: "spring", damping: 25, stiffness: 300 }}
      className="absolute top-2 left-4 right-4 z-50 cursor-pointer"
      onClick={onTap}
      data-testid="iphone-notification"
    >
      <div className="bg-white/95 backdrop-blur-md rounded-2xl shadow-2xl p-4 border border-gray-200">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center flex-shrink-0">
            <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between mb-1">
              <p className="text-sm font-semibold text-gray-900">Auto-Annie</p>
              <p className="text-xs text-gray-500">now</p>
            </div>
            <p className="text-sm font-medium text-gray-900 mb-0.5">Better quote found!</p>
            <p className="text-xs text-gray-600 line-clamp-2">
              {vehicle} - Save £{savings}/year with {provider}
            </p>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

interface IPhoneMockupProps {
  showNotification?: boolean;
  notificationData?: {
    vehicle: string;
    savings: number;
    provider: string;
  };
  onNotificationTap?: () => void;
  caption?: string;
  searchDate?: string;
}

export function IPhoneMockup({ 
  showNotification = false, 
  notificationData,
  onNotificationTap,
  caption,
  searchDate
}: IPhoneMockupProps) {
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
    <div className="flex flex-col items-center gap-6" data-testid="iphone-mockup">
      <div className="relative">
        {/* iPhone Frame */}
        <div className="relative w-[340px] h-[680px] bg-gray-900 rounded-[55px] shadow-2xl p-3">
          {/* Notch */}
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[150px] h-[30px] bg-gray-900 rounded-b-3xl z-20" />
          
          {/* Screen */}
          <div className="relative w-full h-full bg-gradient-to-br from-blue-50 to-purple-50 rounded-[45px] overflow-hidden">
            {/* Status Bar */}
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

            {/* App Content */}
            <div className="absolute inset-0 flex flex-col items-center justify-center p-8 pt-16">
              <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center mb-4 shadow-lg">
                <svg className="w-12 h-12 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
              </div>
              <h2 className="text-2xl font-bold text-gray-800 mb-2">Auto-Annie</h2>
              <p className="text-sm text-gray-600 text-center mb-6">Your insurance policy assistant</p>
              
              {/* Search Date Display */}
              {searchDate && (
                <motion.div
                  key={searchDate}
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="mt-4 bg-white/80 backdrop-blur-sm rounded-xl px-6 py-3 border border-gray-200 shadow-md"
                  data-testid="iphone-search-date"
                >
                  <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">Searching</p>
                  <p className="text-lg font-bold text-gray-800">{searchDate}</p>
                </motion.div>
              )}
            </div>

            {/* Notification */}
            <AnimatePresence>
              {showNotification && notificationData && onNotificationTap && (
                <IPhoneNotification
                  vehicle={notificationData.vehicle}
                  savings={notificationData.savings}
                  provider={notificationData.provider}
                  onTap={onNotificationTap}
                />
              )}
            </AnimatePresence>

            {/* Home Indicator */}
            <div className="absolute bottom-2 left-1/2 -translate-x-1/2 w-32 h-1 bg-gray-800 rounded-full" />
          </div>
        </div>
      </div>

      {/* Caption */}
      {caption && (
        <motion.p
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-sm text-muted-foreground text-center max-w-md"
          data-testid="iphone-caption"
        >
          {caption}
        </motion.p>
      )}
    </div>
  );
}
