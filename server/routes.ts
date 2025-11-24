import type { Express } from "express";
import { createServer, type Server } from "http";
import { WebSocketServer } from "ws";
import { storage } from "./storage";
import { 
  insertUserSchema, 
  loginSchema, 
  insertVehiclePolicySchema,
  updateVehiclePolicySchema,
  insertChatMessageSchema, 
  VehiclePolicyWithDetails 
} from "@shared/schema";
import { z } from "zod";
import multer from "multer";
import { sendChatMessage } from "./openai-realtime";
import { handleVoiceChat } from "./voice-chat-handler";
import { handleGmailAuthorize, handleGmailCallback, handleGmailDisconnect, handleGmailStatus } from "./gmail-oauth";
import { scanGmailForTravelEmails } from "./gmail-scanner";

// Helper function to flatten policy response for frontend compatibility
function flattenPolicyResponse(policy: VehiclePolicyWithDetails): any {
  return {
    // Use policy_id as vehicle_id for backwards compatibility
    vehicle_id: policy.policy_id,
    policy_id: policy.policy_id,
    email_id: policy.email_id,
    policy_type: policy.policy_type,
    policy_number: policy.policy_number,
    policy_start_date: policy.policy_start_date,
    policy_end_date: policy.policy_end_date,
    current_policy_cost: policy.current_policy_cost,
    current_insurance_provider: policy.current_insurance_provider,
    whisper_preferences: policy.whisper_preferences,
    status: policy.status,
    created_at: policy.created_at,
    updated_at: policy.updated_at,
    // Spread detail fields at the top level
    ...policy.details
  };
}

