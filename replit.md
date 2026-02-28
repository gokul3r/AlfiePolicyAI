# AutoAnnie - Insurance Policy Management App

## Overview
AutoAnnie is a mobile-first insurance policy management application designed as a personal AI companion. It aims to provide a trustworthy, clear, and efficient experience for managing insurance policies through a minimalist Material Design-inspired interface. The application is built with a modern full-stack TypeScript architecture, utilizing a React frontend with shadcn/ui and an Express.js backend with PostgreSQL via Drizzle ORM. The project's vision is to offer a seamless, AI-powered solution for insurance management, improving user understanding and control over their policies.

## User Preferences
Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
The frontend uses React 18 with TypeScript and Vite, featuring a mobile-first design optimized for single-hand navigation. It leverages shadcn/ui components (New York style) built on Radix UI, styled with Tailwind CSS, following a Material Design philosophy. TanStack Query manages server state. Core UI components include:
-   **`PasswordGatePage`**: Access control with AutoAnnie branding and AI-themed visuals.
-   **`WelcomeScreen`**: Dashboard with AI chat input and a 6-button icon grid for core functionalities.
-   **`WhisperDialog`**: Interface for recording and editing user insurance preferences.
-   **`QuoteSearchDialog`**: Initiates insurance quote searches.
-   **`QuotesScreen`**: Displays up to 10 insurance quotes with insurer info, ratings, and AI analysis.
-   **`ChatDialog`**: Text-based AI assistant with message history and LLM-based intent detection (OpenAI GPT-4o-mini) for quote searches and policy purchases, including a realistic payment UI.
-   **`PaymentSection`**: Inline payment checkout UI for purchase confirmation.
-   **`VoiceChatDialog`**: Voice-based AI assistant using Web Speech API for STT, browser speechSynthesis for TTS, and Gemini 2.0 Flash text API with function calling for agent behavior. It supports a two-stage purchase flow with tools for vehicle fetching, quote searching, selection, payment display, and purchase completion.
-   **`CancelPolicyDialog`**: Allows policy cancellations.
-   **`InsuranceTypeSelectorDialog`**: Bento-style grid for selecting insurance type.
-   **`ConfigureAutoAnnieDialog`**: Settings for Email Scan and Custom Ratings.
-   **Policy Charting**: Interactive price chart showing "Your Price", "Market Avg", and "Feature-Matched" prices over time, with color-coded dots indicating status (purchased, matched, market) and tooltips. It calculates "Annual Savings" based on a comprehensive 12-month cost comparison.

### Backend Architecture
The backend uses Express.js with TypeScript for a RESTful API (`/api`). It includes middleware for JSON parsing, logging, error handling, and Zod for validation. Key API endpoints manage:
-   User authentication and management.
-   CRUD operations for vehicle policies, including cancellation and purchase.
-   Proxies for PDF extraction and quote searches.

### ChatGPT Custom GPT Integration (Iteration 10)
A dedicated, session-less API surface for use as a ChatGPT Custom GPT Action:
-   **`POST /api/gpt/search-quotes`** — API-key protected endpoint. Accepts flat vehicle/driver details (registration, driver_age, no_claims_bonus, etc.), transforms them into the nested `insurance_details` structure required by the Cloud Run quote API, and returns a clean top-5 quote summary.
-   **`GET /api/gpt/openapi.json`** — Serves the OpenAPI 3.1 schema document. Paste this into ChatGPT Custom GPT → Actions to configure the integration.
-   **Authentication**: `X-API-Key` header. Key is stored in `GPT_API_KEY` environment variable. CORS is enabled for `https://chatgpt.com` and `https://chat.openai.com`.
-   **Setup Steps**: (1) Deploy the app, (2) Create Custom GPT on chatgpt.com, (3) Paste the OpenAPI schema URL into Actions, (4) Enter the `GPT_API_KEY` value as the API key in ChatGPT's Action auth settings.
-   AI chat and voice chat interactions.
-   Gmail OAuth integration.
-   Custom ratings management.
-   **Negotiator Agent** (`server/negotiator-agent.ts`): AI-powered negotiation agent using Gemini 2.5 Flash. When AutoAnnie finds a cheaper quote and the customer wants to switch, it contacts the current insurer's negotiation agent (POST `/api/negotiate`) with the new and current provider renewal costs. The agent decides "matched" (if current provider is cheaper or within 2% of the new quote) or "rejected". Has a deterministic fallback if the AI is unavailable. Policy duration validation enforces max 365 days with totalDays clamped in the financial calculator.
-   **NegotiationScreen** (`TimelapseDialog.tsx`): Animated chatbot UI that shows the negotiation between AutoAnnie and the current insurer's agent. Supports two negotiation modes selectable via radio buttons in the Schedule Quote Search dialog: **AI Agent** (default, uses Gemini-powered negotiator) and **Human Customer Agent** (creates a server-side negotiation record via POST `/api/negotiations` and polls for the provider agent's response every 2.5 seconds). After negotiation completes (AI mode), presents Stay/Switch buttons. **Stay flow**: Updates the policy in the DB with the current provider's latest renewal cost via `/api/purchase-policy`, shows a styled confirmation card in the chat with the yearly premium, then "Done" transitions to the "You're covered!" celebration screen with the current provider name and message "Auto-Annie has kept your insurance policy", offering "Continue Timelapse" (resumes search) and "Close" (returns home). **Switch flow**: Triggers the existing `handleConfirmPurchase` purchase flow (contacts new provider, buys policy, cancels old policy, updates DB).
-   **Provider Customer Agent App** (`client/src/pages/CustomerAgentPage.tsx`): A separate app at `/customer_agent` designed to be opened on a different browser/device by the insurance provider's customer support agent. Features: (1) Email-based login where provider is extracted from email domain (e.g., `customer_agent@admiral.com` → "Admiral Insurance Customer Support"), (2) Dynamic branding with provider-specific color schemes, (3) Home screen with two navigation segments: "Retention Requests" and "Dashboard", (4) Retention Requests view with 4 stat cards (Pending/Matched/Partially Matched/Declined) — table is hidden by default and only appears when a stat card is clicked (clicking again hides it), with inline detail panel and Match/Partial/Unable action buttons, (5) Dashboard view with two metric sections: **Retention Outcomes** (Customers Retained / Customers Lost counts) and **Financial Impact** (Margin Conceded = sum of original_cost - offer_price for responded negotiations; Revenue Lost = sum of original_cost for switched customers), (6) Notification bell with badge count for pending requests. Uses polling (3s for retention, 5s for dashboard). The negotiations table includes `original_policy_cost` and `customer_outcome` ("stayed"/"switched"). API endpoints include PATCH `/api/negotiations/:id/outcome`.

