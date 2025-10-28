import React, { useState, useCallback } from 'react';
import { analyzeTrendAndGeneratePrompts, generateStockImage } from '../services/geminiService';
import { SpinnerIcon } from './icons/SpinnerIcon';
import { DownloadIcon } from './icons/DownloadIcon';

interface GeneratedImage {
    prompt: string;
    src: string;
}

const StockPhotoGenerator: React.FC = () => {
    const [topic, setTopic] = useState('');
    const [prompts, setPrompts] = useState<string[]>([]);
    const [images, setImages] = useState<GeneratedImage[]>([]);
    const [isLoadingPrompts, setIsLoadingPrompts] = useState(false);
    const [isLoadingImages, setIsLoadingImages] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleAnalyze = useCallback(async () => {
        if (!topic.trim()) {
            setError('Please enter a topic or trend.');
            return;
        }
        setIsLoadingPrompts(true);
        setError(null);
        setPrompts([]);
        setImages([]);

        try {
            const generatedPrompts = await analyzeTrendAndGeneratePrompts(topic);
            setPrompts(generatedPrompts);
        } catch (err) {
            const message = err instanceof Error ? err.message : 'An unknown error occurred.';
            setError(`Failed to generate prompts: ${message}`);
        } finally {
            setIsLoadingPrompts(false);
        }
    }, [topic]);

    const handleGenerateImages = useCallback(async () => {
        if (prompts.length === 0) return;

        setIsLoadingImages(true);
        setError(null);
        setImages([]);

        try {
            const imagePromises = prompts.map(prompt => 
                generateStockImage(prompt).then(src => ({ prompt, src }))
            );
            
            const settledImages = await Promise.allSettled(imagePromises);
            
            const successfulImages: GeneratedImage[] = [];
            settledImages.forEach(result => {
                if (result.status === 'fulfilled') {
                    successfulImages.push(result.value);
                } else {
                    console.error('An image generation failed:', result.reason);
                }
            });
            setImages(successfulImages);

            if(successfulImages.length < prompts.length) {
                setError('Some images could not be generated. Please try again.');
            }

        } catch (err) {
            const message = err instanceof Error ? err.message : 'An unknown error occurred.';
            setError(`Failed to generate images: ${message}`);
        } finally {
            setIsLoadingImages(false);
        }
    }, [prompts]);

    const handleDownload = (src: string, prompt: string) => {
        const link = document.createElement('a');
        link.href = src;
        const shortPrompt = prompt.split(' ').slice(0, 5).join('-').replace(/[^a-zA-Z0-9-]/g, '');
        link.download = `stock-photo-${shortPrompt}.png`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const isBusy = isLoadingPrompts || isLoadingImages;

    return (
        <div className="space-y-8">
            {/* Step 1: Input Topic */}
            <div className="bg-slate-800/50 p-6 rounded-2xl shadow-lg">
                <h2 className="text-2xl font-bold text-cyan-400 mb-4">1. Describe a Visual Trend</h2>
                <textarea
                    value={topic}
                    onChange={(e) => setTopic(e.target.value)}
                    placeholder="e.g., 'Minimalist nature scenes with pastel colors', 'People working remotely in cozy cafes', 'Abstract 3D gradient backgrounds'"
                    className="w-full h-24 p-3 bg-slate-700/50 border border-slate-600 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 transition-colors"
                    disabled={isBusy}
                />
                <button
                    onClick={handleAnalyze}
                    disabled={isBusy || !topic.trim()}
                    className="mt-4 w-full max-w-xs bg-cyan-500 hover:bg-cyan-400 disabled:bg-slate-600 disabled:cursor-not-allowed text-white font-bold py-3 px-6 rounded-full text-lg shadow-lg shadow-cyan-500/20 transition-all duration-300 flex items-center justify-center mx-auto"
                >
                    {isLoadingPrompts ? <SpinnerIcon /> : 'Analyze & Create Prompts'}
                </button>
            </div>

            {error && (
                 <div className="bg-red-900/20 p-4 rounded-lg text-center text-red-400">{error}</div>
            )}

            {/* Step 2: Review Prompts */}
            {(isLoadingPrompts || prompts.length > 0) && (
                 <div className="bg-slate-800/50 p-6 rounded-2xl shadow-lg">
                    <h2 className="text-2xl font-bold text-cyan-400 mb-4">2. Review Generated Prompts</h2>
                    {isLoadingPrompts ? (
                         <div className="flex justify-center items-center py-8"><SpinnerIcon /></div>
                    ) : (
                        <>
                            <ul className="space-y-3">
                                {prompts.map((p, i) => (
                                    <li key={i} className="p-3 bg-slate-700/50 border border-slate-700 rounded-md text-slate-300 text-sm">
                                        {p}
                                    </li>
                                ))}
                            </ul>
                            <button
                                onClick={handleGenerateImages}
                                disabled={isBusy}
                                className="mt-6 w-full max-w-xs bg-green-600 hover:bg-green-500 disabled:bg-slate-600 disabled:cursor-not-allowed text-white font-bold py-3 px-6 rounded-full text-lg shadow-lg shadow-green-500/20 transition-all duration-300 flex items-center justify-center mx-auto"
                            >
                                {isLoadingImages ? <SpinnerIcon /> : '✨ Generate Images'}
                            </button>
                        </>
                    )}
                 </div>
            )}
            
            {/* Step 3: View Results */}
            {(isLoadingImages || images.length > 0) && (
                <div className="bg-slate-800/50 p-6 rounded-2xl shadow-lg">
                    <h2 className="text-2xl font-bold text-cyan-400 mb-4">3. Generated Stock Photos</h2>
                    {isLoadingImages ? (
                         <div className="flex justify-center items-center py-8"><SpinnerIcon /></div>
                    ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                            {images.map((img, i) => (
                                <div key={i} className="group relative aspect-square bg-slate-900 rounded-lg overflow-hidden shadow-md">
                                    <img src={img.src} alt={img.prompt} className="w-full h-full object-cover"/>
                                    <div className="absolute inset-0 bg-black/70 opacity-0 group-hover:opacity-100 transition-opacity p-3 flex flex-col justify-end">
                                        <p className="text-xs text-slate-300 mb-2 overflow-hidden max-h-20">{img.prompt}</p>
                                        <button 
                                            onClick={() => handleDownload(img.src, img.prompt)}
                                            className="self-end p-2 rounded-full bg-slate-700/80 hover:bg-green-600 text-white transition-colors" title="Download Image">
                                            <DownloadIcon />
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default StockPhotoGenerator;