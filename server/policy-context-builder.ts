import type { VehiclePolicy, VehiclePolicyWithDetails } from "@shared/schema";

const ADMIRAL_POLICY_CONTEXT = `Motor Policy Schedule
This policy schedule provides important details about your policy. It must be read along with Your Car Insurance Guide, which
is available online at www.admiral.com.
Please check this document carefully and if anything is incorrect, call us. If everything is correct, please keep in your file for fu-
ture reference.
Your Details:
Name: Gokul Ramasubramanian Address: 4 Alfred Underwood Way
Great Oldbury STONEHOUSE
Gloucestershire
GL10 3FJ Contact number: 07871007962 Policy number: P71172080
Issue date: 15/08/2025
Issued by: Admiral
Reason for issue: Policy Update
Email address: gokul3.r@gmail.com
Vehicle Details:
Immobiliser/Alarm: Engine Immobiliser
Engine size: 0
Year made: 2021
Kept overnight: Driveway
Registration number: LB71UUV Annual mileage (est): 7500 Postcode where kept: GL10 3FJ Manufacturer: TESLA Model: MODEL 3 STANDARD
RANGE PLUS
Modifications: None
(Anything which changes the maker's standard specification or alters its performance, including cosmetic changes such as alloy wheels, body kits, or any non-
standard parts. If you have any queries, please call us.)
Description of your Admiral Insurance Cover:
Vehicle Type: Electric Vehicle Period of cover From: 13:01 on 15/08/2025
Type of cover: Comprehensive Years No Claims Bonus: 4 Bonus Protection: None Our maximum NCB is 5 years.
Please see Your Car Insurance Guide
for details of how your bonus will be
affected if you make a claim.
Drivers: Gokul Ramasubramanian
To: 00:00 on 20/12/2025
Type of use: Social, Domestic, Pleasure
and Commuting
Endorsements that apply: See Extra Conditions
Premium Details: (Payment Method: Debit Card)
Policy Upgrades (All prices include Insurance Premium Tax)
Windscreen Cover Included
Motor Legal Protection £24.95
Registered in England and Wales as EUI Limited Reg. No. 02686904 Registered Address: Ty Admi-
ral, David Street, Cardiff, CF10 2EH. Authorised and regulated by the Financial Conduct Authority (309378)
Excess Details:
An excess is the amount you must pay in the event of any claim, regardless of who is to blame for an incident.
(i) If you have a claim and have Comprehensive cover, the following excesses apply:
(remember you must add the relevant Compulsory and Voluntary Excesses together to calculate the total amount you must
pay in the event of any claim made).
Age of Driver in Charge at Time of Accident: Amount of Excess:
Compulsory Voluntary Total
Less than 21 years £750 + £0 = £750
Age 21-24 £650 + £0 = £650
Over 25 with full UK licence for at least 1 year £500 + £0 = £500
Over 25 with a provisional UK licence or full UK licence held
for less than 1 year
£650 + £0 = £650
(ii) If you have windscreen cover and need to claim for windscreen damage, the following excess
£115 for replacement
applies:
(iii) If you make a claim for Fire and/or Theft, the following excess applies: or
£25 for repair
£500
The Compulsory Excess stated above may change if you change your vehicle and/or ask to protect/guarantee your No Claims
Bonus on your motor insurance policy. Please remember any Voluntary Excess you agreed at the start of the period of insur-
ance forms part of the total excess that must be paid in the event of any claim made.
Extra Conditions (Endorsements) - if applicable:
Please read Extra Conditions (Endorsements) in Your Car Insurance Guide at www.admiral.com
Telematics books: Plug & Drive
Includes cover to drive other cars on a third party basis only`;

/**
 * Builds a combined context string for gpt-realtime-mini sessions
 * Combines user's database policy details + Admiral policy document text
 * Supports both VehiclePolicy (flat) and VehiclePolicyWithDetails (nested) formats
 */
export function buildPolicyContext(userEmail: string, policies: (VehiclePolicy | VehiclePolicyWithDetails)[]): string {
  // Build database policy summary
  let dbPolicySummary = "";
  if (policies.length > 0) {
    dbPolicySummary = "\n\nUser's Vehicle Policies from Database:\n";
    policies.forEach((policy, index) => {
      // Handle both flat VehiclePolicy and nested VehiclePolicyWithDetails
      const details = 'details' in policy ? policy.details : policy;
      // Whisper preferences only exists on the top-level policy object in nested format, or on flat VehiclePolicy
      const whisperPrefs = 'whisper_preferences' in policy ? (policy as any).whisper_preferences : null;
      
      if (details) {
        dbPolicySummary += `\nVehicle ${index + 1}:
- Registration: ${details.vehicle_registration_number}
- Manufacturer: ${details.vehicle_manufacturer_name}
- Model: ${details.vehicle_model}
- Year: ${details.vehicle_year}
- Fuel Type: ${details.type_of_fuel}
- Cover Type: ${details.type_of_cover_needed}
- Driver Age: ${details.driver_age}
- No Claims Bonus: ${details.no_claim_bonus_years} years
- Voluntary Excess: £${details.voluntary_excess}`;
        
        if (whisperPrefs) {
          dbPolicySummary += `\n- User Preferences: ${whisperPrefs}`;
        }
      }
    });
  }

  // Combine Admiral document + database policies
  return `${ADMIRAL_POLICY_CONTEXT}${dbPolicySummary}`;
}
