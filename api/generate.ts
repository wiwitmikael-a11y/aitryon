import type { VercelRequest, VercelResponse } from '@vercel/node';
import { v4 as uuidv4 } from 'uuid';
import { getGoogleAuthToken } from './lib/google-auth';
import { createJob, updateJob } from './lib/db';
import { VERTEX_AI_API_BASE, VIRTUAL_TRY_ON_MODEL_ID } from '../src/constants';

// This function runs without being awaited by the handler.
async function processTryOnJob(jobId: string, person_image: string, garment_image: string) {
    try {
        await updateJob(jobId, { state: 'RUNNING' });

        const token = await getGoogleAuthToken();
        const endpoint = `${VERTEX_AI_API_BASE}/publishers/google/models/${VIRTUAL_TRY_ON_MODEL_ID}:predict`;

        const response = await fetch(endpoint, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                instances: [{ person_image, garment_image }],
            }),
        });

        if (!response.ok) {
            const errorBody = await response.text();
            throw new Error(`Vertex AI API failed with status ${response.status}: ${errorBody}`);
        }

        const data = await response.json();

        const resultBase64 = data.predictions?.[0]?.generated_image;
        if (!resultBase64) {
             throw new Error('No generated image found in Vertex AI response.');
        }

        const resultImageUrl = `data:image/png;base64,${resultBase64}`;

        await updateJob(jobId, { state: 'SUCCEEDED', resultImageUrl });

    } catch (error) {
        console.error(`[Job ${jobId}] Processing failed:`, error);
        await updateJob(jobId, { state: 'FAILED', error: error instanceof Error ? error.message : 'Unknown processing error.' });
    }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
    if (req.method !== 'POST') {
        return res.status(405).json({ message: 'Method Not Allowed' });
    }

    try {
        const { personImage, clothingImage } = req.body;

        if (!personImage || !clothingImage) {
            return res.status(400).json({ message: 'Missing personImage or clothingImage in request body.' });
        }

        // Remove data URL prefix
        const personImageBase64 = personImage.split(',')[1];
        const clothingImageBase64 = clothingImage.split(',')[1];

        const jobId = uuidv4();
        await createJob(jobId);

        // Fire-and-forget the processing logic.
        // In a real app, use a proper job queue (e.g., Cloud Tasks, Pub/Sub).
        processTryOnJob(jobId, personImageBase64, clothingImageBase64);

        res.status(202).json({ jobId });

    } catch (error) {
        console.error('Error starting virtual try-on job:', error);
        res.status(500).json({ message: 'Failed to start virtual try-on job.', details: error instanceof Error ? error.message : String(error) });
    }
}
