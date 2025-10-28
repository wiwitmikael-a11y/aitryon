
export interface AssetMetadata {
    title: string;
    description: string;
    tags: string[];
}

export interface GeneratedImage {
    src: string;
    prompt: string;
    metadata: AssetMetadata;
}

interface ImagePayload {
    imageBytes: string;
    mimeType: string;
}

// A generic function to call our backend proxy
async function callGeminiProxy<T>(action: string, payload: unknown): Promise<T> {
    try {
        const response = await fetch('/api/gemini-proxy', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action, payload }),
        });

        const data = await response.json();
        if (!response.ok) {
            throw new Error(data.message || `API request for action "${action}" failed.`);
        }
        return data as T;
    } catch (error) {
        console.error(`Error calling proxy for action "${action}":`, error);
        throw error;
    }
}

// --- Text & Strategy ---

export const generatePhotoConcepts = async (
    payload: { topic: string; style: string; palette: string; angle: string }
): Promise<string[]> => {
    const { concepts } = await callGeminiProxy<{ concepts: string[] }>('generatePhotoConcepts', payload);
    return concepts;
};

export const generateCreativeStrategy = async (
    payload: { topic: string; photoCount: number; videoCount: number }
): Promise<{ photoPrompts: string[]; videoPrompts: string[] }> => {
    return callGeminiProxy('generateCreativeStrategy', payload);
};

export const generateMetadataForAsset = async (prompt: string, type: 'photo' | 'video'): Promise<AssetMetadata> => {
    return callGeminiProxy('generateMetadataForAsset', { prompt, type });
};


// --- Image Generation ---

export const generateStockImage = async (
    prompt: string,
    aspectRatio: string = '16:9',
    includeMetadata: boolean = false
): Promise<GeneratedImage> => {
    const [{ src }, metadata] = await Promise.all([
        callGeminiProxy<{ src: string }>('generateStockImage', { prompt, aspectRatio }),
        includeMetadata ? generateMetadataForAsset(prompt, 'photo') : Promise.resolve({ title: '', description: '', tags: [] })
    ]);

    return {
        src,
        prompt,
        metadata: metadata || { title: prompt.slice(0, 50), description: prompt, tags: [] },
    };
};


export const startAutomatedPhotoBatch = async (
    onProgress: (progress: { message: string; images?: GeneratedImage[] }) => void
): Promise<GeneratedImage[]> => {
    
    onProgress({ message: 'Researching trending topics...' });
    const strategy = await generateCreativeStrategy({ topic: 'A visually trending and commercially viable theme for stock photography', photoCount: 4, videoCount: 0 });

    const generatedImages: GeneratedImage[] = [];

    for (let i = 0; i < strategy.photoPrompts.length; i++) {
        const prompt = strategy.photoPrompts[i];
        onProgress({ message: `Generating photo ${i + 1} of ${strategy.photoPrompts.length}...`, images: generatedImages });
        try {
            const imageResult = await generateStockImage(prompt, '16:9', true);
            generatedImages.push(imageResult);
            onProgress({ message: `Generating photo ${i + 1} of ${strategy.photoPrompts.length}...`, images: generatedImages });
        } catch (error) {
            console.error(`Failed to generate image for prompt: "${prompt}"`, error);
            // Continue to next image
        }
    }

    onProgress({ message: 'Batch complete!', images: generatedImages });
    return generatedImages;
};


// --- Video Generation ---

export const generateVideo = async (prompt: string, image?: ImagePayload | null): Promise<{ name: string }> => {
    return callGeminiProxy('generateVideo', { prompt, image });
};

export const checkVideoOperationStatus = async (operationName: string): Promise<any> => {
    return callGeminiProxy('checkVideoOperationStatus', { operationName });
};

export const fetchAndCreateVideoUrl = async (uri: string): Promise<string> => {
    const { dataUrl } = await callGeminiProxy<{ dataUrl: string }>('fetchVideo', { uri });
    const response = await fetch(dataUrl);
    const blob = await response.blob();
    return URL.createObjectURL(blob);
};

// --- Quantitative Fund Manager ---
export const getTradingMandate = async (prompt: string): Promise<any> => {
    return callGeminiProxy('getTradingMandate', { prompt });
};
