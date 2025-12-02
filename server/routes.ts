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
import { parseWhisperPreferences } from "./preference-parser";
import { calculateFinancialBreakdown } from "./financial-calculator";

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

      // Forward request to Google Cloud Run API (Updated to new endpoint with 15 field extraction)
      const response = await fetch(
        "https://insurance-pdf-extractor-hylbdno2wa-nw.a.run.app/extract",
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
      console.log("Quote search request payload:", JSON.stringify(req.body, null, 2));
      
      // Forward request to Google Cloud Run Quote Search API (OLD URL for home quote search)
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
        console.error(`Quote API error (${response.status}):`, errorText);
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

  // Timelapse search endpoint - simulates scheduled quote search over time
  app.post("/api/timelapse-search", async (req, res) => {
    try {
      const { policy_id, email_id, frequency } = req.body;

      if (!policy_id || !email_id || !frequency) {
        return res.status(400).json({
          error: "Missing required fields: policy_id, email_id, and frequency",
        });
      }

      if (!["weekly", "monthly"].includes(frequency)) {
        return res.status(400).json({
          error: "Invalid frequency. Must be 'weekly' or 'monthly'",
        });
      }

      // Get policy details from database
      const policy = await storage.getVehiclePolicy(policy_id, email_id);
      if (!policy) {
        return res.status(404).json({ error: "Policy not found" });
      }

      // Parse whisper preferences using OpenAI
      const whisperText = policy.whisper_preferences || "";
      const parsedPrefs = await parseWhisperPreferences(whisperText);

      // Fetch custom ratings once (outside the loop for efficiency)
      const customRatings = await storage.getCustomRatings(email_id);
      const trustPilotData = customRatings?.use_custom_ratings ? customRatings.trustpilot_data : null;
      const defactoRatings = customRatings?.use_custom_ratings ? customRatings.defacto_ratings : null;

      // Calculate iteration interval
      const intervalDays = frequency === "weekly" ? 7 : 30;
      const today = new Date();
      const policyEndDate = new Date(policy.policy_end_date);

      // Generate search iterations
      const iterations: Array<{
        date: string;
        match_found: boolean;
        iteration_index?: number;
        quote_data?: any;
        financial_breakdown?: any;
        message?: string;
      }> = [];

      let currentDate = new Date(today);
      const allMatches: any[] = [];
      let iterationIndex = 0;

      while (currentDate <= policyEndDate) {
        const dateStr = currentDate.toISOString().split("T")[0];

        // Prepare request for NEW enriched Quote API
        // CRITICAL: API requires exact capitalization for these field names
        const quoteRequestBody = {
          insurance_details: {
            email_id: policy.email_id,
            current_insurance_provider: policy.current_insurance_provider,
            policy_id: policy.policy_id,
            policy_type: policy.policy_type,
            // Vehicle details with API's required capitalization
            driver_age: policy.details.driver_age,
            vehicle_registration_number: policy.details.vehicle_registration_number,
            vehicle_manufacturer_name: policy.details.vehicle_manufacturer_name,
            vehicle_model: policy.details.vehicle_model,
            vehicle_year: policy.details.vehicle_year,
            type_of_fuel: policy.details.type_of_fuel,
            type_of_Cover_needed: policy.details.type_of_cover_needed,  // Capital C required by API
            No_Claim_bonus_years: policy.details.no_claim_bonus_years,  // Capital N and C required by API
            Voluntary_Excess: policy.details.voluntary_excess,           // Capital V and E required by API
          },
          user_preferences: whisperText,
          conversation_history: [],
          trust_pilot_data: trustPilotData,
          defacto_ratings: defactoRatings,
        };

        // Call NEW enriched Quote API
        const quoteResponse = await fetch(
          "https://alfie-657860957693.europe-west4.run.app/complete-analysis",
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify(quoteRequestBody),
          }
        );

        if (!quoteResponse.ok) {
          const errorBody = await quoteResponse.text().catch(() => "Unable to read error response");
          console.error(`Quote API error (${quoteResponse.status}):`, errorBody);
          console.error("Request payload:", JSON.stringify(quoteRequestBody, null, 2));
          
          iterations.push({
            date: dateStr,
            match_found: false,
            iteration_index: iterationIndex,
            message: `API error ${quoteResponse.status} - unable to fetch quotes`,
          });
          iterationIndex++;
          currentDate = new Date(currentDate.getTime() + intervalDays * 24 * 60 * 60 * 1000);
          continue;
        }

        const quoteData = await quoteResponse.json();
        const quotes = quoteData.quotes_with_insights || [];

        console.log(`[Timelapse] Received ${quotes.length} quotes from API`);

        // Find best matching quote using API's pre-computed matching data
        let bestMatch = null;
        for (const quote of quotes) {
          const quotePrice = quote.price_analysis?.quote_price || quote.original_quote?.output?.policy_cost;
          const insurerName = quote.insurer_name || quote.original_quote?.output?.insurer_name;
          const availableFeatures = quote.available_features || [];

          console.log(`[Timelapse] Checking ${insurerName}: price=${quotePrice}`);

          if (!quotePrice || !insurerName) {
            console.log(`[Timelapse] ❌ ${insurerName || 'Unknown'}: Missing price or name`);
            continue;
          }

          // Use API's pre-computed budget check
          const withinBudget = quote.price_analysis?.within_budget ?? true;
          console.log(`[Timelapse] ${insurerName}: within_budget=${withinBudget}`);
          if (!withinBudget) {
            console.log(`[Timelapse] ❌ ${insurerName}: Not within budget`);
            continue;
          }

          // Use API's pre-computed feature matching - if missing_required is empty, all requirements are met!
          const missingRequired = quote.features_matching_requirements?.missing_required || [];
          const matchedRequired = quote.features_matching_requirements?.matched_required || [];
          console.log(`[Timelapse] ${insurerName}: matched=${JSON.stringify(matchedRequired)}, missing=${JSON.stringify(missingRequired)}`);
          
          if (missingRequired.length > 0) {
            console.log(`[Timelapse] ❌ ${insurerName}: Missing required features: ${missingRequired.join(', ')}`);
            continue;
          }

          // Found a match!
          console.log(`[Timelapse] ✅ ${insurerName}: MATCH FOUND at £${quotePrice}`);
          if (!bestMatch || quotePrice < bestMatch.price) {
            bestMatch = {
              price: quotePrice,
              insurer: insurerName,
              features: availableFeatures,
              trustpilot_rating: quote.trust_pilot_context?.rating || quote.original_quote?.output?.trustpilot_rating,
              ai_insight: quote.alfie_message || quote.original_quote?.output?.ai_driven_insight,
              full_quote_data: quote,
            };
            console.log(`[Timelapse] 🏆 ${insurerName} is now best match`);
          }
        }

        if (bestMatch) {
          console.log(`[Timelapse] Final best match: ${bestMatch.insurer} at £${bestMatch.price}`);
        } else {
          console.log(`[Timelapse] ❌ No matches found in ${quotes.length} quotes`);
        }

        if (bestMatch) {
          // Calculate financial breakdown
          const financialBreakdown = calculateFinancialBreakdown(
            bestMatch.price,
            bestMatch.insurer,
            policy.current_policy_cost,
            policy.policy_start_date,
            policy.policy_end_date,
            20, // £20 cancellation fee
            currentDate
          );

          const matchIteration = {
            date: dateStr,
            match_found: true,
            iteration_index: iterationIndex,
            quote_data: bestMatch,
            financial_breakdown: financialBreakdown,
            message: `Match found: ${bestMatch.insurer} for £${bestMatch.price}`,
          };

          iterations.push(matchIteration);
          allMatches.push(matchIteration);
        } else {
          iterations.push({
            date: dateStr,
            match_found: false,
            iteration_index: iterationIndex,
            message: parsedPrefs.budget
              ? `No quotes within £${parsedPrefs.budget} budget with required features`
              : "No quotes match required features",
          });
        }

        // Move to next iteration date
        iterationIndex++;
        currentDate = new Date(currentDate.getTime() + intervalDays * 24 * 60 * 60 * 1000);
      }

      console.log(`[Timelapse] Sending response: ${iterations.length} iterations, ${allMatches.length} matches`);
      if (allMatches.length > 0) {
        console.log(`[Timelapse] First match details:`, JSON.stringify(allMatches[0], null, 2));
      }

      res.json({
        policy_id: policy.policy_id,
        frequency,
        parsed_preferences: parsedPrefs,
        iterations,
        all_matches: allMatches,
        total_iterations: iterations.length,
        total_matches: allMatches.length,
      });
    } catch (error: any) {
      console.error("Error in timelapse search:", error);
      res.status(500).json({
        error: "Failed to perform timelapse search",
        message: error.message,
      });
    }
  });

  // Single-week timelapse search endpoint - searches quotes for ONE specific date
  app.post("/api/timelapse-search-week", async (req, res) => {
    try {
      const { policy_id, email_id, search_date } = req.body;

      if (!policy_id || !email_id || !search_date) {
        return res.status(400).json({
          error: "Missing required fields: policy_id, email_id, and search_date",
        });
      }

      // Get policy details from database
      const policy = await storage.getVehiclePolicy(policy_id, email_id);
      if (!policy) {
        return res.status(404).json({ error: "Policy not found" });
      }

      // Parse whisper preferences using OpenAI
      const whisperText = policy.whisper_preferences || "";
      const parsedPrefs = await parseWhisperPreferences(whisperText);

      // Fetch custom ratings
      const customRatings = await storage.getCustomRatings(email_id);
      const trustPilotData = customRatings?.use_custom_ratings ? customRatings.trustpilot_data : null;
      const defactoRatings = customRatings?.use_custom_ratings ? customRatings.defacto_ratings : null;

      console.log(`[Timelapse Week] Searching on ${search_date}`);

      // Prepare request for Quote API
      const quoteRequestBody = {
        insurance_details: {
          email_id: policy.email_id,
          current_insurance_provider: policy.current_insurance_provider,
          policy_id: policy.policy_id,
          policy_type: policy.policy_type,
          driver_age: policy.details.driver_age,
          vehicle_registration_number: policy.details.vehicle_registration_number,
          vehicle_manufacturer_name: policy.details.vehicle_manufacturer_name,
          vehicle_model: policy.details.vehicle_model,
          vehicle_year: policy.details.vehicle_year,
          type_of_fuel: policy.details.type_of_fuel,
          type_of_Cover_needed: policy.details.type_of_cover_needed,
          No_Claim_bonus_years: policy.details.no_claim_bonus_years,
          Voluntary_Excess: policy.details.voluntary_excess,
        },
        user_preferences: whisperText,
        conversation_history: [],
        trust_pilot_data: trustPilotData,
        defacto_ratings: defactoRatings,
      };

      // Call Quote API
      const quoteResponse = await fetch(
        "https://alfie-657860957693.europe-west4.run.app/complete-analysis",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(quoteRequestBody),
        }
      );

      if (!quoteResponse.ok) {
        const errorBody = await quoteResponse.text().catch(() => "Unable to read error response");
        console.error(`[Timelapse Week] Quote API error (${quoteResponse.status}):`, errorBody);
        
        return res.json({
          search_date,
          match_found: false,
          matches: [],
          message: `API error ${quoteResponse.status} - unable to fetch quotes`,
        });
      }

      const quoteData = await quoteResponse.json();
      const quotes = quoteData.quotes_with_insights || [];

      console.log(`[Timelapse Week] Received ${quotes.length} quotes from API`);

      // Find all matching quotes (not just best one) using API's pre-computed matching data
      const matches: any[] = [];
      for (const quote of quotes) {
        const quotePrice = quote.price_analysis?.quote_price || quote.original_quote?.output?.policy_cost;
        const insurerName = quote.insurer_name || quote.original_quote?.output?.insurer_name;
        const availableFeatures = quote.available_features || [];

        if (!quotePrice || !insurerName) {
          continue;
        }

        // Use API's pre-computed budget check
        const withinBudget = quote.price_analysis?.within_budget ?? true;
        if (!withinBudget) {
          console.log(`[Timelapse Week] ❌ ${insurerName}: Not within budget`);
          continue;
        }

        // Use API's pre-computed feature matching
        const missingRequired = quote.features_matching_requirements?.missing_required || [];
        if (missingRequired.length > 0) {
          console.log(`[Timelapse Week] ❌ ${insurerName}: Missing required features: ${missingRequired.join(', ')}`);
          continue;
        }

        // Found a match!
        console.log(`[Timelapse Week] ✅ ${insurerName}: MATCH at £${quotePrice}`);
        
        // Calculate financial breakdown
        const financialBreakdown = calculateFinancialBreakdown(
          quotePrice,
          insurerName,
          policy.current_policy_cost,
          policy.policy_start_date,
          policy.policy_end_date,
          20, // £20 cancellation fee
          new Date(search_date)
        );

        matches.push({
          price: quotePrice,
          insurer: insurerName,
          features: availableFeatures,
          trustpilot_rating: quote.trust_pilot_context?.rating || quote.original_quote?.output?.trustpilot_rating,
          ai_insight: quote.alfie_message || quote.original_quote?.output?.ai_driven_insight,
          full_quote_data: quote,
          financial_breakdown: financialBreakdown,
        });
      }

      // Sort matches by price (cheapest first)
      matches.sort((a, b) => a.price - b.price);

      console.log(`[Timelapse Week] Found ${matches.length} matches on ${search_date}`);

      res.json({
        search_date,
        match_found: matches.length > 0,
        matches,
        total_quotes_searched: quotes.length,
        parsed_preferences: parsedPrefs,
        message: matches.length > 0 
          ? `Found ${matches.length} matching quote(s)` 
          : parsedPrefs.budget
            ? `No quotes within £${parsedPrefs.budget} budget with required features`
            : "No quotes match required features",
      });
    } catch (error: any) {
      console.error("[Timelapse Week] Error in single-week search:", error);
      res.status(500).json({
        error: "Failed to perform week search",
        message: error.message,
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
      // Check for duplicate policy error
      if (error instanceof Error && error.message.startsWith("DUPLICATE_POLICY:")) {
        console.log("[vehicle-policies] Duplicate policy error:", error.message);
        return res.status(409).json({ 
          error: "Duplicate policy", 
          message: error.message.replace("DUPLICATE_POLICY: ", "")
        });
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

  // Cancel a policy
  app.post("/api/cancel-policy", async (req, res) => {
    try {
      // Validate request body with Zod
      const cancelPolicySchema = z.object({
        policyId: z.string().min(1, "Policy ID is required"),
        email: z.string().email("Valid email is required").toLowerCase().trim(),
        cancel: z.literal(true, { errorMap: () => ({ message: "cancel must be true" }) }),
      });
      
      const validatedData = cancelPolicySchema.parse(req.body);
      
      // Simulate delay (1-2 seconds) for realistic mock service
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      // Delete the policy from database
      const policyNumber = await storage.deletePolicy(validatedData.policyId, validatedData.email);
      
      // Return mock service response
      res.json({
        policyNumber,
        cancelled: true
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid request data", details: error.errors });
      }
      console.error("Error cancelling policy:", error);
      res.status(500).json({ error: "Failed to cancel policy" });
    }
  });

  // Purchase a policy (update existing policy with new insurer and dates)
  app.post("/api/purchase-policy", async (req, res) => {
    try {
      // Validate request body
      const purchasePolicySchema = z.object({
        email_id: z.string().email("Valid email is required").toLowerCase().trim(),
        vehicle_registration_number: z.string().min(1, "Vehicle registration is required"),
        insurer_name: z.string().min(1, "Insurer name is required"),
        policy_cost: z.number().min(0, "Policy cost must be positive"),
      });
      
      const validatedData = purchasePolicySchema.parse(req.body);
      
      // Check if user exists
      const user = await storage.getUserByEmail(validatedData.email_id);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }
      
      // Purchase the policy (update or create based on vehicle registration)
      const purchasedPolicy = await storage.purchasePolicy(validatedData);
      
      // Flatten policy for frontend compatibility
      res.status(200).json(flattenPolicyResponse(purchasedPolicy));
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid request data", details: error.errors });
      }
      if (error instanceof Error && error.message.includes("No existing policy found")) {
        return res.status(404).json({ error: error.message });
      }
      console.error("Error purchasing policy:", error);
      res.status(500).json({ error: "Failed to purchase policy" });
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

  // Helper: Detect renewal intent from user message
  function detectRenewalIntent(message: string): boolean {
    const lowerMessage = message.toLowerCase();
    const renewalKeywords = [
      "renew", "renewal", "renew my", "renew insurance",
      "quote for my car", "get quotes", "insurance quote",
      "new quote", "find cheaper", "compare prices",
      "renewal quote", "renew my policy", "renew my car"
    ];
    return renewalKeywords.some(keyword => lowerMessage.includes(keyword));
  }

  // Helper: Parse vehicle selection from user message (1st, 2nd, first, second, etc.)
  function parseVehicleSelection(message: string): number | null {
    const lowerMessage = message.toLowerCase().trim();
    const ordinalMap: Record<string, number> = {
      "1": 1, "1st": 1, "first": 1, "one": 1, "the first": 1,
      "2": 2, "2nd": 2, "second": 2, "two": 2, "the second": 2,
      "3": 3, "3rd": 3, "third": 3, "three": 3, "the third": 3,
      "4": 4, "4th": 4, "fourth": 4, "four": 4, "the fourth": 4,
      "5": 5, "5th": 5, "fifth": 5, "five": 5, "the fifth": 5,
    };
    for (const [key, value] of Object.entries(ordinalMap)) {
      if (lowerMessage === key || lowerMessage.includes(key + " ") || lowerMessage.includes(key + ".") || lowerMessage.endsWith(key)) {
        return value;
      }
    }
    return null;
  }

  // Helper: Check if the last assistant message was asking for vehicle selection
  function isWaitingForVehicleSelection(chatHistory: any[]): boolean {
    if (chatHistory.length === 0) return false;
    const lastAssistantMessage = [...chatHistory].reverse().find(m => m.role === "assistant");
    if (!lastAssistantMessage) return false;
    return lastAssistantMessage.content.includes("[VEHICLE_SELECTION_PENDING]");
  }

  // Helper: Extract vehicles list from the pending message
  function extractVehiclesFromPendingMessage(chatHistory: any[]): VehiclePolicyWithDetails[] | null {
    const lastAssistantMessage = [...chatHistory].reverse().find(m => m.role === "assistant");
    if (!lastAssistantMessage) return null;
    const match = lastAssistantMessage.content.match(/\[VEHICLES_DATA:(.*?)\]/);
    if (match) {
      try {
        return JSON.parse(match[1]);
      } catch (e) {
        return null;
      }
    }
    return null;
  }

  // Helper: Call the renewal quote API
  async function callRenewalQuoteAPI(vehicle: VehiclePolicyWithDetails, userEmail: string): Promise<any> {
    const RENEWAL_API_URL = "https://alfie-657860957693.europe-west4.run.app/complete-analysis";
    
    const requestBody = {
      insurance_details: {
        email_id: userEmail,
        driver_age: vehicle.details.driver_age,
        vehicle_registration_number: vehicle.details.vehicle_registration_number,
        vehicle_manufacturer_name: vehicle.details.vehicle_manufacturer_name,
        vehicle_model: vehicle.details.vehicle_model,
        vehicle_year: vehicle.details.vehicle_year,
        type_of_fuel: vehicle.details.type_of_fuel,
        type_of_Cover_needed: vehicle.details.type_of_cover_needed,
        No_Claim_bonus_years: vehicle.details.no_claim_bonus_years,
        Voluntary_Excess: vehicle.details.voluntary_excess,
        current_insurance_provider: vehicle.current_insurance_provider,
        policy_id: vehicle.policy_id,
        policy_type: "car"
      },
      user_preferences: vehicle.whisper_preferences || "",
      conversation_history: [],
      trust_pilot_data: null,
      defacto_ratings: null
    };

    console.log(`[Chat Renewal] Calling renewal API with:`, JSON.stringify(requestBody, null, 2));

    const response = await fetch(RENEWAL_API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[Chat Renewal] API error: ${response.status} - ${errorText}`);
      throw new Error(`Quote API returned ${response.status}`);
    }

    return await response.json();
  }

  // Helper: Format quotes for chat display
  function formatQuotesForChat(quotes: any[]): string {
    if (!quotes || quotes.length === 0) {
      return "I couldn't find any quotes at the moment. Please try again later.";
    }

    let response = "Great news! I found some renewal quotes for you:\n\n";
    quotes.slice(0, 5).forEach((quote: any, index: number) => {
      const price = quote.price || quote.annual_premium || "N/A";
      const provider = quote.insurer || quote.provider || "Unknown";
      const score = quote.autoannie_score || quote.score || "N/A";
      response += `${index + 1}. **${provider}** - £${price}/year`;
      if (score !== "N/A") response += ` (AutoAnnie Score: ${score})`;
      response += "\n";
    });
    response += "\nWould you like more details on any of these quotes?";
    return response;
  }

  // Send message to AI and get response (with agentic renewal capability)
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

      // Get chat history to check for pending vehicle selection
      const chatHistory = await storage.getChatHistory(email);
      
      let aiResponse: string;

      // AGENTIC FLOW: Check if we're waiting for vehicle selection
      if (isWaitingForVehicleSelection(chatHistory)) {
        const vehicleIndex = parseVehicleSelection(userMessage);
        
        if (vehicleIndex !== null) {
          // User selected a vehicle - fetch and trigger quote search
          const vehicles = extractVehiclesFromPendingMessage(chatHistory);
          
          if (vehicles && vehicleIndex >= 1 && vehicleIndex <= vehicles.length) {
            const selectedVehicle = vehicles[vehicleIndex - 1];
            console.log(`[Chat Renewal] User selected vehicle ${vehicleIndex}: ${selectedVehicle.details.vehicle_manufacturer_name} ${selectedVehicle.details.vehicle_model}`);
            
            try {
              aiResponse = `Perfect! I'm searching for renewal quotes for your ${selectedVehicle.details.vehicle_manufacturer_name} ${selectedVehicle.details.vehicle_model} (${selectedVehicle.details.vehicle_registration_number}). This may take a moment...\n\n`;
              
              const quoteResult = await callRenewalQuoteAPI(selectedVehicle, email);
              const quotes = quoteResult.quotes || quoteResult.results || [];
              aiResponse += formatQuotesForChat(quotes);
              
            } catch (quoteError: any) {
              console.error("[Chat Renewal] Quote API error:", quoteError);
              aiResponse = `I'm sorry, I couldn't retrieve quotes for your ${selectedVehicle.details.vehicle_manufacturer_name} ${selectedVehicle.details.vehicle_model} right now. Please try again in a moment, or use the Quote Search button on the home screen.`;
            }
          } else {
            aiResponse = `I didn't quite catch that. Please reply with a number (1, 2, 3...) or say "first", "second", "third" to select which vehicle you'd like to renew.`;
          }
        } else {
          // User said something else while we were waiting - reset and use AI
          const VECTOR_STORE_ID = "vs_6901fa16a5c081918d2ad17626cc303f";
          try {
            aiResponse = await sendChatMessage(userMessage, {
              vectorStoreId: VECTOR_STORE_ID,
              userEmail: email,
            });
          } catch (aiError: any) {
            console.error("[Chat] AI error:", aiError);
            aiResponse = "I'm having trouble connecting right now. Please try again in a moment.";
          }
        }
      }
      // AGENTIC FLOW: Detect renewal intent
      else if (detectRenewalIntent(userMessage)) {
        console.log(`[Chat Renewal] Detected renewal intent for ${email}`);
        
        // Fetch user's vehicles
        const vehicles = await storage.getVehiclePoliciesByEmail(email);
        
        if (vehicles.length === 0) {
          aiResponse = "I'd love to help you find renewal quotes, but I don't see any vehicles registered to your account yet.\n\nTo get started, please go to the home screen and tap 'Add Policy' to add your car. Once your vehicle is registered, I can help you find the best renewal quotes!";
        } else {
          // Format vehicle list for user selection
          let vehicleList = "I'd be happy to help you find renewal quotes! Here are your registered vehicles:\n\n";
          vehicles.forEach((v, index) => {
            vehicleList += `${index + 1}. **${v.details.vehicle_manufacturer_name} ${v.details.vehicle_model}** (${v.details.vehicle_registration_number})\n`;
            vehicleList += `   Current provider: ${v.current_insurance_provider || "Not specified"}\n`;
          });
          vehicleList += "\nWhich vehicle would you like to get renewal quotes for? Just reply with the number (e.g., \"1\" or \"first\").";
          
          // Add hidden marker with vehicle data for state tracking
          const vehiclesData = JSON.stringify(vehicles);
          aiResponse = `${vehicleList}\n\n[VEHICLE_SELECTION_PENDING][VEHICLES_DATA:${vehiclesData}]`;
        }
      }
      // REGULAR FLOW: Use AI for general questions
      else {
        const VECTOR_STORE_ID = "vs_6901fa16a5c081918d2ad17626cc303f";
        
        try {
          aiResponse = await sendChatMessage(userMessage, {
            vectorStoreId: VECTOR_STORE_ID,
            userEmail: email,
          });
          console.log(`[Chat] AI response: "${aiResponse}"`);
        } catch (aiError: any) {
          console.error("[Chat] AI error:", aiError);
          aiResponse = "I'm having trouble connecting right now. Please try again in a moment.";
        }
      }

      // Clean up hidden markers before saving (keep human-readable part only)
      const cleanedResponse = aiResponse.replace(/\[VEHICLE_SELECTION_PENDING\]\[VEHICLES_DATA:.*?\]/g, "[VEHICLE_SELECTION_PENDING]");
      
      // Save assistant response to database (with markers for state tracking)
      const savedAssistantMessage = await storage.saveChatMessage({
        email_id: email,
        role: "assistant",
        content: aiResponse, // Save full response with data markers
      });

      // Return cleaned response to frontend (hide technical markers)
      const displayResponse = aiResponse.replace(/\[VEHICLE_SELECTION_PENDING\](\[VEHICLES_DATA:.*?\])?/g, "").trim();

      // Return both messages
      res.json({
        userMessage: savedUserMessage,
        assistantMessage: {
          ...savedAssistantMessage,
          content: displayResponse // Show clean version to user
        },
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
