import type { VercelRequest, VercelResponse } from '@vercel/node';
import { db } from './lib/db';
import type { BatchJob } from '../src/types';
import { GoogleGenAI, Type, HarmCategory, HarmBlockThreshold } from '@google/genai';

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

  try {
    const { topic } = req.body;

    if (!topic || typeof topic !== 'string') {
      return res.status(400).json({ message: 'Missing or invalid topic' });
    }

    const ai = getAi();
    const prompt = `Generate 5 distinct, highly-detailed, and commercially-viable stock photo concepts based on the following topic: "${topic}". Each concept should be a single, complete sentence ready to be used as an image generation prompt.`;
            
    const response = await ai.models.generateContent({
        model: 'gemini-2.5-pro',
        contents: prompt,
        config: {
            temperature: 0.8,
            maxOutputTokens: 1024,
            responseMimeType: 'application/json',
            responseSchema: {
                type: Type.OBJECT,
                properties: {
                    concepts: {
                        type: Type.ARRAY,
                        items: { type: Type.STRING }
                    }
                }
            },
            safetySettings: safetySettings,
        }
    });

    const result = JSON.parse(response.text);
    const concepts = result.concepts;
    
    if (!concepts || !Array.isArray(concepts) || concepts.length === 0) {
        throw new Error("Failed to generate valid concepts from the topic.");
    }

    const jobId = Date.now().toString(36) + Math.random().toString(36).substring(2);
    const newJob: BatchJob = {
      id: jobId,
      status: 'PENDING',
      topic,
      prompts: concepts,
      results: [],
      createdAt: Date.now(),
    };

    await db.set<BatchJob>(jobId, newJob);

    const host = req.headers.host || 'localhost:3000';
    const protocol = process.env.NODE_ENV === 'production' ? 'https' : 'http';
    const processUrl = `${protocol}://${host}/api/process-batch-job`;
    
    fetch(processUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jobId }),
    }).catch(console.error); 

    res.status(202).json({ jobId });
  } catch (error) {
    console.error('Error in /api/start-batch-job:', error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
}
