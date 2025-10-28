// This service acts as a client to our own backend proxy.
// It does NOT use the @google/genai SDK directly in the browser.

// --- TYPE DEFINITIONS ---

export interface VideoTheme {
    title: string;
    description: string;
    prompt: string;
}

export interface AssetMetadata {
    title: string;
    description: string;
    tags: string[];
}

export interface CreativeStrategy {
    photoPrompts: string[];
    videoPrompts: string[];
}

export interface GeneratedImage {
    src: string;
    prompt: string;
    metadata: AssetMetadata;
}

// --- PROXY HELPER ---

async function callProxy(action: string, payload: any): Promise<any> {
    const response = await fetch('/api/gemini-proxy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, payload }),
    });

    const data = await response.json();
    if (!response.ok) {
        throw new Error(data.error || 'API request failed');
    }
    return data.result;
}

// --- API FUNCTIONS ---

// --- VIDEO GENERATOR ---

export const researchAndSuggestVideoThemes = (): Promise<VideoTheme[]> => {
    return callProxy('researchAndSuggestVideoThemes', {});
};

export const generateAndExtendVideo = async (
    prompt: string,
    referenceImage: string | null,
    onProgress: (message: string) => void
): Promise<any> => {
    onProgress('Submitting video generation request...');
    const initialOperation = await callProxy('startVideoGeneration', { prompt, referenceImage });
    
    let operation = initialOperation;
    onProgress('Video generation started. This can take several minutes...');

    while (!operation.done) {
        await new Promise(resolve => setTimeout(resolve, 10000)); // Poll every 10s
        operation = await callProxy('checkVideoStatus', { operationName: operation.name });
        onProgress('Still processing... Thanks for your patience.');
    }

    if (operation.error) {
        throw new Error(operation.error.message || 'Failed during video generation.');
    }

    // Fix: Return the completed operation object instead of the data URL.
    return operation;
};

// --- STOCK PHOTO GENERATOR (AI ART DIRECTOR) ---

export const generatePhotoConcepts = (payload: { topic: string, style: string, palette: string, angle: string }): Promise<string[]> => {
    return callProxy('generatePhotoConcepts', payload);
};

export const generateStockImage = (prompt: string, aspectRatio: string, withMetadata: boolean): Promise<GeneratedImage> => {
    return callProxy('generateStockImage', { prompt, aspectRatio, withMetadata });
};

export const startAutomatedPhotoBatch = async (
    onProgress: (progress: { message: string, images?: GeneratedImage[] }) => void
): Promise<void> => {
    onProgress({ message: 'Discovering trending concepts...' });
    const { topic } = await callProxy('discoverTrendingTopic', {});

    onProgress({ message: `Trend found: "${topic}". Developing concepts...` });
    const { concepts } = await callProxy('researchAndGeneratePhotoBatch', { topic });
    
    onProgress({ message: 'Concepts developed. Starting photoshoot...' });

    const allImages: GeneratedImage[] = [];

    for (let i = 0; i < concepts.length; i++) {
        const concept = concepts[i];
        onProgress({ message: `Generating image ${i + 1} of ${concepts.length}...`, images: allImages });
        const image = await generateStockImage(concept.prompt, '16:9', true);
        allImages.push(image);
    }
    
    onProgress({ message: 'Production complete!', images: allImages });
};


// --- CREATIVE DIRECTOR ---

export const generateCreativeStrategy = (payload: { topic: string, photoCount: number, videoCount: number }): Promise<CreativeStrategy> => {
    return callProxy('generateCreativeStrategy', payload);
};

export const generateMetadataForAsset = (prompt: string, assetType: 'photo' | 'video'): Promise<AssetMetadata> => {
    return callProxy('generateMetadataForAsset', { prompt, assetType });
};

// --- VIDEO UTILS FOR CREATIVE DIRECTOR (uses proxy now) ---

export const generateVideo = (prompt: string): Promise<any> => {
    return callProxy('startVideoGeneration', { prompt, referenceImage: null });
};

export const checkVideoOperationStatus = (operationName: string): Promise<any> => {
    return callProxy('checkVideoStatus', { operationName });
};

export const fetchAndCreateVideoUrl = async (uri: string): Promise<string> => {
    const { videoDataUrl } = await callProxy('fetchVideo', { uri });
    const blob = await (await fetch(videoDataUrl)).blob();
    return URL.createObjectURL(blob);
};

// --- QUANTITATIVE FUND MANAGER ---

// Fix: Add the missing getTradingMandate function.
export const getTradingMandate = (prompt: string): Promise<any> => {
    return callProxy('getTradingMandate', { prompt });
};
