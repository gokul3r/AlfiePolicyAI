# AutoAnnie - Key Files by Flow

This document provides a summary of the key files organized by the main application flows.

---

## 1. Access & Authentication Flow

| File | Purpose |
|------|---------|
| `client/src/components/PasswordGatePage.tsx` | Access gate - validates key "AA@ITCTO" before app access |
| `client/src/components/HomePage.tsx` | Login page - presents "New User" / "Existing User" choice |
| `client/src/components/NewUserDialog.tsx` | Registration form - collects username and email |
| `client/src/components/ExistingUserDialog.tsx` | Login form - validates existing user email |
| `server/routes.ts` | Backend endpoints: `/api/users` (create), `/api/users/login` |
| `shared/schema.ts` | User database schema and validation |

---

## 2. AI Chat Flow (Text)

| File | Purpose |
|------|---------|
| `client/src/components/ChatDialog.tsx` | Chat UI - message input, history, quote cards display |
| `server/routes.ts` | Endpoint: `/api/chat/send-message` |
| `server/openai-realtime.ts` | OpenAI API integration for chat responses |
| `server/intent-classifier.ts` | LLM-based intent detection (QUOTE/POLICY/GENERAL) |

---

## 3. Voice Chat Flow

| File | Purpose |
|------|---------|
| `client/src/components/VoiceChatDialog.tsx` | Voice UI - recording, playback, WebSocket connection |
| `server/voice-chat-handler.ts` | WebSocket orchestration - manages entire voice flow |
| `server/voice-intent-detector.ts` | Voice intent classification (quote_search, insurer_selection, etc.) |

---

## 4. Quote Search & Purchase Flow

| File | Purpose |
|------|---------|
| `client/src/components/QuoteSearchDialog.tsx` | Quote search UI - vehicle selection, search trigger |
| `client/src/components/QuotesScreen.tsx` | Displays quotes list, handles purchase flow |
| `client/src/components/QuoteCard.tsx` | Individual quote card with ratings, features, pricing |
| `client/src/components/PurchasePolicyDialog.tsx` | Purchase confirmation dialog |
| `server/routes.ts` | Endpoints: `/api/search-quotes`, `/api/purchase-policy` |

---

## 5. Policy Management Flow

| File | Purpose |
|------|---------|
| `client/src/components/WelcomeScreen.tsx` | Dashboard - displays policies, action buttons |
| `client/src/components/ManualEntryForm.tsx` | Add/edit policy form |
| `client/src/components/CancelPolicyDialog.tsx` | Policy cancellation UI |
| `server/routes.ts` | Endpoints: `/api/vehicle-policies` (CRUD), `/api/cancel-policy` |
| `server/storage.ts` | Database operations for policies |
| `shared/schema.ts` | Policy schema definitions |

---

## 6. Scheduled Quote Search (Timelapse)

| File | Purpose |
|------|---------|
| `client/src/components/ScheduleQuoteDialog.tsx` | Schedule settings UI - frequency, savings threshold |
| `client/src/components/TimelapseDialog.tsx` | Animated timelapse simulation of scheduled searches |
| `server/routes.ts` | Endpoint: `/api/timelapse-search` |

---

## Reference

For a complete project overview including architecture, external dependencies, and design philosophy, see **`replit.md`**.
