# Design Guidelines for AutoAnnie - Insurance Policy Management App

## Design Approach
**Selected Approach:** Material Design System with minimalist refinement  
**Rationale:** Insurance apps require trust, clarity, and calm efficiency. Material Design's structured patterns combined with generous whitespace and soft interactions create a reassuring, professional experience perfect for financial/insurance contexts.

**Key Design Principles:**
- Minimalist clarity: Remove visual noise, prioritize essential information
- Trust through simplicity: Clean layouts inspire confidence in financial management
- Calm interactions: Gentle animations, soothing confirmations, no aggressive visuals
- Mobile-first: Optimized for single-hand thumb navigation

---

## Core Design Elements

### A. Typography
**Font Family:** Inter (via Google Fonts CDN) - excellent mobile readability  
**Hierarchy:**
- App Title "AutoAnnie": text-4xl font-bold (brand presence)
- Section Headers: text-xl font-semibold
- Button Text: text-base font-medium
- Body/Form Labels: text-sm font-normal
- Confirmation Messages: text-base font-medium
- Helper Text: text-xs

### B. Layout System
**Spacing Primitives:** Use Tailwind units of **2, 4, 6, and 8** consistently
- Container padding: p-6 (mobile), p-8 (tablet+)
- Section gaps: space-y-8
- Form field spacing: space-y-4
- Button spacing: gap-4 between buttons
- Dialog padding: p-6

**Viewport Structure:**
- Mobile-first: max-width container (max-w-md mx-auto)
- Centered vertical layout with top-aligned branding
- Safe area consideration: pt-8 for status bar clearance

---

## C. Component Library

### 1. Branding Header
**Structure:**
- Full-width container with centered content
- "AutoAnnie" wordmark with AI assistant icon element
- Tagline beneath: "Your Insurance Companion" (text-sm)
- Spacing: mb-12 to create breathing room

### 2. Primary Action Buttons
**"New User" and "Existing User" buttons:**
- Full-width buttons (w-full) stacked vertically
- Height: py-4 for easy thumb targets
- Rounded corners: rounded-xl for friendly feel
- Icon integration: User icon (Heroicons) aligned left
- Text: centered, font-medium
- Spacing between: gap-4
- Elevation: Use subtle shadow (shadow-md) on default, shadow-lg on hover

### 3. Dialog/Modal (New User Registration)
**Structure:**
- Centered overlay with backdrop blur
- Card design: rounded-2xl with shadow-2xl
- Width: max-w-sm on mobile
- Header: "Create Your Account" with close button (X icon)
- Form spacing: space-y-6

**Form Inputs:**
- Label above input: text-sm font-medium mb-2
- Input fields: h-12, rounded-lg, border-2
- Placeholder text with muted styling
- Focus states: Enhanced border, subtle scale
- Submit button: Full-width, py-3, "Create Account" text

### 4. Email Input Screen (Existing User)
**Structure:**
- Single input field prominently centered
- Heading: "Welcome Back" (text-2xl font-bold)
- Subtext: "Enter your email to continue" (text-sm)
- Input: Large, prominent (h-14), rounded-xl
- Submit: "Continue" button, full-width, py-4

### 5. Confirmation Messages
**Success State:**
- Centered card with checkmark icon (Heroicons check-circle)
- Primary message: "User ID Created" or "Welcome - [Name]"
- Soft animation: Gentle fade-in with slight scale (scale-95 to scale-100)
- Auto-dismiss indicator or "Continue" button
- Spacing: p-8 around content

### 6. Navigation Elements
- Back button (arrow-left icon) for nested flows
- Minimal top navigation: Only essentials
- Bottom safe area padding on mobile (pb-8)

---

## D. Interaction Patterns

**Button States:**
- Default: Solid with shadow
- Hover: Slight lift (translate-y effect), enhanced shadow
- Active: Pressed state (scale-98)
- Loading: Spinner icon, disabled state

**Form Validation:**
- Inline error messages below inputs (text-xs, red indicator)
- Success checkmarks for valid inputs
- Real-time validation on blur

**Modal Transitions:**
- Fade + scale animation for dialogs
- Backdrop blur for focus
- Smooth dismiss on overlay click or close button

**Confirmation Animations:**
- Success: Gentle bounce effect on checkmark icon
- Message: Fade in over 400ms
- Auto-progress indicator if applicable

---

## E. Mobile Optimization

**Touch Targets:**
- Minimum 44px height for all interactive elements
- Generous padding around buttons (py-4 minimum)
- Adequate spacing between touch targets (gap-4+)

**Scrolling Behavior:**
- Smooth scroll for any overflow content
- Pull-to-refresh consideration for future features
- Bottom spacing for keyboard avoidance

**Responsive Breakpoints:**
- Mobile (default): max-w-md container
- Tablet (md:): max-w-lg with adjusted padding
- Desktop: Maintain mobile-optimized max-width for consistency

---

## Icon Library
**Selected:** Heroicons (via CDN) - minimal, professional, insurance-appropriate icons
- User/person icons for account actions
- Shield icon for security/insurance branding
- Check-circle for confirmations
- Envelope for email inputs
- Arrow icons for navigation

---

## Images
**No hero images required.** This is a utility app focused on forms and interactions. Maintain clean, uncluttered interface prioritizing functionality over decorative imagery. Brand identity conveyed through typography and icon system.