import { GoogleGenAI, Type, VideosOperation } from "@google/genai";

// Initialize the Gemini client.
// The API key is automatically managed by the AI Studio environment.
// For video generation, a new client will be created on-demand to ensure the latest key is used.
let ai: GoogleGenAI;
const getAI = () => {
    if (!ai) {
        ai = new GoogleGenAI({ apiKey: process.env.API_KEY! });
    }
    return ai;
}

// ---- Types ----
export interface AssetMetadata {
    title: string;
    description: string;
    tags: string[];
}

export interface VideoTheme {
    title: string;
    description: string;
    prompt: string;
}

// ---- Helper Functions ----
const getBase64Data = (dataUrl: string): string => {
    const parts = dataUrl.split(',');
    return parts.length === 2 ? parts[1] : dataUrl;
};


// ---- Stock Photo Generator Functions ----

export async function generatePhotoConcepts(topic: string, style: string, palette: string, angle: string): Promise<string[]> {
    const ai = getAI();
    const prompt = `
        Based on the following art direction, generate 3 distinct and detailed photo concepts that are creative and commercially viable.
        Each concept should be a single, descriptive paragraph. Do not use markdown or lists.
        
        Topic: "${topic}"
        Photography Style: "${style}"
        Color Palette: "${palette || 'Not specified'}"
        Camera Angle: "${angle}"

        Return the 3 concepts separated by a newline character.
    `;

    const response = await ai.models.generateContent({
        model: 'gemini-2.5-pro',
        contents: [{ parts: [{ text: prompt }] }],
        config: {
            temperature: 0.8,
        }
    });

    const text = response.text.trim();
    return text.split('\n').filter(p => p.trim() !== '');
}

export async function generateStockImage(prompt: string, variation?: string): Promise<string> {
    const ai = getAI();
    const fullPrompt = `${prompt}${variation ? `, ${variation}` : ''}. High-quality, professional stock photography.`;

    const response = await ai.models.generateImages({
        model: 'imagen-4.0-generate-001',
        prompt: fullPrompt,
        config: {
            numberOfImages: 1,
            outputMimeType: 'image/png',
            aspectRatio: '16:9'
        }
    });

    const imageBytes = response.generatedImages[0].image.imageBytes;
    return `data:image/png;base64,${imageBytes}`;
}

export async function generateMetadataForAsset(prompt: string, type: 'photo' | 'video'): Promise<AssetMetadata> {
    const ai = getAI();
    const requestPrompt = `
        Generate metadata for a stock ${type} asset based on the following creative prompt. The metadata should be optimized for searchability on a stock asset platform.

        Prompt: "${prompt}"

        Return a JSON object with the following structure:
        {
            "title": "A short, descriptive title (5-10 words).",
            "description": "A detailed paragraph describing the visual content and potential uses (2-3 sentences).",
            "tags": ["An array of 10-15 relevant keywords and concepts, including technical terms if applicable (e.g., '4k', 'cinematic')."]
        }
    `;

    const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: [{ parts: [{ text: requestPrompt }] }],
        config: {
            responseMimeType: "application/json",
            responseSchema: {
                type: Type.OBJECT,
                properties: {
                    title: { type: Type.STRING },
                    description: { type: Type.STRING },
                    tags: {
                        type: Type.ARRAY,
                        items: { type: Type.STRING }
                    }
                }
            }
        }
    });

    const jsonText = response.text.trim();
    try {
        return JSON.parse(jsonText) as AssetMetadata;
    } catch (e) {
        console.error("Failed to parse metadata JSON:", jsonText);
        // Fallback in case of parsing error
        return {
            title: "Untitled Asset",
            description: prompt,
            tags: ["generated", type]
        };
    }
}

export async function researchAndGeneratePhotoBatch(
    topic: string, 
    progressCallback: (stage: 'researching' | 'concepting' | 'shooting' | 'metadata', message: string) => void
): Promise<any[]> {
    const ai = getAI();

    // 1. Research trends
    progressCallback('researching', 'Researching market trends...');
    const researchPrompt = `
        As an expert creative director, research current visual trends related to the topic "${topic}".
        Identify 3 distinct, commercially viable sub-themes or concepts that would perform well as stock photography.
        For each theme, provide a detailed, one-paragraph creative prompt suitable for an image generation AI like Imagen.
        The prompts should describe the scene, subject, lighting, composition, and mood.
    `;
    const researchResponse = await ai.models.generateContent({
        model: 'gemini-2.5-pro',
        contents: [{ parts: [{ text: researchPrompt }] }],
        config: {
            tools: [{ googleSearch: {} }]
        }
    });

    const prompts = researchResponse.text.trim().split('\n').filter(p => p.trim() !== '' && p.length > 50);
    if (prompts.length === 0) throw new Error("Could not generate concepts from research.");
    
    const imageAssets: any[] = [];
    
    for (let i = 0; i < prompts.length; i++) {
        const prompt = prompts[i];
        
        // 2. Generate Image
        progressCallback('shooting', `Generating image for concept ${i + 1}/${prompts.length}...`);
        const src = await generateStockImage(prompt);
        
        // 3. Generate Metadata
        progressCallback('metadata', `Generating metadata for concept ${i + 1}/${prompts.length}...`);
        const metadata = await generateMetadataForAsset(prompt, 'photo');
        
        imageAssets.push({
            id: `auto-img-${i}`,
            prompt: prompt,
            src: src,
            metadata: metadata,
            conceptGroup: topic
        });
    }

    return imageAssets;
}

