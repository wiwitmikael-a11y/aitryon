import { GoogleGenAI } from "@google/genai";
import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
    if (req.method !== 'POST') {
        return res.status(405).json({ message: 'Method Not Allowed' });
    }

    try {
        if (!process.env.API_KEY) {
            return res.status(500).json({ message: 'API key not configured.' });
        }

        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

        const { endpoint, payload } = req.body;

        let result: any;

        switch (endpoint) {
            case 'generateContent':
                result = await ai.models.generateContent(payload);
                break;
            case 'generateImages':
                result = await ai.models.generateImages(payload);
                break;
            case 'generateVideos':
                result = await ai.models.generateVideos(payload);
                break;
            case 'getVideosOperation':
                 // The operation object from the SDK is not directly serializable.
                 // The service sends the operation name string in the payload.
                result = await ai.operations.getVideosOperation({ operation: payload.operation });
                break;
            default:
                return res.status(400).json({ message: `Unknown endpoint: ${endpoint}` });
        }

        return res.status(200).json(result);

    } catch (error) {
        console.error('Error in Gemini proxy:', error);
        const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred.';
        // Attempt to extract a more detailed error message from the Gemini API response
        const errorDetail = (error as any)?.cause ?? errorMessage;
        res.status(500).json({ message: 'Internal Server Error', detail: errorDetail });
    }
}
