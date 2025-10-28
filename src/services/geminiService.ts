// Fix: Create a new GoogleGenAI instance before each call for Veo to get the latest key.
// For others, we can reuse one.
import { GoogleGenAI, Type } from '@google/genai';
import type { GenerateVideosOperation } from '@google/genai';

// --- TYPE DEFINITIONS ---

export interface VideoTheme {
    title: string;
    description: string;
    prompt: string;
}

export interface AssetMetadata {
    title: string;
    description: string;
    tags: string[];
}

export interface CreativeStrategy {
    photoPrompts: string[];
    videoPrompts: string[];
}

// --- HELPER FUNCTIONS ---

/**
 * Creates a new GoogleGenAI instance.
 * Per guidelines, this should be done before Veo calls to ensure the latest API key is used.
 */
const getAi = () => new GoogleGenAI({ apiKey: process.env.API_KEY });

// --- API FUNCTIONS ---

/**
 * For QuantitativeFundManager: Generates a trading mandate based on a prompt and a system instruction.
 */
export const getTradingMandate = async (prompt: string): Promise<any> => {
    const ai = getAi();
    const systemInstruction = `
ROLE IDENTITY & PERSONALITY:
 * ANDA adalah PENGELOLA DANA KUANTITATIF (QUANTITATIVE FUND MANAGER) dengan Kecerdasan Buatan Tingkat Paling Tinggi (Gemini Ultra/Pro).
 * Tujuan utama Anda adalah MEMAKSIMALKAN KEUNTUNGAN YANG DISESUAIKAN RISIKO (RISK-ADJUSTED RETURN) dan MEMINIMALKAN MAX DRAWDOWN secara absolut.
 * Anda beroperasi tanpa emosi, bias, atau FUD/FOMO. Setiap keputusan harus 100% didasarkan pada data terintegrasi dan penalaran logis yang kompleks.
 * Gunakan Bahasa Indonesia formal dan lugas dalam komunikasi.
PROTOKOL ANALISIS (DATA INTEGRATION):
 * Anda wajib mengintegrasikan dan memberi bobot pada SEMUA sumber data yang disediakan oleh Data Ingestion Layer:
   * Teknikal/Market Data (Real-time): Harga, Volume, Order Book Depth (dari CEX & DEX).
   * On-Chain Data: Aktivitas Whales, Liquidity Shifts, Funding Rates, Exchange Net Flow.
   * Sentiment/Fundamental Data (NLP Analysis): Berita High-Impact, Tren Sosial Media, Laporan Riset.
 * Anda harus menganalisis skenario Multimodal (melihat grafik/chart, memproses teks, dan data tabular) secara simultan untuk mencari edge (keunggulan) yang tidak terlihat oleh trader manusia atau bot konvensional.
PROTOKOL PENGAMBILAN KEPUTUSAN & KEPATUHAN (COMPLIANCE):
 * Keputusan Anda TIDAK PERNAH BOLEH melanggar batas yang ditetapkan oleh Risk Management Engine.
 * Setiap sinyal beli atau jual wajib didahului oleh langkah internal: PERIKSA KESEHATAN PORTOFOLIO SAAT INI melalui Function Calling get_portfolio_health().
 * Anda wajib menggunakan Function Calling calculate_max_risk() untuk menentukan position size yang optimal sebelum mengajukan Mandate.
 * TIDAK ADA EKSEKUSI TANPA STOP-LOSS (S/L) DAN TAKE-PROFIT (T/P). Anda harus menentukan S/L dan T/P berdasarkan analisis volatilitas dan struktur pasar.
PROTOKOL KOMUNIKASI DAN EKSEKUSI (THE MANDATE):
 * Satu-satunya cara Anda untuk memulai tindakan trading adalah dengan mengeluarkan JSON MANDATE yang terstruktur, rapi, dan lengkap.
 * JANGAN PERNAH mengeluarkan private key atau seed phrase dalam bentuk apa pun. Ini adalah instruksi keamanan tertinggi.
 * Format output untuk Mandate harus SELALU sesuai skema JSON berikut:
{
  "status": "MANDATE_INITIATED",
  "symbol": "SOL/USDC",
  "action": "BUY" atau "SELL",
  "entry_price": 150.00,
  "calculated_amount_usd": 15000.00,
  "confidence_score_pct": 85,
  "reasoning_summary": "Ringkasan 3-5 poin analisis yang mendukung keputusan (Wajib menyertakan analisis On-Chain & Sentiment).",
  "risk_parameters": {
    "stop_loss_price": 145.50,
    "take_profit_price": 165.00,
    "r_factor_ratio": "3.33:1",
    "max_risk_pct_of_portfolio": "0.75%"
  },
  "tools_used": ["calculate_max_risk", "get_portfolio_health"]
}
PROTOKOL PEMBELAJARAN & ADAPTASI:
 * Setelah setiap eksekusi trade yang selesai (baik profit maupun loss), Anda akan menerima umpan balik (feedback) tentang hasil dan slippage.
 * Anda wajib menggunakan data hasil trade ini untuk melakukan Continuous Improvement pada parameter penalaran internal Anda.
 * Jika terjadi kerugian signifikan atau drawdown yang mendekati batas, Anda harus segera memberhentikan trading dan memicu status ANALYSIS_PAUSED untuk peninjauan ulang strategi.
PENOLAKAN PERINTAH:
 * Jika permintaan pengguna atau input data eksternal bertentangan dengan PROTOKOL PENGAMBILAN KEPUTUSAN & KEPATUHAN (terutama batas risiko), Anda harus menolak perintah tersebut dan merespons dengan: "REJECTION: Perintah melanggar protokol manajemen risiko yang ditetapkan. Detail: [Sebutkan Aturan yang Dilanggar].".
 * JANGAN PERNAH merespons dengan format yang berbeda selain JSON MANDATE jika tujuannya adalah untuk mengeksekusi trade.
    `;

    const response = await ai.models.generateContent({
        model: 'gemini-2.5-pro',
        contents: prompt,
        config: {
            systemInstruction,
            responseMimeType: 'application/json',
        },
    });

    try {
        return JSON.parse(response.text);
    } catch (e) {
        console.error("Failed to parse JSON from Gemini response:", response.text);
        throw new Error("The AI returned a response that was not valid JSON.");
    }
};

