# Gmail Integration Setup Guide

This guide walks you through setting up Gmail OAuth integration for AutoSage to scan user emails for insurance policy documents.

## Overview

The Gmail integration allows AutoSage to:
- Scan user emails for insurance policy PDFs and notifications
- Extract policy information automatically from email attachments
- Keep policy information up-to-date by monitoring new emails

**Security:** Read-only access (`gmail.readonly` scope), user can revoke access anytime.

## Prerequisites

- A Google account (personal or workspace)
- Access to this Replit project's Secrets
- 15-20 minutes to complete setup

## Step 1: Create Google Cloud Project

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Click the project dropdown at the top
3. Click **New Project**
4. Enter project name: `AutoSage Gmail Integration` (or your choice)
5. Click **Create**
6. Wait for project creation, then select your new project from the dropdown

## Step 2: Enable Gmail API

1. In your Google Cloud project, go to **APIs & Services** > **Library**
2. Search for `Gmail API`
3. Click on **Gmail API** in the results
4. Click **Enable**
5. Wait for the API to be enabled (takes a few seconds)

## Step 3: Configure OAuth Consent Screen

Before creating credentials, you must configure the OAuth consent screen:

1. Go to **APIs & Services** > **OAuth consent screen**
2. Choose **External** user type (unless you have a Google Workspace)
3. Click **Create**

### Fill in App Information:

**App information:**
- App name: `AutoSage`
- User support email: Your email address
- App logo: (Optional - skip for now)

**App domain:**
- **IMPORTANT:** Leave ALL fields in this section EMPTY for now
- Application home page: (Leave blank)
- Application privacy policy link: (Leave blank)
- Application terms of service link: (Leave blank)

**Why leave App domain blank?**
- Google requires domain ownership verification to add any URLs here
- Since Replit domains (`replit.dev`, `repl.co`) are shared, you cannot verify them
- Any URL entered in App domain must belong to a verified domain in Authorized domains
- While your app is in "Testing" mode, these fields are not required
- **Only fill these in if you have a custom verified domain**

**Authorized domains:**
- Leave this section EMPTY (click Save and Continue without adding domains)
- Only add domains here if you control and have verified them with Google

**Developer contact information:**
- Email addresses: Your email address

4. Click **Save and Continue**

### Add Scopes:

1. Click **Add or Remove Scopes**
2. Filter or scroll to find these scopes:
   - `https://www.googleapis.com/auth/gmail.readonly` (Read all Gmail messages and settings)
   - `https://www.googleapis.com/auth/userinfo.email` (See your primary Google Account email address)
3. Check both scopes
4. Click **Update**
5. Click **Save and Continue**

### Test Users (for development):

1. Click **Add Users**
2. Add your email address and any test user emails
3. Click **Add**
4. Click **Save and Continue**

### Review and Confirm:

1. Review the summary
2. Click **Back to Dashboard**

**Note:** Your app will be in "Testing" mode. To make it public, you'll need to submit for verification (not required for personal use).

## Step 4: Create OAuth 2.0 Credentials

1. Go to **APIs & Services** > **Credentials**
2. Click **Create Credentials** > **OAuth client ID**
3. Application type: Select **Web application**
4. Name: `AutoSage Web Client` (or your choice)

### Configure Authorized Redirect URIs:

This is critical for the OAuth flow to work properly.

**For local development:**
- Click **Add URI**
- Enter: `http://localhost:5000/api/personalization/gmail/callback`

**For Replit deployment:**
- Click **Add URI**
- Enter: `https://YOUR_REPL_SLUG.YOUR_USERNAME.repl.co/api/personalization/gmail/callback`
  - Replace `YOUR_REPL_SLUG` with your Replit project name (lowercase, hyphens for spaces)
  - Replace `YOUR_USERNAME` with your Replit username

**Example:**
- If your Replit URL is `https://autosage-insurance.johndoe.repl.co`
- Then redirect URI is: `https://autosage-insurance.johndoe.repl.co/api/personalization/gmail/callback`

5. Click **Create**

### Save Your Credentials:

A dialog will appear with your OAuth 2.0 credentials:

- **Client ID**: `xxxxxxxxxx.apps.googleusercontent.com`
- **Client Secret**: `GOCSPX-xxxxxxxxxxxxxxxxxxxxxxxx`

**IMPORTANT:** Copy both values immediately - you'll need them in the next step.

## Step 5: Add Credentials to Replit Secrets

1. In your Replit project, open the **Secrets** tab (lock icon in left sidebar)
2. Add these two secrets:

**Secret 1:**
- Key: `GOOGLE_CLIENT_ID`
- Value: Paste your Client ID from Step 4

**Secret 2:**
- Key: `GOOGLE_CLIENT_SECRET`
- Value: Paste your Client Secret from Step 4

3. Click **Add secret** for each one

