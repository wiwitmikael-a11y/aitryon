
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
