import type { Job } from '../../src/types';

// In-memory store for jobs. In a production environment, this would be replaced
// with a persistent database like Redis, PostgreSQL, or Firestore.
const jobs = new Map<string, Job>();

/**
 * Creates a new job and stores it.
 * @param jobData - The initial data for the job.
 * @returns The created job object.
 */
export function createJob(jobData: Omit<Job, 'id' | 'status' | 'createdAt'>): Job {
  const id = crypto.randomUUID();
  const job: Job = {
    id,
    status: 'PENDING',
    createdAt: Date.now(),
    ...jobData,
  };
  jobs.set(id, job);
  return job;
}

/**
 * Retrieves a job by its ID.
 * @param id - The ID of the job to retrieve.
 * @returns The job object, or undefined if not found.
 */
export function getJob(id: string): Job | undefined {
  return jobs.get(id);
}

/**
 * Updates an existing job.
 * @param id - The ID of the job to update.
 * @param updates - An object with the fields to update.
 * @returns The updated job object, or undefined if the job was not found.
 */
export function updateJob(id:string, updates: Partial<Omit<Job, 'id'>>): Job | undefined {
  const job = jobs.get(id);
  if (job) {
    const updatedJob = { ...job, ...updates };
    jobs.set(id, updatedJob);
    return updatedJob;
  }
  return undefined;
}
