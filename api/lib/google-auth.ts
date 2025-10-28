import { GoogleAuth } from 'google-auth-library';

let authToken: { token: string | null | undefined, expiry: number } | null = null;

/**
 * Gets a Google Cloud access token, using a cached token if available and not expired.
 * It reads credentials from a Base64 encoded environment variable for stability on Vercel.
 */
export async function getAuthToken(): Promise<string> {
    if (authToken && authToken.token && authToken.expiry > Date.now()) {
        return authToken.token;
    }

    const credsB64 = process.env.GOOGLE_CREDENTIALS_B64;
    if (!credsB64) {
        throw new Error('GOOGLE_CREDENTIALS_B64 environment variable not set.');
    }

    try {
        const credsJson = Buffer.from(credsB64, 'base64').toString('utf-8');
        const credentials = JSON.parse(credsJson);

        const auth = new GoogleAuth({
            credentials,
            scopes: ['https://www.googleapis.com/auth/cloud-platform'],
        });

        const client = await auth.getClient();
        const accessTokenResponse = await client.getAccessToken();

        if (!accessTokenResponse || !accessTokenResponse.token) {
            throw new Error('Failed to obtain access token from Google Auth.');
        }
        
        // Cache the token with its expiry date (expiry_date is in seconds, convert to ms)
        // Give a 60-second buffer before expiry.
        authToken = {
            token: accessTokenResponse.token,
            expiry: (accessTokenResponse.res?.data.expiry_date || (Date.now() / 1000 + 3540)) * 1000 - 60000,
        };

        return authToken.token;

    } catch (error) {
        console.error("Authentication Error:", error);
        throw new Error(`Failed to authenticate with Google Cloud. Please check GOOGLE_CREDENTIALS_B64. Error: ${error instanceof Error ? error.message : 'Unknown auth error'}`);
    }
}
