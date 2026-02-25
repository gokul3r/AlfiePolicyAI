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
-   AI chat and voice chat interactions.
-   Gmail OAuth integration.
-   Custom ratings management.
-   **Negotiator Agent** (`server/negotiator-agent.ts`): AI-powered negotiation agent using Gemini 2.5 Flash. When AutoAnnie finds a cheaper quote and the customer wants to switch, it contacts the current insurer's negotiation agent (POST `/api/negotiate`) with the new and current provider renewal costs. The agent decides "matched" (if current provider is cheaper or within 2% of the new quote) or "rejected". Has a deterministic fallback if the AI is unavailable. Policy duration validation enforces max 365 days with totalDays clamped in the financial calculator.
-   **NegotiationScreen** (`TimelapseDialog.tsx`): Animated chatbot UI that shows the negotiation between AutoAnnie and the current insurer's agent. Supports two negotiation modes selectable via radio buttons in the Schedule Quote Search dialog: **AI Agent** (default, uses Gemini-powered negotiator) and **Human Customer Agent** (creates a server-side negotiation record via POST `/api/negotiations` and polls for the provider agent's response every 2.5 seconds). After negotiation completes (AI mode), presents Stay/Switch buttons. **Stay flow**: Updates the policy in the DB with the current provider's latest renewal cost via `/api/purchase-policy`, shows a styled confirmation card in the chat with the yearly premium, then "Done" transitions to the "You're covered!" celebration screen with the current provider name and message "Auto-Annie has kept your insurance policy", offering "Continue Timelapse" (resumes search) and "Close" (returns home). **Switch flow**: Triggers the existing `handleConfirmPurchase` purchase flow (contacts new provider, buys policy, cancels old policy, updates DB).
-   **Provider Customer Agent App** (`client/src/pages/CustomerAgentPage.tsx`): A separate app at `/customer_agent` designed to be opened on a different browser/device by the insurance provider's customer support agent. Features: (1) Email-based login where provider is extracted from email domain (e.g., `customer_agent@admiral.com` → "Admiral Insurance Customer Support"), (2) Dynamic branding with provider-specific color schemes, (3) Home screen with two navigation segments: "Retention Requests" and "Dashboard", (4) Retention Requests view with 4 stat cards (Pending/Matched/Partially Matched/Declined) — table is hidden by default and only appears when a stat card is clicked (clicking again hides it), with inline detail panel and Match/Partial/Unable action buttons, (5) Dashboard view with two metric sections: **Retention Outcomes** (Customers Retained / Customers Lost counts) and **Financial Impact** (Margin Conceded = sum of original_cost - offer_price for responded negotiations; Revenue Lost = sum of original_cost for switched customers), (6) Notification bell with badge count for pending requests. Uses polling (3s for retention, 5s for dashboard). The negotiations table includes `original_policy_cost` and `customer_outcome` ("stayed"/"switched"). API endpoints include PATCH `/api/negotiations/:id/outcome`.

### Data Storage
PostgreSQL is used via Neon serverless driver. Drizzle ORM provides type-safe database operations and migrations. The database schema includes tables for users, policies (with specific details for vehicle policies), chat messages, personalizations, custom ratings, quote history, and negotiations (for cross-app provider agent communication).

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