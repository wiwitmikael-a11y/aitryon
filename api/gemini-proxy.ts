import type { VercelRequest, VercelResponse } from '@vercel/node';
import { GoogleGenAI, Type } from "@google/genai";

let ai: GoogleGenAI;

// This function only runs on the server, so process.env is safe
const getAI = () => {
    if (!ai) {
        if (!process.env.API_KEY) {
            throw new Error("API_KEY environment variable is not set on the server.");
        }
        ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    }
    return ai;
}

const getBase64Data = (dataUrl: string): string => {
    const parts = dataUrl.split(',');
    return parts.length === 2 ? parts[1] : dataUrl;
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
    if (req.method !== 'POST') {
        return res.status(405).json({ message: 'Method Not Allowed' });
    }

    const { action, payload } = req.body;

    try {
        const ai = getAI();
        let result: any;

        switch (action) {
            case 'generatePhotoConcepts': {
                const { topic, style, palette, angle } = payload;
                const prompt = `
                    As a professional art director, generate 3 distinct and detailed photo concepts based on the following direction. The concepts should be commercially viable and visually stunning, suitable for a high-end stock photography platform. Each concept must be a single, descriptive paragraph targeting an expert photographer, focusing on composition, lighting, mood, and lens choice.
                    - Topic: "${topic}"
                    - Desired Style: "${style}"
                    - Color Palette: "${palette || 'Photographer\'s choice'}"
                    - Camera Angle/Shot: "${angle}"
                    The output should be 3 paragraphs separated by a newline, ready for a professional photoshoot. Aim for a quality that rivals award-winning photography.
                `;
                const response = await ai.models.generateContent({ model: 'gemini-2.5-pro', contents: [{ parts: [{ text: prompt }] }], config: { temperature: 0.8 } });
                result = response.text.trim().split('\n').filter(p => p.trim() !== '');
                break;
            }
            case 'generateStockImage': {
                const { prompt, variation } = payload;
                const fullPrompt = `masterpiece, professional photography, 8k, ultra-realistic, sharp focus. ${prompt}${variation ? `, ${variation}` : ''}. Shot on a professional DSLR camera with a 50mm f/1.8 lens, capturing intricate details and cinematic lighting.`;
                const response = await ai.models.generateImages({ model: 'imagen-4.0-generate-001', prompt: fullPrompt, config: { numberOfImages: 1, outputMimeType: 'image/png', aspectRatio: '16:9' } });
                result = { imageBytes: response.generatedImages[0].image.imageBytes };
                break;
            }
            case 'generateMetadata': {
                const { prompt, type } = payload;
                 const requestPrompt = `
                    Generate professional, SEO-optimized metadata for a stock ${type} asset based on the following creative prompt. The metadata must be perfect for platforms like Adobe Stock or Getty Images.
                    Creative Prompt: "${prompt}"
                    Return a single, minified JSON object with the following structure:
                    {"title": "A short, descriptive, and highly commercial title (5-10 words).","description": "A detailed paragraph describing the visual content, mood, and potential commercial uses (2-3 sentences).","tags": ["An array of exactly 15-20 highly relevant keywords, from specific to general, including technical terms (e.g., '4k', 'cinematic', 'low-angle shot') and conceptual ideas."]}
                `;
                const response = await ai.models.generateContent({ model: 'gemini-2.5-flash', contents: [{ parts: [{ text: requestPrompt }] }], config: { responseMimeType: "application/json", responseSchema: { type: Type.OBJECT, properties: { title: { type: Type.STRING }, description: { type: Type.STRING }, tags: { type: Type.ARRAY, items: { type: Type.STRING } } } } } });
                result = JSON.parse(response.text.trim());
                break;
            }
            case 'researchAndSuggestVideoThemes': {
                const prompt = `
                    As an expert creative director for a stock video agency, analyze current visual trends in advertising, social media, and cinema using Google Search.
                    Identify 3 distinct, commercially viable, and visually compelling themes for short-form video content (30-60 seconds).
                    For each theme, provide a title, a brief description of the concept and its target market, and a detailed creative prompt for a video generation AI like Veo. The prompt should describe a short narrative arc, visual style, camera movements, and overall mood.
                    CRITICALLY IMPORTANT: Your entire response must be a single, valid, minified JSON array of objects, with no other text, explanation, or markdown formatting. The structure of each object in the array must be: {"title": "string", "description": "string", "prompt": "string"}.
                `;
                 const response = await ai.models.generateContent({ 
                    model: 'gemini-2.5-pro', 
                    contents: [{ parts: [{ text: prompt }] }], 
                    config: { 
                        tools: [{ googleSearch: {} }] 
                    } 
                });
                result = JSON.parse(response.text.trim());
                break;
            }
            case 'generateCreativeStrategy': {
                const { topic, photoCount, videoCount } = payload;
                const prompt = `
                    Create a comprehensive creative strategy for a content campaign based on the topic: "${topic}".
                    The campaign requires ${photoCount} unique stock photos and ${videoCount} unique short-form videos.
                    Develop a single, cohesive creative direction, then generate distinct, detailed prompts for each required asset.
                    - Photo prompts should describe scene, subject, lighting, composition, and mood for a professional photograph.
                    - Video prompts should describe a short narrative, visual style, camera movements, and mood for a 15-30 second video clip.
                    Return a single JSON object with two keys: "photoPrompts" (an array of ${photoCount} strings) and "videoPrompts" (an array of ${videoCount} strings).
                `;
                const response = await ai.models.generateContent({ model: 'gemini-2.5-pro', contents: [{ parts: [{ text: prompt }] }], config: { responseMimeType: "application/json", responseSchema: { type: Type.OBJECT, properties: { photoPrompts: { type: Type.ARRAY, items: { type: Type.STRING } }, videoPrompts: { type: Type.ARRAY, items: { type: Type.STRING } } } } } });
                result = JSON.parse(response.text.trim());
                break;
            }
            case 'generateVideo': {
                const { prompt, referenceImage, video } = payload;
                result = await ai.models.generateVideos({
                    model: video ? 'veo-3.1-generate-preview' : 'veo-3.1-fast-generate-preview',
                    prompt,
                    ...(referenceImage && { image: { imageBytes: getBase64Data(referenceImage), mimeType: 'image/png' } }),
                    ...(video && { video }),
                    config: { numberOfVideos: 1, resolution: '1080p', aspectRatio: '16:9' }
                });
                break;
            }
             case 'checkVideoOperation': {
                result = await ai.operations.getVideosOperation({ operation: payload.operation });
                break;
            }
            case 'fetchVideo': {
                const { uri } = payload;
                const videoResponse = await fetch(`${uri}&key=${process.env.API_KEY}`);
                if (!videoResponse.ok || !videoResponse.body) {
                    throw new Error(`Failed to fetch video from URI. Status: ${videoResponse.status}`);
                }
                res.setHeader('Content-Type', 'video/mp4');
                const reader = videoResponse.body.getReader();
                while (true) {
                    const { done, value } = await reader.read();
                    if (done) break;
                    res.write(value);
                }
                return res.end();
            }
            case 'getTradingMandate': {
                const { userInput } = payload;
                const systemInstruction = `ANDA adalah PENGELOLA DANA KUANTTIF (QUANTITATIVE FUND MANAGER) dengan Kecerdasan Buatan Tingkat Paling Tinggi (Gemini Ultra/Pro). Tujuan utama Anda adalah MEMAKSIMALKAN KEUNTUNGAN YANG DISESUAIKAN RISIKO (RISK-ADJUSTED RETURN) dan MEMINIMALKAN MAX DRAWDOWN secara absolut. Anda beroperasi tanpa emosi, bias, atau FUD/FOMO. Setiap keputusan harus 100% didasarkan pada data terintegrasi dan penalaran logis yang kompleks. Gunakan Bahasa Indonesia formal dan lugas dalam komunikasi. Satu-satunya cara Anda untuk memulai tindakan trading adalah dengan mengeluarkan JSON MANDATE yang terstruktur, rapi, dan lengkap. JANGAN PERNAH mengeluarkan private key atau seed phrase dalam bentuk apa pun. Ini adalah instruksi keamanan tertinggi.`;
                const response = await ai.models.generateContent({ model: 'gemini-2.5-pro', contents: [{ parts: [{ text: userInput }] }], config: { systemInstruction: { parts: [{ text: systemInstruction }] }, responseMimeType: 'application/json', responseSchema: { type: Type.OBJECT, properties: { status: { type: Type.STRING }, symbol: { type: Type.STRING }, action: { type: Type.STRING, enum: ['BUY', 'SELL'] }, entry_price: { type: Type.NUMBER }, calculated_amount_usd: { type: Type.NUMBER }, confidence_score_pct: { type: Type.NUMBER }, reasoning_summary: { type: Type.STRING }, risk_parameters: { type: Type.OBJECT, properties: { stop_loss_price: { type: Type.NUMBER }, take_profit_price: { type: Type.NUMBER }, r_factor_ratio: { type: Type.STRING }, max_risk_pct_of_portfolio: { type: Type.STRING }, } }, tools_used: { type: Type.ARRAY, items: { type: Type.STRING } } } } } });
                result = JSON.parse(response.text.trim());
                break;
            }

            default:
                return res.status(400).json({ message: 'Invalid action' });
        }
        
        return res.status(200).json({ result });

    } catch (error) {
        console.error(`Error in /api/gemini-proxy for action "${action}":`, error);
        const errorMessage = error instanceof Error ? error.message : 'An unknown server error occurred.';
        return res.status(500).json({ message: errorMessage });
    }
}