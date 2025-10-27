import { kv } from '@vercel/kv';
import { getGoogleAuthToken } from './lib/google-auth';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import type { Job } from '../src/types';

// Constants from the old constants.ts file, now server-side only
const VERTEX_AI_LOCATION = 'us-central1';
const VERTEX_AI_PROJECT_ID = 'gen-lang-client-0513612665';
const MODEL_ID = 'virtual-try-on-preview-08-04';
const API_ENDPOINT = `https://${VERTEX_AI_LOCATION}-aiplatform.googleapis.com/v1/projects/${VERTEX_AI_PROJECT_ID}/locations/${VERTEX_AI_LOCATION}/publishers/google/models/${MODEL_ID}:predict`;

async function runPrediction(job: Job, restrictToAdult: boolean): Promise<string> {
  const authToken = await getGoogleAuthToken();
  
  const body = {
    instances: [{
      personImage: { image: { bytesBase64Encoded: job.personImage } },
      productImages: [{ image: { bytesBase64Encoded: job.productImage } }],
    }],
    parameters: {
      sampleCount: 1,
      personGeneration: restrictToAdult ? 'allow_adult' : 'allow_all',
    },
  };

  const response = await fetch(API_ENDPOINT, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${authToken}`,
      'Content-Type': 'application/json; charset=utf-8',
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorBody = await response.json().catch(() => ({}));
    console.error('Vertex AI API Error:', errorBody);
    throw new Error(`API request failed: ${errorBody?.error?.message || response.statusText}`);
  }

  const data = await response.json();
  const prediction = data.predictions?.[0];
  if (!prediction?.bytesBase64Encoded) {
    throw new Error('No image data in API response.');
  }
  
  return `data:${prediction.mimeType};base64,${prediction.bytesBase64Encoded}`;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method Not Allowed' });
  }

  const { jobId, restrictToAdult } = req.body;
  if (!jobId) {
    return res.status(400).json({ message: 'Job ID is missing.' });
  }

  try {
    const job = await kv.get<Job>(`job:${jobId}`);
    if (!job) {
      return res.status(404).json({ message: `Job ${jobId} not found.` });
    }

    await kv.set(`job:${jobId}`, { ...job, status: 'PROCESSING' });

    try {
      const resultImage = await runPrediction(job, restrictToAdult);
      await kv.set(`job:${jobId}`, { ...job, status: 'COMPLETED', resultImage });
      res.status(200).json({ message: 'Job processed successfully.' });

    } catch (predictionError) {
      const errorMessage = predictionError instanceof Error ? predictionError.message : 'Unknown prediction error';
      await kv.set(`job:${jobId}`, { ...job, status: 'FAILED', error: errorMessage });
      // We still return 200 to QStash to prevent retries for a failed job.
      // The failure is recorded in our KV store for the user to see.
      res.status(200).json({ message: `Job failed: ${errorMessage}` });
    }
  } catch (error) {
    console.error('General processing error:', error);
    // If we can't even fetch the job, it's a server error. QStash might retry this.
    res.status(500).json({ message: 'Failed to process job.' });
  }
}
