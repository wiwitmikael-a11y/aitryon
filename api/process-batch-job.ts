import type { VercelRequest, VercelResponse } from '@vercel/node';
import { db } from './lib/db';
import type { BatchJob, BatchJobResult } from '../src/types';
import { GoogleGenAI, HarmCategory, HarmBlockThreshold } from '@google/genai';

const getAi = () => new GoogleGenAI({ apiKey: process.env.API_KEY! });

const safetySettings = [
  { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
  { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
  { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
  { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
];

export default async function handler(
  req: VercelRequest,
  res: VercelResponse,
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method Not Allowed' });
  }

  const { jobId } = req.body;

  if (!jobId || typeof jobId !== 'string') {
    return res.status(400).json({ message: 'Missing or invalid jobId' });
  }
  
  res.status(202).end();

  try {
    const job = await db.get<BatchJob>(jobId);
    if (!job) {
      console.error(`Batch job not found: ${jobId}`);
      return;
    }

    await db.update<BatchJob>(jobId, { status: 'PROCESSING_IMAGES' });

    const ai = getAi();
    const results: BatchJobResult[] = [];

    for (const prompt of job.prompts) {
        try {
            const response = await ai.models.generateImages({
                model: 'imagen-4.0-generate-001',
                prompt,
                config: {
                    numberOfImages: 1,
                    aspectRatio: '16:9',
                    outputMimeType: 'image/png',
                    safetySettings: safetySettings,
                }
            });
            const image = response.generatedImages[0];
            const src = `data:image/png;base64,${image.image.imageBytes}`;
            results.push({ prompt, src });
            
            // Update DB after each successful generation
            await db.update<BatchJob>(jobId, { results: [...results] });

        } catch (imageError) {
             console.error(`Error generating image for prompt in job ${jobId}: "${prompt}"`, imageError);
             // Continue to the next prompt
        }
    }
    
    await db.update<BatchJob>(jobId, { status: 'COMPLETED' });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'An unknown processing error occurred.';
    console.error(`Error processing batch job ${jobId}:`, error);
    await db.update<BatchJob>(jobId, { status: 'FAILED', error: errorMessage });
  }
}
