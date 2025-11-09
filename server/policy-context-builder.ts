import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import type { VehiclePolicy } from "@shared/schema";

// ESM equivalent of __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Builds a combined context string for gpt-realtime-mini sessions
 * Combines user's database policy details + Admiral policy document text
 */
export function buildPolicyContext(userEmail: string, policies: VehiclePolicy[]): string {
  // Load Admiral policy document
  const admiralPolicyPath = join(__dirname, "admiral-policy-context.txt");
  const admiralPolicyText = readFileSync(admiralPolicyPath, "utf-8");

  // Build database policy summary
  let dbPolicySummary = "";
  if (policies.length > 0) {
    dbPolicySummary = "\n\nUser's Vehicle Policies from Database:\n";
    policies.forEach((policy, index) => {
      dbPolicySummary += `\nVehicle ${index + 1}:
- Registration: ${policy.vehicle_registration_number}
- Manufacturer: ${policy.vehicle_manufacturer_name}
- Model: ${policy.vehicle_model}
- Year: ${policy.vehicle_year}
- Fuel Type: ${policy.type_of_fuel}
- Cover Type: ${policy.type_of_cover_needed}
- Driver Age: ${policy.driver_age}
- No Claims Bonus: ${policy.no_claim_bonus_years} years
- Voluntary Excess: £${policy.voluntary_excess}`;
      
      if (policy.whisper_preferences) {
        dbPolicySummary += `\n- User Preferences: ${policy.whisper_preferences}`;
      }
    });
  }

  // Combine Admiral document + database policies
  return `${admiralPolicyText}${dbPolicySummary}`;
}
