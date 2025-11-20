# AutoSage - Insurance Policy Management App

## Overview

AutoSage is a mobile-first insurance policy management application designed as a personal AI companion. It aims to provide a trustworthy, clear, and efficient experience for managing insurance policies through a minimalist Material Design-inspired interface. The application is built with a modern full-stack TypeScript architecture, utilizing a React frontend with shadcn/ui and an Express.js backend with PostgreSQL via Drizzle ORM.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture

**Framework & UI**
- **React 18** with TypeScript, using **Vite** for building.
- **Mobile-First Design** optimized for single-hand navigation.
- **shadcn/ui** components (New York style variant) built on Radix UI, styled with **Tailwind CSS**.
- **Design Philosophy**: Material Design with minimalist refinement, emphasizing trust and calm interactions.

**State Management & Routing**
- **TanStack Query** for server state management, caching, and data synchronization.
- Component-based routing with five main states: "home", "confirmation", "welcome", "onboarding", and "quotes".

**Key UI Components**
- **`HomePage`**: Landing with "New User" and "Existing User" options.
- **`NewUserDialog` / `ExistingUserDialog`**: Modals for user registration/login.
- **`WelcomeScreen`**: Modern dashboard featuring AutoSage logo, time-based greeting, prominent AI chat input with integrated animated microphone, and 6-button responsive icon grid (2x3 on mobile, 3x2 on desktop). Grid contains: Policy Details (FileText), Whisper (Volume2), Quote Search (SearchCheck), Add Policy (Plus+Umbrella icons), Update Policy (FileEdit), and Cancel Policy (XCircle). Update Policy and Cancel Policy are placeholder buttons that show professional "coming soon" dialogs. Hamburger menu provides access to Schedule Quote Search, Personalize, and Email Notifications. All elements feature entrance stagger animations and micro-interactions.
- **`AnimatedMic`**: Pulsing microphone button integrated into chat input box, directly opens VoiceChatDialog when clicked, prevents form submission via proper event handling.
- **`AnimatedIconButton`**: Reusable card-based action button with primary/secondary icons, label, uniform accent color, and micro-animations (entrance stagger, hover scale 1.02, tap scale 0.98).
- **`ScheduleQuoteDialog`**: Two-column responsive dialog (stacks on mobile) for scheduling automated quote searches. Features vehicle selector dropdown (left), monthly/weekly frequency toggle (right), and calculated next search date preview. State management resets on open/close and syncs with parent props. Currently stores preferences locally (backend integration pending).
- **`OnboardingDialog`**: Post-login modal for document upload or manual entry.
- **`UploadDialog`**: PDF upload interface with extraction integration (6MB max, 8-10 sec processing).
- **`ManualEntryForm`**: Comprehensive vehicle policy form supporting create/edit, pre-filling, and validation.
- **`WhisperDialog`**: Interface for recording and editing user insurance preferences per vehicle. Features stable recommendation system that displays 3 locked insurance feature buttons (from: legal cover, windshield cover, courtesy car, breakdown cover, personal accident cover, european cover, no claim bonus protection) calculated once when vehicle is selected. Recommendations show features NOT already in saved preferences. Buttons toggle between gray outline (unselected) and blue (selected) states via clicks only, automatically adding/removing "* feature" lines in the textarea. Manual typing does not affect button state - users can freely type additional preferences that won't get buttons. All touch targets meet 44px minimum for mobile accessibility.
- **`QuoteSearchDialog`**: Initiates insurance quote search for a selected vehicle, with retry logic and loading indicators. Fetches custom ratings if enabled and includes them in quote search request.
- **`QuotesScreen`**: Displays up to 10 insurance quotes for a selected vehicle, with a sticky header.
- **`QuoteCard`**: Displays individual quotes with insurer info, Trustpilot rating, features matching, AutoSage Score, and AI analysis.
- **`ChatDialog`**: Text-based AI assistant chat interface with message history persistence and real-time updates using OpenAI Responses API.
- **`VoiceChatDialog`**: Voice-based AI assistant with WebSocket audio streaming, real-time transcription display, mic toggle, and comprehensive error handling for microphone permissions (shows user-friendly error messages with retry/cancel options for permission denied, no microphone, or device in use scenarios).
- **`ComingSoonDialog`**: Reusable professional dialog for upcoming features. Displays Sparkles icon, "Coming Soon" heading, and feature-specific message. Used for Update Policy and Cancel Policy placeholder buttons.
- **`PersonalizeDialog`**: Settings dialog for Gmail OAuth integration, connection status, privacy consent, and disconnect option.
- **`ConfigureAutoSageDialog`**: Settings dialog with Email Scan and Custom Ratings sections. Email Scan allows manual Gmail scanning for travel notifications. Custom Ratings section allows users to customize Trustpilot and Defacto ratings for 10 insurance providers (Admiral, PAXA, Baviva, IndirectLane, Churchwell, Ventura, Zorich, HestingsDrive, Assureon, Soga). Ratings must be numeric values between 0-5.0 (validated on both client and server). Toggle switch enables/disables custom ratings usage in quote searches.

