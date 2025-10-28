import type { VercelRequest, VercelResponse } from '@vercel/node';
import { GoogleGenAI, Type } from "@google/genai";
import { Buffer } from 'buffer';

// Ensure the API key is available in environment variables
if (!process.env.API_KEY) {
    throw new Error("API_KEY environment variable is not set.");
}

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

async function handler(req: VercelRequest, res: VercelResponse) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    const { task, ...payload } = req.body;

    try {
        let result;
        switch (task) {
            case 'generateCreativeStrategy':
                result = await handleGenerateCreativeStrategy(payload);
                break;
            case 'generateStockImage':
                result = await handleGenerateStockImage(payload);
                break;
            case 'generateVideo':
                result = await handleGenerateVideo(payload);
                break;
            case 'checkVideoOperationStatus':
                result = await handleCheckVideoOperationStatus(payload);
                break;
            case 'fetchVideo':
                result = await handleFetchVideo(payload);
                break;
            case 'generateMetadataForAsset':
                result = await handleGenerateMetadataForAsset(payload);
                break;
            case 'generateCreativePrompt':
                result = await handleGenerateCreativePrompt(payload);
                break;
            case 'generatePhotoShootPrompts':
                result = await handleGeneratePhotoShootPrompts(payload);
                break;
            default:
                return res.status(400).json({ error: 'Invalid task' });
        }
        res.status(200).json(result);
    } catch (error) {
        console.error(`Error in task '${task}':`, error);
        const message = error instanceof Error ? error.message : 'An unknown server error occurred.';
        res.status(500).json({ error: message });
    }
}

async function handleGeneratePhotoShootPrompts(payload: any) {
    const model = 'gemini-2.5-pro';
    const systemInstruction = `You are a visionary Art Director for a major global brand like Apple, Nike, or Patagonia. You are planning a high-concept photo shoot.
Your task is to create a complete, narrative-driven shot list.
1.  **Define a Core Concept/Theme:** This should be a powerful, single-sentence idea that is commercially relevant and emotionally resonant.
2.  **Create a Narrative Shot List:** Generate an array of exactly 10 distinct, highly-detailed prompts. These prompts are not random variations; they must follow a logical narrative sequence as if telling a story. For example: an establishing shot, a medium shot of the subject, a detail/macro shot of a key object, an action shot, an emotional portrait, an abstract shot, etc. Each prompt must be unique and contribute to the overall story of the theme.

Your response MUST be a valid JSON object with two keys: "theme" (a string for the core concept) and "prompts" (an array of exactly 10 detailed string prompts).`;

    const response = await ai.models.generateContent({
        model,
        contents: "Generate a new photo shoot concept and narrative shot list.",
        config: { 
            systemInstruction,
            responseMimeType: "application/json",
            responseSchema: {
                type: Type.OBJECT,
                properties: {
                    theme: { type: Type.STRING },
                    prompts: { type: Type.ARRAY, items: { type: Type.STRING } }
                },
                required: ["theme", "prompts"]
            }
        }
    });

    try {
        const text = response.text.trim();
        if (!text) {
            throw new Error("Gemini returned an empty response for photo shoot prompts.");
        }
        return JSON.parse(text);
    } catch (e) {
        console.error("Failed to parse Gemini response as JSON:", response.text);
        throw new Error("The AI failed to generate a valid photo shoot plan. Please try again.");
    }
}


// --- Task Handlers ---
async function handleGenerateCreativePrompt({ type }: { type: 'photo' | 'video' | 'campaign' }) {
    const model = 'gemini-2.5-pro';
    let systemInstruction = '';
    
    switch (type) {
        case 'photo':
            systemInstruction = `You are an award-winning conceptual photographer and art director. Your task is to perform a rapid analysis of visual trends on platforms like Behance and Pinterest to identify an under-explored, commercially viable theme. Then, create a single, highly detailed prompt that tells a "micro-story." The prompt must feel like a scene from an art-house film, specifying not just the subject, but the mood, the quality of light, the color palette, and a sense of narrative. Avoid stock photo clichés at all costs. The output must be ONLY the prompt string itself, without any introductory text or labels.`;
            break;
        case 'video':
            systemInstruction = `You are a director pitching a multi-million dollar Super Bowl commercial. You have 5 seconds to captivate the audience. Your task is to generate a single, incredibly dense and evocative prompt for a video. The prompt must describe a complete sensory experience: advanced cinematography (e.g., 'anamorphic lens flare', 'split-diopter focus'), a clear emotional arc (e.g., 'from tension to relief'), and implied sound design (e.g., 'the silence is broken by a single, resonant chord'). The concept must be groundbreaking and unforgettable. The output must be ONLY the prompt string itself, without any introductory text or labels.`;
            break;
        case 'campaign':
            systemInstruction = `You are a Chief Strategy Officer at a market-disrupting advertising agency. Your task is to identify a recent, specific cultural insight or data point about consumer behavior. Based on this insight, you must formulate a single, powerful, and provocative "Big Idea" for a brand campaign. This idea should be summarized in a single, memorable sentence that serves as the campaign topic. It must be innovative and have high potential for going viral. The output must be ONLY the campaign topic string, without any introductory text or labels.`;
            break;
    }

    const response = await ai.models.generateContent({
        model,
        contents: `Generate one perfected, market-aware ${type} concept.`,
        config: { systemInstruction }
    });

    return { prompt: response.text.trim() };
}

