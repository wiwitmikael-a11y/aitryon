import { GoogleAuth } from 'google-auth-library';

// Simple in-memory cache for the auth token
let authToken: string | null = null;
let tokenExpiry: Date | null = null;

/**
 * Retrieves a Google Auth token for accessing Vertex AI APIs.
 * It uses a simple in-memory cache to avoid fetching a new token for every request.
 */
export async function getGoogleAuthToken(): Promise<string> {
    // If we have a valid, non-expired token, return it
    if (authToken && tokenExpiry && new Date() < tokenExpiry) {
        return authToken;
    }

    // Otherwise, fetch a new token
    try {
        const auth = new GoogleAuth({
            scopes: 'https://www.googleapis.com/auth/cloud-platform'
        });

        const client = await auth.getClient();
        const accessToken = await client.getAccessToken();

        if (!accessToken.token || !accessToken.res?.data.expires_in) {
            throw new Error('Failed to retrieve Google Auth token: Token or expiry information is missing.');
        }

        authToken = accessToken.token;
        // Set expiry to 5 minutes before the actual expiry to be safe
        const expiresInSeconds = accessToken.res.data.expires_in;
        tokenExpiry = new Date(new Date().getTime() + (expiresInSeconds - 300) * 1000);
        
        return authToken;
    } catch (error) {
        console.error("Error getting Google Auth token:", error);
        // Reset cache in case of error
        authToken = null;
        tokenExpiry = null;
        throw new Error(`Failed to obtain Google authentication token. ${error instanceof Error ? error.message : ''}`);
    }
}
