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

### Data Storage
PostgreSQL is used via Neon serverless driver. Drizzle ORM provides type-safe database operations and migrations. The database schema includes tables for users, policies (with specific details for vehicle policies), chat messages, personalizations, and custom ratings.

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