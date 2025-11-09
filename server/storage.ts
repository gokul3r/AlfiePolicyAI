import { db } from "./db";
import { users, vehiclePolicies, chatMessages } from "@shared/schema";
import { type User, type InsertUser, type VehiclePolicy, type InsertVehiclePolicy, type ChatMessage, type InsertChatMessage } from "@shared/schema";
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
}

export const storage = new DbStorage();
