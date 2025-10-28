import React, { useState, useEffect, useCallback } from 'react';
import { generateAndExtendVideo, fetchAndCreateVideoUrl, researchAndSuggestVideoThemes, VideoTheme } from '../services/geminiService';
import { SpinnerIcon } from './icons/SpinnerIcon';
import { DownloadIcon } from './icons/DownloadIcon';
import { VideoIcon } from './icons/VideoIcon';
import ImageUploader from './ImageUploader';
import { SearchIcon } from './icons/SearchIcon';
import { LightBulbIcon } from './icons/LightBulbIcon'; // Placeholder, you might need to create this

type Mode = 'manual' | 'auto';
type ResearchStage = 'idle' | 'researching' | 'selection' | 'generating' | 'complete';

const VideoGenerator: React.FC = () => {
    const [mode, setMode] = useState<Mode>('manual');
    const [apiKeySelected, setApiKeySelected] = useState(false);
    
    // Manual mode states
    const [prompt, setPrompt] = useState('');
    const [referenceImage, setReferenceImage] = useState<string | null>(null);

    // Auto mode states
    const [researchStage, setResearchStage] = useState<ResearchStage>('idle');
    const [themes, setThemes] = useState<VideoTheme[]>([]);
    
    // Shared states
    const [isLoading, setIsLoading] = useState(false);
    const [progressMessage, setProgressMessage] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [videoUrl, setVideoUrl] = useState<string | null>(null);
    
    const checkApiKey = useCallback(async () => {
        if (window.aistudio) {
            const hasKey = await window.aistudio.hasSelectedApiKey();
            setApiKeySelected(hasKey);
        }
    }, []);

    useEffect(() => {
        checkApiKey();
    }, [checkApiKey]);

    const resetState = () => {
        setIsLoading(false);
        setError(null);
        setVideoUrl(null);
        setProgressMessage('');
        setPrompt('');
        setReferenceImage(null);
        setResearchStage('idle');
        setThemes([]);
    };

    const handleModeChange = (newMode: Mode) => {
        if (isLoading) return;
        resetState();
        setMode(newMode);
    };

    const handleStartResearch = async () => {
        setResearchStage('researching');
        setIsLoading(true);
        setError(null);
        try {
            const suggestedThemes = await researchAndSuggestVideoThemes();
            setThemes(suggestedThemes);
            setResearchStage('selection');
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to research themes.');
            setResearchStage('idle');
        } finally {
            setIsLoading(false);
        }
    };
    
    const handleThemeSelection = (selectedTheme: VideoTheme) => {
        setResearchStage('generating');
        handleGenerate(selectedTheme.prompt, null); // Reference image is not part of auto-mode for simplicity
    };

    const handleGenerate = async (generationPrompt: string, refImage: string | null) => {
        if (!generationPrompt.trim() || !apiKeySelected) return;

        setIsLoading(true);
        setError(null);
        setVideoUrl(null);

        try {
            const finalOperation = await generateAndExtendVideo(generationPrompt, refImage, (message) => {
                setProgressMessage(message);
            });

            const uri = finalOperation.response?.generatedVideos?.[0]?.video?.uri;
            if (uri) {
                const url = await fetchAndCreateVideoUrl(uri);
                setVideoUrl(url);
                if (mode === 'auto') setResearchStage('complete');
            } else {
                throw new Error('Generation completed, but no video URI was found.');
            }
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : 'An unknown error occurred.';
            if (errorMessage.includes("API_KEY_INVALID") || errorMessage.includes("PERMISSION_DENIED")) {
                setError("Operation failed. Your API Key may be invalid or missing permissions. Please select a valid key.");
                setApiKeySelected(false);
            } else {
                setError(errorMessage);
            }
            if (mode === 'auto') setResearchStage('idle');
        } finally {
            setIsLoading(false);
            setProgressMessage('');
        }
    };
    
    const handleSelectKey = async () => {
        if (window.aistudio) {
            await window.aistudio.openSelectKey();
            setApiKeySelected(true);
            setError(null);
        }
    };

    const renderResult = () => {
        if (isLoading && researchStage !== 'researching') {
            return (
                <div className="flex flex-col items-center justify-center h-full text-center">
                    <SpinnerIcon />
                    <p className="text-slate-300 mt-4 text-lg font-semibold">{progressMessage}</p>
                    <p className="text-slate-400 text-sm">A 35-second video can take several minutes. Please be patient.</p>
                </div>
            );
        }

        if (videoUrl) {
            return (
                <div className="flex flex-col items-center gap-4">
                    <video src={videoUrl} controls autoPlay loop className="w-full h-auto max-h-[60vh] rounded-lg shadow-2xl bg-black" />
                    <a href={videoUrl} download={`veo-video-${Date.now()}.mp4`} className="mt-4 bg-green-600 hover:bg-green-500 text-white font-bold py-3 px-8 rounded-full transition-colors duration-300 flex items-center gap-2">
                        <DownloadIcon /> Download 35-Second Video
                    </a>
                </div>
            );
        }
        
        return (
            <div className="flex flex-col items-center justify-center h-full text-center text-slate-500">
                <VideoIcon />
                <p className="mt-4">Your final 35-second video will appear here.</p>
            </div>
        );
    };

    const renderManualMode = () => (
        <>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="bg-slate-800/50 p-6 rounded-2xl shadow-lg space-y-4">
                    <h2 className="text-2xl font-bold text-cyan-400">1. Describe the Narrative</h2>
                    <textarea value={prompt} onChange={(e) => setPrompt(e.target.value)} placeholder="e.g., 'A lone astronaut discovers a glowing crystal...'" className="w-full h-32 p-3 bg-slate-700/50 border border-slate-600 rounded-lg focus:ring-2 focus:ring-cyan-500" disabled={isLoading} />
                    <ImageUploader label="Reference Image (Optional)" onImageUpload={(base64) => setReferenceImage(base64)} initialImage={referenceImage} />
                </div>
                <div className="bg-slate-800/50 p-6 rounded-2xl shadow-lg">
                    <h2 className="text-2xl font-bold text-cyan-400 mb-6 text-center">2. View Result</h2>
                    <div className="w-full min-h-[400px] flex items-center justify-center bg-slate-900/50 rounded-lg p-4">
                        {renderResult()}
                    </div>
                </div>
            </div>
             <div className="sticky bottom-0 left-0 right-0 -mx-4 md:-mx-8 mt-8 p-4 bg-slate-900/80 backdrop-blur-sm border-t border-slate-700/50 flex justify-center">
                 <button onClick={() => handleGenerate(prompt, referenceImage)} disabled={isLoading || !prompt.trim() || !apiKeySelected} className="w-full max-w-md bg-cyan-500 hover:bg-cyan-400 disabled:bg-slate-600 text-white font-bold py-4 px-8 rounded-full text-lg shadow-lg transition-all">
                    {isLoading ? 'Directing Your Video...' : '✨ Generate 35-Second Video'}
                </button>
            </div>
        </>
    );

    const renderAutoMode = () => {
        switch (researchStage) {
            case 'idle':
                return (
                    <div className="text-center p-8 bg-slate-800/50 rounded-2xl">
                        <h2 className="text-2xl font-bold text-cyan-400 mb-2">Automated Creative Director</h2>
                        <p className="text-slate-400 mb-6 max-w-2xl mx-auto">Let AI analyze current market trends in the creative industry and suggest commercially viable video concepts for you.</p>
                        <button onClick={handleStartResearch} disabled={!apiKeySelected} className="bg-cyan-500 hover:bg-cyan-400 disabled:bg-slate-600 text-white font-bold py-3 px-8 rounded-full text-lg shadow-lg flex items-center gap-2 mx-auto">
                            <SearchIcon /> Start Market Research
                        </button>
                    </div>
                );
            case 'researching':
                 return (
                    <div className="text-center p-8 bg-slate-800/50 rounded-2xl">
                         <SpinnerIcon />
                         <p className="text-slate-300 mt-4 text-lg">Analyzing creative industry trends...</p>
                         <p className="text-slate-400 text-sm">This may take a moment.</p>
                    </div>
                 );
            case 'selection':
                return (
                     <div className="bg-slate-800/50 p-6 rounded-2xl">
                         <h2 className="text-2xl font-bold text-cyan-400 mb-4">Select a Video Theme</h2>
                         <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            {themes.map((theme, index) => (
                                <div key={index} className="bg-slate-900/50 p-4 rounded-lg flex flex-col justify-between">
                                    <div>
                                        <h3 className="font-bold text-white mb-2">{theme.title}</h3>
                                        <p className="text-sm text-slate-400 mb-4">{theme.description}</p>
                                    </div>
                                    <button onClick={() => handleThemeSelection(theme)} className="w-full bg-cyan-600 hover:bg-cyan-500 text-white font-semibold py-2 px-4 rounded-full transition-colors">
                                        Select & Generate Video
                                    </button>
                                </div>
                            ))}
                         </div>
                     </div>
                );
            case 'generating':
            case 'complete':
                 return (
                    <div className="bg-slate-800/50 p-6 rounded-2xl shadow-lg">
                        <h2 className="text-2xl font-bold text-cyan-400 mb-6 text-center">AI-Generated Video</h2>
                        <div className="w-full min-h-[400px] flex items-center justify-center bg-slate-900/50 rounded-lg p-4">
                            {renderResult()}
                        </div>
                        {videoUrl && (
                             <button onClick={resetState} className="text-cyan-400 hover:underline mt-6 mx-auto block">Start New Research</button>
                        )}
                    </div>
                 );
        }
    };

    return (
        <div className="space-y-8">
            <div className="flex justify-center bg-slate-800/50 p-1 rounded-full max-w-sm mx-auto">
                <button onClick={() => handleModeChange('manual')} className={`w-1/2 py-2 rounded-full text-sm font-semibold transition-colors ${mode === 'manual' ? 'bg-cyan-500 text-white' : 'text-slate-300 hover:bg-slate-700'}`}>Manual Mode</button>
                <button onClick={() => handleModeChange('auto')} className={`w-1/2 py-2 rounded-full text-sm font-semibold transition-colors ${mode === 'auto' ? 'bg-cyan-500 text-white' : 'text-slate-300 hover:bg-slate-700'}`}>Automated Mode</button>
            </div>
            
            {error && <div className="bg-red-900/20 p-4 rounded-lg text-center text-red-400">{error}</div>}

            {!apiKeySelected && (
                <div className="bg-amber-900/20 p-4 rounded-lg text-center text-amber-300">
                    <p className="font-semibold">Action Required: Select API Key</p>
                    <p className="text-sm mb-3">Video generation with Veo requires a Google Cloud API key for billing. Please select your key to continue.</p>
                     <a href="https://ai.google.dev/gemini-api/docs/billing" target="_blank" rel="noopener noreferrer" className="text-cyan-400 hover:underline text-sm mr-4">Learn about billing</a>
                     <button onClick={handleSelectKey} className="bg-amber-500 hover:bg-amber-400 text-white font-bold py-2 px-4 rounded-full text-sm">Select API Key</button>
                </div>
            )}
            
            {mode === 'manual' ? renderManualMode() : renderAutoMode()}
        </div>
    );
};

export default VideoGenerator;
