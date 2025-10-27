import type { Job } from '../../src/types';

// WARNING: This is an in-memory database.
// It will not persist data across server restarts or different serverless function instances.
// For a production environment, use a persistent database like Vercel KV, Upstash, Redis, or Firestore.
const jobStore = new Map<string, Job>();

export const db = {
  get: async (id: string): Promise<Job | null> => {
    return jobStore.get(id) || null;
  },
  set: async (id: string, job: Job): Promise<void> => {
    jobStore.set(id, job);
  },
  update: async (id: string, updates: Partial<Job>): Promise<Job | null> => {
    const job = jobStore.get(id);
    if (job) {
      const updatedJob = { ...job, ...updates };
      jobStore.set(id, updatedJob);
      return updatedJob;
    }
    return null;
  },
};
