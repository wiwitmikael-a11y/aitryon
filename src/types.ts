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
