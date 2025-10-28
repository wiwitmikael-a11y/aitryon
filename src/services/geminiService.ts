import { GoogleGenAI, Type, GenerateVideosOperationResponse } from "@google/genai";

if (!process.env.API_KEY) {
    throw new Error("API_KEY environment variable is not set.");
}

// Per pedoman API, buat instance baru sebelum setiap panggilan untuk memastikan kunci terbaru digunakan.
const getClient = () => new GoogleGenAI({ apiKey: process.env.API_KEY });


/**
 * Menganalisis topik dan menghasilkan daftar prompt gambar yang mendetail.
 * @param topic - Topik atau tren yang disediakan pengguna.
 * @returns Promise yang diselesaikan ke array string prompt.
 */
export const analyzeTrendAndGeneratePrompts = async (topic: string): Promise<string[]> => {
    const ai = getClient();
    try {
        const response = await ai.models.generateContent({
            model: "gemini-2.5-pro",
            contents: `The user wants to generate stock photos based on this theme: "${topic}". 
            Analyze this theme and generate 5 diverse, detailed, and professional-grade text-to-image prompts.
            The prompts should be suitable for a high-quality stock photography website.
            Describe composition, lighting, style, and subject matter clearly in each prompt.`,
            config: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.ARRAY,
                    items: {
                        type: Type.STRING,
                        description: 'A detailed text-to-image prompt.',
                    },
                },
            },
        });
        
        const jsonText = response.text.trim();
        const prompts = JSON.parse(jsonText);

        if (!Array.isArray(prompts) || prompts.some(p => typeof p !== 'string')) {
            throw new Error('API returned an invalid format for prompts.');
        }

        return prompts;
    } catch (error) {
        console.error("Error analyzing trend:", error);
        throw new Error("Could not generate prompts from the AI model. The model may be unavailable or the topic may be too sensitive.");
    }
};

/**
 * Menghasilkan satu gambar stok dari prompt menggunakan model Imagen.
 * @param prompt - Prompt terperinci untuk pembuatan gambar.
 * @returns Promise yang diselesaikan ke URL data gambar yang dikodekan base64.
 */
export const generateStockImage = async (prompt: string): Promise<string> => {
    const ai = getClient();
    try {
        const response = await ai.models.generateImages({
            model: 'imagen-4.0-generate-001',
            prompt: prompt,
            config: {
              numberOfImages: 1,
              outputMimeType: 'image/png', // Gunakan PNG untuk kualitas yang lebih baik
              aspectRatio: '16:9', // Ubah ke lanskap untuk kegunaan yang lebih luas
            },
        });

        if (!response.generatedImages || response.generatedImages.length === 0) {
            throw new Error('The model did not return any images.');
        }

        const base64ImageBytes: string = response.generatedImages[0].image.imageBytes;
        return `data:image/png;base64,${base64ImageBytes}`;
    } catch (error) {
        console.error(`Error generating image for prompt "${prompt}":`, error);
        throw new Error(`Failed to generate image for one of the prompts. It might violate safety policies.`);
    }
};

/**
 * Memulai pekerjaan pembuatan video dan mengembalikan operasi awal.
 * @param prompt - Prompt teks untuk pembuatan video.
 * @returns Promise yang diselesaikan ke objek operasi awal.
 */
export const generateVideo = async (prompt: string): Promise<GenerateVideosOperationResponse> => {
    const ai = getClient();
    try {
        const operation = await ai.models.generateVideos({
            model: 'veo-3.1-fast-generate-preview',
            prompt: prompt,
            config: {
                numberOfVideos: 1,
                resolution: '720p',
                aspectRatio: '16:9',
            }
        });
        return operation;
    } catch (error) {
        console.error("Error starting video generation:", error);
        if (error instanceof Error && error.message.includes('API key not valid')) {
             throw new Error("The selected API key is not valid. Please select a different key.");
        }
        throw new Error("Could not start the video generation job.");
    }
};

/**
 * Memeriksa status operasi pembuatan video yang sedang berjalan.
 * @param operationName - Nama operasi yang akan diperiksa.
 * @returns Promise yang diselesaikan ke objek operasi yang diperbarui.
 */
export const checkVideoOperationStatus = async (operationName: string): Promise<GenerateVideosOperationResponse> => {
    const ai = getClient();
    try {
        const operation = await ai.operations.getVideosOperation({ operation: { name: operationName } });
        return operation;
    } catch (error) {
        console.error("Error checking video operation status:", error);
        if (error instanceof Error && error.message.includes('Requested entity was not found.')) {
            throw new Error('API_KEY_INVALID');
        }
        throw new Error("Could not check the video job status.");
    }
};

