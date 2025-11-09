import type { Express } from "express";
import { createServer, type Server } from "http";
import WebSocket from "ws";
import { storage } from "./storage";
import { insertUserSchema, loginSchema, insertVehiclePolicySchema, insertChatMessageSchema } from "@shared/schema";
import { z } from "zod";
import multer from "multer";
import { sendChatMessage } from "./openai-realtime";
import { handleVoiceChat } from "./voice-chat-handler";

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
      res.json(policies);
    } catch (error) {
      console.error("Error fetching vehicle policies:", error);
      res.status(500).json({ error: "Failed to fetch vehicle policies" });
    }
  });

  // Get a specific vehicle policy
  app.get("/api/vehicle-policies/:email/:vehicleId", async (req, res) => {
    try {
      const email = req.params.email.toLowerCase().trim();
      const vehicleId = req.params.vehicleId;
      
      const policy = await storage.getVehiclePolicy(vehicleId, email);
      if (!policy) {
        return res.status(404).json({ error: "Vehicle policy not found" });
      }
      
      res.json(policy);
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
      const user = await storage.getUserByEmail(validatedData.email_id);
      console.log("[vehicle-policies] User lookup result:", user ? `Found: ${user.email_id}` : "Not found");
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }

      // Check if vehicle policy already exists
      const existingPolicy = await storage.getVehiclePolicy(validatedData.vehicle_id, validatedData.email_id);
      console.log("[vehicle-policies] Existing policy check:", existingPolicy ? "Found existing" : "No existing policy");
      if (existingPolicy) {
        return res.status(400).json({ error: "Vehicle policy already exists for this vehicle ID and email" });
      }

      console.log("[vehicle-policies] Attempting to create policy...");
      const policy = await storage.createVehiclePolicy(validatedData);
      console.log("[vehicle-policies] Policy created successfully:", JSON.stringify(policy));
      
      // Verify the policy was actually saved
      const verifyPolicy = await storage.getVehiclePolicy(policy.vehicle_id, policy.email_id);
      console.log("[vehicle-policies] Verification query result:", verifyPolicy ? "Policy found in DB" : "Policy NOT found in DB");
      
      res.status(201).json(policy);
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
  app.put("/api/vehicle-policies/:email/:vehicleId", async (req, res) => {
    try {
      const email = req.params.email.toLowerCase().trim();
      const vehicleId = req.params.vehicleId;
      
      // Check if the policy exists
      const existingPolicy = await storage.getVehiclePolicy(vehicleId, email);
      if (!existingPolicy) {
        return res.status(404).json({ error: "Vehicle policy not found" });
      }

      // Validate the update data (partial schema)
      const updateSchema = insertVehiclePolicySchema.partial().omit({ vehicle_id: true, email_id: true });
      const validatedUpdates = updateSchema.parse(req.body);
      
      const updatedPolicy = await storage.updateVehiclePolicy(vehicleId, email, validatedUpdates);
      res.json(updatedPolicy);
    } catch (error) {
      if (error instanceof z.ZodError) {
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

  const httpServer = createServer(app);

  // WebSocket server for voice chat
  const wss = new WebSocket.Server({ server: httpServer, path: "/api/voice-chat" });

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
