import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getJob } from './lib/db';

export default async function handler(req: VercelRequest, res: VercelResponse) {
    if (req.method !== 'GET') {
        return res.status(405).json({ message: 'Method Not Allowed' });
    }

    const { id } = req.query;

    if (!id || typeof id !== 'string') {
        return res.status(400).json({ message: 'Job ID is required.' });
    }

    try {
        const job = await getJob(id);

        if (!job) {
            return res.status(404).json({ message: 'Job not found.' });
        }

        res.status(200).json({
            state: job.state,
            resultImageUrl: job.resultImageUrl,
            error: job.error,
        });

    } catch (error) {
        console.error('Error fetching job status:', error);
        res.status(500).json({ message: 'Failed to fetch job status.' });
    }
}
