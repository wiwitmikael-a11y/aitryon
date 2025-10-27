import { GoogleAuth } from 'google-auth-library';

let authToken: string | null = null;
let tokenExpiry: Date | null = null;

export async function getGoogleAuthToken(): Promise<string> {
  // If we have a valid token, reuse it
  if (authToken && tokenExpiry && new Date() < tokenExpiry) {
    return authToken;
  }

  try {
    const credentialsJson = process.env.GOOGLE_CREDENTIALS_JSON;
    if (!credentialsJson) {
      throw new Error('GOOGLE_CREDENTIALS_JSON environment variable is not set.');
    }

    const credentials = JSON.parse(credentialsJson);

    const auth = new GoogleAuth({
      credentials,
      scopes: 'https://www.googleapis.com/auth/cloud-platform',
    });
    
    const client = await auth.getClient();
    const token = await client.getAccessToken();

    if (!token.token || !token.res?.data?.expires_in) {
      throw new Error('Failed to retrieve access token or expiry time.');
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
    throw new Error('Could not get Google authentication token.');
  }
}
