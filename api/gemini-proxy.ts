import type { VercelRequest, VercelResponse } from '@vercel/node';
import { ai } from './lib/google-auth';
import { Modality, Type } from '@google/genai';
import {
    VIRTUAL_TRY_ON_MODEL,
    STOCK_PHOTO_MODEL,
    VIDEO_GENERATION_MODEL,
    TEXT_MODEL,
    ADVANCED_TEXT_MODEL,
} from './lib/constants';

// Re-defining this interface here to avoid path resolution issues on Vercel.
interface AssetMetadata {
    title: string;
    description: string;
    tags: string[];
}

/**
 * A helper function to generate metadata for a given asset prompt.
 * @param payload The prompt and type of asset.
 * @returns A promise that resolves to the asset metadata.
 */
async function handleGenerateMetadataForAsset(
    payload: { prompt: string; type: 'photo' | 'video' }
): Promise<AssetMetadata> {
    const { prompt, type } = payload;
    const assetType = type === 'photo' ? 'stock photo' : 'short video';
    const metadataPrompt = `You are a stock media specialist. Generate metadata for a ${assetType} created from the following prompt:
"${prompt}"
Generate a short, catchy title (max 10 words).
Generate a concise description (max 30 words).
Generate a list of 5-10 relevant keywords/tags.
Return the result as a JSON object with keys: "title", "description", and "tags" (an array of strings).`;

    const response = await ai.models.generateContent({
        model: TEXT_MODEL,
        contents: metadataPrompt,
        config: {
            responseMimeType: 'application/json',
            responseSchema: {
                type: Type.OBJECT,
                properties: {
                    title: { type: Type.STRING },
                    description: { type: Type.STRING },
                    tags: {
                        type: Type.ARRAY,
                        items: { type: Type.STRING },
                    },
                },
                required: ['title', 'description', 'tags'],
            },
        },
    });

    return JSON.parse(response.text);
}

