import React, { useState, useEffect, useRef, useCallback } from 'react';
import { generateVideo, checkVideoOperationStatus, fetchAndCreateVideoUrl } from '../services/geminiService';
import { GenerateVideosOperationResponse } from '@google/genai';
import { SpinnerIcon } from './icons/SpinnerIcon';
import { DownloadIcon } from './icons/DownloadIcon';
import { VideoIcon } from './icons/VideoIcon';

const loadingMessages = [
    "Warming up the video engine...",
    "Scripting the visual narrative...",
    "Composing the opening scenes...",
    "Rendering high-fidelity frames...",
    "Adding cinematic effects...",
    "Finalizing audio and color grading...",
    "Almost there, preparing your video...",
];

const POLLING_INTERVAL = 10000; // 10 detik

const VideoGenerator: React.FC = () => {
    const [apiKeySelected, setApiKeySelected] = useState(false);
    const [prompt, setPrompt] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [loadingMessage, setLoadingMessage] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [videoUrl, setVideoUrl] = useState<string | null>(null);
    const [operationName, setOperationName] = useState<string | null>(null);

    const pollingRef = useRef<number | null>(null);

    const checkApiKey = useCallback(async () => {
        const hasKey = await window.aistudio.hasSelectedApiKey();
        setApiKeySelected(hasKey);
    }, []);

    useEffect(() => {
        checkApiKey();
    }, [checkApiKey]);

    useEffect(() => {
        let messageInterval: number;
        if (isLoading) {
            let i = 0;
            setLoadingMessage(loadingMessages[i]);
            messageInterval = window.setInterval(() => {
                i = (i + 1) % loadingMessages.length;
                setLoadingMessage(loadingMessages[i]);
            }, 4000);
        }
        return () => clearInterval(messageInterval);
    }, [isLoading]);

    const handleJobSuccess = useCallback(async (operation: GenerateVideosOperationResponse) => {
        const uri = operation.response?.generatedVideos?.[0]?.video?.uri;
        if (uri) {
            try {
                const url = await fetchAndCreateVideoUrl(uri);
                setVideoUrl(url);
            } catch (err) {
                setError(err instanceof Error ? err.message : 'Failed to fetch video.');
            }
        } else {
            setError('Job completed, but no video URI was found.');
        }
        setIsLoading(false);
    }, []);

    const pollOperationStatus = useCallback(async (name: string) => {
        try {
            const operation = await checkVideoOperationStatus(name);
            if (operation.done) {
                if (pollingRef.current) clearInterval(pollingRef.current);
                setOperationName(null);
                if (operation.error) {
                    setError(`Generation failed: ${operation.error.message}`);
                    setIsLoading(false);
                } else {
                    handleJobSuccess(operation);
                }
            }
        } catch (err) {
            if (pollingRef.current) clearInterval(pollingRef.current);
            setOperationName(null);
            setIsLoading(false);
            if (err instanceof Error && err.message === 'API_KEY_INVALID') {
                setError("Operation failed. Your API Key may be invalid or missing permissions. Please select a valid key.");
                setApiKeySelected(false); // Memaksa pemilihan ulang kunci
            } else {
                setError(err instanceof Error ? err.message : 'An unknown polling error occurred.');
            }
        }
    }, [handleJobSuccess]);

    useEffect(() => {
        if (operationName) {
            pollingRef.current = window.setInterval(() => {
                pollOperationStatus(operationName);
            }, POLLING_INTERVAL);
        }
        return () => {
            if (pollingRef.current) clearInterval(pollingRef.current);
        };
    }, [operationName, pollOperationStatus]);
    
    const handleGenerate = async () => {
        if (!prompt.trim() || !apiKeySelected) return;

        setIsLoading(true);
        setError(null);
        setVideoUrl(null);
        if (pollingRef.current) clearInterval(pollingRef.current);

        try {
            const initialOperation = await generateVideo(prompt);
            if (initialOperation.name) {
                setOperationName(initialOperation.name);
            } else {
                throw new Error("Failed to get operation name from the generation job.");
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to start generation.');
            setIsLoading(false);
        }
    };
    
    const handleSelectKey = async () => {
        await window.aistudio.openSelectKey();
        setApiKeySelected(true);
        setError(null);
    };

    const renderContent = () => {
        if (isLoading) {
            return (
                <div className="flex flex-col items-center justify-center h-full text-center">
                    <SpinnerIcon />
                    <p className="text-slate-300 mt-4 text-lg font-semibold">{loadingMessage}</p>
                    <p className="text-slate-400 text-sm">Video generation can take a few minutes. Please be patient.</p>
                </div>
            );
        }

        if (videoUrl) {
            return (
                <div className="flex flex-col items-center gap-4">
                    <video
                        src={videoUrl}
                        controls
                        autoPlay
                        loop
                        className="w-full h-auto max-h-[60vh] rounded-lg shadow-2xl bg-black"
                    />
                    <a
                        href={videoUrl}
                        download={`veo-video-${Date.now()}.mp4`}
                        className="mt-4 bg-green-600 hover:bg-green-500 text-white font-bold py-3 px-8 rounded-full transition-colors duration-300 flex items-center gap-2"
                    >
                        <DownloadIcon />
                        Download Video
                    </a>
                </div>
            );
        }
        
        return (
            <div className="flex flex-col items-center justify-center h-full text-center text-slate-500">
                <VideoIcon />
                <p className="mt-4">Video yang Anda buat akan muncul di sini.</p>
                <p className="text-sm">Tuliskan prompt dan klik buat untuk memulai.</p>
            </div>
        );
    };

    return (
        <div className="space-y-8">
            <div className="bg-slate-800/50 p-6 rounded-2xl shadow-lg">
                <h2 className="text-2xl font-bold text-cyan-400 mb-4">1. Describe the Video to Generate</h2>
                <textarea
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    placeholder="e.g., 'A neon hologram of a cat driving at top speed', 'An epic cinematic shot of a an ancient library with magical books'"
                    className="w-full h-24 p-3 bg-slate-700/50 border border-slate-600 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 transition-colors"
                    disabled={isLoading}
                />
            </div>
            
            {error && (
                <div className="bg-red-900/20 p-4 rounded-lg text-center text-red-400">{error}</div>
            )}

            {!apiKeySelected && (
                <div className="bg-amber-900/20 p-4 rounded-lg text-center text-amber-300">
                    <p className="font-semibold">Action Required: Select API Key</p>
                    <p className="text-sm mb-3">Video generation with Veo requires a Google Cloud API key for billing. Please select your key to continue.</p>
                     <a href="https://ai.google.dev/gemini-api/docs/billing" target="_blank" rel="noopener noreferrer" className="text-cyan-400 hover:underline text-sm">Learn about billing</a>
                </div>
            )}
            
            <div className="bg-slate-800/50 p-6 rounded-2xl shadow-lg">
                 <h2 className="text-2xl font-bold text-cyan-400 mb-6 text-center">2. View Result</h2>
                 <div className="w-full min-h-[400px] flex items-center justify-center bg-slate-900/50 rounded-lg p-4">
                    {renderContent()}
                 </div>
            </div>

            <div className="sticky bottom-0 left-0 right-0 -mx-4 md:-mx-8 mt-8 p-4 bg-slate-900/80 backdrop-blur-sm border-t border-slate-700/50 flex justify-center">
                 {apiKeySelected ? (
                    <button
                        onClick={handleGenerate}
                        disabled={isLoading || !prompt.trim()}
                        className="w-full max-w-md bg-cyan-500 hover:bg-cyan-400 disabled:bg-slate-600 disabled:cursor-not-allowed text-white font-bold py-4 px-8 rounded-full text-lg shadow-lg shadow-cyan-500/20 transition-all duration-300 transform hover:scale-105 disabled:scale-100 disabled:shadow-none"
                    >
                        {isLoading ? 'Generating Video...' : '✨ Generate Video'}
                    </button>
                 ) : (
                     <button
                        onClick={handleSelectKey}
                        className="w-full max-w-md bg-amber-500 hover:bg-amber-400 text-white font-bold py-4 px-8 rounded-full text-lg shadow-lg shadow-amber-500/20 transition-all duration-300"
                    >
                        Select API Key to Get Started
                    </button>
                 )}
            </div>
        </div>
    );
};

export default VideoGenerator;
