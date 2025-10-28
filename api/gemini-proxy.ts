import type { VercelRequest, VercelResponse } from '@vercel/node';

/**
 * This is a placeholder API route to resolve module resolution errors.
 * The application's Gemini API calls are made directly from the client-side
 * `geminiService` using an API key provided by the aistudio environment.
 */
export default function handler(
  req: VercelRequest,
  res: VercelResponse,
) {
  res.status(404).json({ message: 'This endpoint is not in use.' });
}
