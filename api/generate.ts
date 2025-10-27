// This is a serverless function that acts as the API endpoint for starting a generation job.
import type { NextApiRequest, NextApiResponse } from 'next';
import { db } from './lib/db';
import { processJob } from './process-job';
import type { Job } from '../src/types';
import { randomUUID } from 'crypto';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ message: 'Method Not Allowed' });
  }

  const { personImage, productImage } = req.body;

  if (!personImage || !productImage) {
    return res.status(400).json({ message: 'Missing personImage or productImage' });
  }

  const jobId = randomUUID();

  const newJob: Job = {
    id: jobId,
    status: 'PENDING',
    personImage,
    productImage,
    createdAt: Date.now(),
  };

  await db.set(jobId, newJob);

  // Fire-and-forget the job processing.
  // In a real-world serverless environment, this has limitations (e.g., function timeouts).
  // A more robust solution would use a dedicated queueing service.
  processJob(jobId);

  // Respond immediately with 202 Accepted, so the client can start polling.
  res.status(202).json({ jobId });
}
