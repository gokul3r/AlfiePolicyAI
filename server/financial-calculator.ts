/**
 * Financial calculation utilities for insurance policy switching
 */

export interface FinancialBreakdown {
  new_quote_price: number;
  new_quote_insurer: string;
  current_cost: number;
  cancellation_fee: number;
  pro_rata_refund: number;
  days_remaining: number;
  new_policy_cost: number; // Full 12-month new policy cost (UK policies are always annual)
  upfront_impact: number; // Positive = receive back, Negative = pay extra
  annual_premium_delta: number; // Legacy: simple premium difference (kept for backwards compat)
  stay_cost_12m: number; // Total cost over next 12 months if staying (remaining coverage value + renewal)
  switch_cost_12m: number; // Total cost over next 12 months if switching (new policy + cancellation fee)
  annual_savings: number; // stay_cost_12m - switch_cost_12m (positive = saving by switching)
  stay_remaining_value: number; // Value of remaining coverage on current policy
  stay_renewal_cost: number; // Cost of renewal portion to fill 12 months
  stay_renewal_days: number; // Number of days the renewal covers (365 - daysRemaining)
}

/**
 * Calculate pro-rata refund based on remaining policy days
 */
export function calculateProRataRefund(
  currentPolicyCost: number,
  policyStartDate: string,
  policyEndDate: string,
  switchDate: Date = new Date()
): { refund: number; daysRemaining: number } {
  const startDate = new Date(policyStartDate);
  const endDate = new Date(policyEndDate);
  
  // Calculate total policy days
  const totalDays = Math.ceil(
    (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)
  );
  
  // Calculate remaining days from switch date
  const daysRemaining = Math.ceil(
    (endDate.getTime() - switchDate.getTime()) / (1000 * 60 * 60 * 24)
  );
  
  // Calculate refund (proportional to remaining days)
  const dailyRate = currentPolicyCost / totalDays;
  const refund = Math.round(dailyRate * daysRemaining * 100) / 100;
  
  return {
    refund: Math.max(0, refund), // Never negative
    daysRemaining: Math.max(0, daysRemaining),
  };
}

/**
 * Calculate complete financial breakdown for policy switch
 */
export function calculateFinancialBreakdown(
  newQuotePrice: number,
  newQuoteInsurer: string,
  currentPolicyCost: number,
  policyStartDate: string,
  policyEndDate: string,
  cancellationFee: number = 55, // Default £55
  switchDate: Date = new Date()
): FinancialBreakdown {
  // Calculate total policy days (same as in refund calculation)
  const startDate = new Date(policyStartDate);
  const endDate = new Date(policyEndDate);
  const rawTotalDays = Math.ceil(
    (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)
  );
  // Clamp to 365 days max so non-standard policy durations (e.g. 13 months)
  // don't produce an artificially low daily rate that skews all calculations
  const totalDays = Math.min(rawTotalDays, 365);
  
  // Calculate pro-rata refund
  const { refund, daysRemaining } = calculateProRataRefund(
    currentPolicyCost,
    policyStartDate,
    policyEndDate,
    switchDate
  );
  
  // UK insurance: New policies are always 12 months (full annual premium)
  // You pay the full annual price for the new policy, not pro-rated
  const newPolicyCost = newQuotePrice;
  
  // Upfront impact = refund - cancellation_fee - new_policy_cost (full 12 months)
  // Positive = receive money back
  // Negative = pay money upfront
  const upfront_impact = refund - cancellationFee - newPolicyCost;
  
  // Annual premium delta = current_cost - new_quote_price - cancellation_fee (legacy, kept for backwards compat)
  const annual_premium_delta = currentPolicyCost - newQuotePrice - cancellationFee;
  
  // Expert calculation: Total Cost Over Next 12 Months From Switch Date
  // Both scenarios must cover exactly 365 days for a fair comparison
  const dailyRate = totalDays > 0 ? currentPolicyCost / totalDays : 0;
  const stayRemainingValue = Math.round(dailyRate * daysRemaining * 100) / 100;
  // Renewal only covers the gap: 365 - daysRemaining days (not a full year)
  const renewalDays = Math.max(0, 365 - daysRemaining);
  const stayRenewalCost = Math.round(dailyRate * renewalDays * 100) / 100;
  const stayCost12m = stayRemainingValue + stayRenewalCost;
  
  // If switching: new policy (full 12 months) + cancellation fee
  // Note: pro-rata refund is NOT subtracted here because this represents total insurance cost,
  // not cash flow. The refund is accounted in the upfront_impact section.
  const switchCost12m = newQuotePrice + cancellationFee;
  
  // Annual savings = stay cost - switch cost (positive = saving by switching)
  const annualSavings = stayCost12m - switchCost12m;
  
  return {
    new_quote_price: Math.round(newQuotePrice * 100) / 100,
    new_quote_insurer: newQuoteInsurer,
    current_cost: Math.round(currentPolicyCost * 100) / 100,
    cancellation_fee: Math.round(cancellationFee * 100) / 100,
    pro_rata_refund: Math.round(refund * 100) / 100,
    days_remaining: daysRemaining,
    new_policy_cost: Math.round(newPolicyCost * 100) / 100,
    upfront_impact: Math.round(upfront_impact * 100) / 100,
    annual_premium_delta: Math.round(annual_premium_delta * 100) / 100,
    stay_cost_12m: Math.round(stayCost12m * 100) / 100,
    switch_cost_12m: Math.round(switchCost12m * 100) / 100,
    annual_savings: Math.round(annualSavings * 100) / 100,
    stay_remaining_value: stayRemainingValue,
    stay_renewal_cost: Math.round(stayRenewalCost * 100) / 100,
    stay_renewal_days: renewalDays,
  };
}
