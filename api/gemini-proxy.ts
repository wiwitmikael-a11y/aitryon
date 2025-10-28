import type { VercelRequest, VercelResponse } from '@vercel/node';
import { GoogleGenAI, Type } from "@google/genai";
import { getGoogleAuthToken } from './lib/google-auth';
import { VERTEX_AI_PROJECT_ID, VERTEX_AI_LOCATION, VEO_MODEL_ID, VIRTUAL_TRY_ON_MODEL_ID } from '../src/constants';
import type { VertexAIRequestInstance, VertexAIRequestParameters, VertexAIResponse } from '../src/types';

// --- AUTHENTICATION SETUP ---
if (!process.env.API_KEY) {
    throw new Error("FATAL: API_KEY environment variable is not set for Gemini/Imagen models.");
}
const geminiAiWithApiKey = new GoogleGenAI({ apiKey: process.env.API_KEY });
const VERTEX_AI_API_BASE = `https://${VERTEX_AI_LOCATION}-aiplatform.googleapis.com/v1/projects/${VERTEX_AI_PROJECT_ID}/locations/${VERTEX_AI_LOCATION}`;

async function handler(req: VercelRequest, res: VercelResponse) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    try {
        const { task, ...payload } = req.body;
        if (!task) {
            return res.status(400).json({ error: 'Task is missing from the request body.' });
        }

        let result;
        switch (task) {
            // --- Handlers using API_KEY ---
            case 'generateCreativeStrategy':
                result = await handleGenerateCreativeStrategy(payload);
                break;
            case 'generateStockImage':
                result = await handleGenerateStockImage(payload);
                break;
            case 'generateMetadataForAsset':
                result = await handleGenerateMetadataForAsset(payload);
                break;
            case 'generateCreativePrompt':
                result = await handleGenerateCreativePrompt(payload);
                break;
            case 'generatePhotoShootPackage':
                result = await handleGeneratePhotoShootPackage(payload);
                break;

            // --- Handlers using VERTEX CREDENTIALS ---
            case 'generateVideo':
                result = await handleGenerateVideo(payload);
                break;
            case 'checkVideoOperationStatus':
                result = await handleCheckVideoOperationStatus(payload);
                break;
            case 'fetchVideo':
                result = await handleFetchVideo(payload);
                break;
            case 'virtualTryOn':
                result = await handleVirtualTryOn(payload);
                break;

            default:
                return res.status(400).json({ error: 'Invalid task' });
        }
        res.status(200).json(result);
    } catch (error) {
        console.error(`Error in proxy handler for task "${req.body?.task}":`, error);
        const message = error instanceof Error ? error.message : 'An unknown server error occurred.';
        res.status(500).json({ error: message });
    }
}

// --- Task Handlers using API_KEY Authentication ---

async function handleGeneratePhotoShootPackage({ aspectRatio }: { aspectRatio: '1:1' | '16:9' | '9:16' }) {
    // 1. Generate the creative theme and prompts
    const { theme, prompts } = await handleGeneratePhotoShootPrompts({});

    // 2. Generate all images in parallel
    const imagePromises = prompts.map((prompt: string, i: number) => 
        handleGenerateStockImage({ prompt, aspectRatio, generateMetadata: false })
            .then(result => ({ id: `image-${i}`, prompt, src: result.src }))
            .catch(error => {
                console.error(`Failed to generate image for prompt: "${prompt}"`, error);
                return null; // Return null for failed images
            })
    );
    
    const results = (await Promise.all(imagePromises)).filter((r): r is { id: string, prompt: string, src: string } => r !== null);

    return { theme, results };
}

async function handleGeneratePhotoShootPrompts(payload: any) {
    const model = 'gemini-2.5-pro';
    const systemInstruction = `You are a visionary Art Director for a major global brand like Apple, Nike, or Patagonia. You are planning a high-concept photo shoot. Your task is to create a complete, narrative-driven shot list.
1.  **Define a Core Concept/Theme:** This should be a powerful, single-sentence idea that is commercially relevant and emotionally resonant.
2.  **Create a Narrative Shot List:** Generate an array of exactly 10 distinct, highly-detailed prompts. These prompts are not random variations; they must follow a logical narrative sequence as if telling a story. For example: an establishing shot, a medium shot of the subject, a detail/macro shot of a key object, an action shot, an emotional portrait, an abstract shot, etc. Each prompt must be unique and contribute to the overall story of the theme.
Your response MUST be a valid JSON object with two keys: "theme" (a string for the core concept) and "prompts" (an array of exactly 10 detailed string prompts).`;

    const response = await geminiAiWithApiKey.models.generateContent({
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
        const text = response.text?.trim();
        if (!text) throw new Error("Gemini returned an empty response for photo shoot prompts.");
        return JSON.parse(text);
    } catch (e) {
        console.error("Failed to parse Gemini response as JSON:", response.text);
        throw new Error("The AI failed to generate a valid photo shoot plan. Please try again.");
    }
}

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

    const response = await geminiAiWithApiKey.models.generateContent({ model, contents: `Generate one perfected, market-aware ${type} concept.`, config: { systemInstruction } });
    return { prompt: response.text?.trim() ?? '' };
}

