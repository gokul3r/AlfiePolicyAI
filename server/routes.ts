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
  VehiclePolicyWithDetails,
  insertNegotiationSchema,
  negotiationResponseSchema,
  insertLiveNegotiationSchema
} from "@shared/schema";
import { z } from "zod";
import multer from "multer";
import { sendChatMessage } from "./openai-realtime";
// Voice Chat - Using stable Gemini text API with function calling
// Previous versions: voice-chat-handler-gemini (Live API), voice-chat-handler-2.0 (OpenAI), voice-chat-handler (OpenAI 1.0)
import { handleVoiceChatStable as handleVoiceChat } from "./voice-chat-handler-stable";
import { handleGmailAuthorize, handleGmailCallback, handleGmailDisconnect, handleGmailStatus } from "./gmail-oauth";
import { scanGmailForTravelEmails } from "./gmail-scanner";
import { parseWhisperPreferences } from "./preference-parser";
import { calculateFinancialBreakdown } from "./financial-calculator";
import { classifyIntent, isQuoteIntent, isPolicyIntent, type IntentResult } from "./intent-classifier";
import { negotiate } from "./negotiator-agent";

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
        "https://alfie-657860957693.europe-west4.run.app/complete-analysis",
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

  // ─── ChatGPT Custom GPT Integration ────────────────────────────────────────

  // API key middleware for GPT routes
  function requireGptApiKey(req: any, res: any, next: any) {
    const key = req.headers["x-api-key"];
    const expected = process.env.GPT_API_KEY;
    if (!expected) {
      return res.status(500).json({ error: "GPT_API_KEY is not configured on the server." });
    }
    if (!key || key !== expected) {
      return res.status(401).json({ error: "Unauthorized. A valid X-API-Key header is required." });
    }
    next();
  }

  // Self-contained quote search for ChatGPT Custom GPT — no user session needed
  // Note: requireGptApiKey removed while debugging ChatGPT Action connectivity.
  // Re-apply once end-to-end flow is confirmed working.
  app.post("/api/gpt/search-quotes", async (req, res) => {
    console.log("[GPT INBOUND]", new Date().toISOString(), "ip:", req.ip, "body:", JSON.stringify(req.body));
    try {
      const {
        registration,
        manufacturer,
        model,
        year,
        fuel_type,
        driver_age,
        no_claims_bonus,
        voluntary_excess,
        current_insurer,
        policy_end_date,
        current_premium,
        preferences,
      } = req.body;

      if (!registration || driver_age === undefined || no_claims_bonus === undefined) {
        return res.status(400).json({
          error: "Missing required fields: registration, driver_age, and no_claims_bonus are required.",
        });
      }

      if (!manufacturer || !model || !year || !fuel_type) {
        return res.status(400).json({
          error: "Missing vehicle details: manufacturer, model, year, and fuel_type are required for accurate quotes.",
        });
      }

      const today = new Date().toISOString().split("T")[0];

      // Normalise fuel type to the exact values the API accepts
      const normaliseFuel = (f: string | undefined): string => {
        if (!f) return "Petrol";
        const map: Record<string, string> = {
          petrol: "Petrol", diesel: "Diesel",
          electric: "Electric", hybrid: "Hybrid",
        };
        return map[f.toLowerCase()] || "Petrol";
      };

      const quoteRequestBody = {
        insurance_details: {
          email_id: "gpt-user@autoannie.ai",
          current_date: today,
          current_insurance_provider: current_insurer || "Unknown",
          policy_id: "GPT-SESSION",
          policy_type: "Comprehensive",
          driver_age: driver_age,
          vehicle_registration_number: registration,
          vehicle_manufacturer_name: manufacturer || "Unknown",
          vehicle_model: model || "Unknown",
          vehicle_year: year || new Date().getFullYear() - 5,
          type_of_fuel: normaliseFuel(fuel_type),
          type_of_Cover_needed: "comprehensive",
          No_Claim_bonus_years: no_claims_bonus,
          Voluntary_Excess: voluntary_excess ?? 250,
        },
        user_preferences: preferences || "Please find the best value comprehensive insurance.",
        conversation_history: [],
        trust_pilot_data: null,
        defacto_ratings: null,
      };

      console.log("[GPT] Quote search request:", JSON.stringify(quoteRequestBody, null, 2));

      const response = await fetch(
        "https://alfie-657860957693.europe-west4.run.app/complete-analysis",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(quoteRequestBody),
        }
      );

      if (!response.ok) {
        const errorText = await response.text().catch(() => "Unknown error");
        console.error(`[GPT] Quote API error (${response.status}):`, errorText);
        throw new Error(`Quote API returned ${response.status}: ${errorText}`);
      }

      const data = await response.json();

      // Build a compact, GPT-friendly summary — keep payload small so ChatGPT can process it
      const rawQuotes: any[] = data.quotes_with_insights || data.quotes || [];
      const trim = (s: any, max = 250): string | null => {
        if (!s || typeof s !== "string") return null;
        return s.length > max ? s.slice(0, max).trimEnd() + "..." : s;
      };
      const topQuotes = rawQuotes.slice(0, 3).map((q: any) => {
        const annualPremium =
          q.original_quote?.output?.policy_cost ??
          q.original_quote?.output?.post_discount_cost ??
          q.annual_premium ?? q.price ?? null;
        const monthlyPremium =
          q.original_quote?.output?.monthly_cost ??
          (annualPremium ? Math.round((annualPremium / 12) * 100) / 100 : null);
        const features: string[] =
          q.available_features ??
          q.features_matching_requirements ??
          q.features ?? q.key_features ?? [];
        return {
          insurer: q.insurer_name || q.insurer || q.provider || "Unknown",
          annual_premium_gbp: annualPremium,
          monthly_premium_gbp: monthlyPremium,
          key_features: Array.isArray(features) ? features.slice(0, 3) : [],
          ai_insight: trim(q.autoannie_message ?? q.alfie_message ?? q.insight),
          match_score: q.alfie_touch_score ?? q.match_score ?? null,
        };
      });

      const summary = {
        quotes_found: rawQuotes.length,
        top_quotes: topQuotes,
      };

      res.json(summary);
    } catch (error: any) {
      console.error("[GPT] Error searching quotes:", error);
      res.status(500).json({ error: "Failed to search quotes", message: error.message });
    }
  });

  // OpenAPI schema — paste this into ChatGPT Custom GPT → Actions
  app.get("/api/gpt/openapi.json", (req, res) => {
    const host = req.headers.host || "your-app.replit.app";
    const protocol = req.headers["x-forwarded-proto"] || "https";
    const serverUrl = `${protocol}://${host}`;

    const schema = {
      openapi: "3.1.0",
      info: {
        title: "Autoannie Quote Search",
        description:
          "Search UK motor insurance quotes for a customer. Collect the customer's vehicle registration, driver age, and years of no-claims bonus, then call this action to retrieve real quotes.",
        version: "1.0.0",
      },
      servers: [{ url: serverUrl }],
      paths: {
        "/api/gpt/search-quotes": {
          post: {
            operationId: "searchQuotes",
            summary: "Search for motor insurance quotes",
            description:
              "Returns up to 5 ranked insurance quotes. All required fields must be collected from the customer conversationally before calling this action.",
            requestBody: {
              required: true,
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    required: [
                      "registration",
                      "manufacturer",
                      "model",
                      "year",
                      "fuel_type",
                      "driver_age",
                      "no_claims_bonus",
                    ],
                    properties: {
                      registration: {
                        type: "string",
                        description: "UK vehicle registration number, e.g. AB12 CDE",
                      },
                      manufacturer: {
                        type: "string",
                        description: "Vehicle make, e.g. Ford, BMW, Toyota",
                      },
                      model: {
                        type: "string",
                        description: "Vehicle model, e.g. Focus, 3 Series, Yaris",
                      },
                      year: {
                        type: "integer",
                        description: "Year the vehicle was manufactured, e.g. 2019",
                      },
                      fuel_type: {
                        type: "string",
                        description: "Fuel type — must be exactly one of: Petrol, Diesel, Electric, Hybrid",
                      },
                      driver_age: {
                        type: "integer",
                        description: "Age of the main driver in years",
                      },
                      no_claims_bonus: {
                        type: "integer",
                        description:
                          "Number of years of no-claims bonus (NCB) the driver has, e.g. 5",
                      },
                      voluntary_excess: {
                        type: "integer",
                        description:
                          "Voluntary excess amount in GBP the customer is willing to pay, e.g. 250. Defaults to 250 if not provided.",
                      },
                      current_insurer: {
                        type: "string",
                        description: "Name of the customer's current insurance provider",
                      },
                      policy_end_date: {
                        type: "string",
                        description:
                          "Customer's current policy end/renewal date in ISO format, e.g. 2025-06-01",
                      },
                      current_premium: {
                        type: "number",
                        description:
                          "Customer's current annual insurance premium in GBP, e.g. 650.00",
                      },
                      preferences: {
                        type: "string",
                        description:
                          "Any specific cover preferences the customer has mentioned, e.g. 'I want breakdown cover and a courtesy car'",
                      },
                    },
                  },
                },
              },
            },
            responses: {
              "200": {
                description: "Insurance quotes retrieved successfully",
                content: {
                  "application/json": {
                    schema: {
                      type: "object",
                      properties: {
                        quotes_found: {
                          type: "integer",
                          description: "Total number of quotes found",
                        },
                        top_quotes: {
                          type: "array",
                          description: "Top 5 ranked quotes",
                          items: {
                            type: "object",
                            properties: {
                              insurer: { type: "string" },
                              annual_premium_gbp: { type: "number" },
                              monthly_premium_gbp: { type: "number" },
                              key_features: {
                                type: "array",
                                items: { type: "string" },
                              },
                              ai_insight: { type: "string" },
                              match_score: { type: "number" },
                            },
                          },
                        },
                      },
                    },
                  },
                },
              },
              "400": { description: "Missing required fields" },
              "500": { description: "Internal server error" },
            },
          },
        },
      },
      components: {
        schemas: {},
      },
    };

    res.setHeader("Content-Type", "application/json");
    res.json(schema);
  });

  // Privacy policy page — required by ChatGPT for GPTs that have Actions
  app.get("/privacy-policy", (_req, res) => {
    res.setHeader("Content-Type", "text/html");
    res.send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Privacy Policy — Autoannie</title>
  <style>
    body { font-family: system-ui, sans-serif; max-width: 760px; margin: 48px auto; padding: 0 24px; color: #1a1a1a; line-height: 1.7; }
    h1 { font-size: 1.8rem; margin-bottom: 4px; }
    h2 { font-size: 1.1rem; margin-top: 32px; margin-bottom: 8px; }
    p, li { font-size: 0.95rem; color: #333; }
    ul { padding-left: 20px; }
    .updated { font-size: 0.85rem; color: #888; margin-bottom: 32px; }
    footer { margin-top: 48px; font-size: 0.8rem; color: #aaa; border-top: 1px solid #eee; padding-top: 16px; }
  </style>
</head>
<body>
  <h1>Privacy Policy</h1>
  <p class="updated">Last updated: March 2026</p>

  <p>Autoannie ("we", "our", or "the service") is a UK motor insurance quote assistant. This policy explains how we handle information when you use Autoannie, including via the Autoannie ChatGPT Custom GPT.</p>

  <h2>1. What information we collect</h2>
  <p>When you request an insurance quote through Autoannie, you may provide:</p>
  <ul>
    <li>Vehicle details: registration number, make, model, year of manufacture, fuel type</li>
    <li>Driver details: age, years of no-claims bonus, voluntary excess</li>
    <li>Policy details: current insurer, renewal date, current annual premium</li>
    <li>Cover preferences: any stated preferences such as breakdown cover or courtesy car</li>
  </ul>

  <h2>2. How we use this information</h2>
  <p>The information you provide is used solely to search for UK motor insurance quotes on your behalf. It is passed to our quote search engine in real time and is not stored, retained, or used for any other purpose.</p>

  <h2>3. Data retention</h2>
  <p>Autoannie does not store or log the vehicle or driver details you enter during a ChatGPT conversation. Each quote search is stateless — no personal data is retained after the session ends.</p>

  <h2>4. Third-party services</h2>
  <p>Quote results are retrieved from an insurance market data API. We do not share your details with insurers directly; results are informational only. This service is not FCA-regulated and does not constitute a formal insurance quote or offer.</p>

  <h2>5. ChatGPT integration</h2>
  <p>When using Autoannie through a ChatGPT Custom GPT, your conversation is also subject to OpenAI's privacy policy, available at <a href="https://openai.com/policies/privacy-policy" target="_blank">openai.com/policies/privacy-policy</a>.</p>

  <h2>6. Contact</h2>
  <p>If you have any questions about this privacy policy, please contact the Autoannie team through your usual Autoannie representative.</p>

  <footer>Autoannie &mdash; UK Motor Insurance Assistant &mdash; &copy; 2026</footer>
</body>
</html>`);
  });

  // ─── End ChatGPT Custom GPT Integration ─────────────────────────────────────

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
            current_date: dateStr,
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
              requested_features: matchedRequired,
              missing_features: missingRequired,
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
            55, // £55 cancellation fee
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
          current_date: search_date,
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

      // Collect ALL valid quote prices and basic info for market trend (grey line on chart)
      const allQuotePrices: number[] = [];
      const allQuotesBasic: { insurer: string; price: number; features: string[] }[] = [];

      // Find all matching quotes (not just best one) using API's pre-computed matching data
      const matches: any[] = [];
      for (const quote of quotes) {
        const quotePrice = quote.price_analysis?.quote_price || quote.original_quote?.output?.policy_cost;
        const insurerName = quote.insurer_name || quote.original_quote?.output?.insurer_name;
        const availableFeatures = quote.available_features || [];

        if (!quotePrice || !insurerName) {
          continue;
        }

        // Track all valid prices and basic info for market trend regardless of feature matching
        allQuotePrices.push(quotePrice);
        allQuotesBasic.push({ insurer: insurerName, price: quotePrice, features: availableFeatures });

        // Use API's pre-computed budget check
        const withinBudget = quote.price_analysis?.within_budget ?? true;
        if (!withinBudget) {
          console.log(`[Timelapse Week] ❌ ${insurerName}: Not within budget`);
          continue;
        }

        // Use API's pre-computed feature matching
        const missingRequired = quote.features_matching_requirements?.missing_required || [];
        const matchedRequired = quote.features_matching_requirements?.matched_required || [];
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
          55, // £55 cancellation fee
          new Date(search_date)
        );

        matches.push({
          price: quotePrice,
          insurer: insurerName,
          features: availableFeatures,
          requested_features: matchedRequired,
          missing_features: missingRequired,
          trustpilot_rating: quote.trust_pilot_context?.rating || quote.original_quote?.output?.trustpilot_rating,
          ai_insight: quote.alfie_message || quote.original_quote?.output?.ai_driven_insight,
          full_quote_data: quote,
          financial_breakdown: financialBreakdown,
        });
      }

      // Sort matches by price (cheapest first)
      matches.sort((a, b) => a.price - b.price);

      console.log(`[Timelapse Week] Found ${matches.length} matches on ${search_date}, ${allQuotePrices.length} total quotes with prices`);

      res.json({
        search_date,
        match_found: matches.length > 0,
        matches,
        all_quote_prices: allQuotePrices,
        all_quotes_basic: allQuotesBasic,
        current_insurance_provider: policy.current_insurance_provider,
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

  // Negotiation agent endpoint - AutoAnnie negotiates with current insurer
  app.post("/api/negotiate", async (req, res) => {
    try {
      const { renewal_cost_new_provider, renewal_cost_current_provider } = req.body;

      if (
        typeof renewal_cost_new_provider !== "number" ||
        typeof renewal_cost_current_provider !== "number" ||
        renewal_cost_new_provider <= 0 ||
        renewal_cost_current_provider <= 0
      ) {
        return res.status(400).json({
          error: "Both renewal_cost_new_provider and renewal_cost_current_provider must be positive numbers",
        });
      }

      console.log(
        `[Negotiate] Request: new_provider=£${renewal_cost_new_provider}, current_provider=£${renewal_cost_current_provider}`
      );

      const result = await negotiate({
        renewal_cost_new_provider,
        renewal_cost_current_provider,
      });

      console.log(`[Negotiate] Result: ${result.status}`);
      res.json(result);
    } catch (error: any) {
      console.error("[Negotiate] Error:", error);
      res.status(500).json({
        error: "Negotiation failed",
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

  // Save user message only (for frontend-controlled flows)
  app.post("/api/chat/save-user-message", async (req, res) => {
    try {
      const { email_id, message } = req.body;
      if (!email_id || !message) {
        return res.status(400).json({ error: "email_id and message are required" });
      }
      const savedMessage = await storage.saveChatMessage({
        email_id: email_id.toLowerCase().trim(),
        role: "user",
        content: message,
      });
      res.status(201).json(savedMessage);
    } catch (error) {
      console.error("Error saving user message:", error);
      res.status(500).json({ error: "Failed to save user message" });
    }
  });

  // Save assistant message only (for frontend-controlled flows like purchase simulation)
  app.post("/api/chat/save-assistant-message", async (req, res) => {
    try {
      const { email_id, message } = req.body;
      if (!email_id || !message) {
        return res.status(400).json({ error: "email_id and message are required" });
      }
      const savedMessage = await storage.saveChatMessage({
        email_id: email_id.toLowerCase().trim(),
        role: "assistant",
        content: message,
      });
      res.status(201).json(savedMessage);
    } catch (error) {
      console.error("Error saving assistant message:", error);
      res.status(500).json({ error: "Failed to save assistant message" });
    }
  });

  // Helper: Get top 3 quotes sorted by alfie_touch_score
  function getTop3Quotes(data: any): any[] {
    const quotes = data.quotes_with_insights || [];
    const sortedQuotes = [...quotes].sort(
      (a, b) => (b.alfie_touch_score || 0) - (a.alfie_touch_score || 0)
    );
    return sortedQuotes.slice(0, 3).map(q => {
      const result = {
        insurer_name: q.insurer_name,
        alfie_touch_score: q.alfie_touch_score,
        alfie_message: q.alfie_message,
        quote_price: q.price_analysis?.quote_price || q.original_quote?.output?.policy_cost || null,
        available_features: q.available_features || [],
        features_matched: q.features_matching_requirements?.matched_required || [],
        features_missing: q.features_matching_requirements?.missing_required || []
      };
      console.log(`[Chat] Quote ${q.insurer_name}: price=${result.quote_price}, features=${result.available_features.length}, matched=${result.features_matched.length}, missing=${result.features_missing.length}`);
      return result;
    });
  }

  // Helper: Format top 3 quotes as a structured chat response with embedded JSON
  function formatQuotesForChat(top3: any[]): string {
    if (top3.length === 0) {
      return "I couldn't find any quotes at this time. Please try again later.";
    }
    
    // Mark the first quote as the top match
    const quotesWithTopMatch = top3.map((quote, index) => ({
      ...quote,
      isTopMatch: index === 0
    }));
    
    // Return structured format that frontend can parse and render as cards
    const quoteData = {
      type: "quote_cards",
      intro: "Great news! I found some insurance quotes for you. Here are the top 3 options:",
      quotes: quotesWithTopMatch,
      outro: "Tap any card to select that quote!"
    };
    
    return `[QUOTE_CARDS]${JSON.stringify(quoteData)}[/QUOTE_CARDS]`;
  }

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

      let aiResponse: string;

      // Use LLM-based intent classification with fallback
      const intentResult = await classifyIntent(userMessage);
      console.log(`[Chat] Intent classification: ${intentResult.intent} (${(intentResult.confidence * 100).toFixed(0)}% via ${intentResult.source}) - ${intentResult.reason}`);

      // Check if this is a quote search request
      if (isQuoteIntent(intentResult)) {
        console.log(`[Chat] Detected quote search intent from: "${userMessage}"`);
        
        // Get user's vehicle policies
        const vehiclePolicies = await storage.getVehiclePoliciesByEmail(email);
        
        if (!vehiclePolicies || vehiclePolicies.length === 0) {
          // No vehicle - guide user to add a policy first
          aiResponse = "Please onboard via home -> Add policy before searching for quotes.";
          console.log(`[Chat] No vehicle policies found for ${email}, returning guidance message`);
        } else {
          // Use the first vehicle policy for the quote search
          const policy = vehiclePolicies[0];
          console.log(`[Chat] Found vehicle policy: ${policy.details.vehicle_manufacturer_name} ${policy.details.vehicle_model}`);
          
          // Get whisper_preferences from the policy (same as home quote search)
          const whisperPreferences = policy.whisper_preferences || "";
          console.log(`[Chat] Using whisper_preferences: "${whisperPreferences}"`);
          
          // Build quote search request with case-sensitive field names
          const chatCurrentDate = new Date().toISOString().split("T")[0];
          const quoteRequestBody = {
            insurance_details: {
              email_id: policy.email_id,
              current_date: chatCurrentDate,
              driver_age: policy.details.driver_age,
              vehicle_registration_number: policy.details.vehicle_registration_number,
              vehicle_manufacturer_name: policy.details.vehicle_manufacturer_name,
              vehicle_model: policy.details.vehicle_model,
              vehicle_year: policy.details.vehicle_year,
              type_of_fuel: policy.details.type_of_fuel,
              type_of_Cover_needed: policy.details.type_of_cover_needed,
              No_Claim_bonus_years: policy.details.no_claim_bonus_years,
              Voluntary_Excess: policy.details.voluntary_excess,
              current_insurance_provider: policy.current_insurance_provider,
              policy_id: policy.policy_id,
              policy_type: policy.policy_type
            },
            user_preferences: whisperPreferences,
            conversation_history: [],
            trust_pilot_data: null,
            defacto_ratings: null
          };
          
          console.log(`[Chat] Calling Quote Search API...`);
          console.log(`[Chat] Request body:`, JSON.stringify(quoteRequestBody, null, 2));
          
          try {
            // Call the Quote Search API with 30-second timeout
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 30000);
            
            const quoteResponse = await fetch(
              "https://alfie-657860957693.europe-west4.run.app/complete-analysis",
              {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                },
                body: JSON.stringify(quoteRequestBody),
                signal: controller.signal,
              }
            );
            
            clearTimeout(timeoutId);
            
            if (!quoteResponse.ok) {
              const errorText = await quoteResponse.text().catch(() => "Unknown error");
              console.error(`[Chat] Quote API error (${quoteResponse.status}):`, errorText);
              aiResponse = "I had trouble searching for quotes. Please try again or use the Quote Search button on the home screen.";
            } else {
              const quoteData = await quoteResponse.json();
              console.log(`[Chat] Quote API returned ${quoteData.quotes_with_insights?.length || 0} quotes`);
              
              // Get top 3 quotes
              const top3 = getTop3Quotes(quoteData);
              console.log(`[Chat] Top 3 quotes:`, top3.map(q => q.insurer_name));
              
              // Format response for chat
              aiResponse = formatQuotesForChat(top3);
            }
          } catch (quoteError: any) {
            console.error("[Chat] Quote search error:", quoteError.name, quoteError.message);
            if (quoteError.name === 'AbortError') {
              aiResponse = "The quote search is taking too long. Please try again or use the Quote Search button on the home screen.";
            } else {
              aiResponse = "I couldn't connect to the quote search service. Please try again later.";
            }
          }
        }
      } else {
        // Regular chat - use OpenAI Responses API with vector store
        const VECTOR_STORE_ID = "vs_6901fa16a5c081918d2ad17626cc303f";
        
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

  // Quote History endpoints
  app.get("/api/quote-history/:email", async (req, res) => {
    try {
      const email = req.params.email.toLowerCase().trim();
      const quotes = await storage.getQuoteHistoryByEmail(email);
      res.json(quotes);
    } catch (error) {
      console.error("Error fetching quote history:", error);
      res.status(500).json({ error: "Failed to fetch quote history" });
    }
  });

  app.get("/api/quote-history/:email/:status", async (req, res) => {
    try {
      const email = req.params.email.toLowerCase().trim();
      const status = req.params.status as 'matched' | 'rejected';
      
      if (status !== 'matched' && status !== 'rejected') {
        return res.status(400).json({ error: "Status must be 'matched' or 'rejected'" });
      }
      
      const quotes = await storage.getQuoteHistoryByStatus(email, status);
      res.json(quotes);
    } catch (error) {
      console.error("Error fetching quote history by status:", error);
      res.status(500).json({ error: "Failed to fetch quote history" });
    }
  });

  app.post("/api/quote-history", async (req, res) => {
    try {
      const { email_id, insurance_provider_name, vehicle_number, price_of_quote, features, status, date_of_quote } = req.body;
      
      if (!email_id || !insurance_provider_name || !vehicle_number || price_of_quote === undefined || !features) {
        return res.status(400).json({ error: "Missing required fields" });
      }
      
      const result = await storage.createQuoteHistory({
        email_id: email_id.toLowerCase().trim(),
        insurance_provider_name,
        vehicle_number,
        price_of_quote,
        features,
        status: status || 'matched',
        date_of_quote: date_of_quote ? new Date(date_of_quote) : new Date(),
      });
      
      res.json(result);
    } catch (error) {
      console.error("Error creating quote history:", error);
      res.status(500).json({ error: "Failed to create quote history" });
    }
  });

  // Delete all quote history for a user (used when starting new timelapse session)
  app.delete("/api/quote-history/:email", async (req, res) => {
    try {
      const email = req.params.email.toLowerCase().trim();
      const deletedCount = await storage.deleteQuoteHistoryByEmail(email);
      res.json({ success: true, deletedCount });
    } catch (error) {
      console.error("Error deleting quote history:", error);
      res.status(500).json({ error: "Failed to delete quote history" });
    }
  });

  app.post("/api/negotiations", async (req, res) => {
    try {
      const validated = insertNegotiationSchema.parse(req.body);
      const negotiation = await storage.createNegotiation(validated);
      res.status(201).json(negotiation);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid negotiation data", details: error.errors });
      }
      console.error("Error creating negotiation:", error);
      res.status(500).json({ error: "Failed to create negotiation" });
    }
  });

  app.get("/api/negotiations", async (req, res) => {
    try {
      const provider = req.query.provider as string;
      if (!provider) {
        return res.status(400).json({ error: "Provider query parameter is required" });
      }
      const results = await storage.getNegotiationsByProvider(provider);
      res.json(results);
    } catch (error) {
      console.error("Error fetching negotiations:", error);
      res.status(500).json({ error: "Failed to fetch negotiations" });
    }
  });

  app.get("/api/negotiations/pending", async (req, res) => {
    try {
      const provider = req.query.provider as string;
      if (!provider) {
        return res.status(400).json({ error: "Provider query parameter is required" });
      }
      const count = await storage.getPendingNegotiationCountByProvider(provider);
      res.json({ count });
    } catch (error) {
      console.error("Error fetching pending count:", error);
      res.status(500).json({ error: "Failed to fetch pending count" });
    }
  });

  app.get("/api/negotiations/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ error: "Invalid negotiation ID" });
      }
      const negotiation = await storage.getNegotiationById(id);
      if (!negotiation) {
        return res.status(404).json({ error: "Negotiation not found" });
      }
      res.json(negotiation);
    } catch (error) {
      console.error("Error fetching negotiation:", error);
      res.status(500).json({ error: "Failed to fetch negotiation" });
    }
  });

  app.patch("/api/negotiations/:id/respond", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ error: "Invalid negotiation ID" });
      }
      const validated = negotiationResponseSchema.parse(req.body);
      const existing = await storage.getNegotiationById(id);
      if (!existing) {
        return res.status(404).json({ error: "Negotiation not found" });
      }
      if (existing.status !== "pending") {
        return res.status(409).json({ error: "Negotiation already responded to" });
      }
      const updated = await storage.respondToNegotiation(id, validated.decision, validated.offer_price);
      res.json(updated);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid response data", details: error.errors });
      }
      console.error("Error responding to negotiation:", error);
      res.status(500).json({ error: "Failed to respond to negotiation" });
    }
  });

  app.patch("/api/negotiations/:id/outcome", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ error: "Invalid negotiation ID" });
      }
      const { outcome } = req.body;
      if (!outcome || !["stayed", "switched"].includes(outcome)) {
        return res.status(400).json({ error: "Outcome must be 'stayed' or 'switched'" });
      }
      const existing = await storage.getNegotiationById(id);
      if (!existing) {
        return res.status(404).json({ error: "Negotiation not found" });
      }
      const updated = await storage.updateNegotiationOutcome(id, outcome);
      res.json(updated);
    } catch (error) {
      console.error("Error updating negotiation outcome:", error);
      res.status(500).json({ error: "Failed to update negotiation outcome" });
    }
  });

  app.post("/api/live-negotiations", async (req, res) => {
    try {
      const validated = insertLiveNegotiationSchema.parse(req.body);
      const negotiation = await storage.createLiveNegotiation(validated);
      res.status(201).json(negotiation);
    } catch (error) {
      console.error("Error creating live negotiation:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Validation failed", details: error.errors });
      }
      res.status(500).json({ error: "Failed to create live negotiation" });
    }
  });

  app.get("/api/live-negotiations/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) return res.status(400).json({ error: "Invalid ID" });
      const negotiation = await storage.getLiveNegotiationById(id);
      if (!negotiation) return res.status(404).json({ error: "Not found" });
      res.json(negotiation);
    } catch (error) {
      console.error("Error fetching live negotiation:", error);
      res.status(500).json({ error: "Failed to fetch live negotiation" });
    }
  });

  app.get("/api/live-negotiations/provider/:providerName", async (req, res) => {
    try {
      const providerName = req.params.providerName;
      const negotiations = await storage.getActiveLiveNegotiationsByProvider(providerName);
      res.json(negotiations);
    } catch (error) {
      console.error("Error fetching provider live negotiations:", error);
      res.status(500).json({ error: "Failed to fetch live negotiations" });
    }
  });

  app.get("/api/live-negotiation-messages/:negotiationId", async (req, res) => {
    try {
      const negotiationId = parseInt(req.params.negotiationId);
      if (isNaN(negotiationId)) return res.status(400).json({ error: "Invalid ID" });
      const messages = await storage.getLiveNegotiationMessages(negotiationId);
      res.json(messages);
    } catch (error) {
      console.error("Error fetching live negotiation messages:", error);
      res.status(500).json({ error: "Failed to fetch messages" });
    }
  });

  const httpServer = createServer(app);

  // Initialize Socket.IO for live negotiations
  const { initializeLiveNegotiationSocket, getIO } = await import("./live-negotiation-socket");
  initializeLiveNegotiationSocket(httpServer);

  const { handleVoiceNegotiation, setSocketIOInstance } = await import("./live-negotiation-voice");
  const io = getIO();
  if (io) setSocketIOInstance(io);

  const wss = new WebSocketServer({ noServer: true });

  wss.on("connection", (ws, req) => {
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

  const voiceNegoWss = new WebSocketServer({ noServer: true });

  voiceNegoWss.on("connection", (ws, req) => {
    const url = new URL(req.url || "", `http://${req.headers.host}`);
    const negotiationId = parseInt(url.searchParams.get("negotiationId") || "0");
    const roomId = url.searchParams.get("roomId") || "";

    if (!negotiationId || !roomId) {
      console.error("[WebSocket] Voice negotiation missing params");
      ws.close(1008, "negotiationId and roomId required");
      return;
    }

    console.log(`[WebSocket] New voice negotiation: id=${negotiationId}, room=${roomId}`);
    handleVoiceNegotiation(ws, negotiationId, roomId);
  });

  httpServer.on("upgrade", (req, socket, head) => {
    const pathname = req.url ? req.url.split("?")[0] : "";
    if (pathname === "/api/voice-chat") {
      wss.handleUpgrade(req, socket, head, (ws) => {
        wss.emit("connection", ws, req);
      });
    } else if (pathname === "/api/voice-negotiation") {
      voiceNegoWss.handleUpgrade(req, socket, head, (ws) => {
        voiceNegoWss.emit("connection", ws, req);
      });
    }
  });

  return httpServer;
}
