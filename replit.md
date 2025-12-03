# AutoAnnie - Insurance Policy Management App

## Overview
AutoAnnie is a mobile-first insurance policy management application designed as a personal AI companion. It aims to provide a trustworthy, clear, and efficient experience for managing insurance policies through a minimalist Material Design-inspired interface. The application is built with a modern full-stack TypeScript architecture, utilizing a React frontend with shadcn/ui and an Express.js backend with PostgreSQL via Drizzle ORM. The project's vision is to offer a seamless, AI-powered solution for insurance management, improving user understanding and control over their policies.

## User Preferences
Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
The frontend is built with **React 18** and TypeScript, using **Vite** for building. It features a **mobile-first design** optimized for single-hand navigation, utilizing **shadcn/ui** components (New York style) built on Radix UI, styled with **Tailwind CSS**. The design philosophy emphasizes Material Design with minimalist refinement for trust and calm interactions. **TanStack Query** manages server state, caching, and data synchronization. Component-based routing handles five main states: "home", "confirmation", "welcome", "onboarding", and "quotes".

Key UI components include:
- **`WelcomeScreen`**: Modern dashboard with AI chat input, animated microphone, and a 6-button responsive icon grid for core functionalities (Policy Details, Whisper, Quote Search, Add Policy, Update Policy, Cancel Policy).
- **`WhisperDialog`**: Interface for recording and editing user insurance preferences with stable recommendation system.
- **`QuoteSearchDialog`**: Initiates insurance quote searches with retry logic and loading indicators.
- **`QuotesScreen`**: Displays up to 10 insurance quotes with insurer info, Trustpilot rating, AutoAnnie Score, and AI analysis.
- **`ChatDialog`**: Text-based AI assistant with message history, real-time updates, and intent detection for quote searches and policy purchases. **Real Purchase Flow with Payment UI**: When user says "Go with [insurer]", shows PaymentSection component with GPay, orange card (•••• 9878), payment icons, and terms. User confirms with natural language ("proceed", "go on", "pay", etc.). Animated status flow: "Processing payment..." (2 sec) → "Verifying details..." → "Contacting [Insurer]..." → success. Real database update via `POST /api/purchase-policy`.
- **`PaymentSection`**: Inline payment checkout UI shown during purchase confirmation. Displays total cost, GPay logo with orange card (•••• 9878), Visa/Mastercard/PayPal icons, and terms text. Creates realistic checkout experience.
- **`VoiceChatDialog`**: Voice-based AI assistant with WebSocket audio streaming and real-time transcription. Uses manual response triggering (`create_response: false`) to process intents before OpenAI responds. Supports position-based selection ("first one", "cheapest") alongside insurer names.
- **`CancelPolicyDialog`**: Allows cancellation of policies grouped by insurance type.
- **`InsuranceTypeSelectorDialog`**: Bento-style grid for selecting insurance type when adding a policy, with active 'Car' and inactive placeholders for 'Van', 'Home', 'Pet', 'Travel', 'Business'.
- **`ConfigureAutoAnnieDialog`**: Settings for Email Scan and Custom Ratings, allowing users to customize Trustpilot and Defacto ratings for specific providers.

### Backend Architecture
The backend uses **Express.js** with TypeScript for a RESTful API under the `/api` prefix. It includes custom middleware for JSON parsing, logging, and error handling, with validation using **Zod** schemas.

Key API endpoints include:
- User authentication and management.
- CRUD operations for vehicle policies.
- Policy cancellation (`/api/cancel-policy`) and purchase (`/api/purchase-policy`).
- Backend proxies for PDF extraction (`/api/extract-pdf`) and quote search (`/api/search-quotes`).
- AI chat (`/api/chat/send-message`) and voice chat (`/api/voice-chat`) endpoints.
- Gmail OAuth integration endpoints.
- Custom ratings endpoints for saving and retrieving user-defined provider ratings.

### Data Storage
**PostgreSQL** is used via **Neon serverless driver** for persistent data storage. **Drizzle ORM** provides type-safe database operations and migrations with a schema-first design.

Database Schema includes:
- `users`: User information.
- `policies`: Core policy details, linked to `users`.
- `vehicle_policy_details`: Specific details for vehicle policies.
- Placeholder tables for other policy types (van, home, pet, travel, business).
- `chat_messages`: Stores chat history.
- `personalizations`: Gmail integration details.
- `custom_ratings`: User-defined insurance provider ratings.

## External Dependencies

- **Neon Serverless PostgreSQL**: Database service.
- **Google OAuth 2.0 & Gmail API**: For Gmail integration (read-only email access).
- **Google Cloud Run Insurance PDF Extractor**: Serverless API for extracting policy data from PDFs.
- **Google Cloud Run AutoSage Quote Search API**: Serverless API for insurance quote searches.
- **Radix UI**: Headless UI components.
- **Lucide React**: Icon library.
- **React Hook Form**: Form state and validation.
- **Zod**: Runtime type validation.
- **Tailwind CSS**: Utility-first styling.
- **TypeScript**: For full-stack type safety.