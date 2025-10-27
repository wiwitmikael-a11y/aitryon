import { kv } from '@vercel/kv';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import type { Job } from '../src/types';

export default async function handler(req: VercelRequest, res: VercelResponse) {
    if (req.method !== 'GET') {
        return res.status(405).json({ message: 'Method Not Allowed' });
    }

    const { jobId } = req.query;

    if (!jobId || typeof jobId !== 'string') {
        return res.status(400).json({ message: 'Job ID is required.' });
    }

    try {
        const job = await kv.get<Job>(`job:${jobId}`);

        if (!job) {
            return res.status(404).json({ message: `Job with ID ${jobId} not found.` });
        }

        res.status(200).json({ job });
    } catch (error) {
        console.error('Error fetching job status:', error);
        res.status(500).json({ message: 'Failed to fetch job status.' });
    }
}
