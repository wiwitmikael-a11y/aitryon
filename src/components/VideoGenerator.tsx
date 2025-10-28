import React, { useState, useEffect, useRef } from 'react';
import {
  generateVideo,
  checkVideoOperationStatus,
  fetchAndCreateVideoUrl,
} from '../services/geminiService';
import { SpinnerIcon } from './icons/SpinnerIcon';
import { VideoIcon } from './icons/VideoIcon';
import ImageUploader from './ImageUploader';

declare global {
  interface Window {
    aistudio: {
      hasSelectedApiKey: () => Promise<boolean>;
      openSelectKey: () => Promise<void>;
    };
  }
}

const POLLING_INTERVAL = 10000; // 10 seconds

const VideoGenerator: React.FC = () => {
    const [prompt, setPrompt] = useState('');
    const [image, setImage] = useState<string | null>(null);
    const [videoSrc, setVideoSrc] = useState<string | null>(null);
    
    const [isLoading, setIsLoading] = useState(false);
    const [loadingMessage, setLoadingMessage] = useState('Generating video...');
    const [error, setError] = useState<string | null>(null);
    
    const [operationName, setOperationName] = useState<string | null>(null);
    const [apiKeySelected, setApiKeySelected] = useState(false);

    const pollingRef = useRef<number | null>(null);

    const checkApiKey = async () => {
        if (window.aistudio) {
            const hasKey = await window.aistudio.hasSelectedApiKey();
            setApiKeySelected(hasKey);
        } else {
            // Assume key is available if aistudio context is not present (e.g., local dev)
            setApiKeySelected(true);
        }
    };

    useEffect(() => {
        checkApiKey();
    }, []);

    const cleanupPolling = () => {
        if (pollingRef.current) {
            clearInterval(pollingRef.current);
            pollingRef.current = null;
        }
    };

    useEffect(() => {
        return cleanupPolling;
    }, []);

    const pollOperationStatus = async (opName: string) => {
        setLoadingMessage('Checking video status...');
        try {
            const operation = await checkVideoOperationStatus(opName);
            if (operation.done) {
                cleanupPolling();
                if (operation.error) {
                    throw new Error(operation.error.message);
                }
                const uri = operation.response?.generatedVideos?.[0]?.video?.uri;
                if (!uri) throw new Error("Video URI not found in operation response.");
                
                setLoadingMessage('Fetching video...');
                const url = await fetchAndCreateVideoUrl(uri);
                setVideoSrc(url);
                setIsLoading(false);
                setOperationName(null);
            }
        } catch (err) {
            cleanupPolling();
            setIsLoading(false);
            const message = err instanceof Error ? err.message : 'Polling for video status failed.';
            setError(message);
             if (message.includes('Requested entity was not found')) {
                setError("API Key error. Please re-select your API key and try again.");
                setApiKeySelected(false);
            }
        }
    };

    const handleGenerate = async () => {
        if (!prompt.trim() && !image) {
            setError('Please provide a prompt or an image.');
            return;
        }

        await checkApiKey();
        if (!apiKeySelected) {
            setError("Please select an API key before generating a video.");
            return;
        }

        setIsLoading(true);
        setLoadingMessage('Starting video generation...');
        setError(null);
        setVideoSrc(null);
        cleanupPolling();

        try {
            let imagePayload: { imageBytes: string, mimeType: string } | undefined = undefined;
            if (image) {
                const match = image.match(/^data:(.+);base64,(.+)$/);
                if (match) {
                    imagePayload = { mimeType: match[1], imageBytes: match[2] };
                }
            }

            const op = await generateVideo(prompt, imagePayload);
            if (op.name) {
                setOperationName(op.name);
                pollingRef.current = window.setInterval(() => pollOperationStatus(op.name), POLLING_INTERVAL);
            } else {
                throw new Error("Did not receive a valid operation name to track.");
            }
        } catch (err) {
            setIsLoading(false);
            const message = err instanceof Error ? err.message : 'Failed to start video generation.';
            setError(message);
            if (message.includes('Requested entity was not found')) {
                setError("API Key error. Please re-select your API key and try again.");
                setApiKeySelected(false);
            }
        }
    };

    const handleSelectKey = async () => {
        if (window.aistudio) {
            await window.aistudio.openSelectKey();
            // Assume success and optimistically update UI
            setApiKeySelected(true);
            setError(null);
        }
    };

    return (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <div className="bg-slate-800/50 p-6 rounded-2xl shadow-lg flex flex-col gap-6">
                <h2 className="text-2xl font-bold text-cyan-400">Video Prompt</h2>
                {!apiKeySelected && (
                    <div className="bg-yellow-900/30 p-4 rounded-lg text-center">
                        <p className="text-yellow-300 mb-2">An API key is required for video generation.</p>
                        <button onClick={handleSelectKey} className="bg-yellow-500 hover:bg-yellow-400 text-slate-900 font-bold py-2 px-4 rounded-md">
                            Select API Key
                        </button>
                        <p className="text-xs text-slate-400 mt-2">
                           Video generation with Veo is a paid feature. Please review the <a href="https://ai.google.dev/gemini-api/docs/billing" target="_blank" rel="noopener noreferrer" className="underline hover:text-cyan-400">billing documentation</a>.
                        </p>
                    </div>
                )}
                <div className="space-y-4">
                    <textarea
                        value={prompt}
                        onChange={(e) => setPrompt(e.target.value)}
                        placeholder="e.g., 'A majestic whale breaching the ocean surface in slow motion, sunset lighting'"
                        className="w-full h-24 p-3 bg-slate-700/50 border border-slate-600 rounded-lg focus:ring-2 focus:ring-cyan-500"
                    />
                    <ImageUploader label="Starting Image (Optional)" onImageUpload={setImage} initialImage={image} />
                </div>
                <button onClick={handleGenerate} disabled={isLoading || !apiKeySelected} className="w-full bg-cyan-500 hover:bg-cyan-400 disabled:bg-slate-600 text-white font-bold py-3 px-6 rounded-full text-lg shadow-lg">
                    {isLoading ? 'Generating...' : '✨ Create Video'}
                </button>
            </div>
            <div className="bg-slate-800/50 p-6 rounded-2xl shadow-lg">
                <h2 className="text-2xl font-bold text-cyan-400 mb-6">Generated Video</h2>
                <div className="w-full aspect-video bg-slate-900/50 rounded-lg flex items-center justify-center p-2">
                    {isLoading && (
                        <div className="text-center">
                            <SpinnerIcon />
                            <p className="mt-4 text-slate-400">{loadingMessage}</p>
                            <p className="text-sm text-slate-500">Video generation can take several minutes.</p>
                        </div>
                    )}
                    {error && <p className="text-red-400 p-4 text-center">{error}</p>}
                    {videoSrc && <video src={videoSrc} controls autoPlay loop className="max-w-full max-h-full object-contain rounded-md" />}
                    {!isLoading && !error && !videoSrc && (
                        <div className="text-center text-slate-500">
                            <VideoIcon />
                            <p className="mt-4">Your generated video will appear here.</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default VideoGenerator;
