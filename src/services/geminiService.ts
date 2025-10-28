// src/services/geminiService.ts

import { GoogleGenAI, Type, Modality } from "@google/genai";

export interface VideoOperation {
    name: string;
    done: boolean;
    response?: {
        generatedVideos: { video: { uri: string } }[];
    };
    error?: { message: string };
}

export interface AssetMetadata {
    title: string;
    description: string;
    tags: string[];
}

export async function generateVideo(prompt: string, aspectRatio: '16:9' | '9:16'): Promise<VideoOperation> {
    if (window.aistudio && !(await window.aistudio.hasSelectedApiKey())) {
        await window.aistudio.openSelectKey();
    }

    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

    const operation = await ai.models.generateVideos({
        model: 'veo-3.1-fast-generate-preview',
        prompt,
        config: {
            numberOfVideos: 1,
            resolution: '1080p',
            aspectRatio: aspectRatio
        }
    });
    return operation as any; // Cast to avoid type conflicts if SDK is not perfectly aligned
}

export async function checkVideoOperationStatus(opName: string): Promise<VideoOperation> {
    if (window.aistudio && !(await window.aistudio.hasSelectedApiKey())) {
        await window.aistudio.openSelectKey();
    }
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    
    const operation = await ai.operations.getVideosOperation({ operation: { name: opName } });
    return operation as any; // Cast to avoid type conflicts
}

export async function fetchAndCreateVideoUrl(uri: string): Promise<string> {
    const response = await fetch(`${uri}&key=${process.env.API_KEY}`);
    if (!response.ok) {
        throw new Error('Failed to fetch video from storage URI');
    }
    const blob = await response.blob();
    return URL.createObjectURL(blob);
}

export async function generateCreativePrompt(type: 'video' | 'photo' | 'campaign', topic?: string): Promise<{prompt: string}> {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    let systemInstruction = '';
    let userPrompt = '';

    switch (type) {
        case 'video':
            systemInstruction = "You are a creative director for a film studio. Generate a short, visually rich, and cinematic prompt for an AI video generator. The prompt should describe a scene with a clear subject, action, and environment. Focus on visual details. The prompt should be a single sentence.";
            userPrompt = "Generate a new, random, SFW cinematic video prompt.";
            break;
        case 'photo':
            systemInstruction = "You are an art director. Generate a creative, specific, and visually descriptive prompt for an AI image generator to create a stock photo. If a theme is provided, create a variation within that theme. The prompt should be a single sentence.";
            userPrompt = topic ? `Generate a stock photo prompt based on the theme: "${topic}"` : "Generate a new, random, SFW stock photo prompt.";
            break;
        case 'campaign':
            systemInstruction = "You are a marketing strategist. Generate a concise and compelling topic for a new digital advertising campaign. The topic should be broad enough to generate multiple assets but specific enough to be coherent. Output only the topic itself, no extra text.";
            userPrompt = "Generate a new campaign topic.";
            break;
    }

    const response = await ai.models.generateContent({
        model: 'gemini-2.5-pro',
        contents: userPrompt,
        config: {
            systemInstruction,
            temperature: 1.2,
        }
    });
    
    return { prompt: response.text.trim().replace(/"/g, '') };
}

export async function generateStockImage(prompt: string, aspectRatio: '1:1' | '16:9' | '9:16', highQuality: boolean): Promise<{ src: string, metadata: AssetMetadata }> {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

    const metadataPromise = generateMetadataForAsset(prompt, 'photo');
    let src: string | undefined;

    if (highQuality) {
        const imageResponse = await ai.models.generateImages({
            model: 'imagen-4.0-generate-001',
            prompt,
            config: {
                numberOfImages: 1,
                aspectRatio: aspectRatio,
                outputMimeType: 'image/jpeg'
            }
        });
        const base64Image = imageResponse.generatedImages[0].image.imageBytes;
        src = `data:image/jpeg;base64,${base64Image}`;
    } else {
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash-image',
            contents: { parts: [{ text: prompt }] },
            config: {
                responseModalities: [Modality.IMAGE],
            },
        });

        if (response.candidates && response.candidates[0].content.parts) {
            for (const part of response.candidates[0].content.parts) {
                if (part.inlineData) {
                    const base64ImageBytes: string = part.inlineData.data;
                    src = `data:image/png;base64,${base64ImageBytes}`;
                    break;
                }
            }
        }
    }

    if (!src) {
        throw new Error("Image data not found in the model's response.");
    }

    const metadata = await metadataPromise;
    return { src, metadata };
}

export async function generateCreativeStrategy(
    { topic, photoCount, videoCount }: { topic: string, photoCount: number, videoCount: number }
): Promise<{ photoPrompts: string[], videoPrompts: string[] }> {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    
    const response = await ai.models.generateContent({
        model: 'gemini-2.5-pro',
        contents: `Based on the campaign topic "${topic}", generate ${photoCount} distinct stock photo prompts and ${videoCount} distinct short video prompts.`,
        config: {
            systemInstruction: "You are a creative director. For the given campaign topic, provide a list of concrete, visually descriptive prompts for AI asset generation. Each prompt should be a single sentence. Return ONLY a JSON object with two keys: 'photoPrompts' and 'videoPrompts', which are arrays of strings.",
            responseMimeType: "application/json",
            responseSchema: {
                type: Type.OBJECT,
                properties: {
                    photoPrompts: {
                        type: Type.ARRAY,
                        items: { type: Type.STRING }
                    },
                    videoPrompts: {
                        type: Type.ARRAY,
                        items: { type: Type.STRING }
                    }
                },
                required: ['photoPrompts', 'videoPrompts']
            }
        }
    });

    return JSON.parse(response.text);
}

export async function generateMetadataForAsset(prompt: string, type: 'photo' | 'video'): Promise<AssetMetadata> {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: `Generate metadata for a ${type} asset created with the prompt: "${prompt}". Provide a short, catchy title, a one-sentence description, and an array of 5-7 relevant lowercase tags.`,
        config: {
            systemInstruction: "You are a digital asset manager. Return ONLY a JSON object with three keys: 'title' (string), 'description' (string), and 'tags' (array of strings).",
            responseMimeType: 'application/json',
            responseSchema: {
                type: Type.OBJECT,
                properties: {
                    title: { type: Type.STRING },
                    description: { type: Type.STRING },
                    tags: {
                        type: Type.ARRAY,
                        items: { type: Type.STRING }
                    }
                },
                required: ['title', 'description', 'tags']
            }
        }
    });
    return JSON.parse(response.text);
}

declare global {
    interface Window {
        aistudio?: {
            hasSelectedApiKey: () => Promise<boolean>;
            openSelectKey: () => Promise<void>;
        }
    }
}
