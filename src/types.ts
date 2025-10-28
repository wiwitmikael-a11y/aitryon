// src/types.ts

export interface HistoryItem {
  id: string;
  personImage: string;
  productImage: string;
  resultImage: string;
}

export interface BatchImageResult {
  id: string;
  src: string | null;
  status: 'pending' | 'generating' | 'complete' | 'failed';
  error?: string;
}
