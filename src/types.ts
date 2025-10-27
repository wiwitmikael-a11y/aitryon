// Types for the asynchronous job queue system
export type JobStatus = 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED';

export interface Job {
  id: string;
  status: JobStatus;
  error?: string | null;
  personImage: string;
  productImage: string;
  resultImage?: string | null;
  createdAt: number;
}

// Types for the client-side history
export interface HistoryItem {
  id: string;
  personImage: string;
  productImage: string;
  resultImage: string;
  createdAt: number;
}

// Type for the API response when submitting a job
export interface SubmitJobResponse {
  jobId: string;
}

// Type for the API response when checking job status
export interface JobStatusResponse {
  job: Job;
}
