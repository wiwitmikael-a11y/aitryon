import type { VercelRequest, VercelResponse } from '@vercel/node';
import { db } from './lib/db';
import type { Job } from '../src/types';

export default async function handler(
  req: VercelRequest,
  res: VercelResponse,
) {
  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Method Not Allowed' });
  }

  const { jobId } = req.query;

  if (!jobId || typeof jobId !== 'string') {
    return res.status(400).json({ message: 'Missing or invalid jobId' });
  }

  try {
    // FIX: Use generic type argument for db.get
    const job = await db.get<Job>(jobId);
    if (job) {
      res.status(200).json({ job });
    } else {
      res.status(404).json({ message: 'Job not found' });
    }
  } catch (error) {
    console.error(`Error fetching status for job ${jobId}:`, error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
}
