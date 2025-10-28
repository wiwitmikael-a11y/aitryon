import React, { useState, useCallback, useEffect, useRef } from 'react';
import {
    generateCreativeStrategy,
    generateStockImage,
    generateVideo,
    checkVideoOperationStatus,
    fetchAndCreateVideoUrl,
    generateMetadataForAsset
} from '../services/geminiService';
import type { AssetMetadata } from '../services/geminiService';
import { createContentPackageZip } from '../utils/zipUtils';

import { SearchIcon } from './icons/SearchIcon';
import { StrategyIcon } from './icons/StrategyIcon';
import { ProductionIcon } from './icons/ProductionIcon';
import { PackageIcon } from './icons/PackageIcon';
import { SpinnerIcon } from './icons/SpinnerIcon';
import { CheckIcon } from './icons/CheckIcon';
import { CrossIcon } from './icons/CrossIcon';
import { PhotoIcon } from './icons/PhotoIcon';
import { VideoGeneratorIcon } from './icons/VideoGeneratorIcon';

type Stage = 'idea' | 'strategy' | 'production' | 'package';

interface Asset {
    id: string;
    type: 'photo' | 'video';
    prompt: string;
    status: 'pending' | 'generating' | 'polling' | 'complete' | 'failed';
    src?: string;
    error?: string;
    metadata?: AssetMetadata;
    operationName?: string;
}

const VIDEO_POLLING_INTERVAL = 10000; // 10 seconds

