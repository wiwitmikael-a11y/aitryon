import { kv } from '@vercel/kv';
import { v4 as uuidv4 } from 'uuid';
import { Client } from '@upstash/qstash';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import type { Job } from '../src/types';

export default async function handler(req: VercelRequest, res: VercelResponse) {
    if (req.method !== 'POST') {
        return res.status(405).json({ message: 'Method Not Allowed' });
    }

    // --- Configuration Validation ---
    if (!process.env.QSTASH_TOKEN) {
        console.error("Server Error: QSTASH_TOKEN environment variable is not set.");
        return res.status(500).json({ message: 'Server configuration error: QStash token is missing.' });
    }
    if (!process.env.KV_URL || !process.env.KV_REST_API_TOKEN) {
        console.error("Server Error: Vercel KV environment variables are not set.");
        return res.status(500).json({ message: 'Server configuration error: KV database is not connected.' });
    }

    try {
        const { personImage, productImage } = req.body;

        if (!personImage || !productImage) {
            return res.status(400).json({ message: 'Missing person or product image.' });
        }
        
        const jobId = uuidv4();
        const job: Job = {
            id: jobId,
            status: 'PENDING',
            personImage,
            productImage,
            createdAt: Date.now(),
        };

        // 1. Store the initial job state in Vercel KV
        await kv.set(`job:${jobId}`, job, { ex: 60 * 60 }); // Expire in 1 hour

        // 2. Publish the job to the QStash queue for reliable processing
        const qstashClient = new Client({ token: process.env.QSTASH_TOKEN });
        const appUrl = process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000';
        const destinationUrl = `${appUrl}/api/process-job`;

        await qstashClient.publishJSON({
            url: destinationUrl,
            body: { jobId },
            headers: { 'Content-Type': 'application/json' },
        });

        // 3. Immediately respond to the client with the Job ID
        res.status(202).json({ jobId });

    } catch (error) {
        console.error('Error submitting job to QStash:', error);
        res.status(500).json({ message: 'Failed to submit job for processing.' });
    }
}
