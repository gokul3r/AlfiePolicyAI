# AutoAnnie - Insurance Policy Management App

## Overview

AutoAnnie is a mobile-first, AI-powered insurance policy management application designed to be a personal companion for users. Its core purpose is to provide a trustworthy, clear, and efficient experience for managing insurance policies through a minimalist Material Design-inspired interface. The project envisions a modern full-stack TypeScript architecture, enabling seamless interaction and comprehensive policy handling.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture

**Framework & UI**: React 18 with TypeScript and Vite. Mobile-First Design optimized for single-hand navigation. Uses shadcn/ui (New York style) built on Radix UI, styled with Tailwind CSS, following a Material Design philosophy for trust and calm interactions.

**State Management & Routing**: TanStack Query for server state management. Component-based routing with five main states: "home", "confirmation", "welcome", "onboarding", and "quotes".

**Key UI Components**:
- **`HomePage`**: Landing with user registration/login options.
- **`WelcomeScreen`**: Modern dashboard with AI chat input, animated microphone, and a 6-button responsive icon grid for features like Policy Details, Whisper, Quote Search, Add/Update/Cancel Policy.
- **`AnimatedMic`**: Pulsing microphone for voice chat.
- **`AnimatedIconButton`**: Reusable card-based action buttons with micro-animations.
- **`ScheduleQuoteDialog`**: Two-column responsive dialog for scheduling automated quote searches, includes a "Timelapse" button for feature showcase.
- **`TimelapseDialog`**: Showcase dialog for scheduled quote search feature with engaging animations.
- **`OnboardingDialog`**: Post-login modal for document upload or manual entry.
- **`UploadDialog`**: PDF upload interface with extraction integration.
- **`ManualEntryForm`**: Comprehensive vehicle policy form.
- **`WhisperDialog`**: Interface for recording and editing user insurance preferences per vehicle, with stable recommendation system.
- **`QuoteSearchDialog`**: Initiates insurance quote search with retry logic and loading indicators.
- **`QuotesScreen`**: Displays up to 10 insurance quotes.
- **`QuoteCard`**: Displays individual quotes with insurer info, ratings, and AI analysis.
- **`ChatDialog`**: Text-based AI assistant chat with message history, real-time updates, and registration-first conversational flow for adding policies and searching quotes using action markers. Includes `QuoteChatCard` for expandable quotes.
- **`VoiceChatDialog`**: Voice-based AI assistant with WebSocket audio streaming and real-time transcription.
- **`CancelPolicyDialog`**: Modal for cancelling policies, grouped by insurance type.
- **`CancelConfirmationDialog`**: Confirmation modal for policy cancellation.
- **`ComingSoonDialog`**: Reusable dialog for upcoming features.
- **`InsuranceTypeSelectorDialog`**: Bento-style grid dialog for selecting insurance type when adding a policy, with active Car insurance and placeholder inactive types.
- **`PersonalizeDialog`**: Settings for Gmail OAuth, connection status, privacy.
- **`ConfigureAutoAnnieDialog`**: Settings for Email Scan and Custom Ratings for insurance providers.

### Backend Architecture

**Server & API**: Express.js with TypeScript. RESTful API design under `/api` prefix, with Zod for validation.
**API Endpoints**:
- User and authentication (`/api/users`, `/api/users/login`).
- Vehicle policy CRUD (`/api/vehicle-policies`).
- Policy cancellation (`/api/cancel-policy`).
- Backend proxies for PDF extraction (`/api/extract-pdf`) and quote search (`/api/search-quotes`).
- Text chat (`/api/chat/send-message`).
- Registration check (`/api/chat/check-registration`) for validating vehicle registration against user's existing policies.
- Voice chat WebSocket (`/api/voice-chat`).
- Gmail OAuth integration (`/api/personalization/gmail/*`).
- Custom ratings (`/api/custom-ratings`).

### Data Storage

**Database**: PostgreSQL via Neon serverless driver. Drizzle ORM for type-safe operations.
**Database Schema**: Multi-insurance hybrid architecture with core `policies` table and type-specific detail tables.
- `users`: `email_id`, `user_name`.
- `policies`: `policy_id`, `email_id`, `policy_type`, `policy_number`, dates, costs, provider, `whisper_preferences`, `status`.
- `vehicle_policy_details`: `policy_id`, `driver_age`, `vehicle_registration_number`, `vehicle_manufacturer_name`, `vehicle_model`, `vehicle_year`, `type_of_fuel`, `type_of_cover_needed`, `no_claim_bonus_years`, `voluntary_excess`.
- Type-specific detail tables: `van_policy_details`, `home_policy_details`, `pet_policy_details`, `travel_policy_details`, `business_policy_details` (future).
- `chat_messages`: `id`, `email_id`, `role`, `content`.
- `personalizations`: `email_id`, `gmail_id`, `gmail_access_token`, `gmail_refresh_token`, `gmail_token_expiry`, `email_enabled`.
- `custom_ratings`: `email_id`, `trustpilot_data`, `defacto_ratings`, `use_custom_ratings`.

## External Dependencies

- **Neon Serverless PostgreSQL**: Database service.
- **Google OAuth 2.0 & Gmail API**: For Gmail integration (read-only email access).
- **Google Cloud Run Insurance PDF Extractor**: Serverless API for PDF data extraction.
  - **API URL**: `https://insurance-pdf-extractor-hylbdno2wa-nw.a.run.app/extract`
- **Google Cloud Run AutoSage Quote Search API**: Serverless API for insurance quote searches.
- **Radix UI**: Headless UI components.
- **Lucide React**: Icon library.
- **React Hook Form**: Form management.
- **Zod**: Runtime type validation.
- **Tailwind CSS**: Styling.
- **TypeScript**: Full-stack type safety.