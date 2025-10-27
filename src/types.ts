// Types based on the provided Vertex AI Virtual Try-On API documentation

export interface VertexAIRequestInstance {
  personImage: {
    image: {
      bytesBase64Encoded: string;
    };
  };
  productImages: {
    image: {
      bytesBase64Encoded: string;
    };
  }[];
}

export interface VertexAIRequestParameters {
  sampleCount: number;
  personGeneration: 'allow_adult' | 'allow_all' | 'dont_allow';
}

export interface VertexAIPrediction {
  mimeType: string;
  bytesBase64Encoded: string;
}

export interface VertexAIResponse {
  predictions: VertexAIPrediction[];
}

// Job and History types for async processing
export type JobStatus = 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED';

export interface Job {
  id: string;
  status: JobStatus;
  personImage: string;
  productImage: string;
  resultImage?: string;
  error?: string;
  createdAt: number;
}

export interface HistoryItem {
  id: string;
  resultImage: string;
  personImage: string;
  productImage: string;
}

// Types for Guide Modal
export interface GuideExample {
  type: 'good' | 'bad';
  text: string;
}

export interface Guidelines {
  title: string;
  examples: GuideExample[];
}
