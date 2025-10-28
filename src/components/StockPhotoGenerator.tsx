import React, { useState, useCallback } from 'react';
import type { AssetMetadata } from '../services/geminiService';
import { startAutomatedPhotoBatch, generatePhotoConcepts, generateStockImage } from '../services/geminiService';
import { SpinnerIcon } from './icons/SpinnerIcon';
import { DownloadIcon } from './icons/DownloadIcon';
import { PhotoIcon } from './icons/PhotoIcon';
import { SearchIcon } from './icons/SearchIcon';
import { ArtDirectorIcon } from './icons/ArtDirectorIcon';
import JSZip from 'jszip';

type Mode = 'manual' | 'auto';
type ManualStage = 'idea' | 'concept' | 'photoshoot' | 'package';
type AutoStage = 'idle' | 'processing' | 'complete';

interface GeneratedImage {
    src: string;
    prompt: string;
    metadata: AssetMetadata;
}

const StockPhotoGenerator: React.FC = () => {
    const [mode, setMode] = useState<Mode>('manual');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [generatedImages, setGeneratedImages] = useState<GeneratedImage[]>([]);

    // Manual Mode States
    const [manualStage, setManualStage] = useState<ManualStage>('idea');
    const [topic, setTopic] = useState('');
    const [style, setStyle] = useState('Cinematic');
    const [palette, setPalette] = useState('');
    const [angle, setAngle] = useState('Eye-Level Shot');
    const [concepts, setConcepts] = useState<string[]>([]);
    const [selectedConcept, setSelectedConcept] = useState<string | null>(null);

    // Auto Mode States
    const [autoStage, setAutoStage] = useState<AutoStage>('idle');
    const [progressMessage, setProgressMessage] = useState('');

    const resetState = () => {
        setIsLoading(false);
        setError(null);
        setGeneratedImages([]);
        setManualStage('idea');
        setTopic('');
        setPalette('');
        setConcepts([]);
        setSelectedConcept(null);
        setAutoStage('idle');
        setProgressMessage('');
    };

    const handleModeChange = (newMode: Mode) => {
        if (isLoading) return;
        resetState();
        setMode(newMode);
    };

    // --- MANUAL MODE LOGIC ---
    const handleGetConcepts = async () => {
        if (!topic.trim()) { setError("Please provide a topic."); return; }
        setIsLoading(true); setError(null);
        try {
            const result = await generatePhotoConcepts({ topic, style, palette, angle });
            setConcepts(result);
            setManualStage('concept');
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to generate concepts.');
        } finally {
            setIsLoading(false);
        }
    };

    const handleStartPhotoshoot = async (concept: string) => {
        setSelectedConcept(concept);
        setManualStage('photoshoot');
        setIsLoading(true);
        setError(null);
        setGeneratedImages([]);
        try {
            const variations = 3;
            const imagePromises = Array.from({ length: variations }).map(() =>
                generateStockImage(concept, '16:9', true)
            );
            const results = await Promise.all(imagePromises);
            setGeneratedImages(results);
            setManualStage('package');
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to generate images.');
            setManualStage('concept'); // Go back to concept selection on failure
        } finally {
            setIsLoading(false);
        }
    };

    // --- AUTOMATED MODE LOGIC ---
    const handleStartAutomatedProduction = async () => {
        setAutoStage('processing');
        setIsLoading(true);
        setError(null);
        setGeneratedImages([]);
        try {
            await startAutomatedPhotoBatch((progress) => {
                setProgressMessage(progress.message);
                if (progress.images) {
                    setGeneratedImages(progress.images);
                }
            });
            setAutoStage('complete');
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Automated production failed.');
            setAutoStage('idle');
        } finally {
            setIsLoading(false);
        }
    };

    // --- SHARED LOGIC ---
    const handleDownloadPackage = async () => {
        const zip = new JSZip();
        const metadataCsvRows = ['"filename","title","description","tags","prompt"'];
        
        for (let i = 0; i < generatedImages.length; i++) {
            const image = generatedImages[i];
            const response = await fetch(image.src);
            const blob = await response.blob();
            const filename = `photo_${i + 1}.png`;
            zip.file(filename, blob);
            
            const { title, description, tags } = image.metadata;
            const csvRow = `"${filename}","${title}","${description}","${tags.join(', ')}","${image.prompt}"`;
            metadataCsvRows.push(csvRow);
        }

        zip.file("metadata.csv", metadataCsvRows.join('\n'));
        const content = await zip.generateAsync({ type: 'blob' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(content);
        link.download = `AI-Photo-Package-${Date.now()}.zip`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const renderArtDirectorMode = () => (
        <div className="space-y-6">
            {manualStage === 'idea' && (
                <div className="bg-slate-800/50 p-6 rounded-2xl shadow-lg space-y-4">
                    <h3 className="text-xl font-bold text-slate-200">1. Set Art Direction</h3>
                    <p className="text-sm text-slate-400">Provide a topic and define the aesthetic for the photoshoot.</p>
                    <textarea value={topic} onChange={e => setTopic(e.target.value)} placeholder="e.g., 'Team collaboration in a modern office'" className="w-full h-24 p-3 bg-slate-700/50 border border-slate-600 rounded-lg"/>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <select value={style} onChange={e => setStyle(e.target.value)} className="w-full p-2 bg-slate-700 border border-slate-600 rounded-lg"><option>Cinematic</option><option>Minimalist</option><option>Vintage</option><option>Macro</option><option>Drone</option><option>Product</option></select>
                        <input type="text" value={palette} onChange={e => setPalette(e.target.value)} placeholder="Color Palette (e.g., 'Warm autumn tones')" className="w-full p-2 bg-slate-700 border border-slate-600 rounded-lg"/>
                        <select value={angle} onChange={e => setAngle(e.target.value)} className="w-full p-2 bg-slate-700 border border-slate-600 rounded-lg"><option>Eye-Level Shot</option><option>Low-Angle Shot</option><option>Top-Down Flat Lay</option></select>
                    </div>
                     <button onClick={handleGetConcepts} disabled={isLoading || !topic.trim()} className="w-full bg-cyan-500 hover:bg-cyan-400 disabled:bg-slate-600 text-white font-bold py-3 px-6 rounded-full flex items-center justify-center gap-2">
                        {isLoading ? <SpinnerIcon /> : <><SearchIcon /> Generate Concepts</>}
                    </button>
                </div>
            )}
            {manualStage === 'concept' && (
                <div className="bg-slate-800/50 p-6 rounded-2xl">
                    <h3 className="text-xl font-bold text-slate-200">2. Select a Concept</h3>
                    <p className="text-sm text-slate-400 mb-4">Choose one concept to proceed to a photoshoot.</p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {concepts.map((concept, i) => (
                            <div key={i} className="bg-slate-900/50 p-4 rounded-lg flex flex-col justify-between">
                                <p className="text-sm text-slate-300 mb-4">{concept}</p>
                                <button onClick={() => handleStartPhotoshoot(concept)} className="w-full bg-cyan-600 hover:bg-cyan-500 text-white font-semibold py-2 px-4 rounded-full">
                                    Start Photoshoot
                                </button>
                            </div>
                        ))}
                    </div>
                </div>
            )}
            {(manualStage === 'photoshoot' || manualStage === 'package') && (
                <div className="bg-slate-800/50 p-6 rounded-2xl">
                    <h3 className="text-xl font-bold text-slate-200">
                        {manualStage === 'photoshoot' ? '3. Photoshoot in Progress...' : '3. Photoshoot Complete!'}
                    </h3>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4">
                        {isLoading && Array.from({ length: 3 }).map((_, i) => (
                             <div key={i} className="aspect-video bg-slate-900/50 rounded-lg flex items-center justify-center"><SpinnerIcon /></div>
                        ))}
                        {generatedImages.map((img, i) => (
                            <img key={i} src={img.src} alt={img.prompt} className="w-full h-full object-cover rounded-lg"/>
                        ))}
                    </div>
                    {manualStage === 'package' && (
                         <div className="text-center mt-6">
                            <button onClick={handleDownloadPackage} className="bg-green-600 hover:bg-green-500 text-white font-bold py-3 px-8 rounded-full flex items-center gap-2 mx-auto">
                                <DownloadIcon /> Download Package
                            </button>
                        </div>
                    )}
                </div>
            )}
        </div>
    );

    const renderAutomatedMode = () => (
         <div className="bg-slate-800/50 p-6 rounded-2xl shadow-lg text-center">
            {autoStage === 'idle' && (
                <div className="space-y-4">
                    <h3 className="text-xl font-bold text-slate-200">Fully Automated Art Director</h3>
                    <p className="text-sm text-slate-400 max-w-lg mx-auto">Let the AI act as your personal Art Director. It will research trending visual concepts, direct a photoshoot, and deliver a complete, commercially-viable photo package with a single click.</p>
                     <p className="text-xs text-slate-500">Powered by Gemini 2.5 Pro and Imagen 4.0</p>
                    <button onClick={handleStartAutomatedProduction} className="bg-cyan-500 hover:bg-cyan-400 text-white font-bold py-4 px-8 rounded-full text-lg shadow-lg flex items-center gap-2 mx-auto">
                        <ArtDirectorIcon /> Generate Trending Photo Batch
                    </button>
                </div>
            )}
            {(autoStage === 'processing' || autoStage === 'complete') && (
                <div className="space-y-4">
                    <h3 className="text-xl font-bold text-slate-200">{autoStage === 'processing' ? 'Production in Progress' : 'Production Complete!'}</h3>
                     <p className="text-sm text-cyan-400 font-mono h-6">{progressMessage}</p>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4 min-h-[150px]">
                         {isLoading && !generatedImages.length && Array.from({ length: 4 }).map((_, i) => (
                             <div key={i} className="aspect-video bg-slate-900/50 rounded-lg flex items-center justify-center"><SpinnerIcon /></div>
                         ))}
                         {generatedImages.map((img, i) => (
                            <img key={i} src={img.src} alt={img.prompt} className="w-full h-full object-cover rounded-lg"/>
                        ))}
                    </div>
                    {autoStage === 'complete' && (
                         <div className="flex flex-col items-center gap-4 mt-6">
                            <button onClick={handleDownloadPackage} className="bg-green-600 hover:bg-green-500 text-white font-bold py-3 px-8 rounded-full flex items-center gap-2 mx-auto">
                                <DownloadIcon /> Download Full Package
                            </button>
                             <button onClick={resetState} className="text-slate-400 hover:text-cyan-400 text-sm">Start a New Batch</button>
                         </div>
                    )}
                </div>
            )}
        </div>
    );

    return (
        <div className="space-y-8">
            <div className="flex justify-center bg-slate-800/50 p-1 rounded-full max-w-sm mx-auto">
                <button onClick={() => handleModeChange('manual')} className={`w-1/2 py-2 rounded-full text-sm font-semibold transition-colors ${mode === 'manual' ? 'bg-cyan-500 text-white' : 'text-slate-300 hover:bg-slate-700'}`}>Art Director Mode</button>
                <button onClick={() => handleModeChange('auto')} className={`w-1/2 py-2 rounded-full text-sm font-semibold transition-colors ${mode === 'auto' ? 'bg-cyan-500 text-white' : 'text-slate-300 hover:bg-slate-700'}`}>Automated Mode</button>
            </div>
            
            {error && <div className="bg-red-900/20 p-4 rounded-lg text-center text-red-400">{error}</div>}
            
            {mode === 'manual' ? renderArtDirectorMode() : renderAutomatedMode()}
        </div>
    );
};

export default StockPhotoGenerator;
