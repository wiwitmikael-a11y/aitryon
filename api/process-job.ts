// This module contains the core logic for processing a generation job.
import { db } from './lib/db';
import { getGoogleAuthToken } from './lib/google-auth';
import { API_ENDPOINT } from '../src/constants';
import type { VertexAIRequestInstance, VertexAIRequestParameters, VertexAIResponse } from '../src/types';

// Helper to remove the data URL prefix if it exists, as the API expects raw base64 data.
const getBase64Data = (dataUrl: string): string => {
  const parts = dataUrl.split(',');
  if (parts.length === 2) {
    return parts[1];
  }
  return dataUrl; // Assume it's already just base64 data
};

export async function processJob(jobId: string): Promise<void> {
  const job = await db.get(jobId);
  if (!job) {
    console.error(`[Job ${jobId}] Job not found in DB.`);
    return;
  }

  try {
    console.log(`[Job ${jobId}] Starting processing.`);
    await db.update(jobId, { status: 'PROCESSING' });

    const authToken = await getGoogleAuthToken();
    
    const personImageData = getBase64Data(job.personImage);
    const productImageData = getBase64Data(job.productImage);

    const instance: VertexAIRequestInstance = {
      personImage: {
        image: {
          bytesBase64Encoded: personImageData,
        },
      },
      productImages: [
        {
          image: {
            bytesBase64Encoded: productImageData,
          },
        },
      ],
    };

    // The new UI doesn't have an "allow adult" toggle. Defaulting to 'allow_all'.
    const parameters: VertexAIRequestParameters = {
      sampleCount: 1,
      personGeneration: 'allow_all',
    };

    const body = JSON.stringify({
      instances: [instance],
      parameters: parameters,
    });

    console.log(`[Job ${jobId}] Sending request to Vertex AI endpoint.`);
    const response = await fetch(API_ENDPOINT, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${authToken}`,
        'Content-Type': 'application/json; charset=utf-8',
      },
      body,
    });

    if (!response.ok) {
      const errorBody = await response.json().catch(() => ({ error: { message: 'Failed to parse error response' } }));
      console.error(`[Job ${jobId}] API Error:`, errorBody);
      throw new Error(`API request failed with status ${response.status}: ${errorBody.error?.message || 'Unknown error'}`);
    }

    const data: VertexAIResponse = await response.json();
    console.log(`[Job ${jobId}] Received response from Vertex AI.`);

    if (!data.predictions || data.predictions.length === 0 || !data.predictions[0].bytesBase64Encoded) {
      throw new Error('No predictions returned from the API.');
    }

    const firstPrediction = data.predictions[0];
    const resultImage = `data:${firstPrediction.mimeType};base64,${firstPrediction.bytesBase64Encoded}`;

    await db.update(jobId, { status: 'COMPLETED', resultImage: resultImage });
    console.log(`[Job ${jobId}] Job completed successfully.`);

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred during processing.';
    console.error(`[Job ${jobId}] Job failed:`, errorMessage);
    await db.update(jobId, { status: 'FAILED', error: errorMessage });
  }
}
