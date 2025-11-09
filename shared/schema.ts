import { pgTable, text, integer, real, primaryKey } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  email_id: text("email_id").primaryKey(),
  user_name: text("user_name").notNull(),
});

export const insertUserSchema = createInsertSchema(users).extend({
  email_id: z.string().email("Invalid email address").toLowerCase().trim(),
  user_name: z.string().min(1, "Name is required").trim(),
});

export const loginSchema = z.object({
  email_id: z.string().email("Invalid email address").toLowerCase().trim(),
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type LoginRequest = z.infer<typeof loginSchema>;
export type User = typeof users.$inferSelect;

export const vehiclePolicies = pgTable("vehicle_policies", {
  vehicle_id: text("vehicle_id").notNull(),
  email_id: text("email_id").notNull().references(() => users.email_id),
  driver_age: integer("driver_age").notNull(),
  vehicle_registration_number: text("vehicle_registration_number").notNull(),
  vehicle_manufacturer_name: text("vehicle_manufacturer_name").notNull(),
  vehicle_model: text("vehicle_model").notNull(),
  vehicle_year: integer("vehicle_year").notNull(),
  type_of_fuel: text("type_of_fuel").notNull(),
  type_of_cover_needed: text("type_of_cover_needed").notNull(),
  no_claim_bonus_years: integer("no_claim_bonus_years").notNull(),
  voluntary_excess: real("voluntary_excess").notNull(),
  whisper_preferences: text("whisper_preferences"),
}, (table) => ({
  pk: primaryKey({ columns: [table.vehicle_id, table.email_id] })
}));

export const insertVehiclePolicySchema = createInsertSchema(vehiclePolicies).extend({
  vehicle_id: z.string().min(1, "Vehicle ID is required").trim(),
  email_id: z.string().email("Invalid email address").toLowerCase().trim(),
  driver_age: z.number().int().min(18, "Driver must be at least 18 years old").max(100),
  vehicle_registration_number: z.string().min(1, "Registration number is required").trim(),
  vehicle_manufacturer_name: z.string().min(1, "Manufacturer name is required").trim(),
  vehicle_model: z.string().min(1, "Vehicle model is required").trim(),
  vehicle_year: z.number().int().min(1900).max(new Date().getFullYear() + 1),
  type_of_fuel: z.string().min(1, "Fuel type is required").trim(),
  type_of_cover_needed: z.string().min(1, "Cover type is required").trim(),
  no_claim_bonus_years: z.number().int().min(0).max(20),
  voluntary_excess: z.number().min(0),
  whisper_preferences: z.string().optional(),
});

export type InsertVehiclePolicy = z.infer<typeof insertVehiclePolicySchema>;
export type VehiclePolicy = typeof vehiclePolicies.$inferSelect;

// Quote Search Types
export const trustPilotContextSchema = z.object({
  rating: z.number(),
  reviews_count: z.number(),
  pros: z.array(z.string()),
  cons: z.array(z.string()),
});

export const featuresMatchingSchema = z.object({
  matched_required: z.array(z.string()),
  missing_required: z.array(z.string()),
  justification: z.string(),
});

export const priceAnalysisSchema = z.object({
  quote_price: z.number(),
  budget: z.number(),
  difference: z.number(),
  within_budget: z.boolean(),
  competitiveness: z.string(),
  justification: z.string(),
});

export const scoreBreakdownSchema = z.object({
  trust_pilot_contribution: z.number(),
  defacto_rating_contribution: z.number(),
  features_match_percentage: z.number(),
  price_competitiveness: z.number(),
  calculation_note: z.string(),
});

export const originalQuoteSchema = z.object({
  input: z.any(),
  output: z.object({
    quote_reference_number: z.string(),
    insurer_name: z.string(),
    policy_cost: z.number(),
    type_of_policy: z.string(),
    total_excess_amount: z.number(),
    legal_cover_included: z.string(),
    windshield_cover_included: z.string(),
    courtesy_car_included: z.string(),
    breakdown_cover_included: z.string(),
    personal_Accident_cover_included: z.string(),
    european_cover_included: z.string(),
    no_claim_bonus_protection_included: z.string(),
  }),
});

export const quoteWithInsightsSchema = z.object({
  insurer_name: z.string(),
  original_quote: originalQuoteSchema,
  available_features: z.array(z.string()),
  features_matching_requirements: featuresMatchingSchema,
  price_analysis: priceAnalysisSchema,
  trust_pilot_context: trustPilotContextSchema,
  alfie_touch_score: z.number(),
  score_breakdown: scoreBreakdownSchema,
  alfie_message: z.string(),
  trade_offs: z.array(z.string()),
});

export const quotesApiResponseSchema = z.object({
  parsed_preferences: z.any(),
  quotes_with_insights: z.array(quoteWithInsightsSchema),
});

export type TrustPilotContext = z.infer<typeof trustPilotContextSchema>;
export type FeaturesMatching = z.infer<typeof featuresMatchingSchema>;
export type PriceAnalysis = z.infer<typeof priceAnalysisSchema>;
export type ScoreBreakdown = z.infer<typeof scoreBreakdownSchema>;
export type OriginalQuote = z.infer<typeof originalQuoteSchema>;
export type QuoteWithInsights = z.infer<typeof quoteWithInsightsSchema>;
export type QuotesApiResponse = z.infer<typeof quotesApiResponseSchema>;
