import type { VercelRequest, VercelResponse } from '@vercel/node';
import { GoogleGenAI, Type, HarmCategory, HarmBlockThreshold } from '@google/genai';
import { Buffer } from 'buffer';

// Basic safety settings to allow for broader content generation for creative tools
const safetySettings = [
  {
    category: HarmCategory.HARM_CATEGORY_HARASSMENT,
    threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH,
  },
  {
    category: HarmCategory.HARM_CATEGORY_HATE_SPEECH,
    threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH,
  },
  {
    category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT,
    threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
  },
  {
    category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
    threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH,
  },
];

const getAi = () => new GoogleGenAI({ apiKey: process.env.API_KEY! });

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method Not Allowed' });
  }

  const ai = getAi();

  try {
    const { action, payload } = req.body;

    switch (action) {
        case 'generatePhotoConcepts': {
            const { topic, style, palette, angle } = payload;
            const prompt = `Generate 5 distinct, highly-detailed, and commercially-viable stock photo concepts based on the following art direction. Each concept should be a single, complete sentence ready to be used as an image generation prompt.
            - Topic: "${topic}"
            - Style: "${style}"
            - Color Palette: "${palette || 'Not specified'}"
            - Angle/Shot: "${angle}"
            
            Focus on creating prompts that result in professional, high-quality images suitable for marketing and editorial use. Avoid generic descriptions.`;
            
            const response = await ai.models.generateContent({
                model: 'gemini-2.5-pro',
                contents: prompt,
                config: {
                    temperature: 0.8,
                    maxOutputTokens: 1024,
                    responseMimeType: 'application/json',
                    responseSchema: {
                        type: Type.OBJECT,
                        properties: {
                            concepts: {
                                type: Type.ARRAY,
                                items: { type: Type.STRING }
                            }
                        }
                    },
                    safetySettings: safetySettings,
                }
            });

            const result = JSON.parse(response.text);
            res.status(200).json(result);
            break;
        }

        case 'generateStockImage': {
            const { prompt, aspectRatio } = payload;
            const response = await ai.models.generateImages({
                model: 'imagen-4.0-generate-001',
                prompt,
                config: {
                    numberOfImages: 1,
                    aspectRatio: aspectRatio || '16:9',
                    outputMimeType: 'image/png',
                }
            });
            const image = response.generatedImages[0];
            const src = `data:image/png;base64,${image.image.imageBytes}`;
            res.status(200).json({ src });
            break;
        }

        case 'generateMetadataForAsset': {
            const { prompt, type } = payload;
            const systemInstruction = `You are a helpful assistant who creates metadata for stock assets. Based on the user's prompt, generate a short, catchy title (3-7 words), a concise and descriptive description (1-2 sentences), and 5-10 relevant comma-separated tags. The output must be a clean JSON object.`;
            const user_prompt = `Generate metadata for a stock ${type} based on this prompt: "${prompt}"`;
            
            const response = await ai.models.generateContent({
                model: 'gemini-2.5-flash',
                contents: user_prompt,
                config: {
                    systemInstruction,
                    responseMimeType: 'application/json',
                    responseSchema: {
                        type: Type.OBJECT,
                        properties: {
                            title: { type: Type.STRING },
                            description: { type: Type.STRING },
                            tags: { type: Type.ARRAY, items: { type: Type.STRING } },
                        },
                        required: ['title', 'description', 'tags'],
                    },
                    safetySettings: safetySettings,
                }
            });

            const result = JSON.parse(response.text);
            res.status(200).json(result);
            break;
        }

        case 'generateCreativeStrategy': {
            const { topic, photoCount, videoCount } = payload;
            const systemInstruction = "You are a world-class creative director. Your task is to brainstorm a complete content strategy based on a user's topic. You will generate a list of distinct, detailed, and compelling prompts for photos and another list for videos. The output must be a clean JSON object.";
            const user_prompt = `Topic: "${topic}". Generate ${photoCount} unique photo prompts and ${videoCount} unique video prompts.`;
            
            const response = await ai.models.generateContent({
                model: 'gemini-2.5-pro',
                contents: user_prompt,
                config: {
                    systemInstruction,
                    responseMimeType: 'application/json',
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
                            }
                        },
                        required: ['photoPrompts', 'videoPrompts']
                    },
                    safetySettings: safetySettings,
                }
            });

            const result = JSON.parse(response.text);
            res.status(200).json(result);
            break;
        }

        case 'getTradingMandate': {
            const { prompt } = payload;
            const systemInstruction = `WAJIB: iNI ADALAH APP REAL YG MENGGUNAKAN DATA REAL-TIME DAN BUKAN APP MOCK ATAU APP MAINAN

Baik, ini adalah daftar System Instructions (Instruksi Sistem) yang terstruktur dan tegas. Instruksi ini dirancang untuk dimasukkan ke dalam System Prompt utama di Google AI Studio dan berfungsi sebagai "konstitusi" bagi Gemini Agent Anda.
Instruksi ini bertujuan untuk memastikan Agent:
 * Selalu patuh pada peran utama.
 * Mengutamakan manajemen risiko.
 * Hanya berkomunikasi menggunakan format yang disetujui (JSON Mandate) untuk eksekusi.
 * Mengintegrasikan semua data yang disediakan.
System Instructions (Konstitusi) untuk Gemini AI Agent
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
 * Setiap sinyal beli atau jual wajib didahului oleh langkah internal: PERIKSA KESEHATAN PORTOFILIO SAAT INI melalui Function Calling get_portfolio_health().
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
`;
            
            const response = await ai.models.generateContent({
                model: 'gemini-2.5-pro',
                contents: prompt,
                config: {
                    systemInstruction,
                    responseMimeType: 'application/json',
                    safetySettings: safetySettings,
                }
            });

            // The model is instructed to ONLY return JSON, but it might be wrapped in markdown.
            let jsonString = response.text.trim();
            if (jsonString.startsWith('```json')) {
                jsonString = jsonString.substring(7, jsonString.length - 3).trim();
            }

            const result = JSON.parse(jsonString);
            res.status(200).json(result);
            break;
        }
        
        case 'generateVideo': {
            const { prompt, image } = payload;
            const operation = await ai.models.generateVideos({
                model: 'veo-3.1-fast-generate-preview',
                prompt,
                image,
                config: {
                    numberOfVideos: 1,
                    resolution: '720p',
                    aspectRatio: '16:9',
                }
            });
            res.status(200).json(operation);
            break;
        }

        case 'checkVideoOperationStatus': {
            const { operationName } = payload;
            const operation = await ai.operations.getVideosOperation({ operation: { name: operationName } });
            res.status(200).json(operation);
            break;
        }

        case 'fetchVideo': {
            const { uri } = payload;
            if (!uri) {
                return res.status(400).json({ message: 'Missing video URI' });
            }
            // The download link needs the API key
            const downloadUrl = `${uri}&key=${process.env.API_KEY}`;
            const videoResponse = await fetch(downloadUrl);
            if (!videoResponse.ok) {
                throw new Error(`Failed to fetch video from URI. Status: ${videoResponse.status}`);
            }
            const videoBuffer = await videoResponse.arrayBuffer();
            const base64Video = Buffer.from(videoBuffer).toString('base64');
            const dataUrl = `data:video/mp4;base64,${base64Video}`;
            res.status(200).json({ dataUrl });
            break;
        }

      default:
        res.status(400).json({ message: 'Invalid action' });
    }
  } catch (error) {
    console.error(`Error in gemini-proxy for action: ${req.body?.action}:`, error);
    const message = error instanceof Error ? error.message : 'An unknown error occurred on the server.';
    res.status(500).json({ message });
  }
}