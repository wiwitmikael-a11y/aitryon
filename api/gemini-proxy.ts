import { GoogleGenAI, Type } from '@google/genai';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getAuthToken } from './lib/google-auth';
import {
  VERTEX_AI_API_BASE,
  VIRTUAL_TRY_ON_MODEL_ID,
  VEO_MODEL_ID,
} from '../../src/constants';

// Helper to remove data URL prefix
const stripDataUrlPrefix = (dataUrl: string) => dataUrl.replace(/^data:image\/\w+;base64,/, '');

// Initialize Gemini
// FIX: Use named parameter for apiKey
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
const textModel = 'gemini-2.5-flash';
const imageModel = 'imagen-4.0-generate-001';

export default async function handler(req: VercelRequest, res: VercelResponse) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    try {
        const { task, ...payload } = req.body;

        switch (task) {
            case 'virtualTryOn': {
                const { personImage, productImage } = payload;
                const token = await getAuthToken();
                const endpoint = `${VERTEX_AI_API_BASE}/publishers/google/models/${VIRTUAL_TRY_ON_MODEL_ID}:predict`;

                const requestBody = {
                    instances: [
                        {
                            personImage: {
                                image: { bytesBase64Encoded: stripDataUrlPrefix(personImage) }
                            },
                            productImages: [
                                {
                                    image: { bytesBase64Encoded: stripDataUrlPrefix(productImage) }
                                }
                            ]
                        }
                    ],
                    parameters: {
                        sampleCount: 1,
                        personGeneration: 'allow_all'
                    }
                };

                const response = await fetch(endpoint, {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(requestBody)
                });

                if (!response.ok) {
                    const errorText = await response.text();
                    console.error(`Vertex AI Error: ${errorText}`);
                    throw new Error(`Vertex AI API request failed with status ${response.status}.`);
                }

                const data = await response.json();
                const resultImage = `data:image/png;base64,${data.predictions[0].bytesBase64Encoded}`;

                return res.status(200).json({ resultImage });
            }

            case 'generateCreativePrompt': {
                const { type } = payload;
                const promptMap: Record<string, string> = {
                    photo: `Generate a short, vivid, and highly detailed creative prompt for an AI image generator to create a stunning, professional stock photo. Focus on a single, clear subject with a strong emotional tone. No people. Be specific about lighting, composition, and color palette. Example: "A single dew-kissed fern frond unfurling in the soft morning light of a misty redwood forest, macro shot, shallow depth of field, with cinematic, muted green and brown tones."`,
                    video: `Generate a short, vivid, and highly detailed creative prompt for an AI video generator to create a breathtaking, cinematic 10-second video clip. The prompt should describe a scene with movement and atmosphere. No people. Be specific about the action, camera movement, lighting, and mood. Example: "Slow-motion drone shot flying low over a field of vibrant purple lavender at sunrise, with golden light catching the gentle sway of the flowers, creating a serene and dreamlike atmosphere."`,
                    campaign: `Generate a short, compelling, and marketable topic or theme for a fictional brand's new digital ad campaign. The theme should be aspirational and emotionally resonant. Keep it to one sentence. Example: "Unleash your inner architect: build your world, your way."`
                };

                const response = await ai.models.generateContent({
                    model: textModel,
                    contents: promptMap[type],
                });

                return res.status(200).json({ prompt: response.text.replace(/"/g, '') });
            }

            case 'generateCreativeStrategy': {
                const { topic, photoCount, videoCount } = payload;
                const prompt = `You are an expert creative director. Based on the campaign topic "${topic}", generate a list of ${photoCount} distinct photo prompts and ${videoCount} distinct video prompts. These prompts should be detailed, creative, and ready to be used by an AI image/video generator. The prompts should all feel like part of the same cohesive campaign. Return your response as a JSON object with two keys: "photoPrompts" (an array of strings) and "videoPrompts" (an array of strings). Do not include any other text or explanation.`;

                const response = await ai.models.generateContent({
                    model: textModel,
                    contents: prompt,
                    config: {
                        responseMimeType: 'application/json',
                        responseSchema: {
                            type: Type.OBJECT,
                            properties: {
                                photoPrompts: { type: Type.ARRAY, items: { type: Type.STRING } },
                                videoPrompts: { type: Type.ARRAY, items: { type: Type.STRING } }
                            },
                            required: ['photoPrompts', 'videoPrompts']
                        }
                    }
                });
                
                return res.status(200).json(JSON.parse(response.text));
            }

            case 'generateMetadataForAsset': {
                const { prompt, type } = payload;
                const systemInstruction = `You are an expert stock ${type} metadata creator. Given a prompt, generate a short, catchy title, a compelling one-sentence description, and an array of 5-10 relevant, searchable, lowercase tags. Return your response as a JSON object with three keys: "title" (string), "description" (string), and "tags" (an array of strings). Do not include any other text or explanation.`;

                const response = await ai.models.generateContent({
                    model: textModel,
                    contents: `Prompt: "${prompt}"`,
                    config: {
                        systemInstruction,
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

                return res.status(200).json(JSON.parse(response.text));
            }

            case 'generateStockImage': {
                const { prompt, aspectRatio, generateMetadata } = payload;
                const imageResponse = await ai.models.generateImages({
                    model: imageModel,
                    prompt,
                    config: {
                        numberOfImages: 1,
                        aspectRatio: aspectRatio,
                        outputMimeType: "image/png",
                    }
                });

                const imageBytes = imageResponse.generatedImages[0].image.imageBytes;
                const src = `data:image/png;base64,${imageBytes}`;
                
                let metadata = null;
                if (generateMetadata) {
                    const systemInstruction = `You are an expert stock photo metadata creator. Given a prompt, generate a short, catchy title, a compelling one-sentence description, and an array of 5-10 relevant, searchable, lowercase tags. Return your response as a JSON object with three keys: "title" (string), "description" (string), and "tags" (an array of strings). Do not include any other text or explanation.`;
                    const metaResponse = await ai.models.generateContent({
                        model: textModel,
                        contents: `Prompt: "${prompt}"`,
                        config: {
                            systemInstruction,
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
                    metadata = JSON.parse(metaResponse.text);
                }
                
                return res.status(200).json({ src, metadata });
            }

            case 'generatePhotoShootPackage': {
                const { aspectRatio } = payload;
                const themePrompt = `You are an expert creative director. Generate a creative theme for a photoshoot of 10 images. Also generate 10 distinct, detailed, and professional photo prompts based on that theme. The prompts should be suitable for an AI image generator and should not include people. Return your response as a JSON object with two keys: "theme" (string) and "prompts" (an array of 10 strings). Do not include any other text or explanation.`;

                const themeResponse = await ai.models.generateContent({
                    model: textModel,
                    contents: themePrompt,
                    config: {
                        responseMimeType: 'application/json',
                        responseSchema: {
                            type: Type.OBJECT,
                            properties: {
                                theme: { type: Type.STRING },
                                prompts: { type: Type.ARRAY, items: { type: Type.STRING } }
                            },
                            required: ['theme', 'prompts']
                        }
                    }
                });
                
                const { theme, prompts } = JSON.parse(themeResponse.text);

                const imagePromises = prompts.map((p: string) => 
                    ai.models.generateImages({
                        model: imageModel,
                        prompt: p,
                        config: {
                            numberOfImages: 1,
                            aspectRatio: aspectRatio,
                            outputMimeType: "image/png",
                        }
                    }).catch(e => ({ error: e.message, prompt: p }))
                );

                const imageResults = await Promise.all(imagePromises);
                
                const results = imageResults.map((result: any, i: number) => {
                    if (result.error) {
                        console.error(`Failed to generate image for prompt: "${result.prompt}"`, result.error);
                        return { id: `batch-${i}`, prompt: prompts[i], src: null };
                    }
                    return {
                        id: `batch-${i}`,
                        prompt: prompts[i],
                        src: `data:image/png;base64,${result.generatedImages[0].image.imageBytes}`,
                    };
                });

                return res.status(200).json({ theme, results });
            }

            case 'generateVideo': {
                const { prompt, aspectRatio } = payload;
                const operation = await ai.models.generateVideos({
                    model: VEO_MODEL_ID,
                    prompt,
                    config: {
                        numberOfVideos: 1,
                        resolution: '1080p',
                        aspectRatio: aspectRatio
                    }
                });
                return res.status(200).json(operation);
            }

            case 'checkVideoOperationStatus': {
                const { operationName } = payload;
                const operation = await ai.operations.getVideosOperation({ 
                    operation: { name: operationName, done: false }
                });
                return res.status(200).json(operation);
            }

            case 'fetchVideo': {
                const { uri } = payload;
                const fetchUrl = `${uri}&key=${process.env.API_KEY}`;
                const videoResponse = await fetch(fetchUrl);
                
                if (!videoResponse.ok) {
                    throw new Error(`Failed to fetch video from URI. Status: ${videoResponse.status}`);
                }

                const videoBuffer = await videoResponse.arrayBuffer();
                const videoBytes = Buffer.from(videoBuffer).toString('base64');

                return res.status(200).json({ videoBytes });
            }
                
            default:
                return res.status(400).json({ error: `Unknown task: ${task}` });
        }
    } catch (error) {
        console.error(`Error in task handler:`, error);
        res.status(500).json({ error: error instanceof Error ? error.message : 'An unknown server error occurred' });
    }
}