async function handleGenerateCreativeStrategy({ topic, photoCount, videoCount }: any) {
    const model = 'gemini-2.5-pro';
    const prompt = `
        As a visionary Chief Creative Officer, your task is to translate a high-level campaign topic into a concrete, multi-format content strategy. The campaign topic is: "${topic}".
        Your response must be a perfectly formed JSON object with two keys: "photoPrompts" and "videoPrompts".
        - "photoPrompts" must be an array of exactly ${photoCount} strings.
        - "videoPrompts" must be an array of exactly ${videoCount} strings.
        CRITICAL: The photo and video prompts must work together to tell a cohesive story that reinforces the main campaign topic.
    `;
    const response = await geminiAiWithApiKey.models.generateContent({ model, contents: prompt, config: { responseMimeType: "application/json" } });
    const text = response.text?.trim();
    if (!text) throw new Error("Received empty strategy from AI.");
    return JSON.parse(text);
}

async function handleGenerateStockImage({ prompt, aspectRatio, generateMetadata }: any) {
    const imageResponse = await geminiAiWithApiKey.models.generateImages({
        model: 'imagen-4.0-generate-001',
        prompt,
        config: { numberOfImages: 1, aspectRatio, outputMimeType: "image/png" },
    });
    
    const image = imageResponse.generatedImages?.[0];
    if (!image?.image?.imageBytes) throw new Error("Image generation failed, no bytes returned.");

    const src = `data:image/png;base64,${image.image.imageBytes}`;
    if (!generateMetadata) return { src };

    const metadata = await handleGenerateMetadataForAsset({ prompt, type: 'photo' });
    return { src, metadata };
}

async function handleGenerateMetadataForAsset({ prompt, type }: any) {
    const model = 'gemini-2.5-flash';
    const systemInstruction = `You are an expert in SEO and digital asset management for premium marketplaces. Generate metadata for a digital asset. The response must be a valid JSON object with three keys: "title" (max 60 chars), "description" (max 160 chars), and "tags" (an array of 5-10 relevant, commercial-intent lowercase keywords).`;
    const userPrompt = `Generate metadata for a ${type} with the following theme or prompt: "${prompt}"`;
    
    const response = await geminiAiWithApiKey.models.generateContent({
        model, contents: userPrompt, config: {
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
    const text = response.text?.trim();
    if (!text) throw new Error("Received empty metadata from AI.");
    return JSON.parse(text);
}

// --- Task Handlers that use VERTEX CREDENTIALS Authentication ---

async function handleVirtualTryOn({ personImage, productImage }: { personImage: string, productImage: string }) {
    const authToken = await getGoogleAuthToken();
    const endpoint = `${VERTEX_AI_API_BASE}/publishers/google/models/${VIRTUAL_TRY_ON_MODEL_ID}:predict`;

    const getBase64Data = (dataUrl: string) => dataUrl.split(',')[1] || dataUrl;

    const instance: VertexAIRequestInstance = {
        personImage: { image: { bytesBase64Encoded: getBase64Data(personImage) } },
        productImages: [{ image: { bytesBase64Encoded: getBase64Data(productImage) } }],
    };
    const parameters: VertexAIRequestParameters = { sampleCount: 1, personGeneration: 'allow_all' };
    const body = JSON.stringify({ instances: [instance], parameters });

    const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${authToken}`, 'Content-Type': 'application/json; charset=utf-8' },
        body,
    });

    if (!response.ok) {
        const errorBody = await response.json().catch(() => ({ error: { message: 'Failed to parse error response' } }));
        throw new Error(`API request failed with status ${response.status}: ${errorBody.error?.message || 'Unknown error'}`);
    }

    const data: VertexAIResponse = await response.json();
    const prediction = data.predictions?.[0];
    if (!prediction?.bytesBase64Encoded) {
        throw new Error('No predictions returned from the API.');
    }
    
    return { resultImage: `data:${prediction.mimeType};base64,${prediction.bytesBase64Encoded}` };
}

async function handleGenerateVideo({ prompt, aspectRatio }: any) {
    const authToken = await getGoogleAuthToken();
    const endpoint = `${VERTEX_AI_API_BASE}/publishers/google/models/${VEO_MODEL_ID}:generateVideos`;
    const body = JSON.stringify({ prompt, config: { numberOfVideos: 1, resolution: '1080p', aspectRatio } });

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${authToken}`, 'Content-Type': 'application/json; charset=utf-8' },
      body,
    });

    if (!response.ok) {
        const errorBody = await response.json().catch(() => ({ error: { message: 'Failed to parse error response' } }));
        throw new Error(`Vertex AI request failed: ${errorBody.error?.message || response.statusText}`);
    }
    return response.json();
}

async function handleCheckVideoOperationStatus({ operationName }: any) {
    const authToken = await getGoogleAuthToken();
    const endpoint = `https://${VERTEX_AI_LOCATION}-aiplatform.googleapis.com/v1/${operationName}`;

    const response = await fetch(endpoint, {
      method: 'GET',
      headers: { 'Authorization': `Bearer ${authToken}`, 'Content-Type': 'application/json; charset=utf-8' },
    });

    if (!response.ok) {
        const errorBody = await response.json().catch(() => ({ error: { message: 'Failed to parse error response' } }));
        throw new Error(`Vertex AI status check failed: ${errorBody.error?.message || response.statusText}`);
    }
    return response.json();
}

async function handleFetchVideo({ uri }: any) {
    if (!process.env.API_KEY) throw new Error("API key is required to fetch the final video file.");
    
    const response = await fetch(`${uri}&key=${process.env.API_KEY}`);
    if (!response.ok) throw new Error(`Failed to fetch video from URI. Status: ${response.statusText}`);

    const buffer = await response.arrayBuffer();
    const videoBytes = Buffer.from(buffer).toString('base64');
    return { videoBytes };
}

export default handler;
