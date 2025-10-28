import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getGoogleAuthToken } from './lib/google-auth';
import { VERTEX_AI_API_BASE, VIRTUAL_TRY_ON_MODEL_ID } from '../src/constants';
import type { VertexAIRequestInstance, VertexAIRequestParameters, VertexAIResponse } from '../src/types';

// Helper to remove the data URL prefix if it exists
const getBase64Data = (dataUrl: string): string => {
  const parts = dataUrl.split(',');
  if (parts.length === 2) {
    return parts[1];
  }
  return dataUrl; // Assume it's already just base64 data
};

const API_ENDPOINT = `${VERTEX_AI_API_BASE}/publishers/google/models/${VIRTUAL_TRY_ON_MODEL_ID}:predict`;


export default async function handler(
  req: VercelRequest,
  res: VercelResponse,
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method Not Allowed' });
  }

  try {
    const { personImage, productImage } = req.body;

    if (!personImage || !productImage) {
      return res.status(400).json({ message: 'Missing personImage or productImage' });
    }

    const authToken = await getGoogleAuthToken();
    
    const personImageData = getBase64Data(personImage);
    const productImageData = getBase64Data(productImage);

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

    const parameters: VertexAIRequestParameters = {
      sampleCount: 1,
      personGeneration: 'allow_all', 
    };

    const body = JSON.stringify({
      instances: [instance],
      parameters: parameters,
    });

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
      throw new Error(`API request failed with status ${response.status}: ${errorBody.error?.message || 'Unknown error'}`);
    }

    const data: VertexAIResponse = await response.json();

    if (!data.predictions || data.predictions.length === 0 || !data.predictions[0].bytesBase64Encoded) {
      throw new Error('No predictions returned from the API.');
    }

    const firstPrediction = data.predictions[0];
    const resultImage = `data:${firstPrediction.mimeType};base64,${firstPrediction.bytesBase64Encoded}`;
    
    res.status(200).json({ resultImage });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'An unknown processing error occurred.';
    console.error(`Error in /api/generate:`, error);
    res.status(500).json({ message: errorMessage });
  }
}
