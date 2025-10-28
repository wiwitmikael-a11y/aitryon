import type { VercelRequest, VercelResponse } from '@vercel/node';
import { db } from './lib/db';
import type { BatchJob } from '../src/types';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method Not Allowed' });
  }

  try {
    const { prompts, aspectRatio } = req.body;

    if (!prompts || !Array.isArray(prompts) || prompts.length === 0) {
      return res.status(400).json({ message: 'Missing or invalid prompts array.' });
    }
    if (!aspectRatio || !['1:1', '16:9', '9:16'].includes(aspectRatio)) {
      return res.status(400).json({ message: 'Missing or invalid aspectRatio.' });
    }

    const jobId = Date.now().toString(36) + Math.random().toString(36).substring(2);
    const newJob: BatchJob = {
      id: jobId,
      status: 'PENDING',
      prompts,
      aspectRatio,
      results: prompts.map((p, i) => ({ id: `image-${i}`, prompt: p, status: 'pending' })),
      createdAt: Date.now(),
    };

    await db.set(jobId, newJob);

    // Trigger the background processing job
    const host = req.headers.host || 'localhost:3000';
    const protocol = process.env.NODE_ENV === 'production' ? 'https' : 'http';
    const processUrl = `${protocol}://${host}/api/process-batch-job`;
    
    // Fire-and-forget
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