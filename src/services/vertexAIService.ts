// src/services/vertexAIService.ts
import type { VertexAIResponse } from '../types';

export const generateTryOnImage = async (
  personImageBase64: string,
  productImageBase64: string,
  allowAdult: boolean
): Promise<string> => {
  // The frontend now calls our own secure backend endpoint
  const response = await fetch('/api/generate', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      personImageBase64,
      productImageBase64,
      allowAdult,
    }),
  });

  const data = await response.json();

  if (!response.ok) {
    // The error message now comes from our backend proxy
    throw new Error(data.error || 'An unknown error occurred.');
  }

  const responseData = data as VertexAIResponse;

  if (!responseData.predictions || responseData.predictions.length === 0 || !responseData.predictions[0].bytesBase64Encoded) {
    throw new Error('No valid predictions returned from the backend.');
  }

  const firstPrediction = responseData.predictions[0];
  return `data:${firstPrediction.mimeType};base64,${firstPrediction.bytesBase64Encoded}`;
};
