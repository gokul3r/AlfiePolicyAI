import { google } from "googleapis";
import type { Request, Response } from "express";
import { storage } from "./storage";
import crypto from "crypto";

// OAuth2 client configuration
function getOAuth2Client() {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const redirectUri = `${process.env.REPL_ID ? 'https://' + process.env.REPL_SLUG + '.' + process.env.REPL_OWNER + '.repl.co' : 'http://localhost:5000'}/api/personalization/gmail/callback`;

  if (!clientId || !clientSecret) {
    throw new Error("Missing Google OAuth credentials. Please set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in Replit Secrets.");
  }

  return new google.auth.OAuth2(clientId, clientSecret, redirectUri);
}

// Gmail API scopes - read-only access
const SCOPES = [
  'https://www.googleapis.com/auth/gmail.readonly',
  'https://www.googleapis.com/auth/userinfo.email',
];

// In-memory store for OAuth state tokens (use Redis/DB in production)
const stateStore = new Map<string, { email: string; expires: number }>();

// Cleanup expired states every 5 minutes
setInterval(() => {
  const now = Date.now();
  stateStore.forEach((data, state) => {
    if (data.expires < now) {
      stateStore.delete(state);
    }
  });
}, 5 * 60 * 1000);

function generateState(email: string): string {
  // Generate cryptographically random state token
  const state = crypto.randomBytes(32).toString('hex');
  // Store with 10 minute expiration
  stateStore.set(state, {
    email,
    expires: Date.now() + 10 * 60 * 1000,
  });
  return state;
}

function validateState(state: string): string | null {
  const data = stateStore.get(state);
  if (!data) return null;
  if (data.expires < Date.now()) {
    stateStore.delete(state);
    return null;
  }
  // Delete after use (one-time token)
  stateStore.delete(state);
  return data.email;
}

/**
 * Start OAuth flow - redirect user to Google consent screen
 */
export async function handleGmailAuthorize(req: Request, res: Response) {
  try {
    const { email } = req.query;

    if (!email || typeof email !== 'string') {
      return res.status(400).json({ error: "Email parameter is required" });
    }

    const oauth2Client = getOAuth2Client();

    // Generate cryptographically random state for CSRF protection
    const state = generateState(email);

    // Generate authorization URL
    const authUrl = oauth2Client.generateAuthUrl({
      access_type: 'offline', // Get refresh token
      scope: SCOPES,
      state, // CSRF protection token
      prompt: 'consent', // Force consent screen to get refresh token
    });

    res.json({ authUrl });
  } catch (error: any) {
    console.error("[Gmail OAuth] Error in authorize:", error);
    res.status(500).json({ 
      error: "Failed to generate authorization URL", 
      message: error.message 
    });
  }
}

/**
 * Handle OAuth callback from Google
 */
export async function handleGmailCallback(req: Request, res: Response) {
  try {
    const { code, state } = req.query;

    if (!code || typeof code !== 'string') {
      return res.status(400).json({ error: "Authorization code is required" });
    }

    if (!state || typeof state !== 'string') {
      return res.status(400).json({ error: "State parameter is missing" });
    }

    // Validate state token and get email (CSRF protection)
    const email = validateState(state);
    if (!email) {
      console.error("[Gmail OAuth] Invalid or expired state token");
      return res.redirect('/?gmail=error&reason=invalid_state');
    }

    const oauth2Client = getOAuth2Client();

    // Exchange authorization code for tokens
    const { tokens } = await oauth2Client.getToken(code);
    
    if (!tokens.access_token) {
      throw new Error("Failed to obtain access token");
    }

    // Get user's Gmail email address for verification
    oauth2Client.setCredentials(tokens);
    const oauth2 = google.oauth2({ version: 'v2', auth: oauth2Client });
    const { data: userInfo } = await oauth2.userinfo.get();

    // Get existing personalization to preserve refresh token if not returned
    const existing = await storage.getPersonalization(email);
    const refreshToken = tokens.refresh_token || existing?.gmail_refresh_token;

    if (!refreshToken) {
      // This can happen if user already authorized once and Google doesn't return refresh token
      console.error("[Gmail OAuth] No refresh token available. User may need to revoke access first.");
      return res.redirect('/?gmail=error&reason=no_refresh_token');
    }

    // Save tokens to database
    await storage.saveGmailTokens(email, {
      gmail_id: userInfo.email || null,
      gmail_access_token: tokens.access_token,
      gmail_refresh_token: refreshToken,
      gmail_token_expiry: tokens.expiry_date ? new Date(tokens.expiry_date) : null,
      email_enabled: true,
    });

    // Redirect to success page (frontend will detect this)
    res.redirect('/?gmail=success');
  } catch (error: any) {
    console.error("[Gmail OAuth] Error in callback:", error);
    res.redirect('/?gmail=error');
  }
}

