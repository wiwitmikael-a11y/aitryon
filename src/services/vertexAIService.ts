import type { Job } from '../types';

export const submitGenerationJob = async (
  personImage: string,
  productImage: string
): Promise<{ jobId: string }> => {
  const response = await fetch('/api/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ personImage, productImage }),
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.message || 'Failed to submit job for processing.');
  }
  
  return data;
};

export const checkJobStatus = async (jobId: string): Promise<Job> => {
  const response = await fetch(`/api/status?jobId=${jobId}`);
  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || 'Failed to fetch job status.');
  }
  
  return data.job;
};
