import { google } from "googleapis";
import { storage } from "./storage";
import { refreshGmailToken } from "./gmail-oauth";

interface TravelEmail {
  subject: string;
  date: Date;
  snippet: string;
}

interface ParsedTravelNotification {
  destination: string;
  emailSubject: string;
  emailDate: Date;
  message: string;
}

/**
 * Main scanner function - orchestrates the Gmail scanning process
 */
export async function scanGmailForTravelEmails(emailId: string): Promise<number> {
  const personalization = await storage.getPersonalization(emailId);
  
  if (!personalization?.email_enabled || !personalization?.gmail_refresh_token) {
    throw new Error("Gmail integration not configured for this user");
  }

  try {
    // Get fresh access token
    let accessToken: string;
    if (personalization.gmail_access_token && 
        personalization.gmail_token_expiry && 
        personalization.gmail_token_expiry > new Date()) {
      accessToken = personalization.gmail_access_token;
    } else {
      // Refresh and get new token
      accessToken = await refreshGmailToken(emailId);
    }

    // Determine scan start date (use last_email_scan or default to 30 days ago)
    const scanStartDate = personalization.last_email_scan || (() => {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      return thirtyDaysAgo;
    })();

    // Fetch recent emails from Gmail
    const travelEmails = await fetchRecentEmails(accessToken, scanStartDate);
    
    // Filter for travel-related emails (AI UPGRADE POINT #1)
    const filteredEmails = filterTravelEmails(travelEmails);
    
    // Parse each email to extract destination (AI UPGRADE POINT #2)
    const parsedNotifications: ParsedTravelNotification[] = [];
    for (const email of filteredEmails) {
      const destination = extractDestination(email.subject);
      if (destination) {
        parsedNotifications.push({
          destination,
          emailSubject: email.subject,
          emailDate: email.date,
          message: `Do you want to find Travel insurance for your upcoming journey to ${destination}?`,
        });
      }
    }
    
    // Check for duplicates and create notifications
    let createdCount = 0;
    for (const notification of parsedNotifications) {
      const isDuplicate = await checkDuplicate(
        emailId,
        notification.destination,
        notification.emailDate
      );
      
      if (!isDuplicate) {
        await storage.createNotification({
          email_id: emailId,
          message: notification.message,
          destination: notification.destination,
          email_subject: notification.emailSubject,
          email_date: notification.emailDate,
          dismissed: false,
        });
        createdCount++;
      }
    }
    
    // Update last scan timestamp
    await storage.updateLastEmailScan(emailId);
    
    return createdCount;
  } catch (error: any) {
    console.error("[Gmail Scanner] Error scanning emails:", error);
    throw new Error(`Failed to scan Gmail: ${error.message}`);
  }
}

/**
 * Fetch recent emails from Gmail API
 */
async function fetchRecentEmails(accessToken: string, scanStartDate: Date): Promise<TravelEmail[]> {
  const oauth2Client = new google.auth.OAuth2();
  oauth2Client.setCredentials({ access_token: accessToken });
  
  const gmail = google.gmail({ version: 'v1', auth: oauth2Client });
  
  // Search for emails since last scan (or default scan start date)
  const query = `after:${Math.floor(scanStartDate.getTime() / 1000)}`;
  
  const response = await gmail.users.messages.list({
    userId: 'me',
    q: query,
    maxResults: 100, // Increased for better coverage
  });
  
  if (!response.data.messages) {
    return [];
  }
  
  const travelEmails: TravelEmail[] = [];
  
  for (const message of response.data.messages) {
    const msg = await gmail.users.messages.get({
      userId: 'me',
      id: message.id!,
      format: 'full',
    });
    
    const headers = msg.data.payload?.headers || [];
    const subjectHeader = headers.find(h => h.name?.toLowerCase() === 'subject');
    const dateHeader = headers.find(h => h.name?.toLowerCase() === 'date');
    
    if (subjectHeader?.value && dateHeader?.value) {
      travelEmails.push({
        subject: subjectHeader.value,
        date: new Date(dateHeader.value),
        snippet: msg.data.snippet || '',
      });
    }
  }
  
  return travelEmails;
}

/**
 * AI UPGRADE POINT #1: Filter travel-related emails
 * Current: Keyword-based filtering
 * Future: Replace with AI agent that understands context and intent
 */
function filterTravelEmails(emails: TravelEmail[]): TravelEmail[] {
  const travelKeywords = [
    'flight',
    'ticket',
    'itinerary',
    'booking',
    'reservation',
    'trip',
    'travel',
    'hotel',
    'airfare',
    'airline',
    'departure',
    'journey',
    'vacation',
    'holiday',
    'confirmed booking',
    'e-ticket',
    'boarding pass',
  ];
  
  return emails.filter(email => {
    const subjectLower = email.subject.toLowerCase();
    return travelKeywords.some(keyword => subjectLower.includes(keyword));
  });
}

/**
 * AI UPGRADE POINT #2: Extract destination from email subject
 * Current: Simple regex pattern matching
 * Future: Replace with AI agent that understands location context
 */
function extractDestination(subject: string): string | null {
  // Pattern 1: "to [Destination]" or "to [Destination],"
  const toPattern = /\bto\s+([A-Z][a-zA-Z\s]+?)(?:,|\s+-|\s+on|\s+\(|$)/;
  const toMatch = subject.match(toPattern);
  if (toMatch && toMatch[1]) {
    return toMatch[1].trim();
  }
  
  // Pattern 2: "in [Destination]" or "in [Destination],"
  const inPattern = /\bin\s+([A-Z][a-zA-Z\s]+?)(?:,|\s+-|\s+on|\s+\(|$)/;
  const inMatch = subject.match(inPattern);
  if (inMatch && inMatch[1]) {
    return inMatch[1].trim();
  }
  
  // Pattern 3: Flight codes like "LON" or "NYC" (3-letter airport codes)
  const airportCodePattern = /\b([A-Z]{3})\b/g;
  const airportMatches = subject.match(airportCodePattern);
  if (airportMatches && airportMatches.length >= 2) {
    // Assume destination is the second code (first is usually departure)
    return airportMatches[1];
  }
  
  // Pattern 4: Common city names (capitalized words)
  const cityPattern = /\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)\b/g;
  const cityMatches = subject.match(cityPattern);
  if (cityMatches && cityMatches.length > 0) {
    // Filter out common non-city words
    const nonCities = ['Your', 'Flight', 'Booking', 'Confirmation', 'Hotel', 'Trip', 'Travel'];
    const cities = cityMatches.filter(word => !nonCities.includes(word));
    if (cities.length > 0) {
      return cities[0];
    }
  }
  
  return null;
}

/**
 * Check if a similar notification already exists (15-day window)
 * Only checks active (non-dismissed) notifications with non-null dates
 */
async function checkDuplicate(
  emailId: string,
  destination: string,
  emailDate: Date
): Promise<boolean> {
  // Get only active notifications for this destination (more efficient than loading all)
  const existingNotifications = await storage.getActiveNotificationsByDestination(emailId, destination);
  
  const fifteenDaysAgo = new Date(emailDate);
  fifteenDaysAgo.setDate(fifteenDaysAgo.getDate() - 15);
  
  const fifteenDaysLater = new Date(emailDate);
  fifteenDaysLater.setDate(fifteenDaysLater.getDate() + 15);
  
  return existingNotifications.some(notification => {
    const notifDate = notification.email_date;
    if (!notifDate) {
      return false;
    }
    
    return notifDate >= fifteenDaysAgo && notifDate <= fifteenDaysLater;
  });
}
