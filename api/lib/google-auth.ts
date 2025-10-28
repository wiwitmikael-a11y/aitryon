import { GoogleAuth } from 'google-auth-library';

let authToken: string | null | undefined = undefined;
let tokenExpiration: Date | null = null;

const scopes = ['https://www.googleapis.com/auth/cloud-platform'];

/**
 * Retrieves a Google Cloud authentication token.
 * It caches the token and refreshes it when it's about to expire.
 */
export async function getAuthToken(): Promise<string> {
    // Return cached token if it's still valid
    if (authToken && tokenExpiration && new Date() < tokenExpiration) {
        return authToken;
    }

    try {
        const auth = new GoogleAuth({ scopes });
        const client = await auth.getClient();
        const token = await client.getAccessToken();

        if (!token.token || !token.expiry_date) {
            throw new Error('Failed to retrieve a valid auth token.');
        }

        authToken = token.token;
        // Set expiration to 5 minutes before the actual expiry to be safe
        tokenExpiration = new Date(token.expiry_date - 5 * 60 * 1000);
        
        return authToken;
    } catch (error) {
        console.error('Error getting auth token:', error);
        throw new Error('Could not authenticate with Google Cloud.');
    }
}
