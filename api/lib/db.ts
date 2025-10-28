import { kv } from "@vercel/kv";
import type { Job, BatchJob } from '../../src/types.js';

// Use a union type for things we can store
type Storable = Job | BatchJob;

const db = {
  async get<T extends Storable>(id: string): Promise<T | null> {
    // Vercel KV's get method returns the value or null if not found.
    return kv.get<T>(id);
  },
  
  async set<T extends Storable>(id: string, data: T): Promise<void> {
    // Set the job with a Time-To-Live (TTL) of 24 hours (86400 seconds)
    // to prevent old jobs from cluttering the database.
    await kv.set(id, data, { ex: 86400 });
  },

  async update<T extends Storable>(id: string, updates: Partial<T>): Promise<void> {
    const data = await kv.get<T>(id);
    if (data) {
      const updatedData = { ...data, ...updates };
      // When updating, also extend the TTL.
      await kv.set(id, updatedData, { ex: 86400 });
    } else {
      console.warn(`Attempted to update a non-existent item with id: ${id}`);
    }
  },
};

export { db };
