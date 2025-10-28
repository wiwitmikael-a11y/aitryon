import { GoogleGenAI, GenerateVideosOperationResponse, Type } from '@google/genai';

// In this file, new GoogleGenAI instances are created for API calls.
// This is particularly important for video generation, which uses a separate
// API key selection flow, to ensure the most up-to-date key is used.

export interface AssetMetadata {
    title: string;
    description: string;
    tags: string[];
}

/**
 * Analyzes a topic and generates a list of creative prompts for stock photos.
 * Used by the StockPhotoGenerator component.
 */
export const analyzeTrendAndGeneratePrompts = async (topic: string): Promise<string[]> => {
    try {
        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: `Based on the following trend, generate 4 diverse and creative prompts for stock photography. The prompts should be detailed and visually descriptive. Trend: "${topic}"`,
            config: {
                responseMimeType: 'application/json',
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        prompts: {
                            type: Type.ARRAY,
                            items: {
                                type: Type.STRING,
                                description: 'A detailed, visually descriptive prompt for generating a stock photo.'
                            }
                        }
                    },
                    required: ['prompts']
                }
            }
        });

        const jsonString = response.text.trim();
        const result = JSON.parse(jsonString);

        if (result && Array.isArray(result.prompts)) {
            return result.prompts;
        } else {
            throw new Error('Invalid response format from Gemini API.');
        }
    } catch (error) {
        console.error('Error analyzing trend for stock photos:', error);
        throw new Error(`Failed to generate prompts. ${error instanceof Error ? error.message : ''}`);
    }
};

/**
 * Analyzes a topic and generates prompts for both photos and videos.
 * Used by the CreativeDirector component.
 */
export const generateCreativeStrategy = async (topic: string, photoCount: number, videoCount: number): Promise<{ photoPrompts: string[], videoPrompts: string[] }> => {
    try {
        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-pro', // Using pro for better strategy
            contents: `You are an expert creative director. Based on the following visual trend, generate ${photoCount} diverse and creative prompts for stock photography and ${videoCount} prompts for short, 10-15 second cinematic B-roll videos. The prompts should be detailed and visually descriptive. Trend: "${topic}"`,
            config: {
                responseMimeType: 'application/json',
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        photoPrompts: {
                            type: Type.ARRAY,
                            description: `List of ${photoCount} detailed prompts for stock photos.`,
                            items: { type: Type.STRING }
                        },
                        videoPrompts: {
                            type: Type.ARRAY,
                            description: `List of ${videoCount} detailed prompts for B-roll videos.`,
                            items: { type: Type.STRING }
                        }
                    },
                    required: ['photoPrompts', 'videoPrompts']
                }
            }
        });

        const jsonString = response.text.trim();
        const result = JSON.parse(jsonString);

        if (result && Array.isArray(result.photoPrompts) && Array.isArray(result.videoPrompts)) {
            return result;
        } else {
            throw new Error('Invalid strategy format from Gemini API.');
        }
    } catch (error) {
        console.error('Error generating creative strategy:', error);
        throw new Error(`Failed to generate creative strategy. ${error instanceof Error ? error.message : ''}`);
    }
};


/**
 * Generates a single stock image from a text prompt.
 */
export const generateStockImage = async (prompt: string): Promise<string> => {
    try {
        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
        const response = await ai.models.generateImages({
            model: 'imagen-4.0-generate-001',
            prompt: prompt,
            config: {
                numberOfImages: 1,
                outputMimeType: 'image/png',
                aspectRatio: '16:9',
            },
        });

        const base64ImageBytes = response.generatedImages[0]?.image.imageBytes;
        if (!base64ImageBytes) {
            throw new Error('No image bytes returned from the API.');
        }

        return `data:image/png;base64,${base64ImageBytes}`;
    } catch (error) {
        console.error('Error generating stock image:', error);
        throw new Error(`Failed to generate image for prompt: "${prompt.substring(0, 50)}...". ${error instanceof Error ? error.message : ''}`);
    }
};

/**
 * Starts a video generation job.
 */
export const generateVideo = async (prompt: string): Promise<GenerateVideosOperationResponse> => {
    try {
        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
        const operation = await ai.models.generateVideos({
            model: 'veo-3.1-fast-generate-preview',
            prompt,
            config: {
                numberOfVideos: 1,
                resolution: '720p',
                aspectRatio: '16:9'
            }
        });
        return operation;
    } catch (error) {
        console.error('Error starting video generation:', error);
        throw new Error(`Failed to start video generation. ${error instanceof Error ? error.message : ''}`);
    }
};

/**
 * Checks the status of an ongoing video generation operation.
 */
export const checkVideoOperationStatus = async (operationName: string): Promise<GenerateVideosOperationResponse> => {
    try {
        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
        const operation = await ai.operations.getVideosOperation({ operation: { name: operationName } });
        return operation;
    } catch (error) {
        console.error(`Error polling video operation ${operationName}:`, error);
        if (error instanceof Error && error.message.includes('Requested entity was not found')) {
            throw new Error('API_KEY_INVALID');
        }
        throw new Error(`Failed to check video status. ${error instanceof Error ? error.message : ''}`);
    }
};

/**
 * Fetches the video from the URI and creates a local blob URL.
 */
export const fetchAndCreateVideoUrl = async (uri: string): Promise<string> => {
    try {
        const response = await fetch(`${uri}&key=${process.env.API_KEY}`);
        if (!response.ok) {
            throw new Error(`Failed to fetch video file, status: ${response.status}`);
        }
        const blob = await response.blob();
        return URL.createObjectURL(blob);
    } catch (error) {
        console.error('Error fetching video URL:', error);
        throw new Error(`Failed to fetch and create video URL. ${error instanceof Error ? error.message : ''}`);
    }
};


/**
 * Generates SEO-friendly metadata for a given asset prompt.
 */
export const generateMetadataForAsset = async (prompt: string, type: 'photo' | 'video'): Promise<AssetMetadata> => {
    try {
        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: `Generate SEO-friendly metadata for a stock ${type} created from the following prompt. The title should be short and catchy (5-10 words). The description should be 1-2 sentences. Provide 5-7 relevant tags as an array of strings. Prompt: "${prompt}"`,
            config: {
                responseMimeType: 'application/json',
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        title: { type: Type.STRING },
                        description: { type: Type.STRING },
                        tags: { type: Type.ARRAY, items: { type: Type.STRING } }
                    },
                    required: ['title', 'description', 'tags']
                }
            }
        });
        
        const jsonString = response.text.trim();
        const result = JSON.parse(jsonString) as AssetMetadata;

        if (result && result.title && result.description && Array.isArray(result.tags)) {
            return result;
        } else {
            throw new Error('Invalid metadata format from Gemini API.');
        }
    } catch (error) {
        console.error(`Error generating metadata for prompt "${prompt}":`, error);
        return {
            title: 'Creative Asset',
            description: prompt,
            tags: ['ai generated', type]
        };
    }
};
