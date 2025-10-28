import type { VercelRequest, VercelResponse } from '@vercel/node';
import { GoogleGenAI, Type } from '@google/genai';
// Fix: Import Buffer to resolve TypeScript type error in Vercel environment.
import { Buffer } from 'buffer';

// Initialize the AI client once per serverless instance
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || '' });

const handler = async (req: VercelRequest, res: VercelResponse) => {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    try {
        const { action, payload } = req.body;
        let result: any;

        switch (action) {
            // --- VIDEO ACTIONS ---
            case 'researchAndSuggestVideoThemes':
                result = await researchAndSuggestVideoThemes();
                break;
            case 'startVideoGeneration':
                result = await startVideoGeneration(payload.prompt, payload.referenceImage);
                break;
            case 'checkVideoStatus':
                result = await ai.operations.getVideosOperation({ name: payload.operationName });
                break;
            case 'fetchVideo':
                const fetchRes = await fetch(`${payload.uri}&key=${process.env.API_KEY}`);
                if (!fetchRes.ok) throw new Error(`Failed to download video: ${fetchRes.statusText}`);
                const buffer = Buffer.from(await fetchRes.arrayBuffer());
                result = { videoDataUrl: `data:video/mp4;base64,${buffer.toString('base64')}` };
                break;

            // --- PHOTO ACTIONS ---
            case 'discoverTrendingTopic':
                result = await discoverTrendingTopic();
                break;
            case 'researchAndGeneratePhotoBatch':
                 result = await researchAndGeneratePhotoBatch(payload.topic);
                 break;
            case 'generatePhotoConcepts':
                result = await generatePhotoConcepts(payload);
                break;
            case 'generateStockImage':
                result = await generateStockImage(payload.prompt, payload.aspectRatio, payload.withMetadata);
                break;

            // --- CREATIVE DIRECTOR ACTIONS ---
            case 'generateCreativeStrategy':
                result = await generateCreativeStrategy(payload);
                break;
            case 'generateMetadataForAsset':
                result = await generateMetadataForAsset(payload.prompt, payload.assetType);
                break;
            
            // Fix: Add case for the new getTradingMandate action.
            case 'getTradingMandate':
                result = await getTradingMandate(payload.prompt);
                break;

            default:
                return res.status(400).json({ error: 'Invalid action' });
        }

        return res.status(200).json({ result });
    } catch (error) {
        console.error(`Error in proxy for action: ${req.body?.action}`, error);
        const message = error instanceof Error ? error.message : 'An unknown server error occurred.';
        return res.status(500).json({ error: message });
    }
};

// --- ACTION IMPLEMENTATIONS ---

async function researchAndSuggestVideoThemes() {
    const prompt = `Analyze current market trends in the creative and advertising industry. Based on this, suggest 3 commercially viable video concepts for social media. For each, provide a title, a short description, and a detailed, evocative prompt for a video AI. Ensure the response is a valid JSON array.`;
    const response = await ai.models.generateContent({
        model: 'gemini-2.5-pro',
        contents: prompt,
        config: { tools: [{ googleSearch: {} }] }
    });
    return JSON.parse(response.text);
}

async function startVideoGeneration(prompt: string, referenceImage: string | null) {
    const generationPayload: any = {
        model: 'veo-3.1-generate-preview',
        prompt,
        config: { numberOfVideos: 1, resolution: '1080p', aspectRatio: '16:9' }
    };
    if (referenceImage) {
        generationPayload.image = {
            imageBytes: referenceImage.split(',')[1],
            mimeType: referenceImage.match(/data:(.*);base64/)?.[1] || 'image/png',
        };
    }

    // This is a complex operation, we need to extend it multiple times
    let baseOperation = await ai.models.generateVideos(generationPayload);
    // This loop is simplified; a robust implementation would wait for each segment to complete.
    // For this app's purpose, we assume a sequential-like generation flow managed by the API for extensions.
    for (let i = 0; i < 4; i++) { // 4 extensions for a ~35s video
        let operationResult = baseOperation;
        while (!operationResult.done) {
            await new Promise(resolve => setTimeout(resolve, 10000));
            operationResult = await ai.operations.getVideosOperation({operation: operationResult});
        }

        if (operationResult.error) {
            throw new Error(operationResult.error.message || `Failed during video extension step ${i + 1}`);
        }
        
        baseOperation = await ai.models.generateVideos({
             model: 'veo-3.1-generate-preview',
             video: operationResult.response?.generatedVideos?.[0]?.video,
             config: { ...generationPayload.config }
        });
    }
    return baseOperation;
}