-   **Live Agent Negotiation** (Iteration 9): A real-time live chat mode where AutoAnnie (Gemini-powered AI) negotiates with a human insurance provider agent via Socket.IO WebSockets. Flow: Match Found → "Negotiate?" prompt (Yes/No) → tolerance input → AutoAnnie opens live chat room → agent joins from Provider Portal → real-time AI negotiation → outcome detection → customer Stay/Switch decision.
    -   **`server/live-negotiation-socket.ts`**: Socket.IO server setup with room-based chat. Events: `join_negotiation`, `agent_message`, `agent_joined`, `new_message`, `autoannie_typing`, `negotiation_outcome`, `customer_decision`, `negotiation_closed`. Handles message persistence, AI response generation, and outcome emission.
    -   **`server/live-negotiation-agent.ts`**: Gemini 2.5 Flash-powered negotiation AI. Dynamic system prompt populated with customer/vehicle/policy/competitor details. Uses `[OUTCOME:CONSIDERING:£X]` tag for outcome detection — AutoAnnie NEVER accepts or rejects directly; it always pauses to consult the customer first. After the customer clicks Stay/Switch, the `customer_decision` socket handler sends the final acceptance/rejection message to the agent. Determines outcome category by price: matched (≤ competitor quote), partially_matched (≤ tolerance max), or rejected (> tolerance max).
    -   **`TimelapseDialog.tsx`** additions: `NegotiatePromptState` (Yes/No + tolerance input + Text/Voice toggle), `LiveNegotiationChat` (real-time text chat viewer with stay/switch decision buttons), `LiveNegotiationVoice` (voice mode transcript viewer — customer sees live transcript only, no audio; same stay/switch cost comparison card).
    -   **`CustomerAgentPage.tsx`** additions: "Live Chat" navigation card on home screen with active count badge, `LiveChatView` (list of active negotiations with mode indicator), `AgentChatRoom` (real-time text chat with message input), `VoiceAgentChatRoom` (voice call UI with mic capture, audio playback, and live transcript).
    -   **`server/live-negotiation-voice.ts`**: Gemini Live API voice handler. Model: `gemini-2.5-flash-native-audio-preview-12-2025`, voice: Aoede. Agent mic audio → WebSocket → Gemini Live session → audio response back to agent. Broadcasts transcripts via Socket.IO `voice_transcript` events to customer room. Detects `[OUTCOME:CONSIDERING:£X]` tags in transcripts. Customer decisions bridged via `voiceDecisionEmitter` (EventEmitter) from Socket.IO handler.
    -   **DB Tables**: `live_negotiations` (id, provider_name, customer_name, customer_email, policy_number, current_premium, competitor_name, competitor_quote, tolerance_amount, vehicle details, mode [text/voice], status [pending/active/awaiting_customer/completed], outcome, final_offer_price, socket_room_id, created_at), `live_negotiation_messages` (id, negotiation_id, sender [autoannie/agent], message, created_at).
    -   **Socket.IO**: Server on path `/socket.io`, client uses `socket.io-client`. Room ID format: `live-nego-{timestamp}-{random}`.
    -   **Negotiation Mode**: `ScheduleQuoteDialog.tsx` has three radio options: AI Agent (default), Human Customer Agent, Live Agent. The `live_agent` mode triggers the live chat flow; `ai` and `human` modes remain unchanged.

### Data Storage
PostgreSQL is used via Neon serverless driver. Drizzle ORM provides type-safe database operations and migrations. The database schema includes tables for users, policies (with specific details for vehicle policies), chat messages, personalizations, custom ratings, quote history, negotiations (for cross-app provider agent communication), live_negotiations, and live_negotiation_messages (for real-time Socket.IO chat).

## External Dependencies

-   **Neon Serverless PostgreSQL**: Database service.
-   **Google OAuth 2.0 & Gmail API**: For Gmail integration.
-   **Google Cloud Run Insurance PDF Extractor**: For extracting policy data from PDFs.
-   **Google Cloud Run AutoSage Quote Search API**: For insurance quote searches.
-   **Radix UI**: Headless UI components.
-   **Lucide React**: Icon library.
-   **React Hook Form**: Form state and validation.
-   **Zod**: Runtime type validation.
-   **Tailwind CSS**: Utility-first styling.
-   **TypeScript**: For full-stack type safety.
-   **Socket.IO**: Real-time bidirectional communication for live negotiation chat (server: `socket.io`, client: `socket.io-client`).