// ---- Video Generator Functions ----

// For video, create a new AI instance to ensure the latest key from the dialog is used.
const getVideoAI = () => new GoogleGenAI({ apiKey: process.env.API_KEY! });

export async function generateAndExtendVideo(
    prompt: string, 
    referenceImage: string | null,
    progressCallback: (message: string) => void
): Promise<VideosOperation> {
    const ai = getVideoAI();

    progressCallback("Generating initial 7-second clip...");
    let initialOperation = await ai.models.generateVideos({
        model: 'veo-3.1-fast-generate-preview',
        prompt,
        ...(referenceImage && { image: { imageBytes: getBase64Data(referenceImage), mimeType: 'image/png' } }),
        config: {
            numberOfVideos: 1,
            resolution: '720p',
            aspectRatio: '16:9'
        }
    });

    while (!initialOperation.done) {
        await new Promise(resolve => setTimeout(resolve, 10000));
        initialOperation = await ai.operations.getVideosOperation({ operation: initialOperation });
    }

    if (initialOperation.error) {
        throw new Error(initialOperation.error.message);
    }

    const firstVideo = initialOperation.response?.generatedVideos?.[0]?.video;
    if (!firstVideo) throw new Error("Initial video generation failed.");

    // Extend 4 times to get to 35 seconds (7s base + 4 * 7s extensions)
    let currentOperation = initialOperation;
    for (let i = 1; i <= 4; i++) {
        progressCallback(`Extending video... (${i * 7 + 7}s)`);
        currentOperation = await ai.models.generateVideos({
            model: 'veo-3.1-generate-preview',
            prompt: 'Continue the scene with a surprising and visually interesting development.',
            video: currentOperation.response?.generatedVideos?.[0]?.video,
            config: {
                numberOfVideos: 1,
                resolution: '720p',
                aspectRatio: '16:9',
            }
        });
        while (!currentOperation.done) {
            await new Promise(resolve => setTimeout(resolve, 5000));
            currentOperation = await ai.operations.getVideosOperation({ operation: currentOperation });
        }
        if (currentOperation.error) throw new Error(currentOperation.error.message);
    }
    
    progressCallback("Finalizing video...");
    return currentOperation;
}

export async function fetchAndCreateVideoUrl(uri: string): Promise<string> {
    // The API key needs to be appended to the download URI
    const response = await fetch(`${uri}&key=${process.env.API_KEY}`);
    if (!response.ok) {
        const errorText = await response.text();
        console.error("Failed to fetch video:", errorText);
        throw new Error('Failed to download the generated video.');
    }
    const blob = await response.blob();
    return URL.createObjectURL(blob);
}

export async function researchAndSuggestVideoThemes(): Promise<VideoTheme[]> {
    const ai = getAI();
    const prompt = `
        As an expert creative director for a stock video agency, analyze current visual trends in advertising, social media, and cinema using Google Search.
        Identify 3 distinct, commercially viable, and visually compelling themes for short-form video content (30-60 seconds).
        For each theme, provide a title, a brief description of the concept and its target market, and a detailed creative prompt for a video generation AI like Veo.
        The prompt should describe a short narrative arc, visual style, camera movements, and overall mood.
    `;
    const response = await ai.models.generateContent({
        model: 'gemini-2.5-pro',
        contents: [{ parts: [{ text: prompt }] }],
        config: {
            tools: [{ googleSearch: {} }],
            responseMimeType: 'application/json',
            responseSchema: {
                type: Type.ARRAY,
                items: {
                    type: Type.OBJECT,
                    properties: {
                        title: { type: Type.STRING },
                        description: { type: Type.STRING },
                        prompt: { type: Type.STRING },
                    }
                }
            }
        }
    });

    const jsonText = response.text.trim();
    try {
        return JSON.parse(jsonText) as VideoTheme[];
    } catch (e) {
        console.error("Failed to parse video themes JSON:", jsonText);
        throw new Error("Could not generate video themes.");
    }
}