async function discoverTrendingTopic() {
    const prompt = `As a creative director, use Google Search to find one commercially relevant and visually interesting topic for stock photography right now. Respond with only the topic name as a JSON string. Example: {"topic": "AI in Healthcare"}`;
    const response = await ai.models.generateContent({
        model: 'gemini-2.5-pro',
        contents: prompt,
        config: { tools: [{ googleSearch: {} }] }
    });
    return JSON.parse(response.text);
}

async function researchAndGeneratePhotoBatch(topic: string) {
    const prompt = `You are an expert art director. Research the topic "${topic}" and create 3 distinct, commercially viable photo concepts. For each concept, provide a detailed prompt for an AI like Imagen. Respond with a valid JSON object: {"concepts": [{"prompt": "..."}]}`;
    const response = await ai.models.generateContent({
        model: 'gemini-2.5-pro',
        contents: prompt,
        config: { tools: [{ googleSearch: {} }] }
    });
    return JSON.parse(response.text);
}

async function generatePhotoConcepts({ topic, style, palette, angle }: any) {
    const prompt = `You are an expert art director. A client wants photos on the topic: "${topic}".
    Aesthetic requirements:
    - Style: ${style}
    - Palette: ${palette || 'Any'}
    - Angle: ${angle}
    Generate 3 distinct, detailed, and compelling prompts for an AI like Imagen. Respond with a valid JSON array of strings.`;
    const response = await ai.models.generateContent({ model: 'gemini-2.5-pro', contents: prompt });
    return JSON.parse(response.text);
}

async function generateStockImage(prompt: string, aspectRatio: string, withMetadata: boolean) {
    const enhancedPrompt = ` masterpiece, professional photography, shot on DSLR, 8k, sharp focus, photorealistic. ${prompt}`;
    const response = await ai.models.generateImages({
        model: 'imagen-4.0-generate-001',
        prompt: enhancedPrompt,
        config: { numberOfImages: 1, aspectRatio },
    });
    const src = `data:image/png;base64,${response.generatedImages[0].image.imageBytes}`;

    let metadata = { title: '', description: '', tags: [] };
    if (withMetadata) {
        metadata = await generateMetadataForAsset(prompt, 'photo');
    }
    return { src, prompt, metadata };
}

async function generateCreativeStrategy({ topic, photoCount, videoCount }: any) {
    const prompt = `As a Senior Creative Director for a campaign on "${topic}", generate ${photoCount} unique photo prompts and ${videoCount} unique video prompts. Each prompt must be detailed and evocative. Respond with a valid JSON object: {"photoPrompts": [...], "videoPrompts": [...]}`;
    const response = await ai.models.generateContent({ model: 'gemini-2.5-pro', contents: prompt });
    return JSON.parse(response.text);
}

async function generateMetadataForAsset(prompt: string, assetType: 'photo' | 'video') {
    const systemInstruction = `You are a digital asset manager. Create concise, SEO-friendly metadata. Provide a title, one-sentence description, and an array of 5-7 relevant tags.`;
    const userPrompt = `Generate metadata for this ${assetType} prompt: "${prompt}"`;
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
                    tags: { type: Type.ARRAY, items: { type: Type.STRING } },
                },
                required: ['title', 'description', 'tags']
            }
        }
    });
    return JSON.parse(response.text);
}

// Fix: Add implementation for the getTradingMandate function.
async function getTradingMandate(prompt: string) {
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
 * JANGAN PERNAH merespons dengan format yang berbeda selain JSON MANDATE jika tujuannya adalah untuk mengesekusi trade.
    `.trim();

    const response = await ai.models.generateContent({
        model: 'gemini-2.5-pro',
        contents: prompt,
        config: {
            systemInstruction,
            responseMimeType: 'application/json'
        }
    });

    return JSON.parse(response.text);
}

export default handler;
