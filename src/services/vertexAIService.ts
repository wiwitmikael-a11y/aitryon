// src/services/vertexAIService.ts

export interface VirtualTryOnJob {
    jobId: string;
}

export interface JobStatus {
    state: 'PENDING' | 'RUNNING' | 'SUCCEEDED' | 'FAILED' | 'CANCELLED';
    resultImageUrl?: string;
    error?: string;
}

export async function startVirtualTryOnJob(personImage: string, clothingImage: string): Promise<VirtualTryOnJob> {
    const response = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ personImage, clothingImage }),
    });

    if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: 'Failed to start job.' }));
        throw new Error(errorData.message || 'An unknown error occurred.');
    }

    return response.json();
}

export async function checkVirtualTryOnJobStatus(jobId: string): Promise<JobStatus> {
    const response = await fetch(`/api/status?id=${jobId}`);

    if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: 'Failed to check job status.' }));
        throw new Error(errorData.message || 'An unknown error occurred.');
    }

    return response.json();
}