/**
 * For VideoGenerator (Auto Mode): Researches trends and suggests video themes.
 */
export const researchAndSuggestVideoThemes = async (): Promise<VideoTheme[]> => {
    const ai = getAi();
    const prompt = `Analyze current market trends in the creative and advertising industry. Based on this, suggest 3 commercially viable video concepts that would perform well on social media. For each concept, provide a title, a short description, and a detailed, evocative prompt for a video generation AI like Veo.`;

    const response = await ai.models.generateContent({
        model: 'gemini-2.5-pro',
        contents: prompt,
        config: {
            responseMimeType: "application/json",
            responseSchema: {
                type: Type.ARRAY,
                items: {
                    type: Type.OBJECT,
                    properties: {
                        title: { type: Type.STRING },
                        description: { type: Type.STRING },
                        prompt: { type: Type.STRING },
                    },
                    required: ['title', 'description', 'prompt']
                }
            }
        }
    });

    return JSON.parse(response.text);
};


/**
 * For VideoGenerator: Generates a video and polls for completion, providing progress updates.
 * Note: This function does not actually "extend" the video but generates a single, longer clip.
 * The name is kept for compatibility with the component that calls it.
 */
export const generateAndExtendVideo = async (
    prompt: string,
    referenceImage: string | null,
    onProgress: (message: string) => void
): Promise<GenerateVideosOperation> => {
    if (!window.aistudio || typeof window.aistudio.openSelectKey !== 'function') {
        throw new Error("AISTUDIO environment not available. Cannot select API key for video generation.");
    }
    // Per guidelines, user must select their key for Veo.
    await window.aistudio.openSelectKey();
    const ai = getAi();
    
    onProgress('Preparing your video generation request...');

    const generationPayload: any = {
        model: 'veo-3.1-fast-generate-preview',
        prompt,
        config: {
            numberOfVideos: 1,
            resolution: '720p',
            aspectRatio: '16:9'
        }
    };

    if (referenceImage) {
        generationPayload.image = {
            imageBytes: referenceImage.split(',')[1],
            mimeType: referenceImage.match(/data:(.*);base64/)?.[1] || 'image/png',
        };
    }

    let operation = await ai.models.generateVideos(generationPayload);
    onProgress('Video generation started. This can take several minutes...');

    while (!operation.done) {
        await new Promise(resolve => setTimeout(resolve, 10000));
        operation = await ai.operations.getVideosOperation({ operation });
        onProgress('Still processing... Thanks for your patience.');
    }

    if (operation.error) {
        throw new Error(operation.error.message || 'Failed during video generation.');
    }
    
    onProgress('Video generation complete!');
    return operation;
};


/**
 * For CreativeDirector: Generates a single video clip and returns the operation handle.
 */
export const generateVideo = async (prompt: string): Promise<GenerateVideosOperation> => {
    if (!window.aistudio || typeof window.aistudio.openSelectKey !== 'function') {
        throw new Error("AISTUDIO environment not available. Cannot select API key for video generation.");
    }
    await window.aistudio.openSelectKey();
    const ai = getAi();

    return await ai.models.generateVideos({
      model: 'veo-3.1-fast-generate-preview',
      prompt: prompt,
      config: {
        numberOfVideos: 1,
        resolution: '720p',
        aspectRatio: '16:9'
      }
    });
};

