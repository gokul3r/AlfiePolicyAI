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

interface PriceDataPoint {
  month: string;
  lowestPrice: number | null;
  marketLowestPrice: number | null;
  status?: "purchased" | "matched" | "market";
  insurer?: string;
  features?: string[];
}

function buildLineSegments(
  priceHistory: PriceDataPoint[],
  getValue: (p: PriceDataPoint) => number | null,
  getX: (i: number) => number,
  getY: (price: number) => number,
): string[] {
  const segments: string[] = [];
  let current: { x: number; y: number }[] = [];
  priceHistory.forEach((p, i) => {
    const val = getValue(p);
    if (val !== null) {
      current.push({ x: getX(i), y: getY(val) });
    } else {
      if (current.length > 1) {
        segments.push(current.map((pt, j) => `${j === 0 ? "M" : "L"} ${pt.x} ${pt.y}`).join(" "));
      }
      current = [];
    }
  });
  if (current.length > 1) {
    segments.push(current.map((pt, j) => `${j === 0 ? "M" : "L"} ${pt.x} ${pt.y}`).join(" "));
  }
  return segments;
}

function LivePriceChart({
  priceHistory,
  currentPolicyPrice,
}: {
  priceHistory: PriceDataPoint[];
  currentPolicyPrice: number;
}) {
  const [activeTooltip, setActiveTooltip] = useState<{
    x: number;
    y: number;
    price: number;
    insurer?: string;
    features?: string[];
    type: "purchased" | "matched" | "market";
  } | null>(null);

  const width = 260;
  const height = 120;
  const paddingLeft = 35;
  const paddingRight = 10;
  const paddingTop = 18;
  const paddingBottom = 20;
  const chartWidth = width - paddingLeft - paddingRight;
  const chartHeight = height - paddingTop - paddingBottom;

  const matchedPrices = priceHistory.map((p) => p.lowestPrice).filter((p): p is number => p !== null);
  const marketPrices = priceHistory.map((p) => p.marketLowestPrice).filter((p): p is number => p !== null);
  const allPricesForScale = [...matchedPrices, ...marketPrices];

  if (allPricesForScale.length === 0) {
    return (
      <div className="flex items-center justify-center" style={{ height: height }}>
        <p className="text-[10px] text-gray-400">Collecting data...</p>
      </div>
    );
  }

  if (currentPolicyPrice > 0) allPricesForScale.push(currentPolicyPrice);

  const minPrice = Math.min(...allPricesForScale) - 30;
  const maxPrice = Math.max(...allPricesForScale) + 30;
  const priceRange = maxPrice - minPrice || 1;

  const getX = (index: number) => {
    if (priceHistory.length <= 1) return paddingLeft + chartWidth / 2;
    return paddingLeft + (index / (priceHistory.length - 1)) * chartWidth;
  };

  const getY = (price: number) => {
    return paddingTop + chartHeight - ((price - minPrice) / priceRange) * chartHeight;
  };

  const marketSegments = buildLineSegments(priceHistory, (p) => p.marketLowestPrice, getX, getY);
  const matchedSegments = buildLineSegments(priceHistory, (p) => p.lowestPrice, getX, getY);

  const marketDots = priceHistory
    .map((p, i) => (p.marketLowestPrice !== null ? { x: getX(i), y: getY(p.marketLowestPrice), price: p.marketLowestPrice, index: i } : null))
    .filter((p): p is NonNullable<typeof p> => p !== null);

  const matchedDots = priceHistory
    .map((p, i) => (p.lowestPrice !== null ? { x: getX(i), y: getY(p.lowestPrice), price: p.lowestPrice, index: i, status: p.status || "matched", insurer: p.insurer, features: p.features } : null))
    .filter((p): p is NonNullable<typeof p> => p !== null);

  const refLineY = currentPolicyPrice > 0 ? getY(currentPolicyPrice) : null;

  const yTicks = 3;
  const tickValues = Array.from({ length: yTicks }, (_, i) => {
    const price = minPrice + (priceRange / (yTicks - 1)) * i;
    return Math.round(price);
  });

  const handleDotClick = (
    x: number,
    y: number,
    price: number,
    type: "purchased" | "matched" | "market",
    insurer?: string,
    features?: string[],
  ) => {
    if (activeTooltip && activeTooltip.x === x && activeTooltip.y === y) {
      setActiveTooltip(null);
    } else {
      setActiveTooltip({ x, y, price, insurer, features, type });
    }
  };

  const getMatchedDotColor = (status: string, isLast: boolean) => {
    if (status === "purchased") return "#16a34a";
    return isLast ? "#2563eb" : "#3b82f6";
  };

  const getMatchedLineColor = (hasAnyPurchased: boolean) => {
    return "#3b82f6";
  };

  const hasPurchased = priceHistory.some((p) => p.status === "purchased");

  return (
    <div className="relative" style={{ width: "100%" }}>
      <svg width={width} height={height} className="w-full" viewBox={`0 0 ${width} ${height}`} data-testid="price-chart-svg"
        onClick={(e) => {
          if ((e.target as SVGElement).tagName === 'svg') setActiveTooltip(null);
        }}
      >
        {/* Legend */}
        <circle cx={paddingLeft + 2} cy={6} r={3} fill="#9ca3af" />
        <text x={paddingLeft + 8} y={9} fontSize="6" className="fill-gray-500">Market Avg</text>
        {hasPurchased ? (
          <>
            <circle cx={paddingLeft + 52} cy={6} r={3} fill="#16a34a" />
            <text x={paddingLeft + 58} y={9} fontSize="6" fill="#16a34a">Switched</text>
            <circle cx={paddingLeft + 98} cy={6} r={3} fill="#3b82f6" />
            <text x={paddingLeft + 104} y={9} fontSize="6" className="fill-blue-600">Matched</text>
            {currentPolicyPrice > 0 && (
              <>
                <line x1={paddingLeft + 140} y1={6} x2={paddingLeft + 150} y2={6} stroke="#f97316" strokeWidth={1} strokeDasharray="2 1" />
                <text x={paddingLeft + 153} y={9} fontSize="5.5" className="fill-orange-500">Your price</text>
              </>
            )}
          </>
        ) : (
          <>
            <circle cx={paddingLeft + 52} cy={6} r={3} fill="#3b82f6" />
            <text x={paddingLeft + 58} y={9} fontSize="6" className="fill-blue-600">Matched</text>
            {currentPolicyPrice > 0 && (
              <>
                <line x1={paddingLeft + 98} y1={6} x2={paddingLeft + 108} y2={6} stroke="#f97316" strokeWidth={1} strokeDasharray="2 1" />
                <text x={paddingLeft + 111} y={9} fontSize="6" className="fill-orange-500">Your price</text>
              </>
            )}
          </>
        )}

        {/* Y-axis tick labels */}
        {tickValues.map((val) => (
          <text key={val} x={paddingLeft - 4} y={getY(val) + 3} textAnchor="end" className="fill-gray-400" fontSize="8">
            £{val}
          </text>
        ))}

        {/* Grid lines */}
        {tickValues.map((val) => (
          <line
            key={`grid-${val}`}
            x1={paddingLeft}
            y1={getY(val)}
            x2={width - paddingRight}
            y2={getY(val)}
            stroke="#e5e7eb"
            strokeWidth={0.5}
          />
        ))}

        {/* Current policy price reference line */}
        {refLineY !== null && (
          <line
            x1={paddingLeft}
            y1={refLineY}
            x2={width - paddingRight}
            y2={refLineY}
            stroke="#f97316"
            strokeWidth={1}
            strokeDasharray="4 3"
            opacity={0.8}
          />
        )}

        {/* Grey market line segments */}
        {marketSegments.map((segment, i) => (
          <path key={`market-${i}`} d={segment} fill="none" stroke="#9ca3af" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" opacity={0.7} />
        ))}

        {/* Grey market dots - clickable */}
        {marketDots.map((point, i) => (
          <g key={`market-dot-${i}`}>
            <circle
              cx={point.x}
              cy={point.y}
              r={6}
              fill="transparent"
              style={{ cursor: "pointer" }}
              onClick={(e) => {
                e.stopPropagation();
                handleDotClick(point.x, point.y, point.price, "market");
              }}
            />
            <circle
              cx={point.x}
              cy={point.y}
              r={2.5}
              fill="#9ca3af"
              stroke="white"
              strokeWidth={1}
              opacity={0.8}
              style={{ pointerEvents: "none" }}
            />
          </g>
        ))}

        {/* Matched line segments */}
        {matchedSegments.map((segment, i) => (
          <path key={`matched-${i}`} d={segment} fill="none" stroke={getMatchedLineColor(hasPurchased)} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
        ))}

        {/* Matched/Purchased dots - clickable with color coding */}
        {matchedDots.map((point, i) => {
          const isPurchased = point.status === "purchased";
          const isLast = i === matchedDots.length - 1;
          const dotColor = getMatchedDotColor(point.status, isLast);
          const dotRadius = isPurchased ? 4.5 : (isLast ? 4 : 3);

          return (
            <g key={`matched-dot-${i}`}>
              <circle
                cx={point.x}
                cy={point.y}
                r={8}
                fill="transparent"
                style={{ cursor: "pointer" }}
                onClick={(e) => {
                  e.stopPropagation();
                  handleDotClick(point.x, point.y, point.price, isPurchased ? "purchased" : "matched", point.insurer, point.features);
                }}
              />
              <circle
                cx={point.x}
                cy={point.y}
                r={dotRadius}
                fill={dotColor}
                stroke="white"
                strokeWidth={1.5}
                style={{ pointerEvents: "none" }}
              >
                {isLast && !isPurchased && (
                  <animate attributeName="r" values="4;6;4" dur="1.5s" repeatCount="indefinite" />
                )}
              </circle>
              {isPurchased && (
                <text x={point.x} y={point.y + 0.5} textAnchor="middle" fontSize="5" fill="white" fontWeight="700" style={{ pointerEvents: "none" }}>
                  &#10003;
                </text>
              )}
              <text x={point.x} y={point.y - 7} textAnchor="middle" fontSize="7" fill={dotColor} fontWeight="600" style={{ pointerEvents: "none" }}>
                £{Math.round(point.price)}
              </text>
            </g>
          );
        })}

        {/* X-axis month labels - split into month (top) and year (below) */}
        {priceHistory.map((p, i) => {
          const parts = p.month.split(" ");
          const monthAbbr = parts[0] || p.month;
          const yearAbbr = parts[1] || "";
          return (
            <g key={i}>
              <text
                x={getX(i)}
                y={height - 8}
                textAnchor="middle"
                fontSize="7"
                className="fill-gray-500"
              >
                {monthAbbr}
              </text>
              {yearAbbr && (
                <text
                  x={getX(i)}
                  y={height - 1}
                  textAnchor="middle"
                  fontSize="5.5"
                  className="fill-gray-400"
                >
                  {yearAbbr}
                </text>
              )}
            </g>
          );
        })}
      </svg>

      {/* Tooltip overlay */}
      {activeTooltip && (
        <div
          className="absolute z-50 pointer-events-none"
          style={{
            left: `${(activeTooltip.x / width) * 100}%`,
            top: `${(activeTooltip.y / height) * 100 - 5}%`,
            transform: "translate(-50%, -100%)",
          }}
        >
          <div
            className="bg-gray-900 text-white rounded-lg px-2.5 py-1.5 shadow-lg text-left pointer-events-auto"
            style={{ minWidth: "100px", maxWidth: "150px" }}
            onClick={() => setActiveTooltip(null)}
            data-testid="chart-tooltip"
          >
            <div className="flex items-center gap-1 mb-0.5">
              <div
                className="w-2 h-2 rounded-full shrink-0"
                style={{
                  backgroundColor:
                    activeTooltip.type === "purchased" ? "#16a34a" :
                    activeTooltip.type === "matched" ? "#3b82f6" : "#9ca3af",
                }}
              />
              <span className="text-[8px] font-semibold uppercase tracking-wide"
                style={{
                  color:
                    activeTooltip.type === "purchased" ? "#4ade80" :
                    activeTooltip.type === "matched" ? "#93c5fd" : "#d1d5db",
                }}
              >
                {activeTooltip.type === "purchased" ? "Switched" :
                 activeTooltip.type === "matched" ? "Matched" : "Market Avg"}
              </span>
            </div>
            {activeTooltip.insurer && (
              <p className="text-[9px] font-semibold text-white truncate">{activeTooltip.insurer}</p>
            )}
            <p className="text-[10px] font-bold text-white">£{Math.round(activeTooltip.price)}/yr</p>
            {activeTooltip.features && activeTooltip.features.length > 0 && (
              <div className="mt-0.5 border-t border-gray-700 pt-0.5">
                {activeTooltip.features.slice(0, 4).map((f, i) => (
                  <p key={i} className="text-[7px] text-gray-300 leading-tight truncate">
                    {f.replace(/_included$/, "").replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())}
                  </p>
                ))}
                {activeTooltip.features.length > 4 && (
                  <p className="text-[7px] text-gray-400">+{activeTooltip.features.length - 4} more</p>
                )}
              </div>
            )}
            <div className="absolute left-1/2 -translate-x-1/2 -bottom-1 w-2 h-2 bg-gray-900 rotate-45" />
          </div>
        </div>
      )}
    </div>
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
  priceHistory?: PriceDataPoint[];
  currentPolicyPrice?: number;
}

export function IPhoneMockup({ 
  showNotification = false, 
  notificationData,
  onNotificationTap,
  caption,
  searchDate,
  priceHistory = [],
  currentPolicyPrice = 0,
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
            <div className="absolute inset-0 flex flex-col items-center justify-start p-6 pt-16 overflow-y-auto">
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

              {/* Live Price Chart */}
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="mt-4 bg-white/90 backdrop-blur-sm rounded-xl px-3 py-3 border border-gray-200 shadow-md w-full"
                data-testid="iphone-price-chart"
              >
                <p className="text-[10px] text-gray-500 uppercase tracking-wider mb-1.5 text-center font-semibold">Market Price Trend</p>
                <LivePriceChart
                  priceHistory={priceHistory}
                  currentPolicyPrice={currentPolicyPrice}
                />
              </motion.div>
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
