import React, { useState, useCallback, useEffect } from 'react';
import { SpinnerIcon } from './icons/SpinnerIcon';
import type { TrendAnalysis, CampaignPrompts, AssetMetadata } from '../services/geminiService';
import { 
    analyzeTrend, 
    generateCampaignPrompts, 
    generateStockImage,
    generateVideo,
    checkVideoOperationStatus,
    fetchAndCreateVideoUrl,
    generateMetadataForAsset
} from '../services/geminiService';
import { GenerateVideosOperationResponse } from '@google/genai';

type Step = 'idle' | 'analyzing' | 'prompting' | 'generating' | 'complete';
type AssetType = 'photo' | 'video';
interface Asset {
    id: string;
    type: AssetType;
    prompt: string;
    status: 'pending' | 'generating' | 'polling' | 'complete' | 'failed';
    src?: string;
    metadata?: AssetMetadata;
}

const CreativeDirector: React.FC = () => {
    const [step, setStep] = useState<Step>('idle');
    const [trendText, setTrendText] = useState('');
    const [photoCount, setPhotoCount] = useState(4);
    const [videoCount, setVideoCount] = useState(1);
    const [analysis, setAnalysis] = useState<TrendAnalysis | null>(null);
    const [prompts, setPrompts] = useState<CampaignPrompts | null>(null);
    const [assets, setAssets] = useState<Asset[]>([]);
    const [error, setError] = useState<string | null>(null);

    const handleAnalyze = async () => {
        if (!trendText.trim()) return;
        setStep('analyzing');
        setError(null);
        setAnalysis(null);
        setPrompts(null);
        setAssets([]);
        try {
            const result = await analyzeTrend(trendText);
            setAnalysis(result);
            setStep('prompting'); // Auto-advance to next step
        } catch (e) {
            setError(e instanceof Error ? e.message : 'Analysis failed');
            setStep('idle');
        }
    };

    const handleGeneratePrompts = useCallback(async () => {
        if (!analysis) return;
        setStep('prompting');
        setError(null);
        try {
            const result = await generateCampaignPrompts(analysis, photoCount, videoCount);
            setPrompts(result);
            
            // Initialize assets for generation dashboard
            const photoAssets: Asset[] = result.photoPrompts.map((p, i) => ({ id: `p-${i}`, type: 'photo', prompt: p, status: 'pending' }));
            const videoAssets: Asset[] = result.videoPrompts.map((p, i) => ({ id: `v-${i}`, type: 'video', prompt: p, status: 'pending' }));
            setAssets([...photoAssets, ...videoAssets]);
            
            setStep('idle'); // Ready to start generation
        } catch (e) {
            setError(e instanceof Error ? e.message : 'Prompt generation failed');
            setStep('idle');
        }
    }, [analysis, photoCount, videoCount]);

    // Fix: Import and use `useEffect` directly.
    useEffect(() => {
        if (step === 'prompting' && analysis) {
            handleGeneratePrompts();
        }
    }, [step, analysis, handleGeneratePrompts]);

    const updateAssetState = (id: string, updates: Partial<Asset>) => {
        setAssets(prev => prev.map(a => a.id === id ? { ...a, ...updates } : a));
    };

    const processVideoGeneration = useCallback(async (asset: Asset) => {
        try {
            const initialOp = await generateVideo(asset.prompt);
            updateAssetState(asset.id, { status: 'polling' });

            const poll = async (opName: string): Promise<GenerateVideosOperationResponse> => {
                const currentOp = await checkVideoOperationStatus(opName);
                if (currentOp.done) {
                    return currentOp;
                }
                await new Promise(resolve => setTimeout(resolve, 10000));
                return poll(opName);
            };

            const finalOp = await poll(initialOp.name!);
            
            if (finalOp.error) throw new Error(finalOp.error.message);
            
            const uri = finalOp.response?.generatedVideos?.[0]?.video?.uri;
            if (!uri) throw new Error('No video URI returned');

            const url = await fetchAndCreateVideoUrl(uri);
            updateAssetState(asset.id, { src: url, status: 'complete' });
        } catch (e) {
            console.error(`Video generation failed for ${asset.id}:`, e);
            updateAssetState(asset.id, { status: 'failed' });
        }
    }, []);

    const processPhotoGeneration = useCallback(async (asset: Asset) => {
        try {
            const src = await generateStockImage(asset.prompt);
            updateAssetState(asset.id, { src, status: 'complete' });
        } catch (e) {
            console.error(`Photo generation failed for ${asset.id}:`, e);
            updateAssetState(asset.id, { status: 'failed' });
        }
    }, []);

    const handleStartGeneration = async () => {
        if (!prompts || assets.length === 0) return;
        
        await window.aistudio.openSelectKey();
        const hasKey = await window.aistudio.hasSelectedApiKey();
        if (!hasKey) {
            setError("An API key is required to generate videos.");
            return;
        }

        setStep('generating');
        
        assets.forEach(asset => {
            updateAssetState(asset.id, { status: 'generating' });
            if (asset.type === 'photo') {
                processPhotoGeneration(asset);
            } else if (asset.type === 'video') {
                processVideoGeneration(asset);
            }
        });
    };

    // Effect to check if all assets are done
    useEffect(() => {
        if (step === 'generating' && assets.length > 0 && assets.every(a => a.status === 'complete' || a.status === 'failed')) {
            setStep('complete');
            // Start metadata generation
            assets.filter(a => a.status === 'complete').forEach(async asset => {
                if (asset.type === 'photo' && asset.src) { // Currently metadata only for photos
                    const metadata = await generateMetadataForAsset(asset.src);
                    updateAssetState(asset.id, { metadata });
                }
            });
        }
    }, [assets, step]);

    const isBusy = step === 'analyzing' || step === 'prompting' || step === 'generating';

    return (
        <div className="space-y-8">
            {/* Step 1: Trend Input */}
            <div className="bg-slate-800/50 p-6 rounded-2xl shadow-lg">
                <h2 className="text-2xl font-bold text-cyan-400 mb-4">1. Trend Analysis</h2>
                <p className="text-slate-400 mb-3 text-sm">Enter a topic, theme, or paste content from a trend report URL.</p>
                <textarea
                    value={trendText}
                    onChange={(e) => setTrendText(e.target.value)}
                    placeholder="e.g., 'Cottagecore aesthetic for summer 2024 fashion' or paste article text here..."
                    className="w-full h-32 p-3 bg-slate-700/50 border border-slate-600 rounded-lg focus:ring-2 focus:ring-cyan-500"
                    disabled={isBusy}
                />
                <div className="mt-4 flex flex-col sm:flex-row items-center justify-between gap-4">
                     <div className="flex items-center gap-4">
                        <label className="text-slate-300">Photos:</label>
                        <input type="number" value={photoCount} onChange={e => setPhotoCount(parseInt(e.target.value, 10))} className="w-20 bg-slate-700 p-2 rounded-md" disabled={isBusy} />
                        <label className="text-slate-300">Videos:</label>
                        <input type="number" value={videoCount} onChange={e => setVideoCount(parseInt(e.target.value, 10))} className="w-20 bg-slate-700 p-2 rounded-md" disabled={isBusy} />
                    </div>
                    <button onClick={handleAnalyze} disabled={isBusy || !trendText.trim()} className="w-full sm:w-auto bg-cyan-500 hover:bg-cyan-400 disabled:bg-slate-600 text-white font-bold py-3 px-6 rounded-full text-lg flex items-center justify-center gap-2">
                        {step === 'analyzing' || step === 'prompting' ? <SpinnerIcon /> : 'Start Analysis & Prompting'}
                    </button>
                </div>
            </div>
            
            {error && <div className="bg-red-900/20 p-4 rounded-lg text-center text-red-400">{error}</div>}

            {/* Step 2 & 3: Generation Dashboard */}
            {assets.length > 0 && (
                <div className="bg-slate-800/50 p-6 rounded-2xl shadow-lg">
                    <div className="flex justify-between items-center mb-4">
                        <h2 className="text-2xl font-bold text-cyan-400">2. Generation Dashboard</h2>
                        {step !== 'generating' && step !== 'complete' && (
                             <button onClick={handleStartGeneration} disabled={isBusy} className="bg-green-600 hover:bg-green-500 disabled:bg-slate-600 text-white font-bold py-3 px-6 rounded-full text-lg flex items-center justify-center gap-2">
                                ✨ Generate All Assets
                            </button>
                        )}
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                        {assets.map(asset => (
                           <div key={asset.id} className="aspect-video bg-slate-900 rounded-lg overflow-hidden flex flex-col justify-between p-3 relative">
                                <div className="absolute inset-0 flex items-center justify-center">
                                    {asset.status === 'generating' || asset.status === 'polling' ? <SpinnerIcon /> : null}
                                    {asset.status === 'complete' && asset.type === 'photo' && <img src={asset.src} className="w-full h-full object-cover" alt={asset.prompt} />}
                                    {asset.status === 'complete' && asset.type === 'video' && <video src={asset.src} className="w-full h-full object-cover" controls loop />}
                                    {asset.status === 'failed' && <span className="text-red-400">Failed</span>}
                                </div>
                                <div className="z-10 bg-black/50 p-1 rounded-md">
                                     <span className={`text-xs px-2 py-1 rounded-full ${asset.type === 'photo' ? 'bg-sky-500' : 'bg-purple-500'} text-white`}>{asset.type}</span>
                                </div>
                               {step === 'complete' && asset.metadata && (
                                   <div className="z-10 bg-black/60 p-2 rounded-md backdrop-blur-sm text-xs text-slate-300">
                                       <p className="font-bold truncate">{asset.metadata.title}</p>
                                       <p className="truncate text-slate-400">{asset.metadata.tags.join(', ')}</p>
                                   </div>
                               )}
                           </div>
                        ))}
                    </div>
                </div>
            )}
             {/* Step 4: Download Package */}
            {step === 'complete' && (
                 <div className="bg-slate-800/50 p-6 rounded-2xl shadow-lg text-center">
                      <h2 className="text-2xl font-bold text-cyan-400 mb-4">3. Generation Complete!</h2>
                      <p className="text-slate-300 mb-6">Your content package is ready. This would include all assets and a metadata.csv file.</p>
                       <button className="bg-teal-500 hover:bg-teal-400 text-white font-bold py-4 px-8 rounded-full text-xl shadow-lg shadow-teal-500/20">
                        Download Content Package (.zip)
                      </button>
                 </div>
            )}
        </div>
    );
};

export default CreativeDirector;