const CreativeDirector: React.FC = () => {
    const [stage, setStage] = useState<Stage>('idea');
    const [topic, setTopic] = useState('');
    const [photoCount, setPhotoCount] = useState(3);
    const [videoCount, setVideoCount] = useState(2);
    const [assets, setAssets] = useState<Asset[]>([]);
    const [error, setError] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [apiKeySelected, setApiKeySelected] = useState(false);

    const pollingRefs = useRef<Map<string, number>>(new Map());

    const checkApiKey = useCallback(async () => {
        // Fix: Added a check for window.aistudio before using it.
        if (window.aistudio) {
            const hasKey = await window.aistudio.hasSelectedApiKey();
            setApiKeySelected(hasKey);
        }
    }, []);

    useEffect(() => {
        checkApiKey();
    }, [checkApiKey]);

    // Cleanup polling intervals on unmount
    useEffect(() => {
        return () => {
            pollingRefs.current.forEach(intervalId => clearInterval(intervalId));
        };
    }, []);

    const updateAssetState = (id: string, updates: Partial<Asset>) => {
        setAssets(prevAssets =>
            prevAssets.map(asset => (asset.id === id ? { ...asset, ...updates } : asset))
        );
    };

    const handleGenerateStrategy = async () => {
        if (!topic.trim()) {
            setError('Please enter a topic or project idea.');
            return;
        }
        setIsLoading(true);
        setError(null);
        setAssets([]);
        try {
            const { photoPrompts, videoPrompts } = await generateCreativeStrategy(topic, photoCount, videoCount);
            const newAssets: Asset[] = [
                ...photoPrompts.map((prompt, i) => ({ id: `photo-${i}`, type: 'photo' as const, prompt, status: 'pending' as const })),
                ...videoPrompts.map((prompt, i) => ({ id: `video-${i}`, type: 'video' as const, prompt, status: 'pending' as const })),
            ];
            setAssets(newAssets);
            setStage('strategy');
        } catch (err) {
            setError(err instanceof Error ? err.message : 'An unknown error occurred while generating the strategy.');
        } finally {
            setIsLoading(false);
        }
    };
    
    const handleStartProduction = () => {
        if (videoCount > 0 && !apiKeySelected) {
            setError("Video generation requires selecting an API key for billing. Please select a key to proceed.");
            handleSelectKey(); // Prompt user to select key
            return;
        }
        setStage('production');
        assets.forEach(asset => {
            if (asset.type === 'photo') {
                processPhotoAsset(asset.id, asset.prompt);
            } else if (asset.type === 'video') {
                processVideoAsset(asset.id, asset.prompt);
            }
        });
    };

    const processPhotoAsset = async (id: string, prompt: string) => {
        updateAssetState(id, { status: 'generating' });
        try {
            const [src, metadata] = await Promise.all([
                generateStockImage(prompt),
                generateMetadataForAsset(prompt, 'photo')
            ]);
            updateAssetState(id, { status: 'complete', src, metadata });
        } catch (err) {
            const error = err instanceof Error ? err.message : 'Generation failed.';
            updateAssetState(id, { status: 'failed', error });
        }
    };
    
    const processVideoAsset = async (id: string, prompt: string) => {
        updateAssetState(id, { status: 'generating' });
        try {
            const operation = await generateVideo(prompt);
            if (!operation.name) throw new Error("Video operation name not found.");
            
            updateAssetState(id, { status: 'polling', operationName: operation.name });
            pollVideoStatus(id, operation.name);
        } catch (err) {
            const error = err instanceof Error ? err.message : 'Starting video generation failed.';
            updateAssetState(id, { status: 'failed', error });
        }
    };
    
    const pollVideoStatus = (id: string, operationName: string) => {
        const intervalId = window.setInterval(async () => {
            try {
                const operation = await checkVideoOperationStatus(operationName);
                if (operation.done) {
                    clearInterval(intervalId);
                    pollingRefs.current.delete(id);
                    if (operation.error) {
                        throw new Error(operation.error.message);
                    }
                    const uri = operation.response?.generatedVideos?.[0]?.video?.uri;
                    if (!uri) throw new Error("Video URI not found in operation response.");

                    const [src, metadata] = await Promise.all([
                        fetchAndCreateVideoUrl(uri),
                        generateMetadataForAsset(assets.find(a => a.id === id)!.prompt, 'video')
                    ]);
                    
                    updateAssetState(id, { status: 'complete', src, metadata });
                }
            } catch (err) {
                clearInterval(intervalId);
                pollingRefs.current.delete(id);
                const error = err instanceof Error ? err.message : 'Polling failed.';
                if(error === 'API_KEY_INVALID') {
                    setError("Operation failed. Your API Key may be invalid or missing permissions. Please select a valid key.");
                    setApiKeySelected(false);
                }
                updateAssetState(id, { status: 'failed', error });
            }
        }, VIDEO_POLLING_INTERVAL);
        pollingRefs.current.set(id, intervalId);
    };
    
    useEffect(() => {
        if (stage === 'production' && assets.length > 0) {
            const allFinished = assets.every(a => a.status === 'complete' || a.status === 'failed');
            if (allFinished) {
                setStage('package');
            }
        }
    }, [assets, stage]);

    const handleDownloadPackage = () => {
        createContentPackageZip(assets);
    };

    const handleSelectKey = async () => {
        // Fix: Added a check for window.aistudio before using it.
        if (window.aistudio) {
            await window.aistudio.openSelectKey();
            setApiKeySelected(true);
            setError(null);
        }
    };
    
    const handleStartOver = () => {
        setStage('idea');
        setTopic('');
        setAssets([]);
        setError(null);
        setIsLoading(false);
        pollingRefs.current.forEach(id => clearInterval(id));
        pollingRefs.current.clear();
    };

    const renderStageContent = () => {
        switch(stage) {
            case 'idea':
                return <IdeaStage topic={topic} setTopic={setTopic} photoCount={photoCount} setPhotoCount={setPhotoCount} videoCount={videoCount} setVideoCount={setVideoCount} onGenerate={handleGenerateStrategy} isLoading={isLoading} />;
            case 'strategy':
                return <StrategyStage assets={assets} onConfirm={handleStartProduction} onBack={() => setStage('idea')} videoCount={videoCount} apiKeySelected={apiKeySelected} onSelectKey={handleSelectKey}/>;
            case 'production':
                return <ProductionStage assets={assets} />;
            case 'package':
                return <PackageStage assets={assets} onDownload={handleDownloadPackage} onStartOver={handleStartOver} />;
        }
    };

    const stageTitles: Record<Stage, string> = {
        idea: "1. Project Idea",
        strategy: "2. Creative Strategy",
        production: "3. Content Production",
        package: "4. Download Package"
    };
    
    return (
        <div className="space-y-8">
            <div className="bg-slate-800/50 p-6 rounded-2xl shadow-lg">
                <h2 className="text-2xl font-bold text-cyan-400 mb-4">{stageTitles[stage]}</h2>
                {error && <div className="bg-red-900/20 p-4 rounded-lg text-center text-red-400 mb-4">{error}</div>}
                {renderStageContent()}
            </div>
        </div>
    );
};

