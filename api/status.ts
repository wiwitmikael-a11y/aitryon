// This is a serverless function that acts as the API endpoint for checking a job's status.
import type { NextApiRequest, NextApiResponse } from 'next';
import { db } from './lib/db';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    return res.status(405).json({ message: 'Method Not Allowed' });
  }

  const { jobId } = req.query;

  if (!jobId || typeof jobId !== 'string') {
    return res.status(400).json({ message: 'jobId query parameter is required' });
  }

  const job = await db.get(jobId);

  if (!job) {
    return res.status(404).json({ message: 'Job not found' });
  }

  res.status(200).json({ job });
}
