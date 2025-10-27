// api/generate.ts
import type { VertexAIRequestInstance, VertexAIRequestParameters, VertexAIResponse } from '../src/types';
import { API_ENDPOINT } from '../src/constants';

// This is a Vercel Edge Function, which runs on a Node.js-like environment.
export const config = {
  runtime: 'edge',
};

// Helper to remove the data URL prefix
const getBase64Data = (dataUrl: string): string => {
  const parts = dataUrl.split(',');
  return parts.length === 2 ? parts[1] : dataUrl;
};

export default async function handler(request: Request) {
  if (request.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    const { personImageBase64, productImageBase64, allowAdult } = await request.json();

    if (!personImageBase64 || !productImageBase64) {
      return new Response(JSON.stringify({ error: 'Missing image data' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Securely get the API key from server-side environment variables
    const apiKey = process.env.API_KEY;
    if (!apiKey) {
      console.error('API_KEY is not set on the server.');
      return new Response(JSON.stringify({ error: 'Server configuration error: API key missing.' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    
    const instance: VertexAIRequestInstance = {
      personImage: { image: { bytesBase64Encoded: getBase64Data(personImageBase64) } },
      productImages: [{ image: { bytesBase64Encoded: getBase64Data(productImageBase64) } }],
    };

    const parameters: VertexAIRequestParameters = {
      sampleCount: 1,
      personGeneration: allowAdult ? 'allow_adult' : 'allow_all',
    };

    const body = JSON.stringify({ instances: [instance], parameters });

    // Call the actual Vertex AI API from the server
    const apiResponse = await fetch(API_ENDPOINT, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json; charset=utf-8',
      },
      body,
    });

    if (!apiResponse.ok) {
      const errorBody = await apiResponse.json().catch(() => ({ error: { message: 'Failed to parse error response from Google API' }}));
      console.error('Google API Error:', errorBody);
      const errorMessage = errorBody.error?.message || 'Unknown error from Google API';
      return new Response(JSON.stringify({ error: `API request failed: ${errorMessage}` }), {
        status: apiResponse.status,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const data: VertexAIResponse = await apiResponse.json();

    // Send the successful response back to the frontend
    return new Response(JSON.stringify(data), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });

  } catch (err) {
    console.error('Internal Server Error:', err);
    return new Response(JSON.stringify({ error: 'An unexpected error occurred on the server.' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