// Sub-components for each stage for clarity

const IdeaStage: React.FC<any> = ({ topic, setTopic, photoCount, setPhotoCount, videoCount, setVideoCount, onGenerate, isLoading }) => (
    <div className="space-y-6">
        <div>
            <label htmlFor="topic" className="block text-slate-300 font-semibold mb-2">Describe a topic, theme, or visual trend for your content campaign:</label>
            <textarea
                id="topic"
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                placeholder="e.g., 'Sustainable living in urban environments', 'The future of remote work', 'Vibrant street food culture at night'"
                className="w-full h-24 p-3 bg-slate-700/50 border border-slate-600 rounded-lg focus:ring-2 focus:ring-cyan-500"
                disabled={isLoading}
            />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
                 <label htmlFor="photoCount" className="block text-slate-300 font-semibold mb-2">Number of Photos:</label>
                 <input type="number" id="photoCount" value={photoCount} min="1" max="10" onChange={e => setPhotoCount(Number(e.target.value))} className="w-full p-2 bg-slate-700/50 border border-slate-600 rounded-lg"/>
            </div>
             <div>
                 <label htmlFor="videoCount" className="block text-slate-300 font-semibold mb-2">Number of Videos:</label>
                 <input type="number" id="videoCount" value={videoCount} min="0" max="5" onChange={e => setVideoCount(Number(e.target.value))} className="w-full p-2 bg-slate-700/50 border border-slate-600 rounded-lg"/>
            </div>
        </div>
        <button
            onClick={onGenerate}
            disabled={isLoading || !topic.trim()}
            className="w-full max-w-sm mx-auto flex items-center justify-center bg-cyan-500 hover:bg-cyan-400 disabled:bg-slate-600 text-white font-bold py-3 px-6 rounded-full text-lg shadow-lg transition-all"
        >
            {isLoading ? <SpinnerIcon /> : <><SearchIcon /> <span className="ml-2">Generate Creative Strategy</span></>}
        </button>
    </div>
);

const StrategyStage: React.FC<any> = ({ assets, onConfirm, onBack, videoCount, apiKeySelected, onSelectKey }) => (
    <div>
        <h3 className="text-lg font-semibold text-slate-200 mb-4">Review the AI-generated content plan. When you're ready, proceed to production.</h3>
        <div className="space-y-4 max-h-96 overflow-y-auto pr-2">
            {assets.map((asset: Asset) => (
                <div key={asset.id} className="p-3 bg-slate-700/50 border border-slate-700 rounded-md flex items-start gap-3">
                    <span className="text-cyan-400 mt-1">{asset.type === 'photo' ? <PhotoIcon /> : <VideoGeneratorIcon />}</span>
                    <p className="text-slate-300 text-sm">{asset.prompt}</p>
                </div>
            ))}
        </div>
         {videoCount > 0 && !apiKeySelected && (
            <div className="mt-4 bg-amber-900/20 p-4 rounded-lg text-center text-amber-300">
                <p className="font-semibold">Action Required: Select API Key</p>
                <p className="text-sm mb-3">Video generation with Veo requires a Google Cloud API key for billing. Please select your key to continue.</p>
                <button onClick={onSelectKey} className="bg-amber-500 hover:bg-amber-400 text-white font-bold py-2 px-4 rounded-full text-sm">Select API Key</button>
            </div>
        )}
        <div className="flex justify-center gap-4 mt-6">
            <button onClick={onBack} className="px-6 py-2 rounded-full bg-slate-600 hover:bg-slate-500">Back</button>
            <button onClick={onConfirm} className="px-8 py-3 rounded-full bg-green-600 hover:bg-green-500 text-white font-bold flex items-center gap-2 shadow-lg">
                <ProductionIcon /> Start Production
            </button>
        </div>
    </div>
);

