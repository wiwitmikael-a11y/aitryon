import React, { useState, useEffect, useRef } from 'react';
import { generatePhotoConcepts, generateStockImage } from '../services/geminiService';
import type { BatchJob, BatchJobResult } from '../types';

import { SpinnerIcon } from './icons/SpinnerIcon';
import { ArtDirectorIcon } from './icons/ArtDirectorIcon';
import { SearchIcon } from './icons/SearchIcon';
import { PhotoIcon } from './icons/PhotoIcon';

type Mode = 'direct' | 'batch';
const BATCH_POLLING_INTERVAL = 5000;

const StockPhotoGenerator: React.FC = () => {
    const [mode, setMode] = useState<Mode>('direct');

    return (
        <div className="space-y-8">
            <div className="bg-slate-800/50 p-6 rounded-2xl shadow-lg">
                <div className="flex justify-center border-b border-slate-700 mb-6">
                    <button onClick={() => setMode('direct')} className={`px-4 py-2 text-lg font-semibold transition-colors ${mode === 'direct' ? 'text-cyan-400 border-b-2 border-cyan-400' : 'text-slate-400 hover:text-white'}`}>
                        Art Direction
                    </button>
                    <button onClick={() => setMode('batch')} className={`px-4 py-2 text-lg font-semibold transition-colors ${mode === 'batch' ? 'text-cyan-400 border-b-2 border-cyan-400' : 'text-slate-400 hover:text-white'}`}>
                        Batch Generation
                    </button>
                </div>
                {mode === 'direct' ? <ArtDirectionMode /> : <BatchGenerationMode />}
            </div>
        </div>
    );
};

const ArtDirectionMode: React.FC = () => {
    const [topic, setTopic] = useState('');
    const [style, setStyle] = useState('Photorealistic');
    const [palette, setPalette] = useState('');
    const [angle, setAngle] = useState('Eye-level');
    
    const [concepts, setConcepts] = useState<string[]>([]);
    const [selectedConcept, setSelectedConcept] = useState('');
    const [generatedImage, setGeneratedImage] = useState<string | null>(null);
    
    const [isLoadingConcepts, setIsLoadingConcepts] = useState(false);
    const [isLoadingImage, setIsLoadingImage] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleGenerateConcepts = async () => {
        setIsLoadingConcepts(true);
        setError(null);
        setConcepts([]);
        setSelectedConcept('');
        setGeneratedImage(null);
        try {
            const result = await generatePhotoConcepts(topic, style, palette, angle);
            setConcepts(result.concepts);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to generate concepts.');
        } finally {
            setIsLoadingConcepts(false);
        }
    };

    const handleGenerateImage = async () => {
        if (!selectedConcept) return;
        setIsLoadingImage(true);
        setError(null);
        setGeneratedImage(null);
        try {
            const result = await generateStockImage(selectedConcept, '16:9');
            setGeneratedImage(result.src);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to generate image.');
        } finally {
            setIsLoadingImage(false);
        }
    };

    const handleSelectConcept = (concept: string) => {
        setSelectedConcept(concept);
        setGeneratedImage(null);
    }

    return (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <div className="space-y-4">
                <h3 className="text-xl font-bold text-slate-200">1. Define Art Direction</h3>
                <Input label="Topic or Theme" value={topic} onChange={setTopic} placeholder="e.g., 'A tranquil Japanese zen garden'" />
                <Select label="Style" value={style} onChange={setStyle} options={['Photorealistic', 'Cinematic', 'Minimalist', 'Vintage', 'Abstract']} />
                <Input label="Color Palette (Optional)" value={palette} onChange={setPalette} placeholder="e.g., 'Earthy tones, muted greens, stone gray'" />
                <Select label="Angle / Shot" value={angle} onChange={setAngle} options={['Eye-level', 'Low-angle', 'High-angle', 'Close-up', 'Wide shot']} />
                <button onClick={handleGenerateConcepts} disabled={isLoadingConcepts || !topic} className="w-full flex justify-center items-center gap-2 bg-cyan-600 hover:bg-cyan-500 disabled:bg-slate-600 text-white font-bold py-2 px-4 rounded-lg">
                    {isLoadingConcepts ? <SpinnerIcon /> : <><SearchIcon /> Generate Concepts</>}
                </button>
            </div>
            <div className="space-y-4">
                <h3 className="text-xl font-bold text-slate-200">2. Select Concept & Generate</h3>
                <div className="space-y-2">
                    {concepts.map((concept, i) => (
                        <button key={i} onClick={() => handleSelectConcept(concept)} className={`w-full text-left p-2 rounded-md text-sm border-2 transition-colors ${selectedConcept === concept ? 'bg-cyan-900/50 border-cyan-500' : 'bg-slate-700/50 border-transparent hover:bg-slate-700'}`}>
                            {concept}
                        </button>
                    ))}
                </div>
                {concepts.length > 0 && (
                    <div className="sticky top-20 bg-slate-800 p-2 rounded-lg z-10">
                         <textarea value={selectedConcept} onChange={e => setSelectedConcept(e.target.value)} className="w-full h-20 p-2 bg-slate-900/50 rounded-md text-sm" />
                         <button onClick={handleGenerateImage} disabled={isLoadingImage || !selectedConcept} className="w-full flex justify-center items-center gap-2 bg-green-600 hover:bg-green-500 disabled:bg-slate-600 text-white font-bold py-2 px-4 rounded-lg mt-2">
                            {isLoadingImage ? <SpinnerIcon /> : <><PhotoIcon /> Generate Image</>}
                        </button>
                    </div>
                )}
            </div>
             <div className="lg:col-span-2">
                <h3 className="text-xl font-bold text-slate-200 mb-4 text-center">Result</h3>
                <div className="w-full aspect-video bg-slate-900/50 rounded-lg flex items-center justify-center p-2">
                    {isLoadingImage && <SpinnerIcon />}
                    {error && <p className="text-red-400">{error}</p>}
                    {generatedImage && <img src={generatedImage} alt="Generated stock" className="max-w-full max-h-full object-contain rounded-md" />}
                    {!isLoadingImage && !error && !generatedImage && <p className="text-slate-500">Your generated image will appear here.</p>}
                </div>
            </div>
        </div>
    );
};

