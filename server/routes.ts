import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertUserSchema, loginSchema, insertVehiclePolicySchema } from "@shared/schema";
import { z } from "zod";

export async function registerRoutes(app: Express): Promise<Server> {
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
      const validatedData = insertVehiclePolicySchema.parse(req.body);
      
      // Check if user exists
      const user = await storage.getUserByEmail(validatedData.email_id);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }

      // Check if vehicle policy already exists
      const existingPolicy = await storage.getVehiclePolicy(validatedData.vehicle_id, validatedData.email_id);
      if (existingPolicy) {
        return res.status(400).json({ error: "Vehicle policy already exists for this vehicle ID and email" });
      }

      const policy = await storage.createVehiclePolicy(validatedData);
      res.status(201).json(policy);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid vehicle policy data", details: error.errors });
      }
      console.error("Error creating vehicle policy:", error);
      res.status(500).json({ error: "Failed to create vehicle policy" });
    }
  });

  const httpServer = createServer(app);

  return httpServer;
}
