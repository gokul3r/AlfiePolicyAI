import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Feature mapping for normalization
const FEATURE_MAPPING = {
  "legal_cover": "legal_cover_included",
  "windshield_cover": "windshield_cover_included",
  "windscreen_cover": "windshield_cover_included",
  "courtesy_car": "courtesy_car_included",
  "breakdown_cover": "breakdown_cover_included",
  "personal_accident_cover": "personal_accident_cover_included",
  "european_cover": "european_cover_included",
  "ncb_protection": "no_claim_bonus_protection_included",
  "no_claim_bonus_protection": "no_claim_bonus_protection_included",
};

export interface ParsedPreferences {
  budget: number | null;
  features: string[]; // Normalized feature names (e.g., "legal_cover_included")
  trustpilot_preference: number | null;
}

/**
 * Uses OpenAI to extract structured preferences from natural language whisper text
 * Handles spelling errors and semantic variations for 7 insurance features
 */
export async function parseWhisperPreferences(
  whisperText: string
): Promise<ParsedPreferences> {
  if (!whisperText || whisperText.trim() === "") {
    return {
      budget: null,
      features: [],
      trustpilot_preference: null,
    };
  }

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: `You are an AI assistant that extracts structured insurance preferences from natural language text.
Extract the following:
1. Budget: Any monetary amount mentioned (in GBP/£). Return as a number or null.
2. Features: Identify which insurance features are mentioned. Map them to these exact names:
   - "legal_cover" (legal cover, legal protection, legal assistance)
   - "windshield_cover" (windshield, windscreen, glass cover, windscreen cover)
   - "courtesy_car" (courtesy car, replacement car, hire car)
   - "breakdown_cover" (breakdown, breakdown cover, roadside assistance)
   - "personal_accident_cover" (personal accident, accident cover, injury cover)
   - "european_cover" (european cover, europe cover, EU cover, continental cover)
   - "ncb_protection" (NCB protection, no claims bonus protection, no claim protection, NCD protection)
3. Trustpilot preference: Any Trustpilot rating mentioned (0-5). Return as a number or null.

Handle spelling errors and semantic variations. Return JSON only.`,
        },
        {
          role: "user",
          content: `Extract budget, features, and trustpilot preference from this text:\n\n"${whisperText}"`,
        },
      ],
      response_format: { type: "json_object" },
      temperature: 0.3,
    });

    const result = JSON.parse(completion.choices[0].message.content || "{}");
    
    // Normalize features to match API expectations
    const extractedFeatures: string[] = Array.isArray(result.features) ? result.features : [];
    const normalizedFeatures: string[] = extractedFeatures
      .map((f: string) => {
        const normalized = f.toLowerCase().replace(/\s+/g, "_");
        return FEATURE_MAPPING[normalized as keyof typeof FEATURE_MAPPING] || null;
      })
      .filter((f: string | null): f is string => f !== null);

    // Remove duplicates
    const uniqueFeatures: string[] = Array.from(new Set(normalizedFeatures));

    return {
      budget: result.budget ? parseFloat(result.budget) : null,
      features: uniqueFeatures,
      trustpilot_preference: result.trustpilot_preference
        ? parseFloat(result.trustpilot_preference)
        : null,
    };
  } catch (error) {
    console.error("Error parsing whisper preferences with OpenAI:", error);
    
    // Fallback to simple regex extraction if OpenAI fails
    return fallbackParse(whisperText);
  }
}

/**
 * Fallback parser using regex when OpenAI is unavailable
 */
function fallbackParse(text: string): ParsedPreferences {
  const lowerText = text.toLowerCase();
  
  // Extract budget (first number)
  const budgetMatch = lowerText.match(/£?\s*(\d+(?:,\d{3})*(?:\.\d{2})?)/);
  const budget = budgetMatch ? parseFloat(budgetMatch[1].replace(/,/g, "")) : null;

  // Extract features by keyword matching
  const features: string[] = [];
  
  if (/legal|legul/.test(lowerText)) features.push("legal_cover_included");
  if (/windshield|windscreen|glass/.test(lowerText)) features.push("windshield_cover_included");
  if (/courtesy\s*car|replacement\s*car|hire\s*car/.test(lowerText)) features.push("courtesy_car_included");
  if (/breakdown|roadside/.test(lowerText)) features.push("breakdown_cover_included");
  if (/personal\s*accident|injury/.test(lowerText)) features.push("personal_accident_cover_included");
  if (/european|europe|eu|continental/.test(lowerText)) features.push("european_cover_included");
  if (/ncb|no\s*claim|ncd/.test(lowerText)) features.push("no_claim_bonus_protection_included");

  // Extract Trustpilot rating
  const trustpilotMatch = lowerText.match(/trustpilot[:\s]+(\d+(?:\.\d+)?)/);
  const trustpilot_preference = trustpilotMatch ? parseFloat(trustpilotMatch[1]) : null;

  return {
    budget,
    features: Array.from(new Set(features)),
    trustpilot_preference,
  };
}
