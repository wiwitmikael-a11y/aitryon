
import React, { useReducer, useCallback, useEffect } from 'react';
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
import { createContentPackageZip } from '../utils/zipUtils';

// --- State, Reducer, and Types ---

type Step = 'idle' | 'analyzing' | 'prompting' | 'generating' | 'generating_metadata' | 'complete';
type AssetType = 'photo' | 'video';
interface Asset {
    id: string;
    type: AssetType;
    prompt: string;
    status: 'pending' | 'generating' | 'polling' | 'complete' | 'failed';
    src?: string;
    metadata?: AssetMetadata;
}

interface State {
    step: Step;
    trendText: string;
    photoCount: number;
    videoCount: number;
    analysis: TrendAnalysis | null;
    prompts: CampaignPrompts | null;
    assets: Asset[];
    error: string | null;
}

const initialState: State = {
    step: 'idle',
    trendText: '',
    photoCount: 4,
    videoCount: 1,
    analysis: null,
    prompts: null,
    assets: [],
    error: null,
};

type Action =
  | { type: 'SET_TREND_TEXT'; payload: string }
  | { type: 'SET_PHOTO_COUNT'; payload: number }
  | { type: 'SET_VIDEO_COUNT'; payload: number }
  | { type: 'START_ANALYSIS' }
  | { type: 'ANALYSIS_SUCCESS'; payload: TrendAnalysis }
  | { type: 'ANALYSIS_FAILURE'; payload: string }
  | { type: 'START_PROMPTING' }
  | { type: 'PROMPTING_SUCCESS'; payload: CampaignPrompts }
  | { type: 'START_GENERATION'; payload: Asset[] }
  | { type: 'UPDATE_ASSET'; payload: { id: string; updates: Partial<Asset> } }
  | { type: 'GENERATION_COMPLETE' }
  | { type: 'METADATA_GENERATION_COMPLETE' }
  | { type: 'RESET' };

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'SET_TREND_TEXT': return { ...state, trendText: action.payload };
    case 'SET_PHOTO_COUNT': return { ...state, photoCount: action.payload };
    case 'SET_VIDEO_COUNT': return { ...state, videoCount: action.payload };
    case 'START_ANALYSIS': return { ...state, step: 'analyzing', error: null, analysis: null, prompts: null, assets: [] };
    case 'ANALYSIS_SUCCESS': return { ...state, step: 'prompting', analysis: action.payload };
    case 'ANALYSIS_FAILURE': return { ...state, step: 'idle', error: action.payload };
    case 'START_PROMPTING': return { ...state, step: 'prompting', error: null };
    case 'PROMPTING_SUCCESS': return { ...state, step: 'idle', prompts: action.payload };
    case 'START_GENERATION': return { ...state, step: 'generating', assets: action.payload };
    case 'UPDATE_ASSET': return { ...state, assets: state.assets.map(a => a.id === action.payload.id ? { ...a, ...action.payload.updates } : a) };
    case 'GENERATION_COMPLETE': return { ...state, step: 'generating_metadata' };
    case 'METADATA_GENERATION_COMPLETE': return { ...state, step: 'complete' };
    case 'RESET': return initialState;
    default: return state;
  }
}

// --- Component ---

