import React, { useState } from 'react';
import { generateStockImage, generateCreativePrompt } from '../services/geminiService';
import type { BatchImageResult } from '../types';
import { SpinnerIcon } from './icons/SpinnerIcon';
import { PhotoIcon } from './icons/PhotoIcon';
import { createPhotoShootPackageZip } from '../utils/zipUtils';
import { PackageIcon } from './icons/PackageIcon';

type Mode = 'single' | 'batch';
const BATCH_SIZE = 6;

const StockPhotoGenerator: React.FC = () => {
    const [mode, setMode] = useState<Mode>('single');
    const [prompt, setPrompt] = useState('');
    const [aspectRatio, setAspectRatio] = useState<'1:1' | '16:9' | '9:16'>('16:9');
    const [highQuality, setHighQuality] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Single mode state
    const [singleResult, setSingleResult] = useState<string | null>(null);

    // Batch mode state
    const [batchResults, setBatchResults] = useState<BatchImageResult[]>([]);
    const [isBatchProcessing, setIsBatchProcessing] = useState(false);

    const handleGenerateSingle = async () => {
        if (!prompt) {
            setError('Please enter a prompt.');
            return;
        }
        setIsLoading(true);
        setError(null);
        setSingleResult(null);
        try {
            const { src } = await generateStockImage(prompt, aspectRatio, highQuality);
            setSingleResult(src);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'An unknown error occurred.');
        } finally {
            setIsLoading(false);
        }
    };

    const handleGenerateBatch = async () => {
        if (!prompt) {
            setError('Please enter a prompt for the photo shoot theme.');
            return;
        }
        setIsLoading(true);
        setIsBatchProcessing(true);
        setError(null);
        setBatchResults(Array.from({ length: BATCH_SIZE }, (_, i) => ({
            id: `batch-${i}`,
            src: null,
            status: 'pending'
        })));
        
        try {
            // Generate BATCH_SIZE variations
            for (let i = 0; i < BATCH_SIZE; i++) {
                setBatchResults(prev => prev.map((r, idx) => idx === i ? { ...r, status: 'generating' } : r));
                try {
                    // Generate a creative variation of the main prompt
                    const { prompt: imagePrompt } = await generateCreativePrompt('photo', prompt);
                    const { src } = await generateStockImage(imagePrompt, aspectRatio, highQuality);
                    setBatchResults(prev => prev.map((r, idx) => idx === i ? { ...r, status: 'complete', src } : r));
                } catch (batchErr) {
                     setBatchResults(prev => prev.map((r, idx) => idx === i ? { ...r, status: 'failed', error: batchErr instanceof Error ? batchErr.message : 'Failed' } : r));
                }
            }
        } catch (err) {
             setError(err instanceof Error ? err.message : 'An unknown error occurred during batch generation.');
        } finally {
            setIsLoading(false);
            setIsBatchProcessing(false);
        }
    };

    const handleGenerate = () => {
        if (mode === 'single') {
            handleGenerateSingle();
        } else {
            handleGenerateBatch();
        }
    };

    const handleDownloadBatch = () => {
        createPhotoShootPackageZip(batchResults);
    };

    const isGenerateDisabled = isLoading || isBatchProcessing || !prompt;

    return (
        <div className="space-y-8">
            <div className="text-center max-w-3xl mx-auto">
                <h1 className="text-3xl font-bold text-white mb-2">AI Art Director</h1>
                <p className="text-lg text-slate-400">Generate high-quality, professional stock photos with precise art direction. Create a single image or an entire photo shoot.</p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <div className="bg-slate-900/50 p-6 rounded-2xl shadow-lg flex flex-col gap-6 border border-slate-800">
                    {/* Mode Tabs */}
                    <div className="flex bg-slate-800 p-1 rounded-full">
                        <button onClick={() => setMode('single')} className={`flex-1 p-2 rounded-full font-semibold transition-colors ${mode === 'single' ? 'bg-cyan-600 text-white' : 'hover:bg-slate-700'}`}>Single Image</button>
                        <button onClick={() => setMode('batch')} className={`flex-1 p-2 rounded-full font-semibold transition-colors ${mode === 'batch' ? 'bg-cyan-600 text-white' : 'hover:bg-slate-700'}`}>Photo Shoot (x{BATCH_SIZE})</button>
                    </div>

                    <div>
                        <label htmlFor="prompt" className="block text-slate-300 font-semibold mb-2">{mode === 'single' ? 'Describe your desired image' : 'Describe the theme of your photo shoot'}</label>
                        <textarea id="prompt" value={prompt} onChange={e => setPrompt(e.target.value)} rows={4} className="w-full bg-slate-800 border border-slate-700 p-3 rounded-lg focus:ring-2 focus:ring-cyan-500 transition-colors" placeholder={mode === 'single' ? 'e.g., A minimalist workspace with a laptop, a cup of coffee, and a plant, top-down view.' : 'e.g., Team collaboration in a modern office.'} />
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label htmlFor="aspect-ratio-stock" className="block text-slate-300 font-semibold mb-2">Aspect Ratio</label>
                            <select id="aspect-ratio-stock" value={aspectRatio} onChange={e => setAspectRatio(e.target.value as any)} className="w-full bg-slate-800 border border-slate-700 p-3 rounded-lg focus:ring-2 focus:ring-cyan-500 transition-colors">
                                <option value="16:9">16:9 (Landscape)</option>
                                <option value="9:16">9:16 (Portrait)</option>
                                <option value="1:1">1:1 (Square)</option>
                            </select>
                        </div>
                        <div>
                            <label htmlFor="quality" className="block text-slate-300 font-semibold mb-2">Quality</label>
                            <select id="quality" value={highQuality.toString()} onChange={e => setHighQuality(e.target.value === 'true')} className="w-full bg-slate-800 border border-slate-700 p-3 rounded-lg focus:ring-2 focus:ring-cyan-500 transition-colors">
                                <option value="false">Standard</option>
                                <option value="true">High (Slower)</option>
                            </select>
                        </div>
                    </div>

                    <button onClick={handleGenerate} disabled={isGenerateDisabled} className="w-full bg-cyan-600 hover:bg-cyan-500 disabled:bg-slate-700 disabled:text-slate-400 text-white font-bold py-3 px-6 rounded-full text-lg transition-colors">
                        {isLoading ? 'Generating...' : 'Generate'}
                    </button>
                </div>

                <div className="bg-slate-900/50 p-6 rounded-2xl shadow-lg flex flex-col items-center justify-center min-h-[400px] lg:min-h-full border border-slate-800">
                    {isLoading && mode === 'single' && (
                         <div className="flex flex-col items-center justify-center text-center">
                            <SpinnerIcon />
                            <p className="text-slate-300 mt-4 text-lg">Generating your image...</p>
                        </div>
                    )}
                    {error && (
                        <div className="text-center bg-red-900/20 p-4 rounded-lg border border-red-500/30">
                            <p className="text-red-300 font-semibold">An Error Occurred</p>
                            <p className="text-slate-400 mt-2 text-sm">{error}</p>
                        </div>
                    )}
                    {!isLoading && !error && mode === 'single' && (
                        singleResult ? (
                            <img src={singleResult} alt={prompt} className="w-full h-auto max-h-[60vh] object-contain rounded-lg" />
                        ) : (
                            <div className="text-center text-slate-600">
                                <PhotoIcon />
                                <p className="mt-4 text-slate-400">Your generated image will appear here.</p>
                            </div>
                        )
                    )}

                    {mode === 'batch' && (
                       <div className="w-full">
                           {batchResults.length > 0 ? (
                               <div className="space-y-4">
                                   <div className="grid grid-cols-3 gap-2">
                                       {batchResults.map(res => (
                                           <div key={res.id} className="aspect-video bg-slate-800 rounded-md flex items-center justify-center">
                                               {res.status === 'generating' && <SpinnerIcon />}
                                               {res.status === 'complete' && res.src && <img src={res.src} className="w-full h-full object-cover rounded-md" />}
                                               {res.status === 'failed' && <span className="text-red-400 text-xs p-1 text-center">Failed</span>}
                                           </div>
                                       ))}
                                   </div>
                                   {!isBatchProcessing && batchResults.some(r => r.status === 'complete') && (
                                       <button onClick={handleDownloadBatch} className="w-full mt-4 bg-green-600 hover:bg-green-500 text-white font-bold py-2 px-4 rounded-full flex items-center justify-center gap-2">
                                           <PackageIcon /> Download .zip
                                       </button>
                                   )}
                               </div>
                           ) : (
                               <div className="text-center text-slate-600">
                                    <PhotoIcon />
                                    <p className="mt-4 text-slate-400">Your generated photo shoot will appear here.</p>
                                </div>
                           )}
                       </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default StockPhotoGenerator;