### Backend Architecture

**Server & API**
- **Express.js** with TypeScript for HTTP server, including custom middleware for JSON parsing, logging, and error handling.
- **RESTful API** design under `/api` prefix, with validation using **Zod** schemas.

**API Endpoints**
- User and authentication management (`/api/users`, `/api/users/login`).
- Vehicle policy CRUD operations (`/api/vehicle-policies`).
- Backend proxy endpoints for PDF extraction (`/api/extract-pdf`) and quote search (`/api/search-quotes`).
- Text chat endpoint using OpenAI Responses API (`/api/chat/send-message`).
- Voice chat WebSocket endpoint using OpenAI Realtime API (`/api/voice-chat`).
- Gmail OAuth integration endpoints (`/api/personalization/gmail/authorize`, `/api/personalization/gmail/callback`, `/api/personalization/gmail/disconnect`, `/api/personalization/gmail/status`).
- Custom ratings endpoints (`/api/custom-ratings` for POST, `/api/custom-ratings/:email` for GET) for saving and retrieving user-customized insurance provider ratings.

### Data Storage

**Database**
- **PostgreSQL** via **Neon serverless driver** with WebSocket support.
- **Drizzle ORM** for type-safe database operations and migrations.
- **Schema-First Design** with shared TypeScript schemas.

**Database Schema**
- `users` table: `email_id` (PK), `user_name`.
- `vehicle_policies` table: `vehicle_id` (composite PK), `email_id` (composite PK, FK), `driver_age`, `vehicle_registration_number`, `vehicle_manufacturer_name`, `vehicle_model`, `vehicle_year`, `type_of_fuel`, `type_of_cover_needed`, `no_claim_bonus_years`, `voluntary_excess`, `whisper_preferences` (nullable).
- `chat_messages` table: `id` (serial PK), `email_id` (FK to users), `role` ('user' or 'assistant'), `content`, `created_at` (timestamp, default now()).
- `personalizations` table: `email_id` (PK, FK to users), `gmail_id` (connected Gmail email), `gmail_access_token`, `gmail_refresh_token`, `gmail_token_expiry`, `email_enabled` (boolean), `created_at`, `updated_at`.
- `custom_ratings` table: `email_id` (PK, FK to users), `trustpilot_data` (JSONB), `defacto_ratings` (JSONB), `use_custom_ratings` (boolean), `created_at`, `updated_at`.

## External Dependencies

**Database Service**
- **Neon Serverless PostgreSQL**: Serverless database for persistent data storage.

**Gmail Integration (Phase 1)**
- **Google OAuth 2.0**: OAuth authentication for Gmail access.
- **Gmail API**: Read-only email access for scanning insurance policy notifications.
- **Google Cloud Console**: OAuth credentials and API management.

**Document Extraction Service**
- **Google Cloud Run Insurance PDF Extractor**: Serverless API for extracting policy data from PDFs.

**Insurance Quote Search Service**
- **Google Cloud Run AutoSage Quote Search API**: Serverless API for finding insurance quotes based on vehicle and user preferences.

**UI Component Libraries**
- **Radix UI**: Headless components for accessibility.
- **Lucide React**: Icon library.

**Form Management**
- **React Hook Form**: Form state and validation.
- **Zod**: Runtime type validation and schema generation.

**Styling & Design**
- **Tailwind CSS**: Utility-first styling.

**Development Tools**
- **TypeScript**: Full-stack type safety.