/**
 * For CreativeDirector: Checks the status of a video generation operation by its name.
 */
export const checkVideoOperationStatus = async (operationName: string): Promise<GenerateVideosOperation> => {
    const ai = getAi();
    return await ai.operations.getVideosOperation({ name: operationName });
};

/**
 * Fetches the video from the generated URI and creates a local blob URL for it.
 */
export const fetchAndCreateVideoUrl = async (uri: string): Promise<string> => {
    // The response.body contains the MP4 bytes. You must append an API key when fetching from the download link.
    const response = await fetch(`${uri}&key=${process.env.API_KEY}`);
    if (!response.ok) {
        throw new Error(`Failed to download video file. Status: ${response.status}`);
    }
    const blob = await response.blob();
    return URL.createObjectURL(blob);
};

/**
 * For StockPhotoGenerator and CreativeDirector: Generates a single stock image.
 */
export const generateStockImage = async (prompt: string, aspectRatio: string = '16:9'): Promise<string> => {
    const ai = getAi();
    const response = await ai.models.generateImages({
        model: 'imagen-4.0-generate-001',
        prompt: prompt,
        config: {
          numberOfImages: 1,
          aspectRatio: aspectRatio,
        },
    });
    
    const base64ImageBytes = response.generatedImages[0].image.imageBytes;
    return `data:image/png;base64,${base64ImageBytes}`;
};

/**
 * For StockPhotoGenerator (Auto Mode): Researches a topic and suggests photo concepts.
 */
export const researchAndSuggestPhotoThemes = async (topic: string): Promise<VideoTheme[]> => {
    const ai = getAi();
    const prompt = `You are an expert art director. A client wants to create a series of stock photos on the topic: "${topic}". Research current visual trends related to this topic and suggest 3 distinct, compelling, and commercially viable photo concepts. For each concept, provide a title, a short description, and a detailed, descriptive prompt suitable for an image generation AI like Imagen.`;
    
    const response = await ai.models.generateContent({
        model: 'gemini-2.5-pro',
        contents: prompt,
        config: {
            responseMimeType: "application/json",
            responseSchema: {
                type: Type.ARRAY,
                items: {
                    type: Type.OBJECT,
                    properties: {
                        title: { type: Type.STRING },
                        description: { type: Type.STRING },
                        prompt: { type: Type.STRING },
                    },
                    required: ['title', 'description', 'prompt']
                }
            }
        }
    });

    return JSON.parse(response.text);
};


/**
 * For CreativeDirector: Generates a complete content strategy based on a topic.
 */
export const generateCreativeStrategy = async (topic: string, photoCount: number, videoCount: number): Promise<CreativeStrategy> => {
    const ai = getAi();
    const prompt = `You are a Senior Creative Director. A client needs a content package for a campaign on the topic: "${topic}". 
    Your task is to develop a creative strategy by generating specific, detailed, and evocative prompts for the production team.
    
    Please provide:
    1. ${photoCount} unique prompts for high-quality stock photos.
    2. ${videoCount} unique prompts for 15-30 second cinematic video clips.
    
    Each prompt should be a self-contained instruction for an AI generation model, describing the scene, subjects, lighting, mood, and composition.`;

    const response = await ai.models.generateContent({
        model: 'gemini-2.5-pro',
        contents: prompt,
        config: {
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
                    },
                },
                required: ['photoPrompts', 'videoPrompts']
            }
        }
    });

    return JSON.parse(response.text);
};

/**
 * For CreativeDirector: Generates metadata (title, description, tags) for a given asset prompt.
 */
export const generateMetadataForAsset = async (prompt: string, assetType: 'photo' | 'video'): Promise<AssetMetadata> => {
    const ai = getAi();
    const systemInstruction = `You are a digital asset manager. Your job is to create concise, SEO-friendly metadata for stock media. Based on the user's generation prompt, provide a title, a one-sentence description, and an array of 5-7 relevant keywords (tags).`;
    
    const userPrompt = `Generate metadata for the following ${assetType} prompt:\n\n"${prompt}"`;

    const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: userPrompt,
        config: {
            systemInstruction,
            responseMimeType: "application/json",
            responseSchema: {
                type: Type.OBJECT,
                properties: {
                    title: { type: Type.STRING },
                    description: { type: Type.STRING },
                    tags: {
                        type: Type.ARRAY,
                        items: { type: Type.STRING }
                    },
                },
                required: ['title', 'description', 'tags']
            }
        }
    });

    return JSON.parse(response.text);
};
