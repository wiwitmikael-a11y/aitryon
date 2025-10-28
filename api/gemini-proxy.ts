


import type { VercelRequest, VercelResponse } from '@vercel/node';
import { GoogleGenAI, HarmCategory, HarmBlockThreshold, Type } from '@google/genai';
import { getAuthToken } from './lib/google-auth';
import {
    VIRTUAL_TRY_ON_MODEL,
    STOCK_PHOTO_MODEL,
    VIDEO_GENERATION_MODEL,
    TEXT_MODEL,
    ADVANCED_TEXT_MODEL
} from './lib/constants';

// Helper to extract base64 data and MIME type from data URLs.
const extractBase64 = (dataUrl: string) => dataUrl.split(',')[1];
const getMimeType = (dataUrl: string) => dataUrl.match(/data:(.*);base64,/)?.[1] || 'image/png';

const safetySettings = [
    { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_NONE },
    { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_NONE },
    { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_NONE },
    { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_NONE },
];

/**
 * Main handler for the Vercel serverless function.
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    // Use a single try-catch block for cleaner error handling
    try {
        const { task, ...payload } = req.body;
        
        // --- GEMINI API (API KEY) ---
        // These tasks use the standard Gemini API with an API Key.
        if (['generateCreativeStrategy', 'generateMetadataForAsset', 'generateStockImage', 'generatePhotoShootPackage', 'generateCreativePrompt'].includes(task)) {
            if (!process.env.API_KEY) {
                throw new Error("API_KEY environment variable is not set.");
            }
            const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

            switch (task) {
                case 'generateCreativeStrategy': {
                    const { topic, photoCount, videoCount } = payload;
                    const prompt = `You are an expert creative director tasked with creating a full content package for a commercial brand based on a single topic. The topic is: "${topic}".

Your task is to generate:
1.  Exactly ${photoCount} unique, highly detailed, and commercially valuable photo prompts that tell a cohesive visual story around the topic.
2.  Exactly ${videoCount} unique, cinematic, and engaging video prompts that complement the photos.

Return the response as a valid JSON object with two keys: "photoPrompts" (an array of strings) and "videoPrompts" (an array of strings).`;
                    // FIX: Moved safetySettings into the config object.
                    const response = await ai.models.generateContent({ model: ADVANCED_TEXT_MODEL, contents: prompt, config: { safetySettings, responseMimeType: 'application/json', responseSchema: { type: Type.OBJECT, properties: { photoPrompts: { type: Type.ARRAY, items: { type: Type.STRING } }, videoPrompts: { type: Type.ARRAY, items: { type: Type.STRING } } }, required: ['photoPrompts', 'videoPrompts'] } } });
                    if (!response.text) throw new Error("Failed to generate creative strategy.");
                    return res.status(200).json(JSON.parse(response.text));
                }
                case 'generateMetadataForAsset': {
                    const { prompt, type } = payload;
                    const instruction = `You are a digital asset manager for a premium stock content platform. Your task is to generate metadata for a ${type} based on its production prompt.

The prompt is: "${prompt}"

Generate a valid JSON object with three keys:
1. "title": A concise, marketable title (5-10 words).
2. "description": A compelling, keyword-rich description (20-40 words).
3. "tags": An array of 10-15 relevant, commercial keywords (as strings).`;
                    // FIX: Moved safetySettings into the config object.
                    const response = await ai.models.generateContent({ model: TEXT_MODEL, contents: instruction, config: { safetySettings, responseMimeType: 'application/json', responseSchema: { type: Type.OBJECT, properties: { title: { type: Type.STRING }, description: { type: Type.STRING }, tags: { type: Type.ARRAY, items: { type: Type.STRING } } }, required: ['title', 'description', 'tags'] } } });
                    if (!response.text) throw new Error("Failed to generate metadata.");
                    return res.status(200).json(JSON.parse(response.text));
                }
                case 'generateStockImage': {
                    const { prompt, aspectRatio, generateMetadata } = payload;
                    // FIX: Moved safetySettings into the config object.
                    const imageResponse = await ai.models.generateImages({ model: STOCK_PHOTO_MODEL, prompt, config: { safetySettings, numberOfImages: 1, aspectRatio, outputMimeType: 'image/png' } });
                    const imageBytes = imageResponse.generatedImages?.[0]?.image?.imageBytes;
                    if (!imageBytes) throw new Error("Image generation failed.");
                    const src = `data:image/png;base64,${imageBytes}`;
                    
                    let metadata = null;
                    if(generateMetadata) {
                        // FIX: Moved safetySettings into the config object.
                        const metadataResponse = await ai.models.generateContent({ model: TEXT_MODEL, contents: `Generate metadata (title, description, tags) for an image with the prompt: "${prompt}"`, config: { safetySettings, responseMimeType: 'application/json', responseSchema: { type: Type.OBJECT, properties: { title: { type: Type.STRING }, description: { type: Type.STRING }, tags: { type: Type.ARRAY, items: { type: Type.STRING } } }, required: ['title', 'description', 'tags'] } } });
                        if(metadataResponse.text) metadata = JSON.parse(metadataResponse.text);
                    }
                    return res.status(200).json({ src, metadata });
                }
                case 'generatePhotoShootPackage': {
                     const { aspectRatio } = payload;
                     const themePrompt = `You are a photoshoot art director. Your task is to brainstorm a single, commercially viable, and visually compelling theme. Based on this theme, you must then generate a "shot list" of exactly 10 unique, detailed, and creative photo prompts. The prompts should be diverse (e.g., establishing shot, detail shot, action shot, portrait) but cohesive under the main theme.

Return a valid JSON object with two keys: "theme" (a string for the main theme) and "prompts" (an array of exactly 10 prompt strings).`;
                     // FIX: Moved safetySettings into the config object.
                     const promptsResponse = await ai.models.generateContent({ model: ADVANCED_TEXT_MODEL, contents: themePrompt, config: { safetySettings, responseMimeType: 'application/json', responseSchema: { type: Type.OBJECT, properties: { theme: { type: Type.STRING }, prompts: { type: Type.ARRAY, items: { type: Type.STRING } } }, required: ['theme', 'prompts'] } } });
                     if (!promptsResponse.text) throw new Error("Failed to generate photo shoot theme.");
                     const { theme, prompts } = JSON.parse(promptsResponse.text);

                     // FIX: Moved safetySettings into the config object.
                     const imagePromises = prompts.map((p: string) => ai.models.generateImages({ model: STOCK_PHOTO_MODEL, prompt: p, config: { safetySettings, numberOfImages: 1, aspectRatio, outputMimeType: 'image/png' } }).catch(e => ({ error: true, prompt: p })));
                     const imageResults = await Promise.all(imagePromises);
                     
                     const results = imageResults.map((result: any, i) => {
                         if (result.error || !result.generatedImages?.[0]?.image?.imageBytes) {
                             return { id: `img-${i}`, prompt: prompts[i], src: '' };
                         }
                         const imageBytes = result.generatedImages[0].image.imageBytes;
                         return { id: `img-${i}`, prompt: prompts[i], src: `data:image/png;base64,${imageBytes}` };
                     });

                     return res.status(200).json({ theme, results });
                }
                 case 'generateCreativePrompt': {
                    const { type } = payload;
                    const instruction = `You are a world-class creative director. Generate one single, compelling, and highly detailed creative prompt for a ${type}. The prompt should be a complete sentence or two, ready to be used directly in a generative AI model. Do not wrap it in quotes or add any extra text.`;
                    // FIX: Moved safetySettings into a new config object.
                    const response = await ai.models.generateContent({ model: TEXT_MODEL, contents: instruction, config: { safetySettings } });
                    const prompt = response.text?.replace(/^["']|["']$/g, '').trim() ?? '';
                    return res.status(200).json({ prompt });
                }
            }
        }
        
        // --- VERTEX AI (GOOGLE_CREDENTIALS) ---
        // These tasks require Vertex AI and Service Account authentication.
        if (['virtualTryOn', 'generateVideo', 'checkVideoOperationStatus', 'fetchVideo'].includes(task)) {
            const { GOOGLE_CLOUD_PROJECT, GOOGLE_CLOUD_REGION } = process.env;
            if (!GOOGLE_CLOUD_PROJECT || !GOOGLE_CLOUD_REGION) {
                throw new Error("Missing GOOGLE_CLOUD_PROJECT or GOOGLE_CLOUD_REGION env vars.");
            }
            const vertexApiEndpoint = `https://${GOOGLE_CLOUD_REGION}-aiplatform.googleapis.com/v1`;
            
            const authToken = await getAuthToken();
            const authHeader = { 'Authorization': `Bearer ${authToken}`, 'Content-Type': 'application/json' };

            switch (task) {
                case 'virtualTryOn': {
                    const { personImage, productImage } = payload;
                    const modelEndpoint = `${vertexApiEndpoint}/projects/${GOOGLE_CLOUD_PROJECT}/locations/${GOOGLE_CLOUD_REGION}/publishers/google/models/${VIRTUAL_TRY_ON_MODEL}:generateContent`;
                    
                    const requestBody = {
                        contents: {
                            parts: [
                                { inlineData: { mimeType: getMimeType(personImage), data: extractBase64(personImage) } },
                                { inlineData: { mimeType: getMimeType(productImage), data: extractBase64(productImage) } },
                                { text: 'Place the garment from the second image onto the person in the first image, making it look realistic.' }
                            ]
                        },
                        // FIX: Use responseModalities for image output with multimodal models
                        generationConfig: { responseModalities: ["IMAGE"] },
                        safetySettings,
                    };

                    const response = await fetch(modelEndpoint, { method: 'POST', headers: authHeader, body: JSON.stringify(requestBody) });
                    if (!response.ok) throw new Error(`Vertex AI API Error: ${await response.text()}`);
                    const data = await response.json();

                    const imagePart = data.candidates?.[0]?.content.parts.find((p: any) => p.inlineData);
                     if (!imagePart || !imagePart.inlineData) throw new Error('No image generated by the Vertex AI model.');
                    
                    const resultImage = `data:${imagePart.inlineData.mimeType};base64,${imagePart.inlineData.data}`;
                    return res.status(200).json({ resultImage });
                }
                
                case 'generateVideo': {
                    const { prompt, aspectRatio } = payload;
                    const videoEndpoint = `${vertexApiEndpoint}/projects/${GOOGLE_CLOUD_PROJECT}/locations/${GOOGLE_CLOUD_REGION}/publishers/google/models/${VIDEO_GENERATION_MODEL}:generateVideos`;
                    const requestBody = { prompt, videoGenerationConfig: { numberOfVideos: 1, resolution: '1080p', aspectRatio } };
                    const response = await fetch(videoEndpoint, { method: 'POST', headers: authHeader, body: JSON.stringify(requestBody) });
                    if (!response.ok) throw new Error(`Vertex AI Video API Error: ${await response.text()}`);
                    const operation = await response.json();
                    return res.status(200).json(operation);
                }

                case 'checkVideoOperationStatus': {
                    const { operationName } = payload;
                    const statusEndpoint = `https://${GOOGLE_CLOUD_REGION}-aiplatform.googleapis.com/v1/${operationName}`;
                    const response = await fetch(statusEndpoint, { method: 'GET', headers: authHeader });
                    if (!response.ok) throw new Error(`Vertex AI Status Check Error: ${await response.text()}`);
                    const operation = await response.json();
                    return res.status(200).json(operation);
                }
                
                case 'fetchVideo': {
                     const { uri } = payload;
                     if (!process.env.API_KEY) throw new Error("API_KEY is required to fetch video.");
                     const fetchUrl = uri.includes('?') ? `${uri}&key=${process.env.API_KEY}` : `${uri}?key=${process.env.API_KEY}`;
                     const response = await fetch(fetchUrl);
                     if (!response.ok) throw new Error(`Failed to fetch video from URI: ${response.statusText}`);
                     const buffer = await response.arrayBuffer();
                     const videoBytes = Buffer.from(buffer).toString('base64');
                     return res.status(200).json({ videoBytes });
                }
            }
        }
        
        // If no task matched
        return res.status(400).json({ error: 'Invalid task specified' });

    } catch (error) {
        console.error('API Handler Error:', error);
        const errorMessage = error instanceof Error ? error.message : 'An unknown server error occurred';
        return res.status(500).json({ error: errorMessage });
    }
}