import type { VercelRequest, VercelResponse } from '@vercel/node';
import { GoogleGenAI, Type, Modality } from "@google/genai";
import { Buffer } from 'buffer';
import { getGoogleAuthToken } from './lib/google-auth';
import { VERTEX_AI_PROJECT_ID, VERTEX_AI_LOCATION, VEO_MODEL_ID } from '../src/constants';


// Ensure the API key is available in environment variables for non-Vertex AI calls (e.g., Gemini Flash for prompts, Imagen)
if (!process.env.API_KEY) {
    throw new Error("API_KEY environment variable is not set.");
}

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

const VERTEX_AI_API_BASE = `https://${VERTEX_AI_LOCATION}-aiplatform.googleapis.com/v1/projects/${VERTEX_AI_PROJECT_ID}/locations/${VERTEX_AI_LOCATION}`;


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
            // Viral Affiliate Video tasks
            case 'generateVideoBrief':
                result = await handleGenerateVideoBrief(payload);
                break;
            case 'generateVideoStoryboard':
                result = await handleGenerateVideoStoryboard(payload);
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


async function handleGenerateVideo({ prompt, aspectRatio, image }: any) {
    const authToken = await getGoogleAuthToken();
    const endpoint = `${VERTEX_AI_API_BASE}/publishers/google/models/${VEO_MODEL_ID}:generateVideos`;

    const requestPayload: any = {
        prompt,
        config: {
            numberOfVideos: 1,
            resolution: '1080p',
            aspectRatio: aspectRatio
        }
    };

    if (image) {
        const base64Data = image.data.startsWith('data:') ? image.data.split(',')[1] : image.data;
        requestPayload.image = {
            imageBytes: base64Data,
            mimeType: image.mimeType
        };
    }

    const body = JSON.stringify(requestPayload);

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${authToken}`,
        'Content-Type': 'application/json; charset=utf-8',
      },
      body,
    });

    if (!response.ok) {
        const errorBody = await response.json().catch(() => ({ error: { message: 'Failed to parse error response' } }));
        throw new Error(`Vertex AI request failed with status ${response.status}: ${errorBody.error?.message || 'Unknown error'}`);
    }

    return response.json();
}

async function handleCheckVideoOperationStatus({ operationName }: any) {
    const authToken = await getGoogleAuthToken();
    const endpoint = `https://${VERTEX_AI_LOCATION}-aiplatform.googleapis.com/v1/${operationName}`;

    const response = await fetch(endpoint, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${authToken}`,
        'Content-Type': 'application/json; charset=utf-8',
      },
    });

    if (!response.ok) {
        const errorBody = await response.json().catch(() => ({ error: { message: 'Failed to parse error response' } }));
        throw new Error(`Vertex AI status check failed with status ${response.status}: ${errorBody.error?.message || 'Unknown error'}`);
    }
    
    return response.json();
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


// --- Viral Affiliate Video Handlers ---
async function handleGenerateVideoBrief({ 
    productImage, 
    description, 
    language,
    marketingAngle,
    visualStyle,
    narrationStyle 
}: { 
    productImage: string, 
    description: string, 
    language: string,
    marketingAngle: string,
    visualStyle: string,
    narrationStyle: string
}) {
    const model = 'gemini-2.5-pro';
    const base64Data = productImage.startsWith('data:') ? productImage.split(',')[1] : productImage;
    
    const prompt = language === 'indonesia' ?
        `Kamu adalah AI Marketing Analyst untuk pasar Indonesia. Berdasarkan gambar produk, deskripsi, dan arahan kreatif ini:
        - Deskripsi Produk: "${description}"
        - Angle Pemasaran: "${marketingAngle}"
        - Gaya Visual Video: "${visualStyle}"
        - Gaya Narasi Suara: "${narrationStyle}"
        
        Tentukan:
        * Target Audiens: (Contoh: 'Ibu muda', 'Gamers', 'Pekerja kantoran').
        * Masalah Utama: (Masalah yang diselesaikan produk ini, sesuaikan dengan angle).
        * Fitur Kunci: (3 fitur utama yang paling relevan dengan angle).
        
        Kembalikan jawaban HANYA dalam format JSON.` :
        `You are an AI Marketing Analyst for the global market. Based on this product image, description, and creative direction:
        - Product Description: "${description}"
        - Marketing Angle: "${marketingAngle}"
        - Video Visual Style: "${visualStyle}"
        - Voice Narration Style: "${narrationStyle}"
        
        Determine:
        * Target Audience: (e.g., 'Young mothers', 'Gamers', 'Office workers').
        * Main Problem: (The problem this product solves, aligned with the angle).
        * Key Features: (3 key features most relevant to the angle).
        
        Return the answer ONLY in JSON format.`;

    const imagePart = {
        inlineData: {
            mimeType: 'image/jpeg', // Assuming jpeg/png
            data: base64Data
        }
    };
    
    const response = await ai.models.generateContent({
        model,
        contents: { parts: [imagePart, { text: prompt }] },
        config: { responseMimeType: "application/json" }
    });
    
    return JSON.parse(response.text);
}

async function handleGenerateVideoStoryboard({ brief, language, aspectRatio }: { brief: any, language: string, aspectRatio: string }) {
    const model = 'gemini-2.5-pro';
    
    const prompt = language === 'indonesia' ?
    `Kamu adalah penulis storyboard dan sutradara video TikTok/Reels viral. Gunakan brief strategis ini: ${JSON.stringify(brief)}.
    Buat storyboard untuk video ${aspectRatio} dalam Bahasa Indonesia. Total durasi video harus sekitar 35 detik.
    Buat 5 adegan (scenes). Untuk setiap adegan, kembalikan JSON dengan kunci berikut:
    * "veo_prompt_base": String yang berisi instruksi visual untuk AI video generator (Veo), TIDAK TERMASUK narasi atau musik. Prompt ini HARUS mencakup: Deskripsi visual yang mendetail sesuai dengan "Gaya Visual Video" dari brief. PENTING: Untuk adegan pertama, instruksikan untuk menggunakan gambar produk asli sebagai fokus utama.
    * "display_voice_over": String yang HANYA berisi naskah voice-over untuk adegan ini. Naskah harus ditulis dengan "Gaya Narasi Suara" dari brief.
    Pastikan alur ceritanya persuasif dan sesuai dengan "Angle Pemasaran" dari brief. Kembalikan HANYA sebagai array JSON.` :
    `You are a viral TikTok/Reels storyboard writer and director. Use this strategic brief: ${JSON.stringify(brief)}.
    Create a storyboard for a ${aspectRatio} video in English. The total video duration should be approximately 35 seconds.
    Create 5 scenes. For each scene, return a JSON object with the following keys:
    * "veo_prompt_base": A string containing the visual instructions for an AI video generator (Veo), EXCLUDING any narration or music. This prompt MUST include: A detailed visual description that matches the "Video Visual Style" from the brief. IMPORTANT: For the first scene, instruct it to use the original product image as the main focus.
    * "display_voice_over": A string containing ONLY the voice-over script for this scene. The script should be written in the "Voice Narration Style" from the brief.
    Make the story persuasive and align with the "Marketing Angle" from the brief. Return ONLY as a JSON array.`;
    
    const response = await ai.models.generateContent({
        model,
        contents: prompt,
        config: { responseMimeType: "application/json" }
    });

    return JSON.parse(response.text);
}

export default handler;
