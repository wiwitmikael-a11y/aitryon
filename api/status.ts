import type { NextApiRequest, NextApiResponse } from 'next';
import { getJob } from './lib/db';

/**
 * API route to check the status of a job.
 * It retrieves the job from the in-memory store and returns it.
 */
export default function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    return res.status(405).json({ message: 'Method Not Allowed' });
  }

  const { jobId } = req.query;

  if (typeof jobId !== 'string' || !jobId) {
    return res.status(400).json({ message: 'Query parameter "jobId" is required.' });
  }

  try {
    const job = getJob(jobId);

    if (!job) {
      return res.status(404).json({ message: `Job with ID "${jobId}" not found.` });
    }

    return res.status(200).json({ job });
  } catch (error) {
    console.error(`Error fetching status for job ${jobId}:`, error);
    return res.status(500).json({ message: 'Internal Server Error' });
  }
}