const ProductionStage: React.FC<{ assets: Asset[] }> = ({ assets }) => {
    const getStatusIndicator = (status: Asset['status']) => {
        if (status === 'generating' || status === 'polling') return <SpinnerIcon />;
        if (status === 'complete') return <span className="text-green-400"><CheckIcon /></span>;
        if (status === 'failed') return <span className="text-red-400"><CrossIcon /></span>;
        return <span className="text-slate-500">Queued</span>;
    };
    
    return (
        <div>
            <h3 className="text-lg font-semibold text-slate-200 mb-4 text-center">Your assets are being generated. This may take several minutes, especially for videos.</h3>
            <div className="space-y-3">
                {assets.map(asset => (
                    <div key={asset.id} className="p-3 bg-slate-900/50 rounded-lg flex items-center justify-between gap-4">
                        <div className="flex items-center gap-3 flex-1 min-w-0">
                             <span className="text-cyan-400">{asset.type === 'photo' ? <PhotoIcon /> : <VideoGeneratorIcon />}</span>
                             <p className="text-slate-400 text-sm truncate">{asset.prompt}</p>
                        </div>
                        <div className="flex items-center gap-2 text-sm font-semibold">
                            {getStatusIndicator(asset.status)}
                            <span className="capitalize w-24 text-left">{asset.status}</span>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

const PackageStage: React.FC<any> = ({ assets, onDownload, onStartOver }) => {
    const successful = assets.filter((a: Asset) => a.status === 'complete');
    const failed = assets.filter((a: Asset) => a.status === 'failed');

    return (
        <div className="text-center">
            <h3 className="text-xl font-semibold text-white mb-2">Production Complete!</h3>
            <p className="text-slate-400 mb-6">{successful.length} of {assets.length} assets were generated successfully.</p>
            
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 mb-8">
                {successful.map((asset: Asset) => (
                    <div key={asset.id} className="relative aspect-video bg-slate-900 rounded-lg overflow-hidden">
                        {asset.type === 'photo' ? (
                            <img src={asset.src} alt={asset.prompt} className="w-full h-full object-cover" />
                        ) : (
                            <video src={asset.src} muted loop autoPlay className="w-full h-full object-cover" />
                        )}
                        <div className="absolute top-1 right-1 p-1 bg-green-500 rounded-full text-white"><CheckIcon /></div>
                    </div>
                ))}
                 {failed.map((asset: Asset) => (
                    <div key={asset.id} className="relative aspect-video bg-red-900/30 rounded-lg flex items-center justify-center p-2" title={asset.error}>
                        <CrossIcon />
                         <p className="text-xs text-red-300 absolute bottom-1 text-center">Failed</p>
                    </div>
                ))}
            </div>

            <div className="flex flex-col items-center gap-4">
                 <button onClick={onDownload} className="w-full max-w-sm flex items-center justify-center bg-green-600 hover:bg-green-500 text-white font-bold py-3 px-6 rounded-full text-lg shadow-lg">
                    <PackageIcon /> <span className="ml-2">Download Content Package (.zip)</span>
                </button>
                 <button onClick={onStartOver} className="text-slate-400 hover:text-cyan-400">Start a New Project</button>
            </div>
        </div>
    );
};


export default CreativeDirector;