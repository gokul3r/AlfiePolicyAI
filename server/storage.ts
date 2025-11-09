import { db } from "./db";
import { users, vehiclePolicies, chatMessages, personalizations } from "@shared/schema";
import { type User, type InsertUser, type VehiclePolicy, type InsertVehiclePolicy, type ChatMessage, type InsertChatMessage, type Personalization } from "@shared/schema";
import { eq, and, desc } from "drizzle-orm";

export interface IStorage {
  getUserByEmail(email: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  getVehiclePoliciesByEmail(email: string): Promise<VehiclePolicy[]>;
  getVehiclePolicy(vehicleId: string, email: string): Promise<VehiclePolicy | undefined>;
  createVehiclePolicy(policy: InsertVehiclePolicy): Promise<VehiclePolicy>;
  updateVehiclePolicy(vehicleId: string, email: string, updates: Partial<InsertVehiclePolicy>): Promise<VehiclePolicy>;
  getChatHistory(email: string): Promise<ChatMessage[]>;
  saveChatMessage(message: InsertChatMessage): Promise<ChatMessage>;
  getPersonalization(email: string): Promise<Personalization | undefined>;
  saveGmailTokens(email: string, tokens: Partial<Personalization>): Promise<Personalization>;
  clearGmailTokens(email: string): Promise<void>;
}

export class DbStorage implements IStorage {
  async getUserByEmail(email: string): Promise<User | undefined> {
    const result = await db.select().from(users).where(eq(users.email_id, email));
    return result[0];
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const result = await db.insert(users).values(insertUser).returning();
    return result[0];
  }

  async getVehiclePoliciesByEmail(email: string): Promise<VehiclePolicy[]> {
    return await db.select().from(vehiclePolicies).where(eq(vehiclePolicies.email_id, email));
  }

  async getVehiclePolicy(vehicleId: string, email: string): Promise<VehiclePolicy | undefined> {
    const result = await db.select().from(vehiclePolicies).where(
      and(
        eq(vehiclePolicies.vehicle_id, vehicleId),
        eq(vehiclePolicies.email_id, email)
      )
    );
    return result[0];
  }

  async createVehiclePolicy(policy: InsertVehiclePolicy): Promise<VehiclePolicy> {
    const result = await db.insert(vehiclePolicies).values(policy).returning();
    return result[0];
  }

  async updateVehiclePolicy(vehicleId: string, email: string, updates: Partial<InsertVehiclePolicy>): Promise<VehiclePolicy> {
    const result = await db.update(vehiclePolicies)
      .set(updates)
      .where(
        and(
          eq(vehiclePolicies.vehicle_id, vehicleId),
          eq(vehiclePolicies.email_id, email)
        )
      )
      .returning();
    return result[0];
  }

  async getChatHistory(email: string): Promise<ChatMessage[]> {
    return await db.select()
      .from(chatMessages)
      .where(eq(chatMessages.email_id, email))
      .orderBy(chatMessages.created_at);
  }

  async saveChatMessage(message: InsertChatMessage): Promise<ChatMessage> {
    const result = await db.insert(chatMessages).values(message).returning();
    return result[0];
  }

  async getPersonalization(email: string): Promise<Personalization | undefined> {
    const result = await db.select().from(personalizations).where(eq(personalizations.email_id, email));
    return result[0];
  }

  async saveGmailTokens(email: string, tokens: Partial<Personalization>): Promise<Personalization> {
    // Try to insert first, if exists then update
    const existing = await this.getPersonalization(email);
    
    if (existing) {
      const result = await db.update(personalizations)
        .set({ ...tokens, updated_at: new Date() })
        .where(eq(personalizations.email_id, email))
        .returning();
      return result[0];
    } else {
      const result = await db.insert(personalizations)
        .values({ email_id: email, ...tokens })
        .returning();
      return result[0];
    }
  }

  async clearGmailTokens(email: string): Promise<void> {
    await db.update(personalizations)
      .set({
        gmail_id: null,
        gmail_access_token: null,
        gmail_refresh_token: null,
        gmail_token_expiry: null,
        email_enabled: false,
        updated_at: new Date(),
      })
      .where(eq(personalizations.email_id, email));
  }
}

export const storage = new DbStorage();
