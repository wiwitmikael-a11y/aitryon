import type { SubmitJobResponse, JobStatusResponse } from '../types';

const getBase64Data = (dataUrl: string): string => {
  const parts = dataUrl.split(',');
  return parts.length === 2 ? parts[1] : dataUrl;
};

export const submitGenerationJob = async (
  personImageBase64: string,
  productImageBase64: string,
  allowAdult: boolean
): Promise<SubmitJobResponse> => {
  const response = await fetch('/api/generate', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      personImage: getBase64Data(personImageBase64),
      productImage: getBase64Data(productImageBase64),
      restrictToAdult: allowAdult,
    }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ message: 'Failed to submit job.' }));
    throw new Error(errorData.message || 'Unknown error occurred while submitting the job.');
  }

  return response.json() as Promise<SubmitJobResponse>;
};

export const checkJobStatus = async (jobId: string): Promise<JobStatusResponse> => {
  const response = await fetch(`/api/status?jobId=${jobId}`);

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ message: 'Failed to check job status.' }));
    throw new Error(errorData.message || 'Unknown error occurred while checking job status.');
  }

  return response.json() as Promise<JobStatusResponse>;
};
