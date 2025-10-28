import { GoogleAuth } from 'google-auth-library';
import { Buffer } from 'buffer';

let authToken: string | null = null;
let tokenExpiry: Date | null = null;

// This is the definitive, robust method for handling credentials.
async function getCredentials() {
  const base64Credentials = process.env.GOOGLE_CREDENTIALS_B64;
  const jsonCredentials = process.env.GOOGLE_CREDENTIALS_JSON;

  if (base64Credentials) {
    try {
      const decodedJson = Buffer.from(base64Credentials, 'base64').toString('utf-8');
      return JSON.parse(decodedJson);
    } catch (error) {
      console.error("Fatal: Failed to decode or parse GOOGLE_CREDENTIALS_B64.", error);
      throw new Error("GOOGLE_CREDENTIALS_B64 is not a valid Base64-encoded JSON string.");
    }
  }

  if (jsonCredentials) {
    try {
      // This is less reliable but kept as a fallback.
      return JSON.parse(jsonCredentials);
    } catch (error) {
      console.error("Fatal: Failed to parse GOOGLE_CREDENTIALS_JSON.", error);
      throw new Error("GOOGLE_CREDENTIALS_JSON is not a valid JSON string. Consider using the Base64 method.");
    }
  }

  throw new Error('Neither GOOGLE_CREDENTIALS_B64 nor GOOGLE_CREDENTIALS_JSON environment variable is set.');
}


export async function getGoogleAuthToken(): Promise<string> {
  // If we have a valid token, reuse it
  if (authToken && tokenExpiry && new Date() < tokenExpiry) {
    return authToken;
  }

  try {
    const credentials = await getCredentials();

    const auth = new GoogleAuth({
      credentials,
      scopes: 'https://www.googleapis.com/auth/cloud-platform',
    });
    
    const client = await auth.getClient();
    const token = await client.getAccessToken();

    if (!token.token || !token.res?.data?.expires_in) {
      throw new Error('Failed to retrieve access token or expiry time from Google.');
    }
    
    authToken = token.token;
    // Set expiry to 1 minute before the actual expiry for safety
    const expiresInSeconds = Number(token.res.data.expires_in);
    tokenExpiry = new Date(new Date().getTime() + (expiresInSeconds - 60) * 1000);

    return authToken;

  } catch (error) {
    console.error("Error getting Google Auth token:", error);
    // Invalidate any existing token
    authToken = null;
    tokenExpiry = null;
    // Re-throw the specific error from getCredentials or the auth library
    throw error;
  }
}
