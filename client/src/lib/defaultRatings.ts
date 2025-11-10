import { type TrustPilotData, type DefactoRatings } from "@shared/schema";

// Default Trustpilot data from cloud run app
export const DEFAULT_TRUSTPILOT_DATA: TrustPilotData = {
  Admiral: {
    rating: 4.7,
    reviews_count: 150000,
    pros: [
      "FRESH 2025: Outstanding customer service improvements",
      "FRESH 2025: New mobile app features excellent",
      "FRESH 2025: Claims processed within 24 hours"
    ],
    cons: [
      "FRESH 2025: Premium increases at renewal",
      "FRESH 2025: Phone wait times during peak"
    ]
  },
  PAXA: {
    rating: 4.6,
    reviews_count: 32000,
    pros: [
      "FRESH 2025: Most competitive pricing",
      "FRESH 2025: User dashboard completely redesigned"
    ],
    cons: [
      "FRESH 2025: Claims process can take 3-5 days"
    ]
  },
  Baviva: {
    rating: 4.4,
    reviews_count: 55000,
    pros: ["FRESH 2025: Website improvements", "FRESH 2025: Better customer support"],
    cons: ["FRESH 2025: Some renewal pricing issues"]
  },
  IndirectLane: {
    rating: 4.2,
    reviews_count: 28000,
    pros: ["FRESH 2025: Competitive pricing maintained"],
    cons: ["FRESH 2025: Phone wait times still long"]
  },
  Churchwell: {
    rating: 4.5,
    reviews_count: 29000,
    pros: ["FRESH 2025: Excellent claims handling"],
    cons: ["FRESH 2025: Premium increases reported"]
  },
  Ventura: {
    rating: 4.6,
    reviews_count: 85000,
    pros: ["FRESH 2025: Fast claims settlements improved"],
    cons: ["FRESH 2025: Courtesy car still costs extra"]
  },
  Zorich: {
    rating: 3.9,
    reviews_count: 4500,
    pros: ["FRESH 2025: Some service improvements"],
    cons: ["FRESH 2025: Claims handling still problematic"]
  },
  HestingsDrive: {
    rating: 4.5,
    reviews_count: 180000,
    pros: ["FRESH 2025: Best telematics app in market"],
    cons: ["FRESH 2025: Black box accuracy issues"]
  },
  Assureon: {
    rating: 4.4,
    reviews_count: 70000,
    pros: ["FRESH 2025: UK call centers improved"],
    cons: ["FRESH 2025: High cancellation fees remain"]
  },
  Soga: {
    rating: 4.2,
    reviews_count: 45000,
    pros: ["FRESH 2025: Better for over 50s market"],
    cons: ["FRESH 2025: Wait times still an issue"]
  }
};

// Default Defacto ratings from cloud run app
export const DEFAULT_DEFACTO_RATINGS: DefactoRatings = {
  Admiral: 4.6,
  PAXA: 4.5,
  Baviva: 4.3,
  IndirectLane: 3.9,
  Churchwell: 4.2,
  Ventura: 3.8,
  Zorich: 4.0,
  HestingsDrive: 4.4,
  Assureon: 3.9,
  Soga: 3.7
};

// Provider names for iteration
export const PROVIDER_NAMES = [
  "Admiral",
  "PAXA",
  "Baviva",
  "IndirectLane",
  "Churchwell",
  "Ventura",
  "Zorich",
  "HestingsDrive",
  "Assureon",
  "Soga"
] as const;