async function handleGenerateCreativeStrategy({ topic, photoCount, videoCount }: any) {
    const model = 'gemini-2.5-pro'; // Use a powerful model for strategy
    const prompt = `
        As a visionary Chief Creative Officer, your task is to translate a high-level campaign topic into a concrete, multi-format content strategy. The campaign topic is: "${topic}".
        
        Your response must be a perfectly formed JSON object with two keys: "photoPrompts" and "videoPrompts".
        - "photoPrompts" must be an array of exactly ${photoCount} strings. Each prompt must be a detailed, visually rich directive for an AI image generator.
        - "videoPrompts" must be an array of exactly ${videoCount} strings. Each prompt must be a descriptive directive for an AI video generator to create a short, cinematic clip.

        CRITICAL: The photo and video prompts must not be disconnected ideas. They must work together to tell a cohesive story that reinforces the main campaign topic. Ensure there is a clear narrative and thematic link across all generated assets.
    `;
    const response = await ai.models.generateContent({
        model,
        contents: prompt,
        config: { responseMimeType: "application/json" }
    });
    return JSON.parse(response.text);
}

async function handleGenerateStockImage({ prompt, aspectRatio, generateMetadata }: any) {
    const imageResponse = await ai.models.generateImages({
        model: 'imagen-4.0-generate-001',
        prompt: prompt,
        config: {
            numberOfImages: 1,
            aspectRatio: aspectRatio,
            outputMimeType: "image/png"
        },
    });
    
    const image = imageResponse.generatedImages[0];
    if (!image?.image.imageBytes) throw new Error("Image generation failed, no bytes returned.");

    const src = `data:image/png;base64,${image.image.imageBytes}`;

    if (!generateMetadata) {
        return { src };
    }

    const metadata = await handleGenerateMetadataForAsset({ prompt, type: 'photo' });
    return { src, metadata };
}

async function handleGenerateMetadataForAsset({ prompt, type }: any) {
    const model = 'gemini-2.5-flash';
    const systemInstruction = `You are an expert in SEO and digital asset management for premium marketplaces like Getty Images. Generate metadata for a digital asset. The response must be a valid JSON object with three keys: "title" (a compelling, descriptive title, max 60 chars), "description" (a concise, professional summary, max 160 chars), and "tags" (an array of 5-10 highly relevant, commercial-intent lowercase keywords).`;
    const userPrompt = `Generate metadata for a ${type} with the following theme or prompt: "${prompt}"`;
    
    const response = await ai.models.generateContent({
        model,
        contents: userPrompt,
        config: {
            systemInstruction,
            responseMimeType: "application/json",
            responseSchema: {
                type: Type.OBJECT,
                properties: {
                    title: { type: Type.STRING },
                    description: { type: Type.STRING },
                    tags: { type: Type.ARRAY, items: { type: Type.STRING } }
                },
                required: ["title", "description", "tags"]
            }
        }
    });

    return JSON.parse(response.text);
}


async function handleGenerateVideo({ prompt, aspectRatio }: any) {
    const operation = await ai.models.generateVideos({
        model: 'veo-3.1-fast-generate-preview',
        prompt,
        // Image is removed for automated flow
        config: {
            numberOfVideos: 1,
            resolution: '1080p', // Max resolution for professional output
            aspectRatio: aspectRatio
        }
    });
    return operation;
}

async function handleCheckVideoOperationStatus({ operationName }: any) {
    // FIX: Use the correct 'getVideosOperation' method instead of the non-existent 'get'.
    // We construct a minimal operation object as required by the SDK.
    const operation = await ai.operations.getVideosOperation({ operation: { name: operationName } });
    return operation;
}


async function handleFetchVideo({ uri }: any) {
    if (!process.env.API_KEY) throw new Error("API key is required to fetch video.");
    const response = await fetch(`${uri}&key=${process.env.API_KEY}`);
    if (!response.ok) {
        throw new Error(`Failed to fetch video from URI. Status: ${response.statusText}`);
    }
    const buffer = await response.arrayBuffer();
    const videoBytes = Buffer.from(buffer).toString('base64');
    return { videoBytes };
}

export default handler;