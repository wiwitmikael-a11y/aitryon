import { Modality } from "@google/genai";

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

    const data = await response.json();
    if (!response.ok) {
        throw new Error(data.error || 'An unknown error occurred calling the Gemini proxy.');
    }
    return data;
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
    aspectRatio: '16:9' | '9:16' = '16:9',
    image?: { data: string, mimeType: string }
): Promise<any> => {
    return callGeminiProxy('generateVideo', { prompt, aspectRatio, image });
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

export const generateCreativePrompt = async (
    type: 'photo' | 'video' | 'campaign'
): Promise<{ prompt: string }> => {
    return callGeminiProxy('generateCreativePrompt', { type });
};

// --- Viral Affiliate Video Functions ---
export const generateVideoBrief = async (productImage: string, description: string, language: string): Promise<any> => {
    return callGeminiProxy('generateVideoBrief', { productImage, description, language });
};

export const generateVideoStoryboard = async (brief: any, language: string, aspectRatio: string): Promise<any> => {
    return callGeminiProxy('generateVideoStoryboard', { brief, language, aspectRatio });
};