/**
 * Mengambil file video dari URI yang disediakan dan membuat URL blob.
 * @param uri - URI unduhan untuk file video.
 * @returns Promise yang diselesaikan ke URL blob untuk video.
 */
export const fetchAndCreateVideoUrl = async (uri: string): Promise<string> => {
    try {
        const url = `${uri}&key=${process.env.API_KEY}`;
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`Failed to download video file: ${response.statusText}`);
        }
        const videoBlob = await response.blob();
        return URL.createObjectURL(videoBlob);
    } catch (error) {
        console.error("Error fetching video:", error);
        throw new Error("Could not download the generated video.");
    }
};

// --- Fungsi Baru untuk AI Creative Director ---

export interface TrendAnalysis {
    summary: string;
    visualThemes: string[];
    keywords: string[];
    colorPalette: string[];
}

export const analyzeTrend = async (text: string): Promise<TrendAnalysis> => {
    const ai = getClient();
    try {
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-pro',
            contents: `Analyze the following text about creative trends. Extract the key information into a structured JSON object.
            Input text: "${text}"`,
            config: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        summary: { type: Type.STRING, description: 'A brief summary of the trend.' },
                        visualThemes: { type: Type.ARRAY, items: { type: Type.STRING }, description: 'List of core visual concepts or themes.' },
                        keywords: { type: Type.ARRAY, items: { type: Type.STRING }, description: 'List of SEO-friendly keywords related to the trend.' },
                        colorPalette: { type: Type.ARRAY, items: { type: Type.STRING }, description: 'Suggest a list of 4-5 hex color codes or descriptive color names.' },
                    }
                },
            },
        });
        const jsonText = response.text.trim();
        return JSON.parse(jsonText);
    } catch (error) {
        console.error("Error analyzing trend with Gemini:", error);
        throw new Error("Failed to analyze the provided trend text.");
    }
}

export interface CampaignPrompts {
    photoPrompts: string[];
    videoPrompts: string[];
}

export const generateCampaignPrompts = async (analysis: TrendAnalysis, photoCount: number, videoCount: number): Promise<CampaignPrompts> => {
     const ai = getClient();
    try {
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-pro',
            contents: `Based on this trend analysis, act as a professional creative director. 
            Generate a diverse set of prompts for a stock media campaign.
            Trend Analysis: ${JSON.stringify(analysis, null, 2)}
            
            Generate exactly ${photoCount} unique, high-quality photo prompts for a model like Imagen.
            Generate exactly ${videoCount} unique, cinematic video prompts for a model like Veo.
            Ensure prompts are varied in composition, subject, and style, but all fit the core trend.`,
            config: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        photoPrompts: { type: Type.ARRAY, items: { type: Type.STRING } },
                        videoPrompts: { type: Type.ARRAY, items: { type: Type.STRING } },
                    }
                },
            },
        });
        const jsonText = response.text.trim();
        return JSON.parse(jsonText);
    } catch (error) {
        console.error("Error generating campaign prompts:", error);
        throw new Error("Failed to generate campaign prompts.");
    }
}

export interface AssetMetadata {
    title: string;
    description: string;
    tags: string[];
}

export const generateMetadataForAsset = async (imageBase64: string): Promise<AssetMetadata> => {
    const ai = getClient();
    try {
        const imagePart = {
            inlineData: {
                mimeType: 'image/png',
                data: imageBase64.split(',')[1],
            },
        };
        const textPart = {
            text: `Analyze this image. Generate metadata for a stock photography website. 
            Provide a compelling title, a short descriptive paragraph, and a list of 15 relevant keywords (tags).`
        };

        const response = await ai.models.generateContent({
            model: 'gemini-2.5-pro',
            contents: { parts: [imagePart, textPart] },
             config: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        title: { type: Type.STRING, description: 'A short, compelling title for the asset.' },
                        description: { type: Type.STRING, description: 'A 1-2 sentence description.' },
                        tags: { type: Type.ARRAY, items: { type: Type.STRING }, description: '15 relevant keywords for search.' },
                    }
                },
            },
        });
        const jsonText = response.text.trim();
        return JSON.parse(jsonText);
    } catch (error) {
        console.error("Error generating metadata:", error);
        // Return fallback metadata so the UI doesn't break
        return { title: 'Generation Failed', description: 'Could not generate metadata.', tags: ['error'] };
    }
};