import type { AssetMetadata } from '../types';

// Re-export for components that use it
export type { AssetMetadata };

async function callGeminiApi<T>(action: string, payload: unknown): Promise<T> {
    const response = await fetch('/api/gemini-proxy', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ action, payload }),
    });

    const data = await response.json();

    if (!response.ok) {
        throw new Error(data.message || 'An API error occurred.');
    }

    return data;
}

export const generatePhotoConcepts = async (
    topic: string,
    style: string,
    palette: string,
    angle: string
): Promise<{ concepts: string[] }> => {
    return callGeminiApi('generatePhotoConcepts', { topic, style, palette, angle });
};

export const generateStockImage = async (
    prompt: string, 
    aspectRatio: string, 
    withMetadata: boolean = false
): Promise<{ src: string; metadata?: AssetMetadata }> => {
    const { src } = await callGeminiApi<{ src: string }>('generateStockImage', { prompt, aspectRatio });
    if (withMetadata) {
        const metadata = await generateMetadataForAsset(prompt, 'photo');
        return { src, metadata };
    }
    return { src };
};

export const generateMetadataForAsset = async (
    prompt: string,
    type: 'photo' | 'video'
): Promise<AssetMetadata> => {
    return callGeminiApi('generateMetadataForAsset', { prompt, type });
};

export const generateCreativeStrategy = async (payload: {
    topic: string;
    photoCount: number;
    videoCount: number;
}): Promise<{ photoPrompts: string[], videoPrompts: string[] }> => {
    return callGeminiApi('generateCreativeStrategy', payload);
};

export const getTradingMandate = async (prompt: string): Promise<any> => {
    return callGeminiApi('getTradingMandate', { prompt });
};

export const generateVideo = async (prompt: string, image?: { imageBytes: string, mimeType: string }): Promise<{ name: string }> => {
    return callGeminiApi('generateVideo', { prompt, image });
};

export const checkVideoOperationStatus = async (operationName: string): Promise<any> => {
    return callGeminiApi('checkVideoOperationStatus', { operationName });
};

export const fetchAndCreateVideoUrl = async (uri: string): Promise<string> => {
    const { dataUrl } = await callGeminiApi<{ dataUrl: string }>('fetchVideo', { uri });
    return dataUrl;
};
