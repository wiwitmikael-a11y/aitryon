import type { VercelRequest, VercelResponse } from '@vercel/node';
import { db } from './lib/db';
import type { BatchJob, BatchImageResult } from '../src/types';
import { GoogleGenAI } from "@google/genai";

if (!process.env.API_KEY) {
    throw new Error("API_KEY environment variable is not set.");
}
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });


async function generateImageForPrompt(prompt: string, aspectRatio: '1:1' | '16:9' | '9:16'): Promise<{src: string}> {
    const imageResponse = await ai.models.generateImages({
        model: 'imagen-4.0-generate-001',
        prompt: prompt,
        config: {
            numberOfImages: 1,
            aspectRatio: aspectRatio,
            outputMimeType: "image/png"
        },
    });
    
    const image = imageResponse.generatedImages[0];
    if (!image?.image.imageBytes) throw new Error("Image generation failed, no bytes returned.");

    const src = `data:image/png;base64,${image.image.imageBytes}`;
    return { src };
}


export default async function handler(req: VercelRequest, res: VercelResponse) {
    if (req.method !== 'POST') {
        return res.status(405).json({ message: 'Method Not Allowed' });
    }

    const { jobId } = req.body;
    if (!jobId || typeof jobId !== 'string') {
        return res.status(400).json({ message: 'Missing or invalid jobId' });
    }
  
    // Respond quickly to the caller
    res.status(202).end();

    let job: BatchJob | null = null;
    try {
        job = await db.get<BatchJob>(jobId);
        if (!job) {
            console.error(`Batch job not found: ${jobId}`);
            return;
        }

        await db.update<BatchJob>(jobId, { status: 'PROCESSING' });
        
        const updatedResults = [...job.results];

        for (let i = 0; i < job.prompts.length; i++) {
            const prompt = job.prompts[i];
            const resultIndex = updatedResults.findIndex(r => r.id === `image-${i}`);
            
            if (resultIndex === -1) continue;

            // Update status to 'generating' before starting this specific image
            updatedResults[resultIndex].status = 'generating';
            await db.update<BatchJob>(jobId, { results: updatedResults });

            try {
                const { src } = await generateImageForPrompt(prompt, job.aspectRatio);
                updatedResults[resultIndex].status = 'complete';
                updatedResults[resultIndex].src = src;
            } catch (error) {
                updatedResults[resultIndex].status = 'failed';
                updatedResults[resultIndex].error = error instanceof Error ? error.message : 'Unknown generation error.';
                console.error(`Failed to generate image for prompt: "${prompt}"`, error);
            }
            // IMPORTANT: Update DB after each image generation to provide real-time progress
            await db.update<BatchJob>(jobId, { results: updatedResults });
        }
        
        await db.update<BatchJob>(jobId, { status: 'COMPLETED' });

    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'An unknown processing error occurred.';
        console.error(`Error processing batch job ${jobId}:`, error);
        if (jobId) {
             await db.update<BatchJob>(jobId, { status: 'FAILED', error: errorMessage });
        }
    }
}