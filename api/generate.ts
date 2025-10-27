import type { NextApiRequest, NextApiResponse } from 'next';
import { createJob } from './lib/db';
import { processJob } from './process-job';

/**
 * API route to submit a new virtual try-on job.
 * It creates a job, starts processing it asynchronously,
 * and returns the job ID to the client.
 */
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ message: 'Method Not Allowed' });
  }

  try {
    const { personImage, productImage } = req.body;

    if (!personImage || !productImage) {
      return res.status(400).json({ message: 'Missing personImage or productImage' });
    }

    const job = createJob({ personImage, productImage });

    // Start processing asynchronously without waiting for it to finish.
    // The client will poll the status endpoint.
    processJob(job.id).catch(console.error);

    return res.status(202).json({ jobId: job.id });
  } catch (error) {
    console.error('Error in /api/generate:', error);
    return res.status(500).json({ message: 'Internal Server Error' });
  }
}
