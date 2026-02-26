import { db } from "./db";
import { 
  users, 
  policies, 
  vehiclePolicyDetails, 
  vehiclePolicies, 
  chatMessages, 
  personalizations, 
  notifications, 
  customRatings,
  quoteHistory,
  negotiations,
  liveNegotiations,
  liveNegotiationMessages
} from "@shared/schema";
import { 
  type User, 
  type InsertUser, 
  type Policy,
  type VehiclePolicyWithDetails,
  type InsertVehiclePolicy,
  type UpdateVehiclePolicy,
  type VehiclePolicy,
  type ChatMessage, 
  type InsertChatMessage, 
  type Personalization, 
  type Notification, 
  type InsertNotification, 
  type CustomRatings, 
  type InsertCustomRatings,
  type QuoteHistory,
  type InsertQuoteHistory,
  type Negotiation,
  type InsertNegotiation,
  type LiveNegotiation,
  type InsertLiveNegotiation,
  type LiveNegotiationMessage,
  type InsertLiveNegotiationMessage
} from "@shared/schema";
import { eq, and, desc, ilike, or, inArray } from "drizzle-orm";

export interface PurchasePolicyData {
  email_id: string;
  vehicle_registration_number: string;
  insurer_name: string;
  policy_cost: number;
}

export interface IStorage {
  getUserByEmail(email: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  getVehiclePoliciesByEmail(email: string): Promise<VehiclePolicyWithDetails[]>;
  getVehiclePolicy(policyId: string, email: string): Promise<VehiclePolicyWithDetails | undefined>;
  createVehiclePolicy(policy: InsertVehiclePolicy): Promise<VehiclePolicyWithDetails>;
  updateVehiclePolicy(policyId: string, email: string, updates: UpdateVehiclePolicy): Promise<VehiclePolicyWithDetails>;
  deletePolicy(policyId: string, email: string): Promise<string>;
  purchasePolicy(data: PurchasePolicyData): Promise<VehiclePolicyWithDetails>;
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
  // Quote History methods
  createQuoteHistory(data: Omit<InsertQuoteHistory, 'date_of_quote'> & { date_of_quote?: Date }): Promise<QuoteHistory>;
  getQuoteHistoryByEmail(email: string): Promise<QuoteHistory[]>;
  getQuoteHistoryByStatus(email: string, status: 'matched' | 'rejected'): Promise<QuoteHistory[]>;
  updateQuoteHistoryStatus(quoteId: string, status: 'matched' | 'rejected'): Promise<QuoteHistory>;
  deleteQuoteHistoryByEmail(email: string): Promise<number>;
  createNegotiation(data: InsertNegotiation): Promise<Negotiation>;
  getNegotiationsByProvider(providerName: string): Promise<Negotiation[]>;
  getPendingNegotiationCountByProvider(providerName: string): Promise<number>;
  respondToNegotiation(id: number, decision: string, offerPrice: number): Promise<Negotiation>;
  getNegotiationById(id: number): Promise<Negotiation | undefined>;
  createLiveNegotiation(data: InsertLiveNegotiation): Promise<LiveNegotiation>;
  getLiveNegotiationById(id: number): Promise<LiveNegotiation | undefined>;
  getLiveNegotiationByRoom(roomId: string): Promise<LiveNegotiation | undefined>;
  getActiveLiveNegotiationsByProvider(providerName: string): Promise<LiveNegotiation[]>;
  updateLiveNegotiationStatus(id: number, status: string, outcome?: string, finalOfferPrice?: number): Promise<LiveNegotiation>;
  createLiveNegotiationMessage(data: InsertLiveNegotiationMessage): Promise<LiveNegotiationMessage>;
  getLiveNegotiationMessages(negotiationId: number): Promise<LiveNegotiationMessage[]>;
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
    
    // Check for existing policy with same email and registration number
    const existingPolicies = await db
      .select()
      .from(policies)
      .leftJoin(vehiclePolicyDetails, eq(policies.policy_id, vehiclePolicyDetails.policy_id))
      .where(
        and(
          eq(policies.email_id, policy.email_id),
          eq(policies.policy_type, 'car'),
          eq(vehiclePolicyDetails.vehicle_registration_number, details.vehicle_registration_number)
        )
      );
    
    if (existingPolicies.length > 0) {
      throw new Error(`DUPLICATE_POLICY: A policy for vehicle ${details.vehicle_registration_number} already exists. Please edit the existing policy instead.`);
    }
    
    const [createdPolicy] = await db.insert(policies).values(policy).returning();
    
    const [createdDetails] = await db.insert(vehiclePolicyDetails).values({
      policy_id: createdPolicy.policy_id,
      policy_number: createdPolicy.policy_number, // Sync policy_number to details table
      ...details
    }).returning();
    
    return {
      ...createdPolicy,
      details: createdDetails
    };
  }

