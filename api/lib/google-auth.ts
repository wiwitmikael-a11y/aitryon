import { GoogleAuth } from 'google-auth-library';

let authToken: string | null = null;
let tokenExpiry: Date | null = null;

/**
 * A robust function to get a Google Cloud authentication token.
 * It caches the token to avoid re-fetching on every request.
 * It explicitly reads and parses GOOGLE_CREDENTIALS_JSON.
 * @returns A promise that resolves to the access token string.
 */
export async function getAuthToken(): Promise<string> {
    if (authToken && tokenExpiry && new Date() < tokenExpiry) {
        return authToken;
    }

    const credentialsJsonString = process.env.GOOGLE_CREDENTIALS_JSON;
    if (!credentialsJsonString) {
        throw new Error("GOOGLE_CREDENTIALS_JSON environment variable is not set or empty.");
    }

    let credentials;
    try {
        credentials = JSON.parse(credentialsJsonString);
    } catch (error) {
        throw new Error("Failed to parse GOOGLE_CREDENTIALS_JSON. Please ensure it's a valid JSON string.");
    }
    
    const auth = new GoogleAuth({
        credentials,
        scopes: 'https://www.googleapis.com/auth/cloud-platform',
    });

    try {
        const client = await auth.getClient();
        const tokenResponse = await client.getAccessToken();

        if (!tokenResponse || !tokenResponse.token) {
            throw new Error("Failed to retrieve access token from Google Auth Library; token response is invalid.");
        }

        authToken = tokenResponse.token;
        // Set expiry to 5 minutes before the actual expiry for safety margin
        tokenExpiry = new Date(new Date().getTime() + 55 * 60 * 1000); 
        
        return authToken;

    } catch (error) {
        // Invalidate cache on failure
        authToken = null;
        tokenExpiry = null;
        console.error("Error fetching Google Auth Token:", error);
        throw new Error(`Failed to get Google Auth Token: ${error instanceof Error ? error.message : 'Unknown auth error'}`);
    }
}