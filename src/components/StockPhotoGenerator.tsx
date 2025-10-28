import React, { useState, useEffect, useRef } from 'react';
import { generateStockImage, startBatchImageJob, checkBatchImageJobStatus } from '../services/geminiService';
import type { StockImageResult } from '../services/geminiService';
import type { BatchJob } from '../types';
import { SpinnerIcon } from './icons/SpinnerIcon';
import { ArtDirectorIcon } from './icons/ArtDirectorIcon';
import { SearchIcon } from './icons/SearchIcon';

type Mode = 'single' | 'batch';
const BATCH_POLLING_INTERVAL = 5000; // 5 seconds

const StockPhotoGenerator: React.FC = () => {
    const [mode, setMode] = useState<Mode>('single');

    // Single mode state
    const [prompt, setPrompt] = useState('');
    const [aspectRatio, setAspectRatio] = useState<'1:1' | '16:9' | '9:16'>('16:9');
    const [singleResult, setSingleResult] = useState<StockImageResult | null>(null);
    const [isSingleLoading, setIsSingleLoading] = useState(false);
    const [singleError, setSingleError] = useState<string | null>(null);

    // Batch mode state
    const [batchTopic, setBatchTopic] = useState('');
    const [batchCount, setBatchCount] = useState(4);
    const [batchJob, setBatchJob] = useState<BatchJob | null>(null);
    const [isBatchLoading, setIsBatchLoading] = useState(false);
    const [batchError, setBatchError] = useState<string | null>(null);
    const batchPollingRef = useRef<number | null>(null);

    const handleGenerateSingle = async () => {
        if (!prompt.trim()) return;
        setIsSingleLoading(true);
        setSingleError(null);
        setSingleResult(null);
        try {
            const result = await generateStockImage(prompt, aspectRatio, true);
            setSingleResult(result);
        } catch (err) {
            setSingleError(err instanceof Error ? err.message : 'An unknown error occurred.');
        } finally {
            setIsSingleLoading(false);
        }
    };

    const handleGenerateBatch = async () => {
        if (!batchTopic.trim()) return;
        setIsBatchLoading(true);
        setBatchError(null);
        setBatchJob(null);
        if (batchPollingRef.current) clearInterval(batchPollingRef.current);

        try {
            // In a real app, this prompt generation would be a separate Gemini call.
            // For simplicity here, we generate simple prompts based on the topic.
            const prompts = Array.from({ length: batchCount }, (_, i) => `${batchTopic}, high quality professional stock photo, style ${i + 1}`);

            const { jobId } = await startBatchImageJob(prompts);
            // Initialize job state for the UI
            setBatchJob({ 
                id: jobId, 
                status: 'PENDING', 
                prompts, 
                results: prompts.map((p, i) => ({ id: `image-${i}`, prompt: p, status: 'pending' })),
                createdAt: Date.now() 
            });
            batchPollingRef.current = window.setInterval(() => pollBatchStatus(jobId), BATCH_POLLING_INTERVAL);
        } catch (err) {
            setBatchError(err instanceof Error ? err.message : 'Failed to start batch job.');
            setIsBatchLoading(false);
        }
    };

    const pollBatchStatus = async (jobId: string) => {
        try {
            const job = await checkBatchImageJobStatus(jobId);
            setBatchJob(job);
            if (job.status === 'COMPLETED' || job.status === 'FAILED') {
                if (batchPollingRef.current) clearInterval(batchPollingRef.current);
                setIsBatchLoading(false);
                if (job.status === 'FAILED') {
                    setBatchError(job.error || 'Batch job failed for an unknown reason.');
                }
            }
        } catch (err) {
            if (batchPollingRef.current) clearInterval(batchPollingRef.current);
            setIsBatchLoading(false);
            setBatchError(err instanceof Error ? err.message : 'Failed to poll job status.');
        }
    };

    useEffect(() => {
        return () => {
            if (batchPollingRef.current) clearInterval(batchPollingRef.current);
        };
    }, []);

    const renderBatchResults = () => {
        if (!batchJob) return <p className="text-slate-500 text-center">Batch generation results will appear here.</p>;
        
        return (
             <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {batchJob.results.map(item => (
                    <div key={item.id} className="aspect-video bg-slate-900/50 rounded-lg flex items-center justify-center p-2 relative overflow-hidden">
                        {item.status === 'complete' && item.src && <img src={item.src} alt={item.prompt} className="w-full h-full object-cover" />}
                        {(item.status === 'pending' || item.status === 'generating') && <SpinnerIcon />}
                        {item.status === 'failed' && <p className="text-red-400 text-xs text-center" title={item.error}>Failed</p>}
                    </div>
                ))}
            </div>
        )
    }

    return (
        <div className="space-y-8">
            <div className="flex justify-center bg-slate-800/50 p-1 rounded-full max-w-sm mx-auto">
                <button onClick={() => setMode('single')} className={`w-1/2 py-2 rounded-full font-semibold transition-colors ${mode === 'single' ? 'bg-cyan-500 text-white' : 'hover:bg-slate-700'}`}>Art Director</button>
                <button onClick={() => setMode('batch')} className={`w-1/2 py-2 rounded-full font-semibold transition-colors ${mode === 'batch' ? 'bg-cyan-500 text-white' : 'hover:bg-slate-700'}`}>Batch Generation</button>
            </div>

            {mode === 'single' && (
                <div className="bg-slate-800/50 p-6 rounded-2xl shadow-lg">
                    <h2 className="text-2xl font-bold text-cyan-400 mb-4">Art Director Mode</h2>
                    <p className="text-slate-400 mb-4">Provide a detailed prompt for precise image generation.</p>
                    <textarea value={prompt} onChange={e => setPrompt(e.target.value)} placeholder="e.g., A cinematic, photorealistic shot of a lone astronaut looking at a swirling nebula, high-resolution, detailed suit..." className="w-full h-24 p-3 bg-slate-700/50 border border-slate-600 rounded-lg"/>
                    <div className="flex items-center gap-4 my-4">
                        <label className="text-slate-300">Aspect Ratio:</label>
                        <select value={aspectRatio} onChange={e => setAspectRatio(e.target.value as any)} className="bg-slate-700/50 border border-slate-600 p-2 rounded-lg">
                            <option value="16:9">16:9 (Landscape)</option>
                            <option value="9:16">9:16 (Portrait)</option>
                            <option value="1:1">1:1 (Square)</option>
                        </select>
                    </div>
                    <button onClick={handleGenerateSingle} disabled={isSingleLoading || !prompt.trim()} className="w-full flex items-center justify-center bg-cyan-500 hover:bg-cyan-400 disabled:bg-slate-600 text-white font-bold py-3 px-6 rounded-full text-lg">
                        {isSingleLoading ? <SpinnerIcon /> : <><ArtDirectorIcon /> <span className="ml-2">Generate Image</span></>}
                    </button>
                    {singleError && <p className="text-red-400 mt-4 text-center">{singleError}</p>}
                    {singleResult && (
                        <div className="mt-6">
                            <h3 className="text-xl font-bold mb-4">Result:</h3>
                            <img src={singleResult.src} alt={prompt} className="rounded-lg w-full" />
                            {singleResult.metadata && (
                                <div className="mt-4 p-4 bg-slate-900/50 rounded-lg">
                                    <h4 className="font-semibold text-slate-200">Generated Metadata:</h4>
                                    <p><strong>Title:</strong> {singleResult.metadata.title}</p>
                                    <p><strong>Description:</strong> {singleResult.metadata.description}</p>
                                    <p><strong>Tags:</strong> {singleResult.metadata.tags.join(', ')}</p>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            )}

             {mode === 'batch' && (
                <div className="bg-slate-800/50 p-6 rounded-2xl shadow-lg space-y-4">
                    <h2 className="text-2xl font-bold text-cyan-400">Batch Generation Mode</h2>
                    <p className="text-slate-400">Provide a topic, and the AI will generate a series of images.</p>
                    <input type="text" value={batchTopic} onChange={e => setBatchTopic(e.target.value)} placeholder="e.g., 'Minimalist home office setups'" className="w-full p-3 bg-slate-700/50 border border-slate-600 rounded-lg" />
                    <div>
                        <label htmlFor="batch-count" className="text-slate-300">Number of Images:</label>
                        <input id="batch-count" type="number" value={batchCount} onChange={e => setBatchCount(Number(e.target.value))} min="2" max="8" className="w-full p-2 bg-slate-700/50 border border-slate-600 rounded-lg mt-1" />
                    </div>
                    <button onClick={handleGenerateBatch} disabled={isBatchLoading || !batchTopic.trim()} className="w-full flex items-center justify-center bg-cyan-500 hover:bg-cyan-400 disabled:bg-slate-600 text-white font-bold py-3 px-6 rounded-full text-lg">
                        {isBatchLoading ? <SpinnerIcon /> : <><SearchIcon /> <span className="ml-2">Start Batch Job</span></>}
                    </button>
                    {batchError && <p className="text-red-400 mt-4 text-center">{batchError}</p>}
                    <div className="mt-6">
                        <h3 className="text-xl font-bold mb-4">Batch Results: {batchJob?.status}</h3>
                        {renderBatchResults()}
                    </div>
                </div>
            )}
        </div>
    );
};

export default StockPhotoGenerator;
