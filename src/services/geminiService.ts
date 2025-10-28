import { GoogleGenAI, GenerateVideosOperationResponse, Modality, Type, GenerateVideosOperation } from "@google/genai";

// Re-usable instance creator. Per guidelines, for Veo, a new instance should be created
// right before the call to ensure the latest API key from the selection dialog is used.
// This function respects that, as it's called within each service function.
const getGenAI = () => new GoogleGenAI({ apiKey: process.env.API_KEY! });

// Types for Creative Director tool
export interface TrendAnalysis {
  trendName: string;
  description: string;
  visualThemes: string[];
  keywords: string[];
}

export interface CampaignPrompts {
  photoPrompts: string[];
  videoPrompts: string[];
}

export interface AssetMetadata {
    title: string;
    description: string;
    tags: string[];
}

// --- Functions for StockPhotoGenerator ---

export const analyzeTrendAndGeneratePrompts = async (topic: string): Promise<string[]> => {
  const ai = getGenAI();
  const response = await ai.models.generateContent({
    model: 'gemini-2.5-pro',
    contents: `Analyze the following visual trend topic and generate 5 detailed, diverse, and specific prompts for a stock photo generator. The prompts should be ready to use, describing subjects, composition, lighting, and mood. Topic: "${topic}"`,
    config: {
        responseMimeType: "application/json",
        responseSchema: {
            type: Type.ARRAY,
            description: "A list of 5 detailed text prompts for image generation.",
            items: {
                type: Type.STRING,
                description: "A single image generation prompt."
            }
        }
    }
  });
  
  try {
    const prompts = JSON.parse(response.text);
    if (!Array.isArray(prompts) || !prompts.every(p => typeof p === 'string')) {
        throw new Error('API returned an invalid format for prompts.');
    }
    return prompts;
  } catch (e) {
      console.error("Failed to parse prompts JSON:", response.text);
      throw new Error("Could not parse the prompts from the AI response.");
  }
};

export const generateStockImage = async (prompt: string): Promise<string> => {
    const ai = getGenAI();
    const response = await ai.models.generateImages({
        model: 'imagen-4.0-generate-001',
        prompt: prompt,
        config: {
            numberOfImages: 1,
            outputMimeType: 'image/png',
            aspectRatio: '16:9', // Common aspect ratio for stock photos
        },
    });

    if (!response.generatedImages || response.generatedImages.length === 0) {
        throw new Error("Image generation failed, no image was returned.");
    }

    const base64ImageBytes = response.generatedImages[0].image.imageBytes;
    return `data:image/png;base64,${base64ImageBytes}`;
};

// --- Functions for VideoGenerator ---

export const generateVideo = async (prompt: string): Promise<GenerateVideosOperation> => {
    const ai = getGenAI();
    const operation = await ai.models.generateVideos({
        model: 'veo-3.1-fast-generate-preview',
        prompt: prompt,
        config: {
            numberOfVideos: 1,
            resolution: '720p',
            aspectRatio: '16:9'
        }
    });
    return operation;
};

export const checkVideoOperationStatus = async (operationName: string): Promise<GenerateVideosOperationResponse> => {
    try {
        const ai = getGenAI();
        const operation = await ai.operations.getVideosOperation({ name: operationName });
        return operation;
    } catch (e) {
        if (e instanceof Error && e.message.includes('Requested entity was not found.')) {
            // Per guidelines, this can indicate an API key issue. Propagate a specific error.
            throw new Error("API_KEY_INVALID");
        }
        throw e;
    }
};

export const fetchAndCreateVideoUrl = async (uri: string): Promise<string> => {
    const response = await fetch(`${uri}&key=${process.env.API_KEY}`);
    if (!response.ok) {
        throw new Error(`Failed to download video: ${response.statusText}`);
    }
    const videoBlob = await response.blob();
    return URL.createObjectURL(videoBlob);
};

// --- Functions for CreativeDirector ---

