import { google } from "googleapis";
import type { Request, Response } from "express";
import { storage } from "./storage";

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

    // Generate authorization URL
    const authUrl = oauth2Client.generateAuthUrl({
      access_type: 'offline', // Get refresh token
      scope: SCOPES,
      state: email, // Pass email in state to retrieve after redirect
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
    const { code, state: email } = req.query;

    if (!code || typeof code !== 'string') {
      return res.status(400).json({ error: "Authorization code is required" });
    }

    if (!email || typeof email !== 'string') {
      return res.status(400).json({ error: "Email state parameter is missing" });
    }

    const oauth2Client = getOAuth2Client();

    // Exchange authorization code for tokens
    const { tokens } = await oauth2Client.getToken(code);
    
    if (!tokens.access_token || !tokens.refresh_token) {
      throw new Error("Failed to obtain access or refresh token");
    }

    // Get user's Gmail email address for verification
    oauth2Client.setCredentials(tokens);
    const oauth2 = google.oauth2({ version: 'v2', auth: oauth2Client });
    const { data: userInfo } = await oauth2.userinfo.get();

    // Save tokens to database
    await storage.saveGmailTokens(email, {
      gmail_id: userInfo.email || null,
      gmail_access_token: tokens.access_token,
      gmail_refresh_token: tokens.refresh_token,
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

    // Get current personalization to revoke token
    const personalization = await storage.getPersonalization(email);
    
    if (personalization?.gmail_access_token) {
      try {
        const oauth2Client = getOAuth2Client();
        await oauth2Client.revokeToken(personalization.gmail_access_token);
      } catch (revokeError) {
        console.error("[Gmail OAuth] Error revoking token:", revokeError);
        // Continue even if revoke fails (token might be already expired)
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
