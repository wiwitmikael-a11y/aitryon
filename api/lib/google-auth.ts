import { GoogleAuth } from 'google-auth-library';

let authToken: string | null | undefined = undefined;
let tokenExpiration: Date | null = null;

const scopes = ['https://www.googleapis.com/auth/cloud-platform'];

/**
 * Retrieves a Google Cloud authentication token.
 * This version explicitly uses the GOOGLE_CREDENTIALS_JSON env var.
 */
export async function getAuthToken(): Promise<string> {
    if (authToken && tokenExpiration && new Date() < tokenExpiration) {
        return authToken;
    }

    const credentialsJson = process.env.GOOGLE_CREDENTIALS_JSON;
    if (!credentialsJson) {
        throw new Error('GOOGLE_CREDENTIALS_JSON environment variable not set.');
    }

    try {
        const credentials = JSON.parse(credentialsJson);
        const auth = new GoogleAuth({
            credentials,
            scopes
        });
        
        const client = await auth.getClient();
        const token = await client.getAccessToken();

        if (!token.token || !token.expiry_date) {
            throw new Error('Failed to retrieve a valid auth token from credentials.');
        }

        authToken = token.token;
        tokenExpiration = new Date(token.expiry_date - 5 * 60 * 1000); // 5-minute buffer
        
        return authToken;
    } catch (error) {
        console.error('Error getting auth token from JSON credentials:', error);
        if (error instanceof SyntaxError) {
             throw new Error('Could not authenticate with Google Cloud: GOOGLE_CREDENTIALS_JSON is not valid JSON.');
        }
        throw new Error('Could not authenticate with Google Cloud.');
    }
}
