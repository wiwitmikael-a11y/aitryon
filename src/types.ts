// For Virtual Try-On Job
export type JobStatus = 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED';

export interface Job {
  id: string;
  status: JobStatus;
  personImage: string;
  productImage: string;
  createdAt: number;
  resultImage?: string;
  error?: string;
}

// For Virtual Try-On History
export interface HistoryItem {
  id: string;
  resultImage: string;
  personImage: string;
  productImage: string;
}

// For Vertex AI API call in process-job.ts
export interface VertexAIRequestInstance {
  personImage: {
    image: {
      bytesBase64Encoded: string;
    };
  };
  productImages: [
    {
      image: {
        bytesBase64Encoded: string;
      };
    },
  ];
}

export interface VertexAIRequestParameters {
  sampleCount: number;
  personGeneration: 'allow_all' | 'disallow_all';
}

export interface VertexAIResponse {
  predictions: {
    bytesBase64Encoded: string;
    mimeType: string;
  }[];
}

// For Batch Stock Photo Job
export type BatchJobStatus = 'PENDING' | 'GENERATING_CONCEPTS' | 'PROCESSING_IMAGES' | 'COMPLETED' | 'FAILED';
export interface BatchJobResult {
  prompt: string;
  src: string;
}
export interface BatchJob {
    id: string;
    status: BatchJobStatus;
    topic: string;
    prompts: string[];
    results: BatchJobResult[];
    error?: string;
    createdAt: number;
}

// For Creative Director and Stock Photo assets
export interface AssetMetadata {
  title: string;
  description: string;
  tags: string[];
}