export async function registerRoutes(app: Express): Promise<Server> {
  // Configure multer for file uploads (store in memory)
  const upload = multer({ 
    storage: multer.memoryStorage(),
    limits: {
      fileSize: 6 * 1024 * 1024, // 6MB limit
    },
    fileFilter: (req, file, cb) => {
      if (file.mimetype === "application/pdf") {
        cb(null, true);
      } else {
        cb(new Error("Only PDF files are allowed"));
      }
    }
  });

  // PDF extraction proxy endpoint with Multer error handling
  app.post("/api/extract-pdf", (req, res, next) => {
    upload.single("file")(req, res, (err) => {
      // Handle Multer-specific errors
      if (err instanceof multer.MulterError) {
        if (err.code === "LIMIT_FILE_SIZE") {
          return res.status(400).json({ 
            error: "File too large", 
            message: "Maximum file size is 6MB" 
          });
        }
        return res.status(400).json({ 
          error: "File upload error", 
          message: err.message 
        });
      } else if (err) {
        // Handle custom fileFilter errors
        return res.status(400).json({ 
          error: "Invalid file type", 
          message: "Only PDF files are allowed" 
        });
      }
      
      // No errors, proceed to the route handler
      next();
    });
  }, async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: "No file uploaded" });
      }

      // Create FormData to send to the external API
      const formData = new FormData();
      const blob = new Blob([req.file.buffer], { type: "application/pdf" });
      formData.append("file", blob, req.file.originalname);

      // Forward request to Google Cloud Run API
      const response = await fetch(
        "https://insurance-pdf-extractor-657860957693.europe-west2.run.app/extract",
        {
          method: "POST",
          body: formData,
        }
      );

      if (!response.ok) {
        const errorText = await response.text().catch(() => "Unknown error");
        throw new Error(`External API error: ${response.status} - ${errorText}`);
      }

      const data = await response.json();
      res.json(data);
    } catch (error: any) {
      console.error("Error extracting PDF:", error);
      res.status(500).json({ 
        error: "Failed to extract PDF", 
        message: error.message 
      });
    }
  });

  // Quote search proxy endpoint
  app.post("/api/search-quotes", async (req, res) => {
    try {
      // Forward request to Google Cloud Run Quote Search API
      const response = await fetch(
        "https://alfie-agent-657860957693.europe-west4.run.app/complete-analysis",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(req.body),
        }
      );

      if (!response.ok) {
        const errorText = await response.text().catch(() => "Unknown error");
        throw new Error(`External API error: ${response.status} - ${errorText}`);
      }

      const data = await response.json();
      res.json(data);
    } catch (error: any) {
      console.error("Error searching quotes:", error);
      res.status(500).json({ 
        error: "Failed to search quotes", 
        message: error.message 
      });
    }
  });

  // Create new user
  app.post("/api/users", async (req, res) => {
    try {
      const validatedData = insertUserSchema.parse(req.body);
      
      // Check if email already exists
      const existingUser = await storage.getUserByEmail(validatedData.email_id);
      if (existingUser) {
        return res.status(400).json({ error: "Email already registered" });
      }

      const user = await storage.createUser(validatedData);
      res.status(201).json(user);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid user data", details: error.errors });
      }
      console.error("Error creating user:", error);
      res.status(500).json({ error: "Failed to create user" });
    }
  });

  // Login existing user
  app.post("/api/users/login", async (req, res) => {
    try {
      const validatedData = loginSchema.parse(req.body);
      
      const user = await storage.getUserByEmail(validatedData.email_id);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }

      res.json(user);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid email address", details: error.errors });
      }
      console.error("Error logging in:", error);
      res.status(500).json({ error: "Failed to login" });
    }
  });

  // Get all vehicle policies for a user
  app.get("/api/vehicle-policies/:email", async (req, res) => {
    try {
      const email = req.params.email.toLowerCase().trim();
      const policies = await storage.getVehiclePoliciesByEmail(email);
      // Flatten policies for frontend compatibility
      const flattenedPolicies = policies.map(flattenPolicyResponse);
      res.json(flattenedPolicies);
    } catch (error) {
      console.error("Error fetching vehicle policies:", error);
      res.status(500).json({ error: "Failed to fetch vehicle policies" });
    }
  });

  // Get a specific vehicle policy
  app.get("/api/vehicle-policies/:email/:policyId", async (req, res) => {
    try {
      const email = req.params.email.toLowerCase().trim();
      const policyId = req.params.policyId;
      
      const policy = await storage.getVehiclePolicy(policyId, email);
      if (!policy) {
        return res.status(404).json({ error: "Vehicle policy not found" });
      }
      
      // Flatten policy for frontend compatibility
      res.json(flattenPolicyResponse(policy));
    } catch (error) {
      console.error("Error fetching vehicle policy:", error);
      res.status(500).json({ error: "Failed to fetch vehicle policy" });
    }
  });

  // Create a new vehicle policy
  app.post("/api/vehicle-policies", async (req, res) => {
    try {
      console.log("[vehicle-policies] Received request body:", JSON.stringify(req.body));
      const validatedData = insertVehiclePolicySchema.parse(req.body);
      console.log("[vehicle-policies] Validated data:", JSON.stringify(validatedData));
      
      // Check if user exists
      const user = await storage.getUserByEmail(validatedData.policy.email_id);
      console.log("[vehicle-policies] User lookup result:", user ? `Found: ${user.email_id}` : "Not found");
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }

      console.log("[vehicle-policies] Attempting to create policy...");
      const policy = await storage.createVehiclePolicy(validatedData);
      console.log("[vehicle-policies] Policy created successfully:", JSON.stringify(policy));
      
      // Flatten policy for frontend compatibility
      res.status(201).json(flattenPolicyResponse(policy));
    } catch (error) {
      if (error instanceof z.ZodError) {
        console.log("[vehicle-policies] Validation error:", JSON.stringify(error.errors));
        return res.status(400).json({ error: "Invalid vehicle policy data", details: error.errors });
      }
      console.error("[vehicle-policies] Unexpected error:", error);
      res.status(500).json({ error: "Failed to create vehicle policy" });
    }
  });

  // Update an existing vehicle policy
  app.put("/api/vehicle-policies/:email/:policyId", async (req, res) => {
    try {
      const email = req.params.email.toLowerCase().trim();
      const policyId = req.params.policyId;
      
      // Check if the policy exists
      const existingPolicy = await storage.getVehiclePolicy(policyId, email);
      if (!existingPolicy) {
        return res.status(404).json({ error: "Vehicle policy not found" });
      }

      // Validate the update data using the proper update schema
      const validatedData = updateVehiclePolicySchema.parse(req.body);
      
      const updatedPolicy = await storage.updateVehiclePolicy(policyId, email, validatedData);
      // Flatten policy for frontend compatibility
      res.json(flattenPolicyResponse(updatedPolicy));
    } catch (error) {
      if (error instanceof z.ZodError) {
        console.error("Validation error during policy update:", JSON.stringify(error.errors));
        return res.status(400).json({ error: "Invalid update data", details: error.errors });
      }
      console.error("Error updating vehicle policy:", error);
      res.status(500).json({ error: "Failed to update vehicle policy" });
    }
  });

  // Get chat history for a user
  app.get("/api/chat/messages/:email", async (req, res) => {
    try {
      const email = req.params.email.toLowerCase().trim();
      const messages = await storage.getChatHistory(email);
      res.json(messages);
    } catch (error) {
      console.error("Error fetching chat history:", error);
      res.status(500).json({ error: "Failed to fetch chat history" });
    }
  });

  // Save a new chat message
  app.post("/api/chat/messages", async (req, res) => {
    try {
      const validatedData = insertChatMessageSchema.parse(req.body);
      const message = await storage.saveChatMessage(validatedData);
      res.status(201).json(message);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid message data", details: error.errors });
      }
      console.error("Error saving chat message:", error);
      res.status(500).json({ error: "Failed to save chat message" });
    }
  });

  // Send message to AI and get response
  app.post("/api/chat/send-message", async (req, res) => {
    try {
      const { email_id, message } = req.body;
      
      // Validate inputs
      if (!email_id || typeof email_id !== "string") {
        return res.status(400).json({ error: "email_id is required" });
      }
      if (!message || typeof message !== "string") {
        return res.status(400).json({ error: "message is required" });
      }

      const email = email_id.toLowerCase().trim();
      const userMessage = message.trim();

      // Verify user exists
      const user = await storage.getUserByEmail(email);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }

      console.log(`[Chat] Processing message from ${email}: "${userMessage}"`);

      // Save user message to database
      const savedUserMessage = await storage.saveChatMessage({
        email_id: email,
        role: "user",
        content: userMessage,
      });

      // Get AI response using Chat Completions API with vector store
      const VECTOR_STORE_ID = "vs_6901fa16a5c081918d2ad17626cc303f";
      
      let aiResponse: string;
      try {
        aiResponse = await sendChatMessage(userMessage, {
          vectorStoreId: VECTOR_STORE_ID,
          userEmail: email,
        });
        console.log(`[Chat] AI response: "${aiResponse}"`);
      } catch (aiError: any) {
        console.error("[Chat] AI error:", aiError);
        // Fallback to friendly error message
        aiResponse = "I'm having trouble connecting right now. Please try again in a moment.";
      }

      // Save assistant response to database
      const savedAssistantMessage = await storage.saveChatMessage({
        email_id: email,
        role: "assistant",
        content: aiResponse,
      });

      // Return both messages
      res.json({
        userMessage: savedUserMessage,
        assistantMessage: savedAssistantMessage,
      });
    } catch (error) {
      console.error("Error in send-message endpoint:", error);
      res.status(500).json({ 
        error: "Failed to process message",
        message: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  // Gmail OAuth routes for personalization
  app.get("/api/personalization/gmail/authorize", handleGmailAuthorize);
  app.get("/api/personalization/gmail/callback", handleGmailCallback);
  app.post("/api/personalization/gmail/disconnect", handleGmailDisconnect);
  app.get("/api/personalization/gmail/status", handleGmailStatus);

  // Gmail scanning for travel notifications
  app.post("/api/gmail/scan", async (req, res) => {
    try {
      const { email_id } = req.body;
      
      if (!email_id || typeof email_id !== "string") {
        return res.status(400).json({ error: "email_id is required" });
      }
      
      const email = email_id.toLowerCase().trim();
      
      // Verify user exists
      const user = await storage.getUserByEmail(email);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }
      
      console.log(`[Gmail Scanner] Starting scan for ${email}`);
      const notificationsCreated = await scanGmailForTravelEmails(email);
      console.log(`[Gmail Scanner] Created ${notificationsCreated} new notifications for ${email}`);
      
      res.json({ 
        success: true, 
        notificationsCreated,
        message: `Scan complete. Found ${notificationsCreated} new travel notification(s).`
      });
    } catch (error: any) {
      console.error("[Gmail Scanner] Error:", error);
      res.status(500).json({ 
        error: "Failed to scan Gmail", 
        message: error.message 
      });
    }
  });

  // Get all notifications for a user
  app.get("/api/notifications/:email", async (req, res) => {
    try {
      const email = req.params.email.toLowerCase().trim();
      const notifications = await storage.getNotifications(email);
      res.json(notifications);
    } catch (error) {
      console.error("Error fetching notifications:", error);
      res.status(500).json({ error: "Failed to fetch notifications" });
    }
  });

  // Dismiss a notification
  app.post("/api/notifications/:id/dismiss", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      
      if (isNaN(id)) {
        return res.status(400).json({ error: "Invalid notification ID" });
      }
      
      await storage.dismissNotification(id);
      res.json({ success: true, message: "Notification dismissed" });
    } catch (error) {
      console.error("Error dismissing notification:", error);
      res.status(500).json({ error: "Failed to dismiss notification" });
    }
  });

  // Get custom ratings for a user
  app.get("/api/custom-ratings/:email", async (req, res) => {
    try {
      const email = req.params.email.toLowerCase().trim();
      const ratings = await storage.getCustomRatings(email);
      
      if (!ratings) {
        return res.status(404).json({ error: "Custom ratings not found for this user" });
      }
      
      res.json(ratings);
    } catch (error) {
      console.error("Error fetching custom ratings:", error);
      res.status(500).json({ error: "Failed to fetch custom ratings" });
    }
  });

  // Save custom ratings for a user
  app.post("/api/custom-ratings", async (req, res) => {
    try {
      const { insertCustomRatingsSchema } = await import("@shared/schema");
      
      // Validate request body
      const validated = insertCustomRatingsSchema.parse(req.body);
      
      const { email_id, ...ratingsData } = validated;
      const result = await storage.saveCustomRatings(email_id, ratingsData);
      
      res.json(result);
    } catch (error: any) {
      console.error("Error saving custom ratings:", error);
      
      if (error.name === "ZodError") {
        return res.status(400).json({ 
          error: "Validation failed", 
          details: error.errors 
        });
      }
      
      res.status(500).json({ error: "Failed to save custom ratings" });
    }
  });

  const httpServer = createServer(app);

  // WebSocket server for voice chat
  const wss = new WebSocketServer({ server: httpServer, path: "/api/voice-chat" });

  wss.on("connection", (ws, req) => {
    // Extract email from query params
    const url = new URL(req.url || "", `http://${req.headers.host}`);
    const emailId = url.searchParams.get("email");

    if (!emailId) {
      console.error("[WebSocket] No email provided");
      ws.close(1008, "Email required");
      return;
    }

    console.log(`[WebSocket] New voice chat connection: ${emailId}`);
    handleVoiceChat(ws, emailId);
  });

  return httpServer;
}
