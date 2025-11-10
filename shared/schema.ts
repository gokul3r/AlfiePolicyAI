import { pgTable, text, integer, real, primaryKey, serial, timestamp, boolean } from "drizzle-orm/pg-core";
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
  type_of_fuel: z.enum(["Electric", "Hybrid", "Petrol", "Diesel"], {
    errorMap: () => ({ message: "Please select a valid fuel type" })
  }),
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
