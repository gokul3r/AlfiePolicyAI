# Alfie - Insurance Policy Management App

## Overview

Alfie is a mobile-first insurance policy management application designed to serve as a personal AI companion for managing insurance policies. The application emphasizes trust, clarity, and calm efficiency through a minimalist Material Design-inspired interface. Built with a modern full-stack TypeScript architecture, it features a React frontend with shadcn/ui components and an Express.js backend with PostgreSQL database integration via Drizzle ORM.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture

**Framework & Build System**
- **React 18** with TypeScript for type-safe component development
- **Vite** as the build tool and development server, configured for fast HMR and optimized production builds
- **Mobile-First Design**: Optimized for single-hand thumb navigation with responsive breakpoints

**UI Component System**
- **shadcn/ui** components (New York style variant) built on Radix UI primitives
- **Tailwind CSS** for utility-first styling with custom design tokens
- **Design Philosophy**: Material Design with minimalist refinement, emphasizing trust through simplicity and calm interactions
- **Typography**: Inter font family for excellent mobile readability
- **Spacing System**: Consistent use of Tailwind units (2, 4, 6, 8)

**State Management**
- **TanStack Query (React Query)** for server state management, API caching, and data synchronization
- React hooks for local component state
- Custom query client configured with optimized defaults (no refetch on window focus, infinite stale time)

**Routing & Navigation**
- Application uses state-based navigation with four main states: "home", "confirmation", "welcome", and "onboarding"
- Component-based routing rather than traditional URL-based routing
- State transitions: home → confirmation → welcome → onboarding → (manual entry) → welcome

**Key UI Components**
- `HomePage`: Landing page with "New User" and "Existing User" options
- `NewUserDialog`: Modal for user registration with name and email inputs using React Hook Form + Zod validation
- `ExistingUserDialog`: Modal for existing user login via email using React Hook Form + Zod validation
- `ConfirmationMessage`: Success confirmation screen with animated check icon
- `OnboardingDialog`: Post-login modal offering "Upload policy documents" or "Enter details manually" options
- `UploadDialog`: PDF upload interface with extraction integration
  - Accepts PDF files only with 6MB maximum size
  - Validates file type and size before upload
  - Displays animated progress indicator during 8-10 second extraction
  - Integrates with Google Cloud Run extraction API
  - Shows extraction status with toast notifications
  - Automatically transitions to ManualEntryForm with pre-filled data
- `ManualEntryForm`: Comprehensive vehicle policy form with React Hook Form + Zod validation
  - Pre-fills user email (disabled field)
  - Accepts optional initialValues for pre-filling extracted data from PDFs
  - Highlights missing fields with red borders (2px destructive color)
  - Validates all inputs (driver age, registration, manufacturer, model, year, fuel type, coverage type, bonus years, voluntary excess)
  - Auto-generates vehicle_id from manufacturer name + random number
  - Coverage type dropdown: Comprehensive, Third party only, Third-party fire and theft
  - Returns to welcome screen on cancel or successful submit

### Backend Architecture

**Server Framework**
- **Express.js** HTTP server with TypeScript
- **Custom middleware** for JSON parsing, request logging, and response tracking
- **Vite integration** for development with HMR middleware mode

**Request Handling**
- JSON body parsing with raw body preservation for webhook compatibility
- Request/response logging with duration tracking for API endpoints
- Error handling with Zod schema validation

**API Design**
- RESTful endpoints under `/api` prefix
- Validation using Zod schemas derived from Drizzle ORM
- Structured error responses with appropriate HTTP status codes

**API Endpoints**
- `POST /api/users`: Create new user with email uniqueness validation
- `POST /api/users/login`: Authenticate existing user by email
- `POST /api/vehicle-policies`: Create new vehicle policy with validation
- `GET /api/vehicle-policies/:email_id`: Retrieve all vehicle policies for a user

### Data Storage

**Database**
- **PostgreSQL** via Neon serverless driver with WebSocket support
- **Drizzle ORM** for type-safe database operations and migrations
- **Schema-First Design**: TypeScript schema definitions with automatic type inference

**Database Schema**
```typescript
users table:
  - email_id: text (primary key)
  - user_name: text (required)

vehicle_policies table:
  - vehicle_id: text (composite primary key with email_id)
  - email_id: text (composite primary key, foreign key to users.email_id)
  - driver_age: integer (required)
  - vehicle_registration_number: text (required)
  - vehicle_manufacturer_name: text (required)
  - vehicle_model: text (required)
  - vehicle_year: integer (required)
  - type_of_fuel: text (required)
  - type_of_cover_needed: text (required)
  - no_claim_bonus_years: integer (required)
  - voluntary_excess: real (required)
```

**Data Access Layer**
- `DbStorage` class implementing `IStorage` interface for testability
- Repository pattern separating database logic from business logic
- Type-safe queries using Drizzle's query builder

**Migration Strategy**
- Schema defined in `shared/schema.ts` for sharing between client and server
- Migrations generated in `./migrations` directory
- Push-based deployment via `drizzle-kit push` command

### External Dependencies

**Database Service**
- **Neon Serverless PostgreSQL**: Serverless PostgreSQL with WebSocket connections for edge deployment
- Connection managed via environment variable `DATABASE_URL`
- Connection pooling via `@neondatabase/serverless` Pool

**Document Extraction Service**
- **Google Cloud Run Insurance PDF Extractor**: Serverless API for extracting vehicle policy data from PDF documents
- Endpoint: `https://insurance-pdf-extractor-657860957693.europe-west2.run.app/extract`
- Request: Multipart form data with PDF file (max 6MB)
- Response: JSON with extracted_fields, not_extracted_fields, status, and message
- Processing time: 8-10 seconds average
- No authentication required (public endpoint)

**UI Component Libraries**
- **Radix UI**: Headless, accessible component primitives (accordion, dialog, dropdown, toast, etc.)
- **Lucide React**: Icon library for consistent iconography (Shield, CheckCircle, Mail, User icons)
- **cmdk**: Command palette component for potential future features
- **embla-carousel-react**: Carousel component for potential future features
- **react-day-picker**: Date picker for potential insurance date management

**Form Management**
- **React Hook Form**: Form state management and validation
- **@hookform/resolvers**: Integration with Zod for schema-based validation
- **Zod**: Runtime type validation and schema generation

**Styling & Design**
- **Tailwind CSS**: Utility-first CSS framework with custom configuration
- **tailwindcss-animate**: Animation utilities for smooth transitions
- **class-variance-authority**: Type-safe variant styling system
- **clsx** & **tailwind-merge**: Utility for conditional class merging

**Development Tools**
- **TypeScript**: Full-stack type safety with strict mode enabled
- **esbuild**: Fast bundler for server-side code
- **tsx**: TypeScript execution for development
- **Replit Plugins**: Development banners, error overlays, and cartographer for Replit environment

**Build Configuration**
- Monorepo structure with shared types between client and server
- Path aliases: `@/` for client, `@shared/` for shared code, `@assets/` for static assets
- Separate build outputs: `dist/public` for client, `dist` for server
- ESM module system throughout the stack