import React, { useState } from 'react';
import { generateStockImage, researchAndSuggestPhotoThemes } from '../services/geminiService';
import type { VideoTheme as PhotoTheme } from '../services/geminiService'; // Reusing the type
import { SpinnerIcon } from './icons/SpinnerIcon';
import { DownloadIcon } from './icons/DownloadIcon';
import { PhotoIcon } from './icons/PhotoIcon';
import { SearchIcon } from './icons/SearchIcon';

type Mode = 'manual' | 'auto';
type ResearchStage = 'idle' | 'researching' | 'selection';

const StockPhotoGenerator: React.FC = () => {
    const [mode, setMode] = useState<Mode>('manual');
    
    // Manual mode states
    const [prompt, setPrompt] = useState('');
    const [aspectRatio, setAspectRatio] = useState('16:9');

    // Auto mode states
    const [topic, setTopic] = useState('');
    const [researchStage, setResearchStage] = useState<ResearchStage>('idle');
    const [themes, setThemes] = useState<PhotoTheme[]>([]);
    
    // Shared states
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [imageUrl, setImageUrl] = useState<string | null>(null);

    const resetStateForModeChange = () => {
        setIsLoading(false);
        setError(null);
        setImageUrl(null);
        setPrompt('');
        setTopic('');
        setResearchStage('idle');
        setThemes([]);
    };

    const handleModeChange = (newMode: Mode) => {
        if (isLoading) return;
        resetStateForModeChange();
        setMode(newMode);
    };

    const handleStartResearch = async () => {
        if (!topic.trim()) {
            setError("Please enter a topic to research.");
            return;
        }
        setResearchStage('researching');
        setIsLoading(true);
        setError(null);
        setThemes([]);
        try {
            const suggestedThemes = await researchAndSuggestPhotoThemes(topic);
            setThemes(suggestedThemes);
            setResearchStage('selection');
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to research themes.');
            setResearchStage('idle');
        } finally {
            setIsLoading(false);
        }
    };
    
    const handleThemeSelection = (selectedTheme: PhotoTheme) => {
        setPrompt(selectedTheme.prompt);
        // Switch to manual mode to show the prompt and allow generation
        setMode('manual');
        setResearchStage('idle');
        // Clear auto-mode state
        setTopic('');
        setThemes([]);
    };

    const handleGenerate = async () => {
        if (!prompt.trim()) {
            setError("Please enter a prompt.");
            return;
        }

        setIsLoading(true);
        setError(null);
        setImageUrl(null);

        try {
            // Using a hardcoded aspect ratio for now, but this could be a user setting.
            const url = await generateStockImage(prompt, aspectRatio);
            setImageUrl(url);
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : 'An unknown error occurred.';
            setError(errorMessage);
        } finally {
            setIsLoading(false);
        }
    };

    const renderResult = () => {
        if (isLoading && researchStage !== 'researching') {
            return (
                <div className="flex flex-col items-center justify-center h-full text-center">
                    <SpinnerIcon />
                    <p className="text-slate-300 mt-4 text-lg font-semibold">Directing your photoshoot...</p>
                    <p className="text-slate-400 text-sm">High-quality images take a moment to generate.</p>
                </div>
            );
        }

        if (error) {
            return (
                 <div className="flex flex-col items-center justify-center h-full text-center bg-red-900/20 p-4 rounded-lg">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <p className="text-red-400 mt-4 font-semibold">An Error Occurred</p>
                    <p className="text-slate-300 mt-2 text-sm break-words">{error}</p>
                </div>
            );
        }

        if (imageUrl) {
            return (
                <div className="flex flex-col items-center gap-4">
                    <img src={imageUrl} alt={prompt} className="w-full h-auto max-h-[60vh] object-contain rounded-lg shadow-2xl bg-black" />
                    <a href={imageUrl} download={`stock-photo-${Date.now()}.png`} className="mt-4 bg-green-600 hover:bg-green-500 text-white font-bold py-3 px-8 rounded-full transition-colors duration-300 flex items-center gap-2">
                        <DownloadIcon /> Download Image
                    </a>
                </div>
            );
        }
        
        return (
            <div className="flex flex-col items-center justify-center h-full text-center text-slate-500">
                <PhotoIcon />
                <p className="mt-4">Your generated stock photo will appear here.</p>
            </div>
        );
    };

    const renderManualMode = () => (
        <>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="bg-slate-800/50 p-6 rounded-2xl shadow-lg space-y-4">
                    <h2 className="text-2xl font-bold text-cyan-400">1. Direct the Photoshoot</h2>
                    <textarea value={prompt} onChange={(e) => setPrompt(e.target.value)} placeholder="e.g., 'A minimalist workspace with a laptop, a cup of coffee, and a plant, top-down view, cinematic lighting...'" className="w-full h-48 p-3 bg-slate-700/50 border border-slate-600 rounded-lg focus:ring-2 focus:ring-cyan-500" disabled={isLoading} />
                    <div>
                        <label htmlFor="aspectRatio" className="block text-slate-300 font-semibold mb-2">Aspect Ratio:</label>
                        <select id="aspectRatio" value={aspectRatio} onChange={e => setAspectRatio(e.target.value)} className="w-full p-2 bg-slate-700/50 border border-slate-600 rounded-lg" disabled={isLoading}>
                            <option value="16:9">16:9 (Landscape)</option>
                            <option value="9:16">9:16 (Portrait)</option>
                            <option value="1:1">1:1 (Square)</option>
                            <option value="4:3">4:3 (Standard)</option>
                            <option value="3:4">3:4 (Standard Portrait)</option>
                        </select>
                    </div>
                </div>
                <div className="bg-slate-800/50 p-6 rounded-2xl shadow-lg">
                    <h2 className="text-2xl font-bold text-cyan-400 mb-6 text-center">2. View Result</h2>
                    <div className="w-full min-h-[400px] flex items-center justify-center bg-slate-900/50 rounded-lg p-4">
                        {renderResult()}
                    </div>
                </div>
            </div>
             <div className="sticky bottom-0 left-0 right-0 -mx-4 md:-mx-8 mt-8 p-4 bg-slate-900/80 backdrop-blur-sm border-t border-slate-700/50 flex justify-center">
                 <button onClick={handleGenerate} disabled={isLoading || !prompt.trim()} className="w-full max-w-md bg-cyan-500 hover:bg-cyan-400 disabled:bg-slate-600 text-white font-bold py-4 px-8 rounded-full text-lg shadow-lg transition-all">
                    {isLoading ? 'Generating Image...' : '✨ Generate Stock Photo'}
                </button>
            </div>
        </>
    );

    const renderAutoMode = () => {
        switch (researchStage) {
            case 'idle':
                return (
                    <div className="text-center p-8 bg-slate-800/50 rounded-2xl space-y-4">
                        <h2 className="text-2xl font-bold text-cyan-400">Automated Art Director</h2>
                        <p className="text-slate-400 max-w-2xl mx-auto">Provide a topic, and the AI will research visual trends and suggest commercially viable photo concepts for you to generate.</p>
                        <div className="max-w-xl mx-auto">
                             <label htmlFor="topic" className="sr-only">Topic</label>
                            <input type="text" id="topic" value={topic} onChange={e => setTopic(e.target.value)} placeholder="e.g., 'The future of renewable energy'" className="w-full p-3 bg-slate-700/50 border border-slate-600 rounded-full focus:ring-2 focus:ring-cyan-500" disabled={isLoading} />
                        </div>
                        <button onClick={handleStartResearch} disabled={isLoading || !topic.trim()} className="bg-cyan-500 hover:bg-cyan-400 disabled:bg-slate-600 text-white font-bold py-3 px-8 rounded-full text-lg shadow-lg flex items-center gap-2 mx-auto">
                            <SearchIcon /> Research Photo Concepts
                        </button>
                    </div>
                );
            case 'researching':
                 return (
                    <div className="text-center p-8 bg-slate-800/50 rounded-2xl">
                         <SpinnerIcon />
                         <p className="text-slate-300 mt-4 text-lg">Researching visual trends...</p>
                         <p className="text-slate-400 text-sm">This may take a moment.</p>
                    </div>
                 );
            case 'selection':
                return (
                     <div className="bg-slate-800/50 p-6 rounded-2xl">
                         <h2 className="text-2xl font-bold text-cyan-400 mb-4">Select a Photo Concept</h2>
                         <p className="text-slate-400 mb-6">Choose a concept to load its detailed prompt into the Manual Mode for generation.</p>
                         <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {themes.map((theme, index) => (
                                <div key={index} className="bg-slate-900/50 p-4 rounded-lg flex flex-col justify-between">
                                    <div>
                                        <h3 className="font-bold text-white mb-2">{theme.title}</h3>
                                        <p className="text-sm text-slate-400 mb-4">{theme.description}</p>
                                    </div>
                                    <button onClick={() => handleThemeSelection(theme)} className="w-full mt-auto bg-cyan-600 hover:bg-cyan-500 text-white font-semibold py-2 px-4 rounded-full transition-colors">
                                        Use This Concept
                                    </button>
                                </div>
                            ))}
                         </div>
                     </div>
                );
        }
    };

    return (
        <div className="space-y-8">
            <div className="flex justify-center bg-slate-800/50 p-1 rounded-full max-w-sm mx-auto">
                <button onClick={() => handleModeChange('manual')} className={`w-1/2 py-2 rounded-full text-sm font-semibold transition-colors ${mode === 'manual' ? 'bg-cyan-500 text-white' : 'text-slate-300 hover:bg-slate-700'}`}>Manual Direction</button>
                <button onClick={() => handleModeChange('auto')} className={`w-1/2 py-2 rounded-full text-sm font-semibold transition-colors ${mode === 'auto' ? 'bg-cyan-500 text-white' : 'text-slate-300 hover:bg-slate-700'}`}>Automated Research</button>
            </div>
            
            {error && mode === 'manual' && <div className="bg-red-900/20 p-4 rounded-lg text-center text-red-400">{error}</div>}
            
            {mode === 'manual' ? renderManualMode() : renderAutoMode()}
        </div>
    );
};

export default StockPhotoGenerator;