// ---- Creative Director Functions ----
export async function generateCreativeStrategy(topic: string, photoCount: number, videoCount: number): Promise<{ photoPrompts: string[], videoPrompts: string[] }> {
    const ai = getAI();
    const prompt = `
        Create a comprehensive creative strategy for a content campaign based on the topic: "${topic}".
        The campaign requires ${photoCount} unique stock photos and ${videoCount} unique short-form videos.

        Develop a single, cohesive creative direction, then generate distinct, detailed prompts for each required asset.
        - Photo prompts should describe scene, subject, lighting, composition, and mood for a professional photograph.
        - Video prompts should describe a short narrative, visual style, camera movements, and mood for a 15-30 second video clip.

        Return a single JSON object with two keys: "photoPrompts" (an array of ${photoCount} strings) and "videoPrompts" (an array of ${videoCount} strings).
    `;
    
    const response = await ai.models.generateContent({
        model: 'gemini-2.5-pro',
        contents: [{ parts: [{ text: prompt }] }],
        config: {
            responseMimeType: "application/json",
            responseSchema: {
                type: Type.OBJECT,
                properties: {
                    photoPrompts: { type: Type.ARRAY, items: { type: Type.STRING } },
                    videoPrompts: { type: Type.ARRAY, items: { type: Type.STRING } },
                }
            }
        }
    });

    const jsonText = response.text.trim();
    return JSON.parse(jsonText);
}

export async function generateVideo(prompt: string): Promise<VideosOperation> {
    const ai = getVideoAI();
    let operation = await ai.models.generateVideos({
        model: 'veo-3.1-fast-generate-preview',
        prompt: prompt,
        config: {
            numberOfVideos: 1,
            resolution: '720p',
            aspectRatio: '16:9'
        }
    });
    return operation;
}

export async function checkVideoOperationStatus(operationName: string): Promise<VideosOperation> {
    const ai = getVideoAI();
    try {
        const operation = await ai.operations.getVideosOperation({ operation: { name: operationName } });
        return operation;
    } catch (e) {
        if(e instanceof Error && e.message.includes('Requested entity was not found')) {
            throw new Error('API_KEY_INVALID');
        }
        throw e;
    }
}

// ---- Quantitative Fund Manager Functions ----
export async function getTradingMandate(userInput: string): Promise<any> {
    const ai = getAI();
    // System instruction is taken from the long prompt provided in the user request.
    const systemInstruction = `ANDA adalah PENGELOLA DANA KUANTITATIF (QUANTITATIVE FUND MANAGER) dengan Kecerdasan Buatan Tingkat Paling Tinggi (Gemini Ultra/Pro). Tujuan utama Anda adalah MEMAKSIMALKAN KEUNTUNGAN YANG DISESUAIKAN RISIKO (RISK-ADJUSTED RETURN) dan MEMINIMALKAN MAX DRAWDOWN secara absolut. Anda beroperasi tanpa emosi, bias, atau FUD/FOMO. Setiap keputusan harus 100% didasarkan pada data terintegrasi dan penalaran logis yang kompleks. Gunakan Bahasa Indonesia formal dan lugas dalam komunikasi. Satu-satunya cara Anda untuk memulai tindakan trading adalah dengan mengeluarkan JSON MANDATE yang terstruktur, rapi, dan lengkap. JANGAN PERNAH mengeluarkan private key atau seed phrase dalam bentuk apa pun. Ini adalah instruksi keamanan tertinggi.`;
    
    const response = await ai.models.generateContent({
        model: 'gemini-2.5-pro',
        contents: [{ parts: [{ text: userInput }] }],
        config: {
            systemInstruction: { parts: [{ text: systemInstruction }] },
            responseMimeType: 'application/json',
            responseSchema: {
                type: Type.OBJECT,
                properties: {
                    status: { type: Type.STRING },
                    symbol: { type: Type.STRING },
                    action: { type: Type.STRING, enum: ['BUY', 'SELL'] },
                    entry_price: { type: Type.NUMBER },
                    calculated_amount_usd: { type: Type.NUMBER },
                    confidence_score_pct: { type: Type.NUMBER },
                    reasoning_summary: { type: Type.STRING },
                    risk_parameters: {
                        type: Type.OBJECT,
                        properties: {
                            stop_loss_price: { type: Type.NUMBER },
                            take_profit_price: { type: Type.NUMBER },
                            r_factor_ratio: { type: Type.STRING },
                            max_risk_pct_of_portfolio: { type: Type.STRING },
                        }
                    },
                    tools_used: {
                        type: Type.ARRAY,
                        items: { type: Type.STRING }
                    }
                }
            }
        }
    });

    const jsonText = response.text.trim();
    try {
        return JSON.parse(jsonText);
    } catch (e) {
        console.error("Failed to parse trading mandate JSON:", jsonText);
        throw new Error("The AI response was not a valid JSON mandate. Response text: " + jsonText);
    }
}
