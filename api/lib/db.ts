// A simple in-memory database for demonstration purposes.
// In a real application, you would use a persistent database like Firestore, Redis, or a SQL database.

interface Job {
    id: string;
    state: 'PENDING' | 'RUNNING' | 'SUCCEEDED' | 'FAILED' | 'CANCELLED';
    resultImageUrl?: string;
    error?: string;
    operationName?: string; // To store the long-running operation name from Vertex AI
}

const jobs = new Map<string, Job>();

export async function createJob(id: string, initialState: Partial<Job> = {}): Promise<Job> {
    const job: Job = {
        id,
        state: 'PENDING',
        ...initialState
    };
    jobs.set(id, job);
    return job;
}

export async function getJob(id: string): Promise<Job | undefined> {
    return jobs.get(id);
}

export async function updateJob(id: string, updates: Partial<Job>): Promise<Job | undefined> {
    const job = jobs.get(id);
    if (job) {
        const updatedJob = { ...job, ...updates };
        jobs.set(id, updatedJob);
        return updatedJob;
    }
    return undefined;
}
