import type { BatchImageResult } from '../types';

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
            const errorData = await response.json();
            errorMessage = errorData.error || JSON.stringify(errorData);
        } catch (e) {
            errorMessage = `A server error occurred (status ${response.status}). The response was not in a valid JSON format. Please check the server logs.`;
        }
        throw new Error(errorMessage);
    }

    return response.json();
}

// --- VIRTUAL TRY-ON ---
export const performVirtualTryOn = async (
    personImage: string,
    productImage: string
): Promise<{ resultImage: string }> => {
    return callGeminiProxy('virtualTryOn', { personImage, productImage });
};


// --- CREATIVE DIRECTOR ---
export const generateCreativeStrategy = async (
    { topic, photoCount, videoCount }: { topic: string, photoCount: number, videoCount: number }
): Promise<{ photoPrompts: string[], videoPrompts: string[] }> => {
    return callGeminiProxy('generateCreativeStrategy', { topic, photoCount, videoCount });
};

export const generateMetadataForAsset = async (prompt: string, type: 'photo' | 'video'): Promise<AssetMetadata> => {
    return callGeminiProxy('generateMetadataForAsset', { prompt, type });
};


// --- ART DIRECTOR (SINGLE & BATCH) ---
export const generateStockImage = async (
    prompt: string,
    aspectRatio: '1:1' | '16:9' | '9:16' = '16:9',
    generateMetadata = false
): Promise<StockImageResult> => {
    return callGeminiProxy('generateStockImage', { prompt, aspectRatio, generateMetadata });
};

export const generatePhotoShootPackage = async (
    aspectRatio: '1:1' | '16:9' | '9:16'
): Promise<{ theme: string, results: BatchImageResult[] }> => {
    return callGeminiProxy('generatePhotoShootPackage', { aspectRatio });
};


// --- VIDEO DIRECTOR & GENERAL ---
export const generateVideo = async (
    prompt: string, 
    aspectRatio: '16:9' | '9:16' = '16:9'
): Promise<any> => {
    return callGeminiProxy('generateVideo', { prompt, aspectRatio });
};

export const checkVideoOperationStatus = async (operationName: string): Promise<any> => {
    return callGeminiProxy('checkVideoOperationStatus', { operationName });
};

export const fetchAndCreateVideoUrl = async (uri: string): Promise<string> => {
    const data = await callGeminiProxy<{ videoBytes: string }>('fetchVideo', { uri });
    return `data:video/mp4;base64,${data.videoBytes}`;
};

export const generateCreativePrompt = async (
    type: 'photo' | 'video' | 'campaign'
): Promise<{ prompt: string }> => {
    return callGeminiProxy('generateCreativePrompt', { type });
};
