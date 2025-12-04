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
  pro_rated_new_price: number; // New quote price adjusted for remaining days
  upfront_impact: number; // Positive = receive back, Negative = pay extra
  annual_premium_delta: number; // Positive = saving, Negative = paying more
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
  cancellationFee: number = 20, // Default £20
  switchDate: Date = new Date()
): FinancialBreakdown {
  // Calculate total policy days (same as in refund calculation)
  const startDate = new Date(policyStartDate);
  const endDate = new Date(policyEndDate);
  const totalDays = Math.ceil(
    (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)
  );
  
  // Calculate pro-rata refund
  const { refund, daysRemaining } = calculateProRataRefund(
    currentPolicyCost,
    policyStartDate,
    policyEndDate,
    switchDate
  );
  
  // Pro-rate the new quote price for remaining days only
  // Uses the same totalDays base as the refund calculation for consistency
  const proRatedNewPrice = (newQuotePrice / totalDays) * daysRemaining;
  
  // Upfront impact = refund - cancellation_fee - pro_rated_new_price
  // Positive = receive money back
  // Negative = pay money upfront
  const upfront_impact = refund - cancellationFee - proRatedNewPrice;
  
  // Annual premium delta = current_cost - new_quote_price
  // Positive = saving
  // Negative = paying more
  const annual_premium_delta = currentPolicyCost - newQuotePrice;
  
  return {
    new_quote_price: Math.round(newQuotePrice * 100) / 100,
    new_quote_insurer: newQuoteInsurer,
    current_cost: Math.round(currentPolicyCost * 100) / 100,
    cancellation_fee: Math.round(cancellationFee * 100) / 100,
    pro_rata_refund: Math.round(refund * 100) / 100,
    days_remaining: daysRemaining,
    pro_rated_new_price: Math.round(proRatedNewPrice * 100) / 100,
    upfront_impact: Math.round(upfront_impact * 100) / 100,
    annual_premium_delta: Math.round(annual_premium_delta * 100) / 100,
  };
}
