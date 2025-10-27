import { API_ENDPOINT } from '../constants';
import type { VertexAIRequestInstance, VertexAIRequestParameters, VertexAIResponse } from '../types';

// Helper to remove the data URL prefix if it exists
const getBase64Data = (dataUrl: string): string => {
  const parts = dataUrl.split(',');
  if (parts.length === 2) {
    return parts[1];
  }
  return dataUrl; // Assume it's already just base64 data
};

export const generateTryOnImage = async (
  personImageBase64: string,
  productImageBase64: string,
  allowAdult: boolean
): Promise<string> => {
  // Fix: Use process.env.API_KEY to align with guidelines and fix build errors.
  const apiKey = process.env.API_KEY;

  if (!apiKey) {
    throw new Error('API key is not configured. Please set the API_KEY environment variable.');
  }

  // API expects base64 data without the data URI prefix
  const personImageData = getBase64Data(personImageBase64);
  const productImageData = getBase64Data(productImageBase64);

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
    personGeneration: allowAdult ? 'allow_adult' : 'allow_all',
  };

  const body = JSON.stringify({
    instances: [instance],
    parameters: parameters,
  });

  const response = await fetch(API_ENDPOINT, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json; charset=utf-8',
    },
    body,
  });

  if (!response.ok) {
    const errorBody = await response.json().catch(() => ({ error: { message: 'Failed to parse error response' } }));
    console.error('API Error:', errorBody);
    throw new Error(`API request failed with status ${response.status}: ${errorBody.error?.message || 'Unknown error'}`);
  }

  const data: VertexAIResponse = await response.json();

  if (!data.predictions || data.predictions.length === 0 || !data.predictions[0].bytesBase64Encoded) {
    throw new Error('No predictions returned from the API.');
  }

  const firstPrediction = data.predictions[0];
  return `data:${firstPrediction.mimeType};base64,${firstPrediction.bytesBase64Encoded}`;
};
