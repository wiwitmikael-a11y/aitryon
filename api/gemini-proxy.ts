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
    const systemInstruction = `You are a world-class art director planning a commercial photo shoot. Your goal is to generate a cohesive set of 10 images around a single, commercially valuable theme.
First, define a concise 'theme'. Then, create an array of 10 highly detailed and distinct prompts that explore variations of this theme. These variations should cover different angles, lighting, compositions, subjects, and emotions.
Your response MUST be a valid JSON object with two keys: "theme" (a string) and "prompts" (an array of exactly 10 strings).`;

    const response = await ai.models.generateContent({
        model,
        contents: "Generate a new photo shoot concept.",
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
            systemInstruction = `You are an elite art director for a high-end stock photography service like Getty Images or Stocksy. Your job is to create concepts that are modern, commercially valuable, and align with current visual trends. Avoid clichés. Focus on authenticity, dynamic lighting, and concepts relevant to tech, remote work, wellness, and sustainability. Generate a single, highly detailed prompt suitable for a cutting-edge AI image generator. Do not respond with anything other than the prompt string itself. No extra text or labels.`;
            break;
        case 'video':
            systemInstruction = `You are a world-class commercial and film director. Your task is to conceptualize a short, 5-second video clip that is visually stunning and has high commercial appeal for use in digital advertising. The prompt must specify camera movement (e.g., slow-motion, drone shot, tracking shot), lighting (e.g., golden hour, neon glow), and a clear, emotionally resonant subject. Focus on luxury, technology, or nature themes. Generate a single, detailed prompt suitable for the Veo model. Do not respond with anything but the prompt string itself. No extra text or labels.`;
            break;
        case 'campaign':
            systemInstruction = `You are a Chief Creative Officer at a top global advertising agency. Your task is to devise a single, groundbreaking campaign concept for a modern, direct-to-consumer brand. The concept should be emotionally resonant, highly shareable on social media, and have a clear marketing objective. Focus on current cultural trends and consumer behavior. Respond with only the campaign topic string. No extra text or labels.`;
            break;
    }

    const response = await ai.models.generateContent({
        model,
        contents: `Generate one creative ${type} concept.`,
        config: { systemInstruction }
    });

    return { prompt: response.text.trim() };
}

async function handleGenerateCreativeStrategy({ topic, photoCount, videoCount }: any) {
    const model = 'gemini-2.5-pro'; // Use a powerful model for strategy
    const prompt = `
        As an expert creative director, generate a content strategy for the following topic: "${topic}".
        Your response must be in JSON format.
        The JSON object should have two keys: "photoPrompts" and "videoPrompts".
        - "photoPrompts" should be an array of exactly ${photoCount} strings. Each string is a detailed, visually rich prompt for an AI image generator (like Imagen) to create a stock photo.
        - "videoPrompts" should be an array of exactly ${videoCount} strings. Each string is a descriptive prompt for an AI video generator (like Veo) to create a short, cinematic video clip (5-10 seconds).
        The prompts should be diverse, creative, and aligned with the central topic.
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
    const systemInstruction = `You are an expert in SEO and content marketing. Generate metadata for a digital asset. The response must be a valid JSON object with three keys: "title" (a catchy, descriptive title, max 60 chars), "description" (a concise summary, max 160 chars), and "tags" (an array of 5-10 relevant lowercase keywords).`;
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