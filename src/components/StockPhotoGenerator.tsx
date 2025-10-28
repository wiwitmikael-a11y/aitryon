import React, { useState, useCallback } from 'react';
import { 
    generatePhotoConcepts, 
    generateStockImage, 
    generateMetadataForAsset,
    researchAndGeneratePhotoBatch
} from '../services/geminiService';
import type { AssetMetadata } from '../services/geminiService';

import { SpinnerIcon } from './icons/SpinnerIcon';
import { DownloadIcon } from './icons/DownloadIcon';
import { ArtDirectorIcon } from './icons/ArtDirectorIcon';
import { SearchIcon } from './icons/SearchIcon';

interface GeneratedImage {
    id: string;
    prompt: string;
    src: string;
    metadata?: AssetMetadata;
    conceptGroup: string;
}

type Mode = 'director' | 'auto';
type AutoStage = 'idle' | 'researching' | 'concepting' | 'shooting' | 'metadata' | 'complete';

const photographyStyles = ['Cinematic', 'Minimalist', 'Vintage / Retro', 'Macro / Close-Up', 'Drone / Aerial View', 'Product Photography', 'Photorealistic'];
const cameraAngles = ['Eye-Level Shot', 'Low-Angle Shot', 'High-Angle Shot', 'Top-Down Flat Lay', 'Dutch Angle'];