const CreativeDirector: React.FC = () => {
    const [state, dispatch] = useReducer(reducer, initialState);
    const { step, trendText, photoCount, videoCount, analysis, prompts, assets, error } = state;

    const handleAnalyze = async () => {
        if (!trendText.trim()) return;
        dispatch({ type: 'START_ANALYSIS' });
        try {
            const result = await analyzeTrend(trendText);
            dispatch({ type: 'ANALYSIS_SUCCESS', payload: result });
        } catch (e) {
            dispatch({ type: 'ANALYSIS_FAILURE', payload: e instanceof Error ? e.message : 'Analysis failed' });
        }
    };

    const handleGeneratePrompts = useCallback(async () => {
        if (!analysis) return;
        dispatch({ type: 'START_PROMPTING' });
        try {
            const result = await generateCampaignPrompts(analysis, photoCount, videoCount);
            dispatch({ type: 'PROMPTING_SUCCESS', payload: result });
            const photoAssets: Asset[] = result.photoPrompts.map((p, i) => ({ id: `p-${i}`, type: 'photo', prompt: p, status: 'pending' }));
            const videoAssets: Asset[] = result.videoPrompts.map((p, i) => ({ id: `v-${i}`, type: 'video', prompt: p, status: 'pending' }));
            dispatch({ type: 'START_GENERATION', payload: [...photoAssets, ...videoAssets]});
            dispatch({ type: 'PROMPTING_SUCCESS', payload: result });
        } catch (e) {
            dispatch({ type: 'ANALYSIS_FAILURE', payload: e instanceof Error ? e.message : 'Prompt generation failed' });
        }
    }, [analysis, photoCount, videoCount]);

    useEffect(() => {
        if (step === 'prompting' && analysis) {
            handleGeneratePrompts();
        }
    }, [step, analysis, handleGeneratePrompts]);

    const updateAssetState = (id: string, updates: Partial<Asset>) => {
        dispatch({ type: 'UPDATE_ASSET', payload: { id, updates } });
    };
    
    const processVideoGeneration = useCallback(async (asset: Asset) => {
        try {
            const initialOp = await generateVideo(asset.prompt);
            updateAssetState(asset.id, { status: 'polling' });
            const poll = async (opName: string): Promise<GenerateVideosOperationResponse> => {
                const currentOp = await checkVideoOperationStatus(opName);
                if (currentOp.done) return currentOp;
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
        if (!prompts) return;
        const assetsToGenerate = prompts.photoPrompts.map((p, i) => ({ id: `p-${i}`, type: 'photo' as AssetType, prompt: p, status: 'pending' }))
            .concat(prompts.videoPrompts.map((p, i) => ({ id: `v-${i}`, type: 'video' as AssetType, prompt: p, status: 'pending' })));

        if(videoCount > 0) {
            await window.aistudio.openSelectKey();
            const hasKey = await window.aistudio.hasSelectedApiKey();
            if (!hasKey) {
                dispatch({type: 'ANALYSIS_FAILURE', payload: "An API key is required to generate videos."});
                return;
            }
        }

        dispatch({ type: 'START_GENERATION', payload: assetsToGenerate });
        
        assetsToGenerate.forEach(asset => {
            updateAssetState(asset.id, { status: 'generating' });
            if (asset.type === 'photo') {
                processPhotoGeneration(asset);
            } else if (asset.type === 'video') {
                processVideoGeneration(asset);
            }
        });
    };

    useEffect(() => {
        if (step === 'generating' && assets.length > 0 && assets.every(a => a.status === 'complete' || a.status === 'failed')) {
            dispatch({ type: 'GENERATION_COMPLETE' });
        }
    }, [assets, step]);

    useEffect(() => {
        if (step === 'generating_metadata') {
             const completedAssets = assets.filter(a => a.status === 'complete' && a.type === 'photo');
             if (completedAssets.length === 0) {
                dispatch({ type: 'METADATA_GENERATION_COMPLETE' });
                return;
             }
             
             let metadataCount = 0;
             completedAssets.forEach(async asset => {
                if (asset.src) {
                    try {
                        const metadata = await generateMetadataForAsset(asset.src);
                        updateAssetState(asset.id, { metadata });
                    } catch (e) {
                        console.error(`Metadata generation failed for ${asset.id}`, e);
                        // Silently fail on metadata
                    } finally {
                        metadataCount++;
                        if (metadataCount === completedAssets.length) {
                             dispatch({ type: 'METADATA_GENERATION_COMPLETE' });
                        }
                    }
                }
            });
        }
    }, [step, assets]);

    const handleDownloadPackage = () => {
        createContentPackageZip(assets);
    };

    const isBusy = step === 'analyzing' || step === 'prompting' || step === 'generating' || step === 'generating_metadata';

    return (
        <div className="space-y-8">
            <div className="bg-slate-800/50 p-6 rounded-2xl shadow-lg">
                <h2 className="text-2xl font-bold text-cyan-400 mb-4">1. Trend Analysis</h2>
                <p className="text-slate-400 mb-3 text-sm">Enter a topic, theme, or paste content from a trend report URL.</p>
                <textarea
                    value={trendText}
                    onChange={(e) => dispatch({ type: 'SET_TREND_TEXT', payload: e.target.value })}
                    placeholder="e.g., 'Cottagecore aesthetic for summer 2024 fashion' or paste article text here..."
                    className="w-full h-32 p-3 bg-slate-700/50 border border-slate-600 rounded-lg focus:ring-2 focus:ring-cyan-500"
                    disabled={isBusy}
                />
                <div className="mt-4 flex flex-col sm:flex-row items-center justify-between gap-4">
                     <div className="flex items-center gap-4">
                        <label className="text-slate-300">Photos:</label>
                        <input type="number" value={photoCount} min="0" onChange={e => dispatch({type: 'SET_PHOTO_COUNT', payload: parseInt(e.target.value, 10)})} className="w-20 bg-slate-700 p-2 rounded-md" disabled={isBusy} />
                        <label className="text-slate-300">Videos:</label>
                        <input type="number" value={videoCount} min="0" onChange={e => dispatch({type: 'SET_VIDEO_COUNT', payload: parseInt(e.target.value, 10)})} className="w-20 bg-slate-700 p-2 rounded-md" disabled={isBusy} />
                    </div>
                    <button onClick={handleAnalyze} disabled={isBusy || !trendText.trim()} className="w-full sm:w-auto bg-cyan-500 hover:bg-cyan-400 disabled:bg-slate-600 text-white font-bold py-3 px-6 rounded-full text-lg flex items-center justify-center gap-2">
                        {step === 'analyzing' || step === 'prompting' ? <SpinnerIcon /> : 'Analyze & Create Prompts'}
                    </button>
                </div>
            </div>
            
            {error && <div className="bg-red-900/20 p-4 rounded-lg text-center text-red-400">{error}</div>}

            {assets.length > 0 && (
                <div className="bg-slate-800/50 p-6 rounded-2xl shadow-lg">
                    <div className="flex justify-between items-center mb-4">
                        <h2 className="text-2xl font-bold text-cyan-400">2. Generation Dashboard</h2>
                        {step === 'idle' && (
                             <button onClick={handleStartGeneration} disabled={isBusy} className="bg-green-600 hover:bg-green-500 disabled:bg-slate-600 text-white font-bold py-3 px-6 rounded-full text-lg flex items-center justify-center gap-2">
                                ✨ Generate All Assets
                            </button>
                        )}
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                        {assets.map(asset => (
                           <div key={asset.id} className="aspect-video bg-slate-900 rounded-lg overflow-hidden flex flex-col justify-between p-3 relative shadow-inner">
                                <div className="absolute inset-0 flex items-center justify-center">
                                    {asset.status === 'generating' || asset.status === 'polling' ? <SpinnerIcon /> : null}
                                    {asset.status === 'complete' && asset.type === 'photo' && <img src={asset.src} className="w-full h-full object-cover" alt={asset.prompt} />}
                                    {asset.status === 'complete' && asset.type === 'video' && <video src={asset.src} className="w-full h-full object-cover" controls loop />}
                                    {asset.status === 'failed' && <span className="text-red-400 font-semibold">Failed</span>}
                                </div>
                                <div className="z-10 bg-black/50 p-1 rounded-md self-start">
                                     <span className={`text-xs px-2 py-1 rounded-full ${asset.type === 'photo' ? 'bg-sky-500' : 'bg-purple-500'} text-white capitalize`}>{asset.type}</span>
                                </div>
                               {asset.metadata && (
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
            {step === 'complete' && (
                 <div className="bg-slate-800/50 p-6 rounded-2xl shadow-lg text-center">
                      <h2 className="text-2xl font-bold text-cyan-400 mb-4">3. Generation Complete!</h2>
                      <p className="text-slate-300 mb-6">Your content package is ready, including all assets and a metadata CSV file.</p>
                       <button onClick={handleDownloadPackage} className="bg-teal-500 hover:bg-teal-400 text-white font-bold py-4 px-8 rounded-full text-xl shadow-lg shadow-teal-500/20">
                        Download Content Package (.zip)
                      </button>
                 </div>
            )}
        </div>
    );
};

export default CreativeDirector;