  async updateVehiclePolicy(policyId: string, email: string, policyData: UpdateVehiclePolicy): Promise<VehiclePolicyWithDetails> {
    const { policy, details } = policyData;
    
    // Filter out undefined values from policy to prevent accidental nullification
    const policyUpdates = Object.fromEntries(
      Object.entries(policy).filter(([_, value]) => value !== undefined)
    );
    
    // Only update policy table if there are valid fields to update
    if (Object.keys(policyUpdates).length > 0) {
      await db.update(policies)
        .set({ ...policyUpdates, updated_at: new Date() })
        .where(
          and(
            eq(policies.policy_id, policyId),
            eq(policies.email_id, email)
          )
        );
    }
    
    // Filter out undefined values from details and only update if provided
    if (details) {
      const detailUpdates = Object.fromEntries(
        Object.entries(details).filter(([_, value]) => value !== undefined)
      );
      
      // Also sync policy_number if it was updated in the policy
      if (policy.policy_number) {
        detailUpdates.policy_number = policy.policy_number;
      }
      
      if (Object.keys(detailUpdates).length > 0) {
        await db.update(vehiclePolicyDetails)
          .set(detailUpdates)
          .where(eq(vehiclePolicyDetails.policy_id, policyId));
      }
    }
    
    const updated = await this.getVehiclePolicy(policyId, email);
    if (!updated) {
      throw new Error("Policy not found after update");
    }
    return updated;
  }

  async deletePolicy(policyId: string, email: string): Promise<string> {
    // Get the policy first to retrieve policy_number before deletion
    const policy = await db
      .select()
      .from(policies)
      .where(
        and(
          eq(policies.policy_id, policyId),
          eq(policies.email_id, email)
        )
      );
    
    if (policy.length === 0) {
      throw new Error("Policy not found");
    }
    
    const policyNumber = policy[0].policy_number;
    
    // Hard delete the policy (cascade will handle detail tables)
    await db.delete(policies)
      .where(
        and(
          eq(policies.policy_id, policyId),
          eq(policies.email_id, email)
        )
      );
    
    return policyNumber;
  }

  async purchasePolicy(data: PurchasePolicyData): Promise<VehiclePolicyWithDetails> {
    const { email_id, vehicle_registration_number, insurer_name, policy_cost } = data;
    
    // Generate new policy number: P + 10 random digits
    const policyNumber = 'P' + Math.floor(Math.random() * 10000000000).toString().padStart(10, '0');
    
    // Calculate dates: start = today, end = today + 1 year
    const today = new Date();
    const oneYearFromNow = new Date(today);
    oneYearFromNow.setFullYear(oneYearFromNow.getFullYear() + 1);
    
    const policyStartDate = today.toISOString().split('T')[0];
    const policyEndDate = oneYearFromNow.toISOString().split('T')[0];
    
    // Check if policy exists for this vehicle registration
    const existingPolicies = await db
      .select()
      .from(policies)
      .leftJoin(vehiclePolicyDetails, eq(policies.policy_id, vehiclePolicyDetails.policy_id))
      .where(
        and(
          eq(policies.email_id, email_id),
          eq(vehiclePolicyDetails.vehicle_registration_number, vehicle_registration_number)
        )
      );
    
    if (existingPolicies.length > 0 && existingPolicies[0].policies) {
      // Update existing policy
      const existingPolicy = existingPolicies[0].policies;
      
      await db.update(policies)
        .set({
          policy_number: policyNumber,
          policy_start_date: policyStartDate,
          policy_end_date: policyEndDate,
          current_insurance_provider: insurer_name,
          current_policy_cost: policy_cost,
          status: 'active',
          updated_at: new Date(),
        })
        .where(eq(policies.policy_id, existingPolicy.policy_id));
      
      // Also update policy_number in vehicle_policy_details
      await db.update(vehiclePolicyDetails)
        .set({ policy_number: policyNumber })
        .where(eq(vehiclePolicyDetails.policy_id, existingPolicy.policy_id));
      
      const updated = await this.getVehiclePolicy(existingPolicy.policy_id, email_id);
      if (!updated) {
        throw new Error("Policy not found after purchase update");
      }
      return updated;
    } else {
      throw new Error("No existing policy found for this vehicle. Please add the vehicle first.");
    }
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

  // Quote History methods
  async createQuoteHistory(data: Omit<InsertQuoteHistory, 'date_of_quote'> & { date_of_quote?: Date }): Promise<QuoteHistory> {
    const result = await db.insert(quoteHistory).values({
      ...data,
      date_of_quote: data.date_of_quote || new Date(),
    }).returning();
    return result[0];
  }

  async getQuoteHistoryByEmail(email: string): Promise<QuoteHistory[]> {
    return await db.select()
      .from(quoteHistory)
      .where(eq(quoteHistory.email_id, email))
      .orderBy(desc(quoteHistory.date_of_quote));
  }

  async getQuoteHistoryByStatus(email: string, status: 'matched' | 'rejected'): Promise<QuoteHistory[]> {
    return await db.select()
      .from(quoteHistory)
      .where(
        and(
          eq(quoteHistory.email_id, email),
          eq(quoteHistory.status, status)
        )
      )
      .orderBy(desc(quoteHistory.date_of_quote));
  }

  async updateQuoteHistoryStatus(quoteId: string, status: 'matched' | 'rejected'): Promise<QuoteHistory> {
    const result = await db.update(quoteHistory)
      .set({ status })
      .where(eq(quoteHistory.quote_id, quoteId))
      .returning();
    return result[0];
  }

  async deleteQuoteHistoryByEmail(email: string): Promise<number> {
    const result = await db.delete(quoteHistory)
      .where(eq(quoteHistory.email_id, email))
      .returning();
    return result.length;
  }

  async createNegotiation(data: InsertNegotiation): Promise<Negotiation> {
    const result = await db.insert(negotiations).values(data).returning();
    return result[0];
  }

  async getNegotiationsByProvider(providerName: string): Promise<Negotiation[]> {
    return await db.select()
      .from(negotiations)
      .where(ilike(negotiations.provider_name, providerName))
      .orderBy(desc(negotiations.created_at));
  }

  async getPendingNegotiationCountByProvider(providerName: string): Promise<number> {
    const result = await db.select()
      .from(negotiations)
      .where(
        and(
          ilike(negotiations.provider_name, providerName),
          eq(negotiations.status, "pending")
        )
      );
    return result.length;
  }

  async respondToNegotiation(id: number, decision: string, offerPrice: number): Promise<Negotiation> {
    const statusMap: Record<string, string> = {
      match: "matched",
      partial: "partial",
      unable: "rejected",
    };
    const result = await db.update(negotiations)
      .set({
        status: statusMap[decision] || decision,
        decision_type: decision,
        agent_offer_price: offerPrice,
        responded_at: new Date(),
      })
      .where(eq(negotiations.id, id))
      .returning();
    return result[0];
  }

  async getNegotiationById(id: number): Promise<Negotiation | undefined> {
    const result = await db.select()
      .from(negotiations)
      .where(eq(negotiations.id, id));
    return result[0];
  }

  async updateNegotiationOutcome(id: number, outcome: string): Promise<Negotiation> {
    const result = await db.update(negotiations)
      .set({ customer_outcome: outcome })
      .where(eq(negotiations.id, id))
      .returning();
    return result[0];
  }

  async createLiveNegotiation(data: InsertLiveNegotiation): Promise<LiveNegotiation> {
    const result = await db.insert(liveNegotiations).values(data).returning();
    return result[0];
  }

  async getLiveNegotiationById(id: number): Promise<LiveNegotiation | undefined> {
    const result = await db.select().from(liveNegotiations).where(eq(liveNegotiations.id, id));
    return result[0];
  }

  async getLiveNegotiationByRoom(roomId: string): Promise<LiveNegotiation | undefined> {
    const result = await db.select().from(liveNegotiations).where(eq(liveNegotiations.socket_room_id, roomId));
    return result[0];
  }

  async getActiveLiveNegotiationsByProvider(providerName: string): Promise<LiveNegotiation[]> {
    return await db.select()
      .from(liveNegotiations)
      .where(
        and(
          ilike(liveNegotiations.provider_name, `%${providerName}%`),
          inArray(liveNegotiations.status, ["pending", "active", "awaiting_customer"])
        )
      )
      .orderBy(desc(liveNegotiations.created_at));
  }

  async updateLiveNegotiationStatus(id: number, status: string, outcome?: string, finalOfferPrice?: number): Promise<LiveNegotiation> {
    const updates: Record<string, any> = { status };
    if (outcome !== undefined) updates.outcome = outcome;
    if (finalOfferPrice !== undefined) updates.final_offer_price = finalOfferPrice;
    const result = await db.update(liveNegotiations)
      .set(updates)
      .where(eq(liveNegotiations.id, id))
      .returning();
    return result[0];
  }

  async createLiveNegotiationMessage(data: InsertLiveNegotiationMessage): Promise<LiveNegotiationMessage> {
    const result = await db.insert(liveNegotiationMessages).values(data).returning();
    return result[0];
  }

  async getLiveNegotiationMessages(negotiationId: number): Promise<LiveNegotiationMessage[]> {
    return await db.select()
      .from(liveNegotiationMessages)
      .where(eq(liveNegotiationMessages.negotiation_id, negotiationId))
      .orderBy(liveNegotiationMessages.created_at);
  }
}

export const storage = new DbStorage();
