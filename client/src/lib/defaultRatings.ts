import { type TrustPilotData, type DefactoRatings } from "@shared/schema";

// Default Trustpilot data from cloud run app
export const DEFAULT_TRUSTPILOT_DATA: TrustPilotData = {
  Admiral: {
    rating: 4.7,
    reviews_count: 150000,
    pros: [
      "Outstanding customer service improvements",
      "New mobile app features excellent",
      "Claims processed within 24 hours"
    ],
    cons: [
      "Premium increases at renewal",
      "Phone wait times during peak"
    ]
  },
  PAXA: {
    rating: 4.6,
    reviews_count: 32000,
    pros: [
      "Most competitive pricing",
      "User dashboard completely redesigned"
    ],
    cons: [
      "Claims process can take 3-5 days"
    ]
  },
  Baviva: {
    rating: 4.4,
    reviews_count: 55000,
    pros: ["Website improvements", "Better customer support"],
    cons: ["Some renewal pricing issues"]
  },
  IndirectLane: {
    rating: 4.2,
    reviews_count: 28000,
    pros: ["Competitive pricing maintained"],
    cons: ["Phone wait times still long"]
  },
  Churchwell: {
    rating: 4.5,
    reviews_count: 29000,
    pros: ["Excellent claims handling"],
    cons: ["Premium increases reported"]
  },
  Ventura: {
    rating: 4.6,
    reviews_count: 85000,
    pros: ["Fast claims settlements improved"],
    cons: ["Courtesy car still costs extra"]
  },
  Zorich: {
    rating: 3.9,
    reviews_count: 4500,
    pros: ["Some service improvements"],
    cons: ["Claims handling still problematic"]
  },
  HestingsDrive: {
    rating: 4.5,
    reviews_count: 180000,
    pros: ["Best telematics app in market"],
    cons: ["Black box accuracy issues"]
  },
  Assureon: {
    rating: 4.4,
    reviews_count: 70000,
    pros: ["UK call centers improved"],
    cons: ["High cancellation fees remain"]
  },
  Soga: {
    rating: 4.2,
    reviews_count: 45000,
    pros: ["Better for over 50s market"],
    cons: ["Wait times still an issue"]
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
