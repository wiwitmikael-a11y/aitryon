import type { BatchJob } from '../types';

export interface AssetMetadata {
    title: string;
    description: string;
    tags: string[];
}

export interface StockImageResult {
    src: string; // base64 data url
    metadata?: AssetMetadata;
}

async function callGeminiProxy<T = any>(task: string, payload: object): Promise<T> {
    const response = await fetch('/api/gemini-proxy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ task, ...payload }),
    });

    if (!response.ok) {
        let errorMessage = `API call failed with status ${response.status}`;
        try {
            // Try to get a specific error message from the JSON body
            const errorData = await response.json();
            errorMessage = errorData.error || JSON.stringify(errorData);
        } catch (e) {
            // If the body isn't JSON, it's likely an HTML error page from Vercel.
            errorMessage = `A server error occurred (status ${response.status}). The response was not in a valid JSON format. Please check the server logs.`;
        }
        throw new Error(errorMessage);
    }

    return response.json();
}

export const generateCreativeStrategy = async (
    { topic, photoCount, videoCount }: { topic: string, photoCount: number, videoCount: number }
): Promise<{ photoPrompts: string[], videoPrompts: string[] }> => {
    return callGeminiProxy('generateCreativeStrategy', { topic, photoCount, videoCount });
};

export const generateStockImage = async (
    prompt: string,
    aspectRatio: '1:1' | '16:9' | '9:16' = '16:9',
    generateMetadata = false
): Promise<StockImageResult> => {
    return callGeminiProxy('generateStockImage', { prompt, aspectRatio, generateMetadata });
};

export const generateVideo = async (
    prompt: string, 
    aspectRatio: '16:9' | '9:16' = '16:9'
): Promise<any> => {
    // This function is simplified; image payload is removed for the automated workflow
    return callGeminiProxy('generateVideo', { prompt, aspectRatio });
};

export const checkVideoOperationStatus = async (operationName: string): Promise<any> => {
    return callGeminiProxy('checkVideoOperationStatus', { operationName });
};

export const fetchAndCreateVideoUrl = async (uri: string): Promise<string> => {
    const data = await callGeminiProxy<{ videoBytes: string }>('fetchVideo', { uri });
    return `data:video/mp4;base64,${data.videoBytes}`;
};

export const generateMetadataForAsset = async (prompt: string, type: 'photo' | 'video'): Promise<AssetMetadata> => {
    return callGeminiProxy('generateMetadataForAsset', { prompt, type });
};

// New function for automated idea generation
export const generateCreativePrompt = async (
    type: 'photo' | 'video' | 'campaign'
): Promise<{ prompt: string }> => {
    return callGeminiProxy('generateCreativePrompt', { type });
};

// New function for Photo Shoot mode
export const generatePhotoShootPrompts = async (): Promise<{ theme: string, prompts: string[] }> => {
    return callGeminiProxy('generatePhotoShootPrompts', {});
}


// Batch job services for Stock Photo Generator
export const startBatchImageJob = async (prompts: string[], aspectRatio: '1:1' | '16:9' | '9:16'): Promise<{ jobId: string }> => {
    const response = await fetch('/api/start-batch-job', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompts, aspectRatio }),
    });

    const data = await response.json();
    if (!response.ok) {
        throw new Error(data.message || 'Failed to submit batch job.');
    }
    return data;
};

export const checkBatchImageJobStatus = async (jobId: string): Promise<BatchJob> => {
    const response = await fetch(`/api/get-batch-status?jobId=${jobId}`);
    const data = await response.json();

    if (!response.ok) {
        throw new Error(data.message || 'Failed to fetch batch job status.');
    }
    return data.job;
};