export const analyzeTrend = async (trendText: string): Promise<TrendAnalysis> => {
    const ai = getGenAI();
    const response = await ai.models.generateContent({
        model: 'gemini-2.5-pro',
        contents: `Analyze the following text describing a cultural or visual trend. Extract the core concept, key visual themes, and relevant keywords.
        
        Trend description: "${trendText}"
        
        Provide the output in a structured JSON format.`,
        config: {
            responseMimeType: "application/json",
            responseSchema: {
                type: Type.OBJECT,
                properties: {
                    trendName: { type: Type.STRING, description: "A catchy name for the trend." },
                    description: { type: Type.STRING, description: "A one-paragraph summary of the trend." },
                    visualThemes: { 
                        type: Type.ARRAY, 
                        items: { type: Type.STRING },
                        description: "A list of 3-5 key visual elements or themes."
                    },
                    keywords: { 
                        type: Type.ARRAY, 
                        items: { type: Type.STRING },
                        description: "A list of 5-10 relevant keywords for tagging."
                    }
                },
                required: ["trendName", "description", "visualThemes", "keywords"]
            }
        }
    });

    try {
        return JSON.parse(response.text) as TrendAnalysis;
    } catch (e) {
        console.error("Failed to parse trend analysis JSON:", response.text);
        throw new Error("Could not parse the trend analysis from the AI response.");
    }
};

export const generateCampaignPrompts = async (analysis: TrendAnalysis, photoCount: number, videoCount: number): Promise<CampaignPrompts> => {
    const ai = getGenAI();
    const response = await ai.models.generateContent({
        model: 'gemini-2.5-pro',
        contents: `Based on this trend analysis, generate a set of creative prompts for a marketing campaign.
        
        Trend Analysis: ${JSON.stringify(analysis, null, 2)}
        
        Generate exactly ${photoCount} detailed prompts for stock photos.
        Generate exactly ${videoCount} detailed prompts for short B-roll videos (5-10 seconds).
        
        The prompts should be diverse and cover different aspects of the trend.
        Provide the output in a structured JSON format.`,
        config: {
            responseMimeType: "application/json",
            responseSchema: {
                type: Type.OBJECT,
                properties: {
                    photoPrompts: {
                        type: Type.ARRAY,
                        items: { type: Type.STRING },
                        description: `A list of exactly ${photoCount} photo prompts.`
                    },
                    videoPrompts: {
                        type: Type.ARRAY,
                        items: { type: Type.STRING },
                        description: `A list of exactly ${videoCount} video prompts.`
                    }
                },
                required: ["photoPrompts", "videoPrompts"]
            }
        }
    });

    try {
        const prompts = JSON.parse(response.text) as CampaignPrompts;
        if (!prompts.photoPrompts || !prompts.videoPrompts) {
            throw new Error("Invalid prompt structure returned.");
        }
        return prompts;
    } catch (e) {
        console.error("Failed to parse campaign prompts JSON:", response.text);
        throw new Error("Could not parse the campaign prompts from the AI response.");
    }
};

const dataUrlToPart = (dataUrl: string) => {
    const [meta, data] = dataUrl.split(',');
    const mimeType = meta.match(/:(.*?);/)?.[1];
    if (!mimeType || !data) {
        throw new Error('Invalid data URL for metadata generation.');
    }
    return {
        inlineData: {
            mimeType,
            data,
        },
    };
};

export const generateMetadataForAsset = async (assetSrc: string): Promise<AssetMetadata> => {
    const ai = getGenAI();
    const imagePart = dataUrlToPart(assetSrc);
    
    const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: { 
            parts: [
                imagePart,
                { text: "Analyze this image and generate metadata for a stock photo website. Provide a compelling title, a short description, and a list of relevant tags." }
            ] 
        },
        config: {
            responseMimeType: "application/json",
            responseSchema: {
                type: Type.OBJECT,
                properties: {
                    title: { type: Type.STRING, description: "A short, catchy title for the image." },
                    description: { type: Type.STRING, description: "A one-sentence description of the image." },
                    tags: {
                        type: Type.ARRAY,
                        items: { type: Type.STRING },
                        description: "A list of 10-15 relevant keywords/tags."
                    }
                },
                required: ["title", "description", "tags"]
            }
        }
    });

    try {
        return JSON.parse(response.text) as AssetMetadata;
    } catch (e) {
        console.error("Failed to parse metadata JSON:", response.text);
        throw new Error("Could not parse the metadata from the AI response.");
    }
};
