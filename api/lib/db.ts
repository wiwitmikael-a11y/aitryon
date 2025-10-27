import type { Job } from '../../src/types';

// This is a simple in-memory database for demonstration purposes.
// In a production environment, you would use a persistent database like Vercel KV (Redis), a relational DB, or a document store.
const jobStore = new Map<string, Job>();

const db = {
  async get(id: string): Promise<Job | null> {
    return Promise.resolve(jobStore.get(id) || null);
  },
  
  async set(id: string, job: Job): Promise<void> {
    jobStore.set(id, job);
    return Promise.resolve();
  },

  async update(id: string, updates: Partial<Job>): Promise<void> {
    const job = jobStore.get(id);
    if (job) {
      jobStore.set(id, { ...job, ...updates });
    } else {
      console.warn(`Attempted to update a non-existent job with id: ${id}`);
    }
    return Promise.resolve();
  },
};

export { db };
