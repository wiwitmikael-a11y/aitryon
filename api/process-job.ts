import { kv } from '@vercel/kv';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import type { Job, VertexAIResponse } from '../src/types';
import { getGoogleAuthToken } from './lib/google-auth';
import { API_ENDPOINT } from '../src/constants';

const getBase64Data = (dataUrl: string): string => {
  const parts = dataUrl.split(',');
  if (parts.length === 2) {
    return parts[1];
  }
  return dataUrl;
};

// Vercel's Edge runtime doesn't support the 'body' property directly from QStash.
// We need to parse it manually if using the edge. For serverless, it's fine.
export const config = {
  // api: { bodyParser: true }, // Default is true, so this is not needed
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
    if (req.method !== 'POST') {
        return res.status(405).json({ message: 'Method Not Allowed' });
    }
    
    // For production, you should verify the QStash signature here for security
    // See: https://upstash.com/docs/qstash/features/verification

    const { jobId } = req.body;

    if (!jobId) {
        return res.status(400).json({ message: 'Job ID is required.' });
    }
    
    // Respond quickly to QStash to acknowledge receipt of the job.
    res.status(202).json({ message: 'Processing started.' });

    let job: Job | null = null;
    try {
        job = await kv.get<Job>(`job:${jobId}`);
        if (!job) {
            console.error(`Job not found in KV: ${jobId}`);
            return; // Stop processing if job doesn't exist
        }

        if (job.status !== 'PENDING') {
            console.log(`Job ${jobId} is not pending, skipping.`);
            return;
        }

        job.status = 'PROCESSING';
        await kv.set(`job:${jobId}`, job);

        const authToken = await getGoogleAuthToken();
        
        const personImageData = getBase64Data(job.personImage);
        const productImageData = getBase64Data(job.productImage);
        
        const body = JSON.stringify({
            instances: [{
                personImage: { image: { bytesBase64Encoded: personImageData } },
                productImages: [{ image: { bytesBase64Encoded: productImageData } }],
            }],
            parameters: {
                sampleCount: 1,
                personGeneration: 'allow_all', // Hardcoded as per user request
            },
        });

        const apiResponse = await fetch(API_ENDPOINT, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${authToken}`,
                'Content-Type': 'application/json; charset=utf-8',
            },
            body,
        });

        if (!apiResponse.ok) {
            const errorBody = await apiResponse.json().catch(() => ({ error: { message: 'Failed to parse error response' } }));
            throw new Error(`API request failed with status ${apiResponse.status}: ${errorBody.error?.message || 'Unknown error'}`);
        }
        
        const data: VertexAIResponse = await apiResponse.json();
        
        if (!data.predictions || data.predictions.length === 0 || !data.predictions[0].bytesBase64Encoded) {
            throw new Error('No predictions returned from the API.');
        }

        const firstPrediction = data.predictions[0];
        const resultImage = `data:${firstPrediction.mimeType};base64,${firstPrediction.bytesBase64Encoded}`;

        job.status = 'COMPLETED';
        job.resultImage = resultImage;
        await kv.set(`job:${jobId}`, job);

    } catch (error: any) {
        console.error(`Error processing job ${jobId}:`, error);
        if (job) {
            job.status = 'FAILED';
            job.error = error.message || 'An unknown error occurred.';
            await kv.set(`job:${jobId}`, job);
        }
    }
}
