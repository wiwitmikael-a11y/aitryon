import { getJob, updateJob } from './lib/db';
import { getGoogleAuthToken } from './lib/google-auth';
import { API_ENDPOINT } from '../src/constants';
import type { VertexAIRequestInstance, VertexAIRequestParameters, VertexAIResponse } from '../src/types';

/**
 * Removes the data URL prefix from a base64 string.
 * @param dataUrl - The base64 string with a data URL prefix.
 * @returns The raw base64 data.
 */
const getBase64Data = (dataUrl: string): string => {
  if (dataUrl.includes(',')) {
    return dataUrl.split(',')[1];
  }
  return dataUrl;
};

/**
 * Processes a single virtual try-on job.
 * This function is designed to be called asynchronously.
 * It fetches data, calls the Vertex AI API, and updates the job status.
 * @param jobId - The ID of the job to process.
 */
export async function processJob(jobId: string): Promise<void> {
  const job = getJob(jobId);
  if (!job) {
    console.error(`Job not found: ${jobId}`);
    return;
  }

  try {
    updateJob(jobId, { status: 'PROCESSING' });

    const authToken = await getGoogleAuthToken();
    
    const personImageData = getBase64Data(job.personImage);
    const productImageData = getBase64Data(job.productImage);

    const instance: VertexAIRequestInstance = {
      personImage: { image: { bytesBase64Encoded: personImageData } },
      productImages: [{ image: { bytesBase64Encoded: productImageData } }],
    };

    const parameters: VertexAIRequestParameters = {
      sampleCount: 1,
      personGeneration: 'allow_all', // Defaulting to 'allow_all' as no UI option is present in the async version
    };

    const body = JSON.stringify({ instances: [instance], parameters });
  
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
      const errorMessage = errorBody.error?.message || `API request failed with status ${response.status}`;
      throw new Error(errorMessage);
    }

    const data: VertexAIResponse = await response.json();

    if (!data.predictions?.[0]?.bytesBase64Encoded) {
      throw new Error('No predictions returned from the API.');
    }

    const prediction = data.predictions[0];
    const resultImage = `data:${prediction.mimeType};base64,${prediction.bytesBase64Encoded}`;

    updateJob(jobId, { status: 'COMPLETED', resultImage });

  } catch (error: any) {
    console.error(`Error processing job ${jobId}:`, error);
    updateJob(jobId, { status: 'FAILED', error: error.message || 'An unknown error occurred' });
  }
}
