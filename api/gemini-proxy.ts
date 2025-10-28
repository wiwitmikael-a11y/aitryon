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
            case 'getTradingMandate':
                result = await handleGetTradingMandate(payload);
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


async function handleGenerateVideo({ prompt, image }: any) {
    const operation = await ai.models.generateVideos({
        model: 'veo-3.1-fast-generate-preview',
        prompt,
        image,
        config: {
            numberOfVideos: 1,
            resolution: '720p',
            aspectRatio: '16:9'
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

async function handleGetTradingMandate({ prompt }: any) {
    const model = "gemini-2.5-pro";
    const systemInstruction = `
        ANDA adalah PENGELOLA DANA KUANTITATIF (QUANTITATIVE FUND MANAGER) dengan Kecerdasan Buatan Tingkat Paling Tinggi.
        Tujuan utama Anda adalah MEMAKSIMALKAN KEUNTUNGAN YANG DISESUAIKAN RISIKO.
        Anda beroperasi tanpa emosi, bias, atau FUD/FOMO. Setiap keputusan harus 100% didasarkan pada data.
        Satu-satunya cara Anda untuk memulai tindakan trading adalah dengan mengeluarkan JSON MANDATE yang terstruktur.
        Format output untuk Mandate harus SELALU sesuai skema JSON berikut:
        {
          "status": "MANDATE_INITIATED",
          "symbol": "string",
          "action": "BUY" atau "SELL",
          "entry_price": number,
          "calculated_amount_usd": number,
          "confidence_score_pct": number,
          "reasoning_summary": "string",
          "risk_parameters": {
            "stop_loss_price": number,
            "take_profit_price": number,
            "r_factor_ratio": "string",
            "max_risk_pct_of_portfolio": "string"
          },
          "tools_used": ["array", "of", "strings"]
        }
        Jika permintaan tidak jelas atau tidak mengarah pada trade, berikan jawaban dalam format teks biasa. JANGAN memformat sebagai JSON jika itu bukan Mandat.
    `;
    const response = await ai.models.generateContent({
        model,
        contents: prompt,
        config: {
            systemInstruction,
            responseMimeType: "application/json"
        }
    });
    // Gemini might wrap the JSON in markdown, so we need to clean it.
    const cleanedText = response.text.replace(/^```json\n?/, '').replace(/```$/, '');
    return JSON.parse(cleanedText);
}

export default handler;