## Step 6: Verify Configuration

### Check Server Configuration:

The server automatically reads these environment variables:
```typescript
GOOGLE_CLIENT_ID      // Your OAuth client ID
GOOGLE_CLIENT_SECRET  // Your OAuth client secret
```

### Restart Your Application:

1. Stop the application if running
2. Click **Run** to restart with new secrets
3. Check console logs for any errors related to Gmail OAuth

## Step 7: Test the Integration

1. Open your AutoSage application
2. Log in with a test user
3. Open the **Personalize** menu (user menu in top-right)
4. Click **Connect Gmail**
5. You should be redirected to Google's consent screen
6. Sign in with your Google account (must be a test user you added in Step 3)
7. Review permissions and click **Allow**
8. You should be redirected back to AutoSage with "Gmail connected successfully" message

### Troubleshooting Common Issues:

**Error: "redirect_uri_mismatch"**
- Check that your redirect URI in Google Cloud Console exactly matches your Replit URL
- Ensure you're using the correct URL format (http:// for localhost, https:// for Replit)
- Don't forget to add the full path: `/api/personalization/gmail/callback`

**Error: "access_denied"**
- User clicked "Cancel" on consent screen
- User account is not added as a test user
- App is in "Testing" mode and user is not in test users list

**Error: "invalid_client"**
- GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET is incorrect
- Check Replit Secrets for typos
- Verify credentials in Google Cloud Console

**Error: "Gmail disconnected successfully" but token still shows as connected**
- Clear browser cache and reload
- Check server logs for revocation errors
- May need to revoke access manually in [Google Account permissions](https://myaccount.google.com/permissions)

## Step 8: Going to Production

When you're ready to make your app available to all users (not just test users):

1. Go to **APIs & Services** > **OAuth consent screen**
2. Click **Publish App**
3. You may need to submit for Google verification if:
   - You use sensitive or restricted scopes (gmail.readonly requires verification)
   - You expect more than 100 users

**Google Verification Process:**
- Requires privacy policy, terms of service
- May take 6-8 weeks for review
- Required for apps using Gmail API with external users
- See: https://support.google.com/cloud/answer/9110914

## Security Best Practices

### OAuth State Protection:
- The server uses cryptographically random state tokens (32 bytes)
- State tokens expire after 10 minutes
- Each token is single-use (deleted after validation)
- Protects against CSRF attacks

### Token Storage:
- **Current (MVP):** Access and refresh tokens stored in PostgreSQL database
- **Important:** Tokens are stored as plaintext (not encrypted) in database
- **Production roadmap:** Add encryption at rest for token storage
- Tokens are only accessible to the user who authorized them
- Tokens persist across server restarts
- Refresh tokens are revoked on disconnect

### Token Refresh:
- Access tokens expire after 1 hour
- Server automatically refreshes using refresh token
- If refresh fails, user must re-authorize

### Revocation:
- User can disconnect anytime via Personalize menu
- Server revokes both access and refresh tokens with Google
- All tokens cleared from database on disconnect

## API Rate Limits

Gmail API has the following quotas (free tier):
- 1 billion quota units per day
- Reading a message: ~5 quota units
- Listing messages: ~5 quota units
- Typical usage: 100-1000 units per user per day

**Recommendation:** Implement email scanning with reasonable frequency (e.g., once per hour) to stay within limits.

## Next Steps

Once Gmail is connected:
1. **Phase 2**: Implement email scanning to detect insurance policy PDFs
2. **Phase 3**: Extract policy data from email attachments
3. **Phase 4**: Automatically update user policies based on email content

## Support Resources

- [Gmail API Documentation](https://developers.google.com/gmail/api)
- [OAuth 2.0 for Web Server Applications](https://developers.google.com/identity/protocols/oauth2/web-server)
- [Google OAuth Consent Screen](https://support.google.com/cloud/answer/10311615)
- [Replit Secrets Documentation](https://docs.replit.com/programming-ide/workspace-features/secrets)

## FAQ

**Q: Can users revoke access themselves?**
A: Yes, users can disconnect Gmail in the Personalize menu or visit [Google Account permissions](https://myaccount.google.com/permissions) to revoke access.

**Q: What happens if a user's token expires?**
A: The server automatically refreshes using the refresh token. If that fails, the user will see a "reconnect required" message.

**Q: Is email data stored permanently?**
A: No, AutoSage only extracts policy information from emails. Email content itself is not stored.

**Q: Can AutoSage send emails?**
A: No, the integration uses `gmail.readonly` scope - read-only access. AutoSage cannot send, delete, or modify emails.

**Q: How often does AutoSage scan for new emails?**
A: This will be configured in Phase 2. Recommended: hourly scans to respect API quotas.

**Q: What if I change my Replit URL?**
A: You must update the authorized redirect URI in Google Cloud Console to match your new URL.