/**
 * Disconnect Gmail - revoke tokens and clear from database
 */
export async function handleGmailDisconnect(req: Request, res: Response) {
  try {
    const { email } = req.body;

    if (!email || typeof email !== 'string') {
      return res.status(400).json({ error: "Email is required" });
    }

    // Get current personalization to revoke tokens
    const personalization = await storage.getPersonalization(email);
    
    // Revoke both access token and refresh token for complete revocation
    if (personalization) {
      const oauth2Client = getOAuth2Client();
      
      // Try to revoke refresh token first (this revokes all tokens)
      if (personalization.gmail_refresh_token) {
        try {
          await oauth2Client.revokeToken(personalization.gmail_refresh_token);
          console.log("[Gmail OAuth] Refresh token revoked successfully");
        } catch (revokeError) {
          console.error("[Gmail OAuth] Error revoking refresh token:", revokeError);
          // Try access token as fallback
          if (personalization.gmail_access_token) {
            try {
              await oauth2Client.revokeToken(personalization.gmail_access_token);
              console.log("[Gmail OAuth] Access token revoked successfully");
            } catch (accessError) {
              console.error("[Gmail OAuth] Error revoking access token:", accessError);
              // Continue even if revoke fails (tokens might be already expired/revoked)
            }
          }
        }
      } else if (personalization.gmail_access_token) {
        // Only access token available
        try {
          await oauth2Client.revokeToken(personalization.gmail_access_token);
          console.log("[Gmail OAuth] Access token revoked successfully");
        } catch (revokeError) {
          console.error("[Gmail OAuth] Error revoking access token:", revokeError);
        }
      }
    }

    // Clear tokens from database
    await storage.clearGmailTokens(email);

    res.json({ success: true, message: "Gmail disconnected successfully" });
  } catch (error: any) {
    console.error("[Gmail OAuth] Error in disconnect:", error);
    res.status(500).json({ 
      error: "Failed to disconnect Gmail", 
      message: error.message 
    });
  }
}

/**
 * Get Gmail connection status
 */
export async function handleGmailStatus(req: Request, res: Response) {
  try {
    const { email } = req.query;

    if (!email || typeof email !== 'string') {
      return res.status(400).json({ error: "Email parameter is required" });
    }

    const personalization = await storage.getPersonalization(email);
    
    const isConnected = !!(
      personalization?.email_enabled && 
      personalization?.gmail_access_token &&
      personalization?.gmail_refresh_token
    );

    res.json({
      isConnected,
      gmail_id: personalization?.gmail_id || null,
      email_enabled: personalization?.email_enabled || false,
      last_scan: personalization?.last_email_scan || null,
    });
  } catch (error: any) {
    console.error("[Gmail OAuth] Error getting status:", error);
    res.status(500).json({ 
      error: "Failed to get Gmail status", 
      message: error.message 
    });
  }
}

/**
 * Refresh access token using refresh token
 */
export async function refreshGmailToken(email: string): Promise<string> {
  const personalization = await storage.getPersonalization(email);
  
  if (!personalization?.gmail_refresh_token) {
    throw new Error("No refresh token found for user");
  }

  const oauth2Client = getOAuth2Client();
  oauth2Client.setCredentials({
    refresh_token: personalization.gmail_refresh_token,
  });

  // Get new access token
  const { credentials } = await oauth2Client.refreshAccessToken();
  
  if (!credentials.access_token) {
    throw new Error("Failed to refresh access token");
  }

  // Save new access token
  await storage.saveGmailTokens(email, {
    gmail_access_token: credentials.access_token,
    gmail_token_expiry: credentials.expiry_date ? new Date(credentials.expiry_date) : null,
  });

  return credentials.access_token;
}
