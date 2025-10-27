import { kv } from '@vercel/kv';
import { nanoid } from 'nanoid';
import { Client } from '@upstash/qstash';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import type { Job } from '../src/types';

const qstashClient = new Client({
  token: process.env.QSTASH_TOKEN!,
});

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method Not Allowed' });
  }

  try {
    const { personImage, productImage, restrictToAdult } = req.body;
    if (!personImage || !productImage) {
      return res.status(400).json({ message: 'Missing person or product image data.' });
    }

    const jobId = nanoid();
    const appUrl = process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000';

    const newJob: Job = {
      id: jobId,
      status: 'PENDING',
      personImage,
      productImage,
      createdAt: Date.now(),
    };

    // Store the initial job state in KV
    await kv.set(`job:${jobId}`, newJob, { ex: 86400 }); // Expire in 24 hours

    // Publish to QStash to be processed by the worker
    await qstashClient.publishJSON({
      url: `${appUrl}/api/process-job`,
      body: { jobId, restrictToAdult },
      retries: 3,
    });

    res.status(202).json({ jobId });

  } catch (error) {
    console.error('Error submitting job:', error);
    res.status(500).json({ message: 'Failed to submit job for processing.' });
  }
}
