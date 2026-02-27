import { pgTable, text, integer, real, primaryKey, serial, timestamp, boolean, jsonb } from "drizzle-orm/pg-core";
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

// Core policies table - supports all insurance types
export const policies = pgTable("policies", {
  policy_id: text("policy_id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  email_id: text("email_id").notNull().references(() => users.email_id),
  policy_type: text("policy_type").notNull(), // car, van, home, pet, travel, business
  policy_number: text("policy_number").notNull(),
  policy_start_date: text("policy_start_date").notNull(), // Stored as ISO date string
  policy_end_date: text("policy_end_date").notNull(), // Stored as ISO date string
  current_policy_cost: real("current_policy_cost").notNull(),
  current_insurance_provider: text("current_insurance_provider").notNull(),
  whisper_preferences: text("whisper_preferences"),
  status: text("status").notNull().default("active"), // active, expired, cancelled
  created_at: timestamp("created_at").notNull().defaultNow(),
  updated_at: timestamp("updated_at").notNull().defaultNow(),
});

// Vehicle-specific details (for car and van)
export const vehiclePolicyDetails = pgTable("vehicle_policy_details", {
  policy_id: text("policy_id").primaryKey().references(() => policies.policy_id, { onDelete: "cascade" }),
  policy_number: text("policy_number"), // Denormalized for easier querying (synced from policies table)
  driver_age: integer("driver_age").notNull(),
  vehicle_registration_number: text("vehicle_registration_number").notNull(),
  vehicle_manufacturer_name: text("vehicle_manufacturer_name").notNull(),
  vehicle_model: text("vehicle_model").notNull(),
  vehicle_year: integer("vehicle_year").notNull(),
  type_of_fuel: text("type_of_fuel").notNull(),
  type_of_cover_needed: text("type_of_cover_needed").notNull(),
  no_claim_bonus_years: integer("no_claim_bonus_years").notNull(),
  voluntary_excess: real("voluntary_excess").notNull(),
});

// Home-specific details
export const homePolicyDetails = pgTable("home_policy_details", {
  policy_id: text("policy_id").primaryKey().references(() => policies.policy_id, { onDelete: "cascade" }),
  property_address: text("property_address").notNull(),
  property_type: text("property_type").notNull(), // house, apartment, condo
  year_built: integer("year_built"),
  square_footage: integer("square_footage"),
});

// Pet-specific details
export const petPolicyDetails = pgTable("pet_policy_details", {
  policy_id: text("policy_id").primaryKey().references(() => policies.policy_id, { onDelete: "cascade" }),
  pet_name: text("pet_name").notNull(),
  pet_type: text("pet_type").notNull(), // dog, cat, etc.
  pet_breed: text("pet_breed"),
  pet_age: integer("pet_age"),
});

// Travel-specific details
export const travelPolicyDetails = pgTable("travel_policy_details", {
  policy_id: text("policy_id").primaryKey().references(() => policies.policy_id, { onDelete: "cascade" }),
  trip_destination: text("trip_destination").notNull(),
  trip_start_date: text("trip_start_date").notNull(),
  trip_end_date: text("trip_end_date").notNull(),
  number_of_travelers: integer("number_of_travelers").notNull(),
});

// Business-specific details
export const businessPolicyDetails = pgTable("business_policy_details", {
  policy_id: text("policy_id").primaryKey().references(() => policies.policy_id, { onDelete: "cascade" }),
  business_name: text("business_name").notNull(),
  business_type: text("business_type").notNull(),
  number_of_employees: integer("number_of_employees"),
  annual_revenue: real("annual_revenue"),
});

// Policy type enum for validation
const policyTypeEnum = z.enum(["car", "van", "home", "pet", "travel", "business"]);

// Base policy insert schema (without cross-field refinements, used for .partial() in update schema)
const basePolicySchema = createInsertSchema(policies).omit({
  policy_id: true,
  created_at: true,
  updated_at: true,
}).extend({
  email_id: z.string().email("Invalid email address").toLowerCase().trim(),
  policy_type: policyTypeEnum,
  policy_number: z.string().min(1, "Policy number is required").trim(),
  policy_start_date: z.string().min(1, "Policy start date is required"),
  policy_end_date: z.string().min(1, "Policy end date is required"),
  current_policy_cost: z.number().min(0, "Policy cost must be positive"),
  current_insurance_provider: z.string().min(1, "Insurance provider is required").trim(),
  whisper_preferences: z.string().nullish(),
  status: z.string().nullish(),
});

// Core policy insert schema with 365-day max duration validation
export const insertPolicySchema = basePolicySchema.refine((data) => {
  if (data.policy_start_date && data.policy_end_date) {
    const start = new Date(data.policy_start_date);
    const end = new Date(data.policy_end_date);
    const diffDays = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
    return diffDays > 0 && diffDays <= 365;
  }
  return true;
}, {
  message: "Policy duration must be between 1 and 365 days (annual policies only)",
  path: ["policy_end_date"],
});

// Vehicle policy details insert schema
export const insertVehiclePolicyDetailsSchema = createInsertSchema(vehiclePolicyDetails).omit({
  policy_id: true,
}).extend({
  driver_age: z.number().int().min(18, "Driver must be at least 18 years old").max(100),
  vehicle_registration_number: z.string().min(1, "Registration number is required").trim(),
  vehicle_manufacturer_name: z.string().min(1, "Manufacturer name is required").trim(),
  vehicle_model: z.string().min(1, "Vehicle model is required").trim(),
  vehicle_year: z.number().int().min(1900).max(new Date().getFullYear() + 1),
  type_of_fuel: z.enum(["Electric", "Hybrid", "Petrol", "Diesel"], {
    errorMap: () => ({ message: "Please select a valid fuel type" })
  }),
  type_of_cover_needed: z.string().min(1, "Cover type is required").trim(),
  no_claim_bonus_years: z.number().int().min(0).max(20),
  voluntary_excess: z.number().min(0),
});

// Combined schema for creating a vehicle policy (car/van)
export const insertVehiclePolicySchema = z.object({
  policy: insertPolicySchema,
  details: insertVehiclePolicyDetailsSchema,
});

// Update schema for vehicle policy (allows partial fields)
// Applies 365-day validation when both start and end dates are provided in the update
export const updateVehiclePolicySchema = z.object({
  policy: basePolicySchema.partial(),
  details: insertVehiclePolicyDetailsSchema.partial(),
}).refine((data) => {
  if (data.policy?.policy_start_date && data.policy?.policy_end_date) {
    const start = new Date(data.policy.policy_start_date);
    const end = new Date(data.policy.policy_end_date);
    const diffDays = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
    return diffDays > 0 && diffDays <= 365;
  }
  return true;
}, {
  message: "Policy duration must be between 1 and 365 days (annual policies only)",
  path: ["policy", "policy_end_date"],
});

export type InsertPolicy = z.infer<typeof insertPolicySchema>;
export type Policy = typeof policies.$inferSelect;
export type InsertVehiclePolicyDetails = z.infer<typeof insertVehiclePolicyDetailsSchema>;
export type VehiclePolicyDetails = typeof vehiclePolicyDetails.$inferSelect;
export type InsertVehiclePolicy = z.infer<typeof insertVehiclePolicySchema>;
export type UpdateVehiclePolicy = z.infer<typeof updateVehiclePolicySchema>;

// Combined type for fetching vehicle policy with details
export type VehiclePolicyWithDetails = Policy & {
  details: VehiclePolicyDetails;
};

// Legacy support - keep old table for migration
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

export const chatMessages = pgTable("chat_messages", {
  id: serial("id").primaryKey(),
  email_id: text("email_id").notNull().references(() => users.email_id),
  role: text("role").notNull(),
  content: text("content").notNull(),
  created_at: timestamp("created_at").notNull().defaultNow(),
});

export const insertChatMessageSchema = createInsertSchema(chatMessages).omit({
  id: true,
  created_at: true,
}).extend({
  email_id: z.string().email("Invalid email address").toLowerCase().trim(),
  role: z.enum(["user", "assistant"], {
    errorMap: () => ({ message: "Role must be either 'user' or 'assistant'" })
  }),
  content: z.string().min(1, "Message content is required").trim(),
});

export type InsertChatMessage = z.infer<typeof insertChatMessageSchema>;
export type ChatMessage = typeof chatMessages.$inferSelect;

export const personalizations = pgTable("personalizations", {
  email_id: text("email_id").primaryKey().references(() => users.email_id),
  gmail_id: text("gmail_id"),
  gmail_access_token: text("gmail_access_token"),
  gmail_refresh_token: text("gmail_refresh_token"),
  gmail_token_expiry: timestamp("gmail_token_expiry"),
  email_enabled: boolean("email_enabled").notNull().default(false),
  calendar_enabled: boolean("calendar_enabled").notNull().default(false),
  last_email_scan: timestamp("last_email_scan"),
  created_at: timestamp("created_at").notNull().defaultNow(),
  updated_at: timestamp("updated_at").notNull().defaultNow(),
});

export const insertPersonalizationSchema = createInsertSchema(personalizations).omit({
  created_at: true,
  updated_at: true,
}).extend({
  email_id: z.string().email("Invalid email address").toLowerCase().trim(),
});

export type InsertPersonalization = z.infer<typeof insertPersonalizationSchema>;
export type Personalization = typeof personalizations.$inferSelect;

export const notifications = pgTable("notifications", {
  id: serial("id").primaryKey(),
  email_id: text("email_id").notNull().references(() => users.email_id),
  message: text("message").notNull(),
  destination: text("destination"),
  email_subject: text("email_subject"),
  email_date: timestamp("email_date"),
  departure_date: text("departure_date"),
  dismissed: boolean("dismissed").notNull().default(false),
  created_at: timestamp("created_at").notNull().defaultNow(),
});

export const insertNotificationSchema = createInsertSchema(notifications).omit({
  id: true,
  created_at: true,
}).extend({
  email_id: z.string().email("Invalid email address").toLowerCase().trim(),
  message: z.string().min(1, "Notification message is required").trim(),
  destination: z.string().optional(),
  email_subject: z.string().optional(),
  email_date: z.date().optional(),
  departure_date: z.string().optional(),
  dismissed: z.boolean().optional(),
});

export type InsertNotification = z.infer<typeof insertNotificationSchema>;
export type Notification = typeof notifications.$inferSelect;

// Custom Ratings Schema - using JSONB for flexible storage
export const customRatings = pgTable("custom_ratings", {
  email_id: text("email_id").primaryKey().references(() => users.email_id),
  trustpilot_data: jsonb("trustpilot_data").notNull(),
  defacto_ratings: jsonb("defacto_ratings").notNull(),
  use_custom_ratings: boolean("use_custom_ratings").notNull().default(false),
  created_at: timestamp("created_at").notNull().defaultNow(),
  updated_at: timestamp("updated_at").notNull().defaultNow(),
});

// Trustpilot data structure for each provider
const trustPilotProviderSchema = z.object({
  rating: z.number().min(0).max(5.0),
  reviews_count: z.number().int().min(0),
  pros: z.array(z.string()),
  cons: z.array(z.string()),
});

// Full trustpilot data structure (all providers)
export const trustPilotDataSchema = z.object({
  Admiral: trustPilotProviderSchema,
  PAXA: trustPilotProviderSchema,
  Baviva: trustPilotProviderSchema,
  IndirectLane: trustPilotProviderSchema,
  Churchwell: trustPilotProviderSchema,
  Ventura: trustPilotProviderSchema,
  Zorich: trustPilotProviderSchema,
  HestingsDrive: trustPilotProviderSchema,
  Assureon: trustPilotProviderSchema,
  Soga: trustPilotProviderSchema,
});

// Defacto ratings structure (provider name -> rating)
export const defactoRatingsSchema = z.object({
  Admiral: z.number().min(0).max(5.0),
  PAXA: z.number().min(0).max(5.0),
  Baviva: z.number().min(0).max(5.0),
  IndirectLane: z.number().min(0).max(5.0),
  Churchwell: z.number().min(0).max(5.0),
  Ventura: z.number().min(0).max(5.0),
  Zorich: z.number().min(0).max(5.0),
  HestingsDrive: z.number().min(0).max(5.0),
  Assureon: z.number().min(0).max(5.0),
  Soga: z.number().min(0).max(5.0),
});

export const insertCustomRatingsSchema = createInsertSchema(customRatings).omit({
  created_at: true,
  updated_at: true,
}).extend({
  email_id: z.string().email("Invalid email address").toLowerCase().trim(),
  trustpilot_data: trustPilotDataSchema,
  defacto_ratings: defactoRatingsSchema,
  use_custom_ratings: z.boolean(),
});

export type TrustPilotData = z.infer<typeof trustPilotDataSchema>;
export type DefactoRatings = z.infer<typeof defactoRatingsSchema>;
export type InsertCustomRatings = z.infer<typeof insertCustomRatingsSchema>;
export type CustomRatings = typeof customRatings.$inferSelect;

// Quote History table - tracks matched/rejected quotes from Time Lapse
export const quoteHistory = pgTable("quote_history", {
  quote_id: text("quote_id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  email_id: text("email_id").notNull().references(() => users.email_id),
  insurance_provider_name: text("insurance_provider_name").notNull(),
  vehicle_number: text("vehicle_number").notNull(),
  date_of_quote: timestamp("date_of_quote").notNull().defaultNow(),
  price_of_quote: real("price_of_quote").notNull(),
  features: text("features").array().notNull(),
  status: text("status").notNull().default("matched"), // matched, rejected
  created_at: timestamp("created_at").notNull().defaultNow(),
});

export const insertQuoteHistorySchema = createInsertSchema(quoteHistory).omit({
  quote_id: true,
  created_at: true,
}).extend({
  email_id: z.string().email("Invalid email address").toLowerCase().trim(),
  insurance_provider_name: z.string().min(1, "Provider name is required").trim(),
  vehicle_number: z.string().min(1, "Vehicle number is required").trim(),
  date_of_quote: z.date().optional(),
  price_of_quote: z.number().min(0, "Price must be positive"),
  features: z.array(z.string()),
  status: z.enum(["matched", "rejected"]).default("matched"),
});

export type InsertQuoteHistory = z.infer<typeof insertQuoteHistorySchema>;
export type QuoteHistory = typeof quoteHistory.$inferSelect;

export const negotiations = pgTable("negotiations", {
  id: serial("id").primaryKey(),
  provider_name: text("provider_name").notNull(),
  customer_name: text("customer_name").notNull(),
  policy_number: text("policy_number").notNull(),
  current_renewal_cost: real("current_renewal_cost").notNull(),
  original_policy_cost: real("original_policy_cost"),
  competitor_name: text("competitor_name").notNull(),
  competitor_quote: real("competitor_quote").notNull(),
  status: text("status").notNull().default("pending"),
  agent_offer_price: real("agent_offer_price"),
  decision_type: text("decision_type"),
  customer_outcome: text("customer_outcome"),
  created_at: timestamp("created_at").notNull().defaultNow(),
  responded_at: timestamp("responded_at"),
});

export const insertNegotiationSchema = createInsertSchema(negotiations).omit({
  id: true,
  created_at: true,
  responded_at: true,
}).extend({
  provider_name: z.string().min(1, "Provider name is required").trim(),
  customer_name: z.string().min(1, "Customer name is required").trim(),
  policy_number: z.string().min(1, "Policy number is required").trim(),
  current_renewal_cost: z.number().min(0, "Cost must be positive"),
  original_policy_cost: z.number().min(0).nullable().optional(),
  competitor_name: z.string().min(1, "Competitor name is required").trim(),
  competitor_quote: z.number().min(0, "Quote must be positive"),
  status: z.string().optional(),
  agent_offer_price: z.number().nullable().optional(),
  decision_type: z.string().nullable().optional(),
  customer_outcome: z.string().nullable().optional(),
});

export const negotiationResponseSchema = z.object({
  decision: z.enum(["match", "partial", "unable"]),
  offer_price: z.number().min(0, "Price must be positive"),
});

export type InsertNegotiation = z.infer<typeof insertNegotiationSchema>;
export type Negotiation = typeof negotiations.$inferSelect;
export type NegotiationResponse = z.infer<typeof negotiationResponseSchema>;

export const liveNegotiations = pgTable("live_negotiations", {
  id: serial("id").primaryKey(),
  provider_name: text("provider_name").notNull(),
  customer_name: text("customer_name").notNull(),
  customer_email: text("customer_email").notNull(),
  policy_number: text("policy_number").notNull(),
  current_premium: real("current_premium").notNull(),
  competitor_name: text("competitor_name").notNull(),
  competitor_quote: real("competitor_quote").notNull(),
  tolerance_amount: real("tolerance_amount").notNull(),
  vehicle_make: text("vehicle_make").notNull(),
  vehicle_model: text("vehicle_model").notNull(),
  vehicle_year: integer("vehicle_year").notNull(),
  no_claim_bonus_years: integer("no_claim_bonus_years").notNull(),
  voluntary_excess: real("voluntary_excess").notNull(),
  policy_start_date: text("policy_start_date"),
  policy_end_date: text("policy_end_date"),
  socket_room_id: text("socket_room_id").notNull(),
  mode: text("mode").notNull().default("text"),
  status: text("status").notNull().default("pending"),
  outcome: text("outcome"),
  final_offer_price: real("final_offer_price"),
  created_at: timestamp("created_at").notNull().defaultNow(),
});

export const insertLiveNegotiationSchema = createInsertSchema(liveNegotiations).omit({
  id: true,
  created_at: true,
}).extend({
  provider_name: z.string().min(1).trim(),
  customer_name: z.string().min(1).trim(),
  customer_email: z.string().email().toLowerCase().trim(),
  policy_number: z.string().min(1).trim(),
  current_premium: z.number().min(0),
  competitor_name: z.string().min(1).trim(),
  competitor_quote: z.number().min(0),
  tolerance_amount: z.number().min(0),
  vehicle_make: z.string().min(1).trim(),
  vehicle_model: z.string().min(1).trim(),
  vehicle_year: z.number().int().min(1900),
  no_claim_bonus_years: z.number().int().min(0),
  voluntary_excess: z.number().min(0),
  socket_room_id: z.string().min(1),
  mode: z.enum(["text", "voice"]).optional(),
  status: z.string().optional(),
  outcome: z.string().nullable().optional(),
  final_offer_price: z.number().nullable().optional(),
});

export type InsertLiveNegotiation = z.infer<typeof insertLiveNegotiationSchema>;
export type LiveNegotiation = typeof liveNegotiations.$inferSelect;

export const liveNegotiationMessages = pgTable("live_negotiation_messages", {
  id: serial("id").primaryKey(),
  negotiation_id: integer("negotiation_id").notNull().references(() => liveNegotiations.id),
  sender: text("sender").notNull(),
  message: text("message").notNull(),
  created_at: timestamp("created_at").notNull().defaultNow(),
});

export const insertLiveNegotiationMessageSchema = createInsertSchema(liveNegotiationMessages).omit({
  id: true,
  created_at: true,
}).extend({
  negotiation_id: z.number().int(),
  sender: z.enum(["autoannie", "agent"]),
  message: z.string().min(1).trim(),
});

export type InsertLiveNegotiationMessage = z.infer<typeof insertLiveNegotiationMessageSchema>;
export type LiveNegotiationMessage = typeof liveNegotiationMessages.$inferSelect;