/**
 * The main Vercel serverless function handler.
 * It routes requests based on the 'task' property in the request body.
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    try {
        const { task, ...payload } = req.body;

        switch (task) {
            case 'virtualTryOn': {
                const { personImage, productImage } = payload;
                if (!personImage || !productImage) {
                    return res.status(400).json({ error: 'Missing person or product image' });
                }

                const personImagePart = {
                    inlineData: {
                        mimeType: personImage.match(/data:(.*);base64,/)?.[1] || 'image/png',
                        data: personImage.split(',')[1],
                    },
                };
                const productImagePart = {
                    inlineData: {
                        mimeType: productImage.match(/data:(.*);base64,/)?.[1] || 'image/png',
                        data: productImage.split(',')[1],
                    },
                };
                const textPart = { text: 'Put the clothing item from the second image onto the person in the first image. Make it look realistic, retaining the person\'s features and pose. Ensure the clothing fits naturally.' };

                const response = await ai.models.generateContent({
                    model: VIRTUAL_TRY_ON_MODEL,
                    contents: { parts: [personImagePart, productImagePart, textPart] },
                    config: {
                        responseModalities: [Modality.IMAGE],
                    },
                });

                const firstPart = response.candidates?.[0]?.content?.parts?.[0];
                if (firstPart && 'inlineData' in firstPart && firstPart.inlineData) {
                    const resultImageBase64 = firstPart.inlineData.data;
                    const mimeType = firstPart.inlineData.mimeType;
                    const resultImage = `data:${mimeType};base64,${resultImageBase64}`;
                    return res.status(200).json({ resultImage });
                }
                throw new Error('No image data found in response');
            }

            case 'generateCreativeStrategy': {
                const { topic, photoCount, videoCount } = payload;
                const prompt = `You are a creative director for a marketing campaign. The campaign topic is: "${topic}". Generate a list of ${photoCount} creative and detailed photo prompts and ${videoCount} creative and detailed video prompts for this campaign. The prompts should be suitable for a generative AI model. Return the result as a JSON object with two keys: "photoPrompts" and "videoPrompts", which are arrays of strings.`;

                const response = await ai.models.generateContent({
                    model: TEXT_MODEL,
                    contents: prompt,
                    config: {
                        responseMimeType: 'application/json',
                        responseSchema: {
                            type: Type.OBJECT,
                            properties: {
                                photoPrompts: { type: Type.ARRAY, items: { type: Type.STRING } },
                                videoPrompts: { type: Type.ARRAY, items: { type: Type.STRING } },
                            },
                            required: ['photoPrompts', 'videoPrompts'],
                        },
                    },
                });
                return res.status(200).json(JSON.parse(response.text));
            }

            case 'generateMetadataForAsset': {
                const metadata = await handleGenerateMetadataForAsset(payload);
                return res.status(200).json(metadata);
            }

            case 'generateStockImage': {
                const { prompt, aspectRatio, generateMetadata } = payload;

                const imageResponse = await ai.models.generateImages({
                    model: STOCK_PHOTO_MODEL,
                    prompt: prompt,
                    config: {
                        numberOfImages: 1,
                        aspectRatio: aspectRatio,
                        outputMimeType: 'image/png',
                    },
                });
                
                const base64ImageBytes = imageResponse.generatedImages[0].image.imageBytes;
                const src = `data:image/png;base64,${base64ImageBytes}`;

                let metadata;
                if (generateMetadata) {
                    metadata = await handleGenerateMetadataForAsset({ prompt, type: 'photo' });
                }

                return res.status(200).json({ src, metadata });
            }

            case 'generatePhotoShootPackage': {
                const { aspectRatio } = payload;
                const themePrompt = `You are a creative director for a photo shoot. Generate a cohesive theme for a set of 10 stock photos. The theme should be specific and evocative. Then, generate 10 distinct, detailed, and creative image prompts based on that theme. The prompts should be suitable for a generative AI model like Imagen. Return the result as a JSON object with two keys: "theme" (a string) and "prompts" (an array of 10 strings).`;

                const themeResponse = await ai.models.generateContent({
                    model: ADVANCED_TEXT_MODEL,
                    contents: themePrompt,
                    config: {
                        responseMimeType: 'application/json',
                        responseSchema: {
                            type: Type.OBJECT,
                            properties: {
                                theme: { type: Type.STRING },
                                prompts: { type: Type.ARRAY, items: { type: Type.STRING } },
                            },
                            required: ['theme', 'prompts'],
                        },
                    },
                });

                const { theme, prompts } = JSON.parse(themeResponse.text);

                const imagePromises = (prompts as string[]).map(prompt =>
                    ai.models.generateImages({
                        model: STOCK_PHOTO_MODEL,
                        prompt,
                        config: {
                            numberOfImages: 1,
                            aspectRatio,
                            outputMimeType: 'image/png',
                        },
                    }).catch(e => {
                        console.error(`Image generation failed for prompt: "${prompt}"`, e);
                        return { error: true, prompt };
                    })
                );

                const imageGenResults = await Promise.all(imagePromises);

                const results = imageGenResults.map((result: any, i) => {
                    if (result.error) {
                        return { id: `img-${i}`, prompt: result.prompt, src: null };
                    }
                    const base64ImageBytes = result.generatedImages[0].image.imageBytes;
                    return {
                        id: `img-${i}`,
                        prompt: prompts[i],
                        src: `data:image/png;base64,${base64ImageBytes}`,
                    };
                });

                return res.status(200).json({ theme, results });
            }

            case 'generateVideo': {
                const { prompt, aspectRatio } = payload;
                const operation = await ai.models.generateVideos({
                    model: VIDEO_GENERATION_MODEL,
                    prompt: prompt,
                    config: {
                        numberOfVideos: 1,
                        resolution: '1080p',
                        aspectRatio: aspectRatio,
                    },
                });
                return res.status(200).json(operation);
            }

            case 'checkVideoOperationStatus': {
                const { operationName } = payload;
                const operation = await ai.operations.getVideosOperation({ name: operationName });
                return res.status(200).json(operation);
            }

            case 'fetchVideo': {
                const { uri } = payload;
                const apiKey = process.env.API_KEY;
                const fetchUrl = `${uri}&key=${apiKey}`;
                
                const response = await fetch(fetchUrl);
                if (!response.ok) {
                    const errorText = await response.text();
                    throw new Error(`Failed to fetch video from URI: ${response.status} ${response.statusText}. Response: ${errorText}`);
                }
                const videoBuffer = await response.arrayBuffer();
                const videoBytes = Buffer.from(videoBuffer).toString('base64');
                return res.status(200).json({ videoBytes });
            }

            case 'generateCreativePrompt': {
                const { type } = payload;
                let subject = '';
                switch (type) {
                    case 'photo': subject = 'a visually stunning, high-quality, professional stock photo'; break;
                    case 'video': subject = 'a short, cinematic video clip (5-7 seconds)'; break;
                    case 'campaign': subject = 'a marketing campaign concept for a fictional brand. The concept should be just a few words, like "Urban Oasis" or "Retro Future".'; break;
                    default: return res.status(400).json({ error: 'Invalid prompt type' });
                }

                const prompt = `You are a creative director. Generate a creative and concise prompt for ${subject}. The prompt should be specific and evocative, suitable for a generative AI. For a campaign, just return the concept topic. For photo/video, return a detailed art direction prompt. Return only the prompt string, with no extra text or quotation marks.`;

                const response = await ai.models.generateContent({
                    model: TEXT_MODEL,
                    contents: prompt,
                });

                return res.status(200).json({ prompt: response.text.trim() });
            }
            
            default:
                return res.status(400).json({ error: 'Invalid task specified' });
        }
    } catch (error) {
        console.error('API Error:', error);
        const message = error instanceof Error ? error.message : 'An unknown server error occurred.';
        res.status(500).json({ error: message });
    }
}