const BatchGenerationMode: React.FC = () => {
    const [topic, setTopic] = useState('');
    const [job, setJob] = useState<BatchJob | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const pollingRef = useRef<number | null>(null);

    const cleanupPolling = () => {
        if (pollingRef.current) {
            clearInterval(pollingRef.current);
            pollingRef.current = null;
        }
    };

    useEffect(() => {
        return cleanupPolling;
    }, []);
    
    const pollJobStatus = async (jobId: string) => {
        try {
            const response = await fetch(`/api/get-batch-status?jobId=${jobId}`);
            if (!response.ok) throw new Error("Failed to get job status.");
            const data = await response.json();
            setJob(data.job);

            if (data.job.status === 'COMPLETED' || data.job.status === 'FAILED') {
                cleanupPolling();
                setIsLoading(false);
                if (data.job.status === 'FAILED') setError(data.job.error || 'Job failed for an unknown reason.');
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Polling failed.');
            cleanupPolling();
            setIsLoading(false);
        }
    };

    const handleStartBatch = async () => {
        setIsLoading(true);
        setError(null);
        setJob(null);
        cleanupPolling();
        try {
            const response = await fetch('/api/start-batch-job', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ topic }),
            });
            if (!response.ok) {
                const errData = await response.json();
                throw new Error(errData.message || "Failed to start batch job.");
            }
            const { jobId } = await response.json();
            pollingRef.current = window.setInterval(() => pollJobStatus(jobId), BATCH_POLLING_INTERVAL);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'An unknown error occurred.');
            setIsLoading(false);
        }
    };
    
    return (
        <div className="space-y-6">
            <div>
                 <Input label="Describe the topic for your content batch:" value={topic} onChange={setTopic} placeholder="e.g., 'Healthy and vibrant breakfast foods', 'Team collaboration in a modern office'" />
                 <button onClick={handleStartBatch} disabled={isLoading || !topic} className="mt-4 w-full max-w-sm mx-auto flex justify-center items-center gap-2 bg-cyan-600 hover:bg-cyan-500 disabled:bg-slate-600 text-white font-bold py-3 px-6 rounded-full text-lg">
                    {isLoading ? <SpinnerIcon /> : '✨ Research & Generate Batch'}
                </button>
            </div>
            
            {error && <p className="text-center text-red-400 bg-red-900/20 p-3 rounded-lg">{error}</p>}

            {job && <BatchProgress job={job} />}
        </div>
    );
};

const BatchProgress: React.FC<{ job: BatchJob }> = ({ job }) => (
    <div className="space-y-4">
        <div className="text-center">
            <p className="font-semibold text-lg">Job Status: <span className="text-cyan-400 capitalize">{job.status.replace(/_/g, ' ')}</span></p>
            {job.status === 'PROCESSING_IMAGES' && (
                <p className="text-slate-400">{job.results.length} of {job.prompts.length} images generated.</p>
            )}
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
            {job.results.map((result, i) => (
                <div key={i} className="aspect-video bg-slate-700 rounded-lg overflow-hidden">
                    <img src={result.src} alt={result.prompt} className="w-full h-full object-cover" />
                </div>
            ))}
            {Array.from({ length: job.prompts.length - job.results.length }).map((_, i) => (
                 <div key={i} className="aspect-video bg-slate-900/50 rounded-lg flex items-center justify-center">
                     <SpinnerIcon />
                </div>
            ))}
        </div>
    </div>
);


const Input: React.FC<{ label: string; value: string; onChange: (val: string) => void; placeholder?: string }> = ({ label, value, onChange, placeholder }) => (
    <div>
        <label className="block text-sm font-medium text-slate-300 mb-1">{label}</label>
        <input type="text" value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} className="w-full p-2 bg-slate-700/50 border border-slate-600 rounded-md" />
    </div>
);

const Select: React.FC<{ label: string; value: string; onChange: (val: string) => void; options: string[] }> = ({ label, value, onChange, options }) => (
     <div>
        <label className="block text-sm font-medium text-slate-300 mb-1">{label}</label>
        <select value={value} onChange={e => onChange(e.target.value)} className="w-full p-2 bg-slate-700/50 border border-slate-600 rounded-md">
            {options.map(opt => <option key={opt} value={opt}>{opt}</option>)}
        </select>
    </div>
);


export default StockPhotoGenerator;
