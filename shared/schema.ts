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
