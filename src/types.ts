// For Virtual Try-On job
export interface Job {
  id: string;
  status: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED';
  personImage: string;
  productImage: string;
  createdAt: number;
  resultImage?: string;
  error?: string;
}

// For Virtual Try-On history
export interface HistoryItem {
    id: string;
    personImage: string;
    productImage: string;
    resultImage: string;
}

// For Virtual Try-On API call
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
    }
  ];
}

export interface VertexAIRequestParameters {
  sampleCount: number;
  personGeneration: 'allow_all';
}

export interface VertexAIResponse {
    predictions: {
        bytesBase64Encoded: string;
        mimeType: string;
    }[];
}


// For Batch Stock Photo Generation
export interface BatchImageResult {
    id: string; // Corresponds to the index/id from the initial prompt list
    prompt: string;
    status: 'pending' | 'generating' | 'complete' | 'failed';
    src?: string; // base64 data URL
    error?: string;
}

export interface BatchJob {
    id: string;
    status: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED';
    prompts: string[];
    results: BatchImageResult[];
    createdAt: number;
    aspectRatio: '1:1' | '16:9' | '9:16';
    error?: string;
}