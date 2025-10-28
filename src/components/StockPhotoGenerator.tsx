import React, { useState, useEffect, useRef } from 'react';
import { 
    generateStockImage, 
    generateCreativePrompt, 
    startBatchImageJob, 
    checkBatchImageJobStatus,
    generatePhotoShootPrompts
} from '../services/geminiService';
import type { StockImageResult } from '../services/geminiService';
import type { BatchJob, BatchImageResult } from '../types';
import { SpinnerIcon } from './icons/SpinnerIcon';
import { GenerateIcon } from './icons/GenerateIcon';
import { CheckIcon } from './icons/CheckIcon';
import { CrossIcon } from './icons/CrossIcon';
import { createPhotoShootPackageZip } from '../utils/zipUtils';

type Mode = 'single' | 'batch';

const BATCH_POLLING_INTERVAL = 3000; // 3 seconds

const StockPhotoGenerator: React.FC = () => {
    const [mode, setMode] = useState<Mode>('single');

    return (
        <div className="space-y-8">
            <div className="text-center max-w-3xl mx-auto">
                <h1 className="text-3xl font-bold text-white mb-2">AI Art Director</h1>
                <p className="text-lg text-slate-400">Choose your mode. Let the AI generate a complete art direction for a single stunning image, or orchestrate an entire photo shoot with 10 variations.</p>
            </div>
            
            <div className="flex justify-center border-b border-slate-700">
                <button onClick={() => setMode('single')} className={`px-6 py-3 font-semibold text-lg transition-colors ${mode === 'single' ? 'text-cyan-400 border-b-2 border-cyan-400' : 'text-slate-400 hover:text-white'}`}>
                    Art Director (Single Image)
                </button>
                <button onClick={() => setMode('batch')} className={`px-6 py-3 font-semibold text-lg transition-colors ${mode === 'batch' ? 'text-cyan-400 border-b-2 border-cyan-400' : 'text-slate-400 hover:text-white'}`}>
                    Photo Shoot (10 Images)
                </button>
            </div>

            {mode === 'single' ? <SingleGenerator /> : <BatchGenerator />}
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

const BatchGenerator: React.FC = () => {
    const [aspectRatio, setAspectRatio] = useState<'16:9' | '9:16' | '1:1'>('16:9');
    const [job, setJob] = useState<BatchJob | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [loadingMessage, setLoadingMessage] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [aiTheme, setAiTheme] = useState('');
    const pollingRef = useRef<number | null>(null);

    const pollJobStatus = async (id: string) => {
        try {
          const currentJob = await checkBatchImageJobStatus(id);
          setJob(currentJob);
    
          if (currentJob.status === 'COMPLETED' || currentJob.status === 'FAILED') {
            setIsLoading(false);
            if (pollingRef.current) clearInterval(pollingRef.current);
            if(currentJob.status === 'FAILED') {
                setError(currentJob.error || 'The batch job failed for an unknown reason.');
            }
          }
        } catch (err) {
            setIsLoading(false);
            if (pollingRef.current) clearInterval(pollingRef.current);
            setError(err instanceof Error ? err.message : 'An unknown error occurred while polling.');
        }
    };

    useEffect(() => {
        return () => {
            if (pollingRef.current) clearInterval(pollingRef.current);
        };
    }, []);

    const handleGenerate = async () => {
        setIsLoading(true);
        setError(null);
        setJob(null);
        setAiTheme('');
        if (pollingRef.current) clearInterval(pollingRef.current);

        try {
            setLoadingMessage("AI is developing a core photoshoot theme...");
            const { theme, prompts } = await generatePhotoShootPrompts();
            setAiTheme(theme);
            
            setLoadingMessage("Submitting job to the production queue...");
            const { jobId } = await startBatchImageJob(prompts, aspectRatio);
            
            setLoadingMessage("Generation in progress...");
            pollJobStatus(jobId); // Initial poll
            pollingRef.current = window.setInterval(() => pollJobStatus(jobId), BATCH_POLLING_INTERVAL);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'An unknown error occurred.');
            setIsLoading(false);
        }
    };
    
    const completedCount = job?.results.filter(r => r.status === 'complete').length || 0;
    const totalCount = job?.prompts.length || 0;

    return (
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
            <div className="lg:col-span-2 bg-slate-900/50 p-6 rounded-2xl shadow-lg border border-slate-800 flex flex-col justify-center gap-6">
                 <div>
                    <label htmlFor="aspect-ratio-batch" className="block text-slate-300 font-semibold mb-2 text-center text-lg">1. Select Orientation</label>
                    <select id="aspect-ratio-batch" value={aspectRatio} onChange={e => setAspectRatio(e.target.value as any)} className="w-full bg-slate-800 border border-slate-700 p-3 rounded-lg focus:ring-2 focus:ring-cyan-500 transition-colors text-lg">
                        <option value="16:9">16:9 (Landscape)</option>
                        <option value="9:16">9:16 (Portrait)</option>
                        <option value="1:1">1:1 (Square)</option>
                    </select>
                </div>
                <button onClick={handleGenerate} disabled={isLoading} className="w-full flex items-center justify-center gap-2 bg-cyan-600 hover:bg-cyan-500 disabled:bg-slate-700 disabled:text-slate-400 text-white font-bold py-4 px-6 rounded-full text-xl transition-colors">
                    {isLoading ? <SpinnerIcon /> : <><GenerateIcon /> <span>2. Generate Photo Shoot</span></>}
                </button>
            </div>
            <div className="lg:col-span-3 bg-slate-900/50 p-6 rounded-2xl shadow-lg border border-slate-800 flex flex-col">
                <h2 className="text-xl font-bold text-cyan-400 mb-4">Results</h2>
                <div className="flex-grow">
                    {isLoading && (
                        <div className="text-center flex flex-col items-center justify-center h-full">
                            <SpinnerIcon />
                            <p className="text-slate-300 mt-4">{loadingMessage}</p>
                            {totalCount > 0 && <p className="text-cyan-400 font-bold text-lg">{completedCount} / {totalCount} Generated</p>}
                            {aiTheme && <p className="text-sm text-slate-500 mt-2 italic">Theme: "{aiTheme}"</p>}
                        </div>
                    )}
                    {error && <p className="text-red-400 text-center">{error}</p>}
                    {job && (
                        <div className='space-y-4'>
                            {aiTheme && (
                                <div className="p-3 bg-slate-800/70 rounded-lg border border-slate-700">
                                    <h4 className="font-semibold text-cyan-400 mb-1">AI Photoshoot Theme:</h4>
                                    <p className="text-sm text-slate-300 italic">"{aiTheme}"</p>
                                </div>
                            )}
                            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                                {job.results.map(res => (
                                    <div key={res.id} className="aspect-square bg-slate-800 rounded-lg flex items-center justify-center relative overflow-hidden">
                                        {res.status === 'generating' && <SpinnerIcon />}
                                        {res.status === 'failed' && <div className='text-red-400 text-center p-1'><CrossIcon /><p className='text-xs mt-1' title={res.error}>Failed</p></div>}
                                        {res.src && <img src={res.src} alt={res.prompt} className="w-full h-full object-cover" />}
                                        {res.status === 'complete' && <div className='absolute top-1 right-1 bg-green-500/80 text-white rounded-full p-1'><CheckIcon /></div>}
                                    </div>
                                ))}
                            </div>
                            {job.status === 'COMPLETED' && (
                                 <button onClick={() => createPhotoShootPackageZip(job.results.filter(r => r.status === 'complete'))} className="w-full bg-green-600 hover:bg-green-500 text-white font-bold py-3 px-6 rounded-full transition-colors mt-4">
                                    Download All as .zip
                                </button>
                            )}
                        </div>
                    )}
                    {!isLoading && !job && !error && <p className="text-slate-500 text-center py-16">Your generated photo shoot will appear here.</p>}
                </div>
            </div>
        </div>
    );
};


export default StockPhotoGenerator;