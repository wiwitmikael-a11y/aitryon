import type { VercelRequest, VercelResponse } from '@vercel/node';
import { db } from './lib/db';
import type { Job } from '../src/types';

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

    const jobId = Date.now().toString(36) + Math.random().toString(36).substring(2);
    const newJob: Job = {
      id: jobId,
      status: 'PENDING',
      personImage,
      productImage,
      createdAt: Date.now(),
    };

    await db.set(jobId, newJob);

    // Trigger the background processing job without waiting for it to complete.
    // The URL needs to be absolute for server-to-server fetch.
    const host = req.headers.host || 'localhost:3000';
    const protocol = process.env.NODE_ENV === 'production' ? 'https' : 'http';
    const processUrl = `${protocol}://${host}/api/process-job`;
    
    // Fire-and-forget, log errors if any
    fetch(processUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jobId }),
    }).catch(console.error); 

    res.status(202).json({ jobId });
  } catch (error) {
    console.error('Error in /api/generate:', error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
}
