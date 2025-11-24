import { db } from "./db";
import { 
  users, 
  policies, 
  vehiclePolicyDetails, 
  vehiclePolicies, 
  chatMessages, 
  personalizations, 
  notifications, 
  customRatings 
} from "@shared/schema";
import { 
  type User, 
  type InsertUser, 
  type Policy,
  type VehiclePolicyWithDetails,
  type InsertVehiclePolicy,
  type VehiclePolicy,
  type ChatMessage, 
  type InsertChatMessage, 
  type Personalization, 
  type Notification, 
  type InsertNotification, 
  type CustomRatings, 
  type InsertCustomRatings 
} from "@shared/schema";
import { eq, and, desc } from "drizzle-orm";

export interface IStorage {
  getUserByEmail(email: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  getVehiclePoliciesByEmail(email: string): Promise<VehiclePolicyWithDetails[]>;
  getVehiclePolicy(policyId: string, email: string): Promise<VehiclePolicyWithDetails | undefined>;
  createVehiclePolicy(policy: InsertVehiclePolicy): Promise<VehiclePolicyWithDetails>;
  updateVehiclePolicy(policyId: string, email: string, updates: InsertVehiclePolicy): Promise<VehiclePolicyWithDetails>;
  getChatHistory(email: string): Promise<ChatMessage[]>;
  saveChatMessage(message: InsertChatMessage): Promise<ChatMessage>;
  getPersonalization(email: string): Promise<Personalization | undefined>;
  saveGmailTokens(email: string, tokens: Partial<Personalization>): Promise<Personalization>;
  clearGmailTokens(email: string): Promise<void>;
  updateLastEmailScan(email: string): Promise<void>;
  getNotifications(email: string): Promise<Notification[]>;
  getActiveNotificationsByDestination(email: string, destination: string): Promise<Notification[]>;
  createNotification(notification: InsertNotification): Promise<Notification>;
  dismissNotification(id: number): Promise<void>;
  getCustomRatings(email: string): Promise<CustomRatings | undefined>;
  saveCustomRatings(email: string, ratings: Omit<InsertCustomRatings, 'email_id'>): Promise<CustomRatings>;
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

  async getVehiclePoliciesByEmail(email: string): Promise<VehiclePolicyWithDetails[]> {
    const result = await db
      .select()
      .from(policies)
      .leftJoin(vehiclePolicyDetails, eq(policies.policy_id, vehiclePolicyDetails.policy_id))
      .where(
        and(
          eq(policies.email_id, email),
          eq(policies.policy_type, 'car')
        )
      );
    
    return result.map(row => ({
      ...row.policies,
      details: row.vehicle_policy_details!
    }));
  }

  async getVehiclePolicy(policyId: string, email: string): Promise<VehiclePolicyWithDetails | undefined> {
    const result = await db
      .select()
      .from(policies)
      .leftJoin(vehiclePolicyDetails, eq(policies.policy_id, vehiclePolicyDetails.policy_id))
      .where(
        and(
          eq(policies.policy_id, policyId),
          eq(policies.email_id, email)
        )
      );
    
    if (result.length === 0 || !result[0].vehicle_policy_details) {
      return undefined;
    }
    
    return {
      ...result[0].policies,
      details: result[0].vehicle_policy_details
    };
  }

  async createVehiclePolicy(policyData: InsertVehiclePolicy): Promise<VehiclePolicyWithDetails> {
    const { policy, details } = policyData;
    
    const [createdPolicy] = await db.insert(policies).values(policy).returning();
    
    const [createdDetails] = await db.insert(vehiclePolicyDetails).values({
      policy_id: createdPolicy.policy_id,
      ...details
    }).returning();
    
    return {
      ...createdPolicy,
      details: createdDetails
    };
  }

  async updateVehiclePolicy(policyId: string, email: string, policyData: InsertVehiclePolicy): Promise<VehiclePolicyWithDetails> {
    const { policy, details } = policyData;
    
    // Update policy table
    await db.update(policies)
      .set({ ...policy, updated_at: new Date() })
      .where(
        and(
          eq(policies.policy_id, policyId),
          eq(policies.email_id, email)
        )
      );
    
    // Only update details if they are provided and not empty
    if (details && Object.keys(details).length > 0) {
      await db.update(vehiclePolicyDetails)
        .set(details)
        .where(eq(vehiclePolicyDetails.policy_id, policyId));
    }
    
    const updated = await this.getVehiclePolicy(policyId, email);
    if (!updated) {
      throw new Error("Policy not found after update");
    }
    return updated;
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

  async updateLastEmailScan(email: string): Promise<void> {
    await db.update(personalizations)
      .set({
        last_email_scan: new Date(),
        updated_at: new Date(),
      })
      .where(eq(personalizations.email_id, email));
  }

  async getNotifications(email: string): Promise<Notification[]> {
    return await db.select()
      .from(notifications)
      .where(eq(notifications.email_id, email))
      .orderBy(desc(notifications.created_at));
  }

  async getActiveNotificationsByDestination(email: string, destination: string): Promise<Notification[]> {
    return await db.select()
      .from(notifications)
      .where(
        and(
          eq(notifications.email_id, email),
          eq(notifications.destination, destination),
          eq(notifications.dismissed, false)
        )
      );
  }

  async createNotification(notification: InsertNotification): Promise<Notification> {
    const result = await db.insert(notifications).values(notification).returning();
    return result[0];
  }

  async dismissNotification(id: number): Promise<void> {
    await db.update(notifications)
      .set({ dismissed: true })
      .where(eq(notifications.id, id));
  }

  async getCustomRatings(email: string): Promise<CustomRatings | undefined> {
    const result = await db.select().from(customRatings).where(eq(customRatings.email_id, email));
    return result[0];
  }

  async saveCustomRatings(email: string, ratings: Omit<InsertCustomRatings, 'email_id'>): Promise<CustomRatings> {
    const existing = await this.getCustomRatings(email);
    
    if (existing) {
      const result = await db.update(customRatings)
        .set({ ...ratings, updated_at: new Date() })
        .where(eq(customRatings.email_id, email))
        .returning();
      return result[0];
    } else {
      const result = await db.insert(customRatings)
        .values({ email_id: email, ...ratings })
        .returning();
      return result[0];
    }
  }
}

export const storage = new DbStorage();
