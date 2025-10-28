import React, { useState, useEffect, useRef } from 'react';
import {
    generateCreativeStrategy,
    generateStockImage,
    generateVideo,
    checkVideoOperationStatus,
    fetchAndCreateVideoUrl,
    generateMetadataForAsset,
    generateCreativePrompt
} from '../services/geminiService';
import type { AssetMetadata } from '../services/geminiService';
import { createContentPackageZip } from '../utils/zipUtils';

import { SearchIcon } from './icons/SearchIcon';
import { ProductionIcon } from './icons/ProductionIcon';
import { PackageIcon } from './icons/PackageIcon';
import { SpinnerIcon } from './icons/SpinnerIcon';
import { CheckIcon } from './icons/CheckIcon';
import { CrossIcon } from './icons/CrossIcon';
import { PhotoIcon } from './icons/PhotoIcon';
import { VideoGeneratorIcon } from './icons/VideoGeneratorIcon';
import { GenerateIcon } from './icons/GenerateIcon';


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

const Stepper: React.FC<{ currentStage: Stage }> = ({ currentStage }) => {
    const stages: {id: Stage, title: string}[] = [
        { id: 'idea', title: 'Idea' },
        { id: 'strategy', title: 'Strategy' },
        { id: 'production', title: 'Production' },
        { id: 'package', title: 'Package' },
    ];
    const currentIndex = stages.findIndex(s => s.id === currentStage);

    return (
        <div className="flex justify-between items-center mb-8">
            {stages.map((stage, index) => (
                <React.Fragment key={stage.id}>
                    <div className="flex flex-col items-center text-center">
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center border-2 transition-colors ${index <= currentIndex ? 'bg-cyan-500 border-cyan-500' : 'bg-slate-700 border-slate-600'}`}>
                            {index < currentIndex ? <CheckIcon /> : <span className="font-bold">{index + 1}</span>}
                        </div>
                        <p className={`mt-2 text-xs sm:text-sm font-semibold transition-colors ${index <= currentIndex ? 'text-cyan-400' : 'text-slate-500'}`}>{stage.title}</p>
                    </div>
                    {index < stages.length - 1 && <div className={`flex-1 h-1 mx-2 transition-colors ${index < currentIndex ? 'bg-cyan-500' : 'bg-slate-700'}`}></div>}
                </React.Fragment>
            ))}
        </div>
    );
}

const CreativeDirector: React.FC = () => {
    const [stage, setStage] = useState<Stage>('idea');
    const [topic, setTopic] = useState('');
    const [assets, setAssets] = useState<Asset[]>([]);
    const [error, setError] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(false);

    const pollingRefs = useRef<Map<string, number>>(new Map());

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
        setIsLoading(true);
        setError(null);
        setAssets([]);
        setTopic('');
        try {
            // Step 1: AI generates the campaign topic
            const { prompt: newTopic } = await generateCreativePrompt('campaign');
            setTopic(newTopic);

            // Step 2: AI generates the strategy based on its own topic
            const photoCount = 3; // Fixed counts for automation
            const videoCount = 2;
            const { photoPrompts, videoPrompts } = await generateCreativeStrategy({ topic: newTopic, photoCount, videoCount });
            
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
            // Highest quality for final assets
            const imageResult = await generateStockImage(prompt, '16:9', true);
            updateAssetState(id, { status: 'complete', src: imageResult.src, metadata: imageResult.metadata });
        } catch (err) {
            const error = err instanceof Error ? err.message : 'Generation failed.';
            updateAssetState(id, { status: 'failed', error });
        }
    };
    
    const processVideoAsset = async (id: string, prompt: string) => {
        updateAssetState(id, { status: 'generating' });
        try {
            // Highest quality for final assets
            const operation = await generateVideo(prompt, '16:9');
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
                return <IdeaStage onGenerate={handleGenerateStrategy} isLoading={isLoading} />;
            case 'strategy':
                return <StrategyStage topic={topic} assets={assets} onConfirm={handleStartProduction} onBack={() => setStage('idea')} />;
            case 'production':
                return <ProductionStage assets={assets} />;
            case 'package':
                return <PackageStage assets={assets} onDownload={handleDownloadPackage} onStartOver={handleStartOver} />;
        }
    };
    
    return (
        <div className="space-y-8">
            <div className="bg-slate-900/50 p-6 sm:p-8 rounded-2xl shadow-lg border border-slate-800">
                <Stepper currentStage={stage} />
                {error && <div className="bg-red-900/20 p-4 rounded-lg text-center text-red-300 mb-4 border border-red-500/30">{error}</div>}
                {renderStageContent()}
            </div>
        </div>
    );
};

// Sub-components for each stage for clarity

const IdeaStage: React.FC<{onGenerate: () => void, isLoading: boolean}> = ({ onGenerate, isLoading }) => (
    <div className="space-y-6 text-center">
        <h2 className="text-xl font-bold text-white">Ready for a new campaign?</h2>
        <p className="text-slate-400 max-w-2xl mx-auto">Click the button below and the AI Creative Director will generate a complete campaign concept, create a content strategy, and produce all the visual assets for you. No manual input required.</p>
        <button
            onClick={onGenerate}
            disabled={isLoading}
            className="w-full max-w-sm mx-auto flex items-center justify-center gap-2 bg-cyan-600 hover:bg-cyan-500 disabled:bg-slate-700 text-white font-bold py-4 px-6 rounded-full text-xl shadow-lg transition-all"
        >
            {isLoading ? <SpinnerIcon /> : <><GenerateIcon /> <span className="ml-2">Generate Full Campaign</span></>}
        </button>
    </div>
);

const StrategyStage: React.FC<{topic: string, assets: Asset[], onConfirm: () => void, onBack: () => void}> = ({ topic, assets, onConfirm, onBack }) => (
    <div>
        <h3 className="text-lg font-semibold text-slate-200 mb-2 text-center">Review the AI-generated content plan.</h3>
        <div className="p-4 bg-slate-800 rounded-lg border border-slate-700 mb-4">
            <p className="text-slate-400 text-sm">Campaign Topic:</p>
            <p className="text-white font-semibold">{topic}</p>
        </div>
        <div className="space-y-4 max-h-96 overflow-y-auto p-4 bg-slate-800/50 rounded-lg border border-slate-700">
            {assets.map((asset: Asset) => (
                <div key={asset.id} className="p-3 bg-slate-900/70 border border-slate-700 rounded-md flex items-start gap-3">
                    <span className="text-cyan-400 mt-1">{asset.type === 'photo' ? <PhotoIcon /> : <VideoGeneratorIcon />}</span>
                    <p className="text-slate-300 text-sm">{asset.prompt}</p>
                </div>
            ))}
        </div>
        <div className="flex justify-center gap-4 mt-6">
            <button onClick={onBack} className="px-6 py-2 rounded-full bg-slate-600 hover:bg-slate-500 font-semibold">Back</button>
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
        return <span className="text-slate-500 text-xs">Queued</span>;
    };
    
    return (
        <div>
            <h3 className="text-lg font-semibold text-slate-200 mb-4 text-center">Your assets are being generated. This may take several minutes.</h3>
            <div className="space-y-3 p-4 bg-slate-800/50 rounded-lg border border-slate-700">
                {assets.map(asset => (
                    <div key={asset.id} className="p-3 bg-slate-900/70 rounded-lg flex items-center justify-between gap-4">
                        <div className="flex items-center gap-3 flex-1 min-w-0">
                             <span className="text-cyan-400">{asset.type === 'photo' ? <PhotoIcon /> : <VideoGeneratorIcon />}</span>
                             <p className="text-slate-400 text-sm truncate">{asset.prompt}</p>
                        </div>
                        <div className="flex items-center gap-2 text-sm font-semibold w-28 flex-shrink-0 justify-end">
                            {getStatusIndicator(asset.status)}
                            <span className="capitalize w-20 text-left">{asset.status}</span>
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
                    <div key={asset.id} className="relative aspect-video bg-slate-800 rounded-lg overflow-hidden group">
                        {asset.type === 'photo' ? (
                            <img src={asset.src} alt={asset.prompt} className="w-full h-full object-cover" />
                        ) : (
                            <video src={asset.src} muted loop autoPlay className="w-full h-full object-cover" />
                        )}
                        <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                          <span className="text-green-400"><CheckIcon /></span>
                        </div>
                    </div>
                ))}
                 {failed.map((asset: Asset) => (
                    <div key={asset.id} className="relative aspect-video bg-red-900/30 rounded-lg flex flex-col items-center justify-center p-2 border border-red-500/30" title={asset.error}>
                        <CrossIcon />
                         <p className="text-xs text-red-300 mt-1">Failed</p>
                    </div>
                ))}
            </div>

            <div className="flex flex-col items-center gap-4">
                 <button onClick={onDownload} className="w-full max-w-sm flex items-center justify-center gap-2 bg-green-600 hover:bg-green-500 text-white font-bold py-3 px-6 rounded-full text-lg shadow-lg">
                    <PackageIcon /> <span>Download Content Package (.zip)</span>
                </button>
                 <button onClick={onStartOver} className="text-slate-400 hover:text-cyan-400 mt-2 font-semibold">Start a New Project</button>
            </div>
        </div>
    );
};


export default CreativeDirector;