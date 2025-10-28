import React, { useState, useEffect, useRef } from 'react';
import { generateVideo, checkVideoOperationStatus, fetchAndCreateVideoUrl, generateCreativePrompt } from '../services/geminiService';
import { SpinnerIcon } from './icons/SpinnerIcon';
import { VideoIcon } from './icons/VideoIcon';
import { VideoGeneratorIcon } from './icons/VideoGeneratorIcon';

const POLLING_INTERVAL = 10000; // 10 seconds

const VideoGenerator: React.FC = () => {
    const [aspectRatio, setAspectRatio] = useState<'16:9' | '9:16'>('16:9');
    const [videoSrc, setVideoSrc] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [loadingMessage, setLoadingMessage] = useState('Starting video generation...');
    const [error, setError] = useState<string | null>(null);
    const [operationName, setOperationName] = useState<string | null>(null);
    const [aiPrompt, setAiPrompt] = useState('');
    const pollingRef = useRef<number | null>(null);

    const loadingMessages = [
        "AI is writing a cinematic script...",
        "Syncing with the cinematic universe...",
        "Teaching AI about the rule of thirds...",
        "Rendering pixel-perfect popcorn...",
        "This is taking a bit longer than expected. Hang tight!",
        "Finalizing the director's cut...",
    ];

    useEffect(() => {
        let messageInterval: number;
        if (isLoading) {
            let i = 0;
            setLoadingMessage(loadingMessages[0]);
            messageInterval = window.setInterval(() => {
                i = (i + 1) % loadingMessages.length;
                setLoadingMessage(loadingMessages[i]);
            }, 5000);
        }
        return () => {
            if (messageInterval) clearInterval(messageInterval);
        };
    }, [isLoading]);


    const pollStatus = async (opName: string) => {
        try {
            const operation = await checkVideoOperationStatus(opName);
            if (operation.done) {
                if (pollingRef.current) clearInterval(pollingRef.current);
                setOperationName(null);
                
                if (operation.error) {
                    throw new Error(operation.error.message || 'Operation failed in backend.');
                }
                const uri = operation.response?.generatedVideos?.[0]?.video?.uri;
                if (!uri) throw new Error("Video URI not found in operation response.");

                setLoadingMessage("Fetching final video...");
                const src = await fetchAndCreateVideoUrl(uri);
                setVideoSrc(src);
                setIsLoading(false);
            }
        } catch (err) {
            if (pollingRef.current) clearInterval(pollingRef.current);
            setOperationName(null);
            setIsLoading(false);
            const errorMessage = err instanceof Error ? err.message : 'Failed to poll for video status.';
            setError(errorMessage);
        }
    };
    
    useEffect(() => {
        if (operationName) {
            pollingRef.current = window.setInterval(() => {
                pollStatus(operationName)
            }, POLLING_INTERVAL);
        }
        return () => {
            if (pollingRef.current) clearInterval(pollingRef.current);
        };
    }, [operationName]);

    const handleGenerate = async () => {
        setIsLoading(true);
        setError(null);
        setVideoSrc(null);
        setAiPrompt('');
        if (pollingRef.current) clearInterval(pollingRef.current);

        try {
            setLoadingMessage("AI is brainstorming a cinematic scene...");
            const { prompt } = await generateCreativePrompt('video');
            setAiPrompt(prompt);
            setLoadingMessage("Directing and rendering the scene... This may take a few minutes.");

            const operation = await generateVideo(prompt, aspectRatio);
            if (!operation.name) throw new Error("Video operation name not found.");
            
            setOperationName(operation.name);
            
        } catch (err) {
            setIsLoading(false);
            const errorMessage = err instanceof Error ? err.message : 'An unknown error occurred.';
            setError(errorMessage);
        }
    };
        
    return (
        <div className="space-y-8">
             <div className="text-center max-w-3xl mx-auto">
                <h1 className="text-3xl font-bold text-white mb-2">Cinematic Video Director</h1>
                <p className="text-lg text-slate-400">The AI will imagine a complete cinematic scene and generate a stunning, 1080p video. Just select an orientation and let the AI do the rest.</p>
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <div className="bg-slate-900/50 p-6 rounded-2xl shadow-lg flex flex-col justify-center gap-6 border border-slate-800">
                     <div>
                        <label htmlFor="aspect-ratio-video" className="block text-slate-300 font-semibold mb-2 text-center text-lg">1. Select Orientation</label>
                        <select id="aspect-ratio-video" value={aspectRatio} onChange={e => setAspectRatio(e.target.value as any)} className="w-full bg-slate-800 border border-slate-700 p-3 rounded-lg focus:ring-2 focus:ring-cyan-500 transition-colors text-lg">
                            <option value="16:9">16:9 (Landscape)</option>
                            <option value="9:16">9:16 (Portrait)</option>
                        </select>
                    </div>
                     <button onClick={handleGenerate} disabled={isLoading} className="w-full bg-cyan-600 hover:bg-cyan-500 disabled:bg-slate-700 disabled:text-slate-400 text-white font-bold py-4 px-8 rounded-full text-xl shadow-lg flex items-center justify-center gap-2">
                        {isLoading ? 'Generating...' : <> <VideoGeneratorIcon /> 2. Generate Video </>}
                    </button>
                </div>
                <div className="bg-slate-900/50 p-6 rounded-2xl shadow-lg flex flex-col items-center justify-center min-h-[400px] lg:min-h-full border border-slate-800">
                    {isLoading && (
                        <div className="text-center w-full">
                            <SpinnerIcon />
                            <p className="text-slate-300 mt-4 text-lg">Generating Video</p>
                             <div className="w-full bg-slate-700 rounded-full h-2.5 mt-4 overflow-hidden">
                                <div className="bg-cyan-500 h-2.5 rounded-full animate-pulse" style={{width: '100%'}}></div>
                            </div>
                            <p className="text-slate-400 mt-2 text-sm h-4">{loadingMessage}</p>
                            {aiPrompt && <p className="text-xs text-slate-500 mt-4 italic">Concept: "{aiPrompt}"</p>}
                        </div>
                    )}
                    {error && (
                        <div className="text-center bg-red-900/20 p-4 rounded-lg border border-red-500/30">
                            <p className="text-red-300 font-semibold">An Error Occurred</p>
                            <p className="text-slate-400 mt-2 text-sm">{error}</p>
                        </div>
                    )}
                    {videoSrc && (
                        <div className="w-full space-y-4">
                             <video src={videoSrc} controls autoPlay loop className="w-full rounded-lg shadow-2xl" />
                             <div className="p-4 bg-slate-800/70 rounded-lg border border-slate-700">
                                <h4 className="font-semibold text-cyan-400 mb-2">AI Cinematic Direction:</h4>
                                <p className="text-sm text-slate-300 italic">"{aiPrompt}"</p>
                            </div>
                             <a href={videoSrc} download="ai-cinematic-video.mp4" className="w-full block text-center bg-green-600 hover:bg-green-500 text-white font-bold py-3 px-6 rounded-full transition-colors">
                                Download Video
                            </a>
                        </div>
                    )}
                    {!isLoading && !error && !videoSrc && (
                        <div className="text-center text-slate-600">
                            <VideoIcon />
                            <p className="mt-4 text-slate-400">Your generated video will appear here.</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default VideoGenerator;