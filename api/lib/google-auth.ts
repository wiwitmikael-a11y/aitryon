import { GoogleAuth } from 'google-auth-library';

/**
 * Gets an access token for authenticating with Google Cloud APIs.
 * It relies on Application Default Credentials (ADC).
 * In a Vercel environment, you should set the GOOGLE_CREDENTIALS environment variable
 * with the content of your service account key JSON file. The google-auth-library
 * will automatically pick it up.
 */
export async function getAuthToken(): Promise<string> {
    const auth = new GoogleAuth({
        scopes: ['https://www.googleapis.com/auth/cloud-platform'],
    });

    const client = await auth.getClient();
    const accessTokenResponse = await client.getAccessToken();

    if (!accessTokenResponse || !accessTokenResponse.token) {
        throw new Error('Failed to obtain access token from Google Auth.');
    }

    return accessTokenResponse.token;
}
