import React, { useState } from 'react';
import { 
    generateStockImage, 
    generateCreativePrompt, 
} from '../services/geminiService';
import type { StockImageResult } from '../services/geminiService';
import { SpinnerIcon } from './icons/SpinnerIcon';
import { GenerateIcon } from './icons/GenerateIcon';

const StockPhotoGenerator: React.FC = () => {
    return (
        <div className="space-y-8">
            <div className="text-center max-w-3xl mx-auto">
                <h1 className="text-3xl font-bold text-white mb-2">AI Art Director</h1>
                <p className="text-lg text-slate-400">Let the AI generate a complete art direction for a single stunning image. Just select an orientation and let the AI do the rest.</p>
            </div>
            
            <SingleGenerator />
        </div>
    );
};

const SingleGenerator: React.FC = () => {
    const [aspectRatio, setAspectRatio] = useState<'16:9' | '9:16' | '1:1'>('16:9');
    const [result, setResult] = useState<StockImageResult | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [loadingMessage, setLoadingMessage] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [aiPrompt, setAiPrompt] = useState('');

    const handleGenerate = async () => {
        setIsLoading(true);
        setError(null);
        setResult(null);
        setAiPrompt('');
        try {
            setLoadingMessage("AI is brainstorming a creative concept...");
            const { prompt } = await generateCreativePrompt('photo');
            setAiPrompt(prompt);
            
            setLoadingMessage("Generating image from AI's direction...");
            const imageResult = await generateStockImage(prompt, aspectRatio, true);
            setResult(imageResult);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'An unknown error occurred.');
        } finally {
            setIsLoading(false);
            setLoadingMessage('');
        }
    };
    
    const handleDownload = () => {
        if (result?.src) {
          const link = document.createElement('a');
          link.href = result.src;
          link.download = `ai-art-director-result.png`;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
        }
    };

    return (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <div className="bg-slate-900/50 p-6 rounded-2xl shadow-lg border border-slate-800 flex flex-col justify-center gap-6">
                <div>
                    <label htmlFor="aspect-ratio" className="block text-slate-300 font-semibold mb-2 text-center text-lg">1. Select Orientation</label>
                    <select id="aspect-ratio" value={aspectRatio} onChange={e => setAspectRatio(e.target.value as any)} className="w-full bg-slate-800 border border-slate-700 p-3 rounded-lg focus:ring-2 focus:ring-cyan-500 transition-colors text-lg">
                        <option value="16:9">16:9 (Landscape)</option>
                        <option value="9:16">9:16 (Portrait)</option>
                        <option value="1:1">1:1 (Square)</option>
                    </select>
                </div>
                <button onClick={handleGenerate} disabled={isLoading} className="w-full flex items-center justify-center gap-2 bg-cyan-600 hover:bg-cyan-500 disabled:bg-slate-700 disabled:text-slate-400 text-white font-bold py-4 px-6 rounded-full text-xl transition-colors">
                    {isLoading ? <SpinnerIcon /> : <><GenerateIcon /> <span>2. Generate Image</span></>}
                </button>
            </div>
            <div className="bg-slate-900/50 p-6 rounded-2xl shadow-lg border border-slate-800 flex flex-col">
                <h2 className="text-xl font-bold text-cyan-400 mb-4">Result</h2>
                <div className="flex-grow flex items-center justify-center">
                    {isLoading && (
                        <div className="text-center">
                            <SpinnerIcon />
                            <p className="text-slate-300 mt-4">{loadingMessage}</p>
                        </div>
                    )}
                    {error && <p className="text-red-400 text-center">{error}</p>}
                    {result ? (
                        <div className="space-y-4 w-full">
                            <img src={result.src} alt={aiPrompt} className="rounded-lg w-full shadow-lg" />
                            <div className="p-4 bg-slate-800/70 rounded-lg border border-slate-700">
                                <h4 className="font-semibold text-cyan-400 mb-2">AI Art Direction:</h4>
                                <p className="text-sm text-slate-300 italic">"{aiPrompt}"</p>
                            </div>
                            {result.metadata && (
                                 <div className="p-4 bg-slate-800/70 rounded-lg border border-slate-700 text-sm">
                                     <p><strong className="text-slate-300">Title:</strong> {result.metadata.title}</p>
                                     <p><strong className="text-slate-300">Description:</strong> {result.metadata.description}</p>
                                     <p><strong className="text-slate-300">Tags:</strong> {result.metadata.tags.join(', ')}</p>
                                 </div>
                            )}
                            <button onClick={handleDownload} className="w-full bg-green-600 hover:bg-green-500 text-white font-bold py-3 px-6 rounded-full transition-colors">
                                Download Image
                            </button>
                        </div>
                    ) : !isLoading && !error && <p className="text-slate-500 text-center py-8">Your generated image will appear here.</p>}
                </div>
            </div>
        </div>
    );
};


export default StockPhotoGenerator;
