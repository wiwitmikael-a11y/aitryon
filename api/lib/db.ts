import { createKV } from "@vercel/kv";
import type { Job } from '../../src/types';

// createKV will automatically use the Vercel KV environment variables
// that you have already set (KV_URL, KV_REST_API_TOKEN, etc.)
const kv = createKV();

const db = {
  async get(id: string): Promise<Job | null> {
    // Vercel KV's get method returns the value or null if not found.
    return kv.get<Job>(id);
  },
  
  async set(id: string, job: Job): Promise<void> {
    // Set the job with a Time-To-Live (TTL) of 24 hours (86400 seconds)
    // to prevent old jobs from cluttering the database.
    await kv.set(id, job, { ex: 86400 });
  },

  async update(id: string, updates: Partial<Job>): Promise<void> {
    const job = await kv.get<Job>(id);
    if (job) {
      const updatedJob = { ...job, ...updates };
      // When updating, also extend the TTL.
      await kv.set(id, updatedJob, { ex: 86400 });
    } else {
      console.warn(`Attempted to update a non-existent job with id: ${id}`);
    }
  },
};

export { db };