const StockPhotoGenerator: React.FC = () => {
    const [mode, setMode] = useState<Mode>('director');
    
    // Director Mode State
    const [topic, setTopic] = useState('');
    const [style, setStyle] = useState(photographyStyles[0]);
    const [palette, setPalette] = useState('');
    const [angle, setAngle] = useState(cameraAngles[0]);
    const [concepts, setConcepts] = useState<string[]>([]);
    const [selectedConcept, setSelectedConcept] = useState<string | null>(null);
    
    // Auto Mode State
    const [autoTopic, setAutoTopic] = useState('');
    const [autoStage, setAutoStage] = useState<AutoStage>('idle');
    const [progressMessage, setProgressMessage] = useState('');

    // Shared State
    const [images, setImages] = useState<GeneratedImage[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const resetState = () => {
        setTopic('');
        setStyle(photographyStyles[0]);
        setPalette('');
        setAngle(cameraAngles[0]);
        setConcepts([]);
        setSelectedConcept(null);
        setAutoTopic('');
        setAutoStage('idle');
        setProgressMessage('');
        setImages([]);
        setIsLoading(false);
        setError(null);
    };

    const handleModeChange = (newMode: Mode) => {
        if (isLoading) return;
        resetState();
        setMode(newMode);
    };

    // --- Director Mode Functions ---
    const handleGenerateConcepts = useCallback(async () => {
        if (!topic.trim()) {
            setError('Please enter a topic.');
            return;
        }
        setIsLoading(true);
        setError(null);
        setConcepts([]);
        setSelectedConcept(null);
        setImages([]);

        try {
            const generatedConcepts = await generatePhotoConcepts(topic, style, palette, angle);
            setConcepts(generatedConcepts);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to generate concepts.');
        } finally {
            setIsLoading(false);
        }
    }, [topic, style, palette, angle]);

    const handleStartPhotoshoot = useCallback(async () => {
        if (!selectedConcept) return;

        setIsLoading(true);
        setError(null);
        setImages([]);

        try {
            // Generate 3 variations for the selected concept
            const variations = Array.from({ length: 3 });
            const imagePromises = variations.map((_, i) => 
                generateStockImage(selectedConcept, `variation ${i+1}`).then(async (src) => {
                    const metadata = await generateMetadataForAsset(selectedConcept, 'photo');
                    return { id: `img-${i}`, prompt: selectedConcept, src, metadata, conceptGroup: 'Photoshoot' };
                })
            );

            const results = await Promise.allSettled(imagePromises);
            const successfulImages = results
                .filter(res => res.status === 'fulfilled')
                .map(res => (res as PromiseFulfilledResult<GeneratedImage>).value);
            
            setImages(successfulImages);

            if (successfulImages.length < variations.length) {
                setError('Some image variations could not be generated.');
            }

        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to generate image variations.');
        } finally {
            setIsLoading(false);
        }
    }, [selectedConcept]);


    // --- Automated Mode Functions ---
    const handleStartAutomatedProduction = async () => {
        if (!autoTopic.trim()) {
            setError('Please enter a topic.');
            return;
        }
        resetState(); // Clear everything except the autoTopic and mode
        setAutoTopic(autoTopic);
        setMode('auto');
        setIsLoading(true);

        try {
            const generatedAssets = await researchAndGeneratePhotoBatch(autoTopic, (stage, message) => {
                setAutoStage(stage);
                setProgressMessage(message);
            });
            setImages(generatedAssets);
            setAutoStage('complete');
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Automated production failed.');
            setAutoStage('idle');
        } finally {
            setIsLoading(false);
        }
    }


    // --- Shared Functions ---
    const handleDownload = (src: string, prompt: string) => {
        const link = document.createElement('a');
        link.href = src;
        const shortPrompt = prompt.split(' ').slice(0, 5).join('-').replace(/[^a-zA-Z0-9-]/g, '');
        link.download = `stock-photo-${shortPrompt}.png`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    // --- Render Functions ---

    const renderImageResults = () => (
        <div className="bg-slate-800/50 p-6 rounded-2xl shadow-lg">
            <h2 className="text-2xl font-bold text-cyan-400 mb-4">
                {mode === 'director' ? '3. Photoshoot Results' : 'Production Complete!'}
            </h2>
            {isLoading && autoStage !== 'complete' ? (
                 <div className="flex justify-center items-center py-8"><SpinnerIcon /></div>
            ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {images.map((img) => (
                        <div key={img.id} className="group relative aspect-square bg-slate-900 rounded-lg overflow-hidden shadow-md">
                            <img src={img.src} alt={img.prompt} className="w-full h-full object-cover"/>
                            <div className="absolute inset-0 bg-black/70 opacity-0 group-hover:opacity-100 transition-opacity p-3 flex flex-col justify-between">
                                <div>
                                    <p className="text-xs font-bold text-cyan-400 mb-1">{img.metadata?.title}</p>
                                    <p className="text-xs text-slate-300 mb-2 overflow-hidden max-h-16">{img.metadata?.description}</p>
                                </div>
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
            {mode === 'auto' && autoStage === 'complete' && (
                 <button onClick={resetState} className="text-cyan-400 hover:underline mt-6 mx-auto block">Start New Research</button>
            )}
        </div>
    );

    const renderDirectorMode = () => (
        <div className="space-y-8">
            {/* Step 1: Art Direction */}
            <div className="bg-slate-800/50 p-6 rounded-2xl shadow-lg">
                <h2 className="text-2xl font-bold text-cyan-400 mb-4">1. Provide Art Direction</h2>
                <p className="text-slate-400 mb-4 text-sm">Your direction will be combined with advanced prompts to generate images using Imagen's highest quality model, aiming for the quality of a professional photographer or artisan.</p>
                <div className="space-y-4">
                     <textarea value={topic} onChange={(e) => setTopic(e.target.value)} placeholder="e.g., 'A developer focused on their code at night'" className="w-full h-20 p-3 bg-slate-700/50 border border-slate-600 rounded-lg" disabled={isLoading} />
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <select value={style} onChange={e => setStyle(e.target.value)} className="p-2 bg-slate-700/50 border border-slate-600 rounded-lg">
                            {photographyStyles.map(s => <option key={s}>{s}</option>)}
                        </select>
                         <input type="text" value={palette} onChange={e => setPalette(e.target.value)} placeholder="Color Palette (e.g., 'warm autumn tones')" className="p-2 bg-slate-700/50 border border-slate-600 rounded-lg" />
                         <select value={angle} onChange={e => setAngle(e.target.value)} className="p-2 bg-slate-700/50 border border-slate-600 rounded-lg">
                            {cameraAngles.map(a => <option key={a}>{a}</option>)}
                        </select>
                    </div>
                </div>
                <button onClick={handleGenerateConcepts} disabled={isLoading || !topic.trim()} className="mt-6 w-full max-w-xs mx-auto flex items-center justify-center bg-cyan-500 hover:bg-cyan-400 disabled:bg-slate-600 text-white font-bold py-3 px-6 rounded-full text-lg">
                    {isLoading ? <SpinnerIcon /> : 'Generate Concepts'}
                </button>
            </div>

            {/* Step 2: Select Concept */}
            {(isLoading || concepts.length > 0) && (
                <div className="bg-slate-800/50 p-6 rounded-2xl shadow-lg">
                    <h2 className="text-2xl font-bold text-cyan-400 mb-4">2. Select a Concept</h2>
                    {isLoading && concepts.length === 0 ? (
                         <div className="flex justify-center py-8"><SpinnerIcon /></div>
                    ) : (
                        <div className="space-y-3">
                            {concepts.map((p, i) => (
                                <button key={i} onClick={() => setSelectedConcept(p)} disabled={isLoading} className={`w-full text-left p-3 border rounded-md text-sm transition-colors ${selectedConcept === p ? 'bg-cyan-900/50 border-cyan-500' : 'bg-slate-700/50 border-slate-700 hover:bg-slate-700'}`}>
                                    {p}
                                </button>
                            ))}
                        </div>
                    )}
                    {selectedConcept && (
                         <button onClick={handleStartPhotoshoot} disabled={isLoading} className="mt-6 w-full max-w-xs mx-auto flex items-center justify-center bg-green-600 hover:bg-green-500 disabled:bg-slate-600 text-white font-bold py-3 px-6 rounded-full text-lg">
                             {isLoading ? <SpinnerIcon /> : 'Start Photoshoot'}
                        </button>
                    )}
                </div>
            )}
            
            {(isLoading && images.length === 0 && selectedConcept) || images.length > 0 ? renderImageResults() : null}
        </div>
    );

    const renderAutomatedMode = () => (
        <div className="space-y-8">
            {autoStage === 'idle' && (
                <div className="bg-slate-800/50 p-6 rounded-2xl shadow-lg">
                    <h2 className="text-2xl font-bold text-cyan-400 mb-4">Automated Production</h2>
                     <p className="text-slate-400 mb-4">Enter a high-level topic. The AI will perform deep research, develop multiple concepts, and generate a complete batch of professional stock photos aiming for the highest artistic and photorealistic quality.</p>
                     <textarea value={autoTopic} onChange={(e) => setAutoTopic(e.target.value)} placeholder="e.g., 'The future of sustainable energy', 'Global financial markets', 'AI in healthcare'" className="w-full h-24 p-3 bg-slate-700/50 border border-slate-600 rounded-lg" />
                     <button onClick={handleStartAutomatedProduction} disabled={!autoTopic.trim()} className="mt-4 w-full max-w-sm mx-auto flex items-center justify-center bg-cyan-500 hover:bg-cyan-400 disabled:bg-slate-600 text-white font-bold py-3 px-6 rounded-full text-lg">
                         <SearchIcon /> <span className="ml-2">Start Research & Production</span>
                    </button>
                </div>
            )}

            {autoStage !== 'idle' && autoStage !== 'complete' && (
                <div className="bg-slate-800/50 p-6 rounded-2xl shadow-lg text-center">
                    <SpinnerIcon />
                    <h2 className="text-xl font-semibold text-white mt-4">{progressMessage}</h2>
                    <p className="text-slate-400">AI is working... This may take a few moments.</p>
                </div>
            )}
             
            {autoStage === 'complete' && renderImageResults()}
        </div>
    );

    return (
        <div className="space-y-8">
             <div className="flex justify-center bg-slate-800/50 p-1 rounded-full max-w-sm mx-auto">
                <button onClick={() => handleModeChange('director')} className={`w-1/2 py-2 rounded-full text-sm font-semibold transition-colors flex items-center justify-center gap-2 ${mode === 'director' ? 'bg-cyan-500 text-white' : 'text-slate-300 hover:bg-slate-700'}`}>
                    <ArtDirectorIcon /> Art Director
                </button>
                <button onClick={() => handleModeChange('auto')} className={`w-1/2 py-2 rounded-full text-sm font-semibold transition-colors ${mode === 'auto' ? 'bg-cyan-500 text-white' : 'text-slate-300 hover:bg-slate-700'}`}>Automated</button>
            </div>
            {error && <div className="bg-red-900/20 p-4 rounded-lg text-center text-red-400">{error}</div>}

            {mode === 'director' ? renderDirectorMode() : renderAutomatedMode()}
        </div>
    );
};

export default StockPhotoGenerator;