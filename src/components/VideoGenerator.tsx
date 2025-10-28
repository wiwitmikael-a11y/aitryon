import React, { useState, useEffect, useRef } from 'react';
import {
    generateVideo,
    checkVideoOperationStatus,
    fetchAndCreateVideoUrl
} from '../services/geminiService';
import ImageUploader from './ImageUploader';
import { SpinnerIcon } from './icons/SpinnerIcon';
import { VideoIcon } from './icons/VideoIcon';
import { useLocalStorage } from '../hooks/useLocalStorage';

type Stage = 'idle' | 'generating' | 'polling' | 'complete' | 'failed';

interface VideoHistoryItem {
    id: string;
    src: string;
    prompt: string;
    image?: string | null;
}

const POLLING_INTERVAL = 10000; // 10 seconds

const VideoGenerator: React.FC = () => {
    const [prompt, setPrompt] = useState('');
    const [image, setImage] = useState<string | null>(null);
    const [stage, setStage] = useState<Stage>('idle');
    const [error, setError] = useState<string | null>(null);
    const [generatedVideoUrl, setGeneratedVideoUrl] = useState<string | null>(null);
    const [progressMessage, setProgressMessage] = useState('');
    const [history, setHistory] = useLocalStorage<VideoHistoryItem[]>('video-generator-history', []);

    const pollingRef = useRef<number | null>(null);

    // Cleanup polling interval on unmount
    useEffect(() => {
        return () => {
            if (pollingRef.current) {
                clearInterval(pollingRef.current);
            }
        };
    }, []);

    const resetGenerationState = () => {
        setStage('idle');
        setError(null);
        setGeneratedVideoUrl(null);
        setProgressMessage('');
        if (pollingRef.current) {
            clearInterval(pollingRef.current);
            pollingRef.current = null;
        }
    };

    const handleGenerate = async () => {
        if (!prompt.trim() && !image) {
            setError('Please provide a text prompt or an image.');
            return;
        }

        resetGenerationState();
        setStage('generating');
        setError(null);
        setProgressMessage('Submitting video generation job...');

        try {
            let imagePayload;
            if (image) {
                const [header, base64Data] = image.split(',');
                const mimeType = header.match(/:(.*?);/)?.[1] || 'image/png';
                imagePayload = { imageBytes: base64Data, mimeType };
            }

            const operation = await generateVideo(prompt, imagePayload);
            if (!operation || !operation.name) {
                throw new Error("Failed to start video generation job. No operation name returned.");
            }

            setStage('polling');
            setProgressMessage('Video is generating... This can take a few minutes.');
            startPolling(operation.name);

        } catch (err) {
            const message = err instanceof Error ? err.message : 'An unknown error occurred.';
            setError(message);
            setStage('failed');
        }
    };

    const startPolling = (operationName: string) => {
        pollingRef.current = window.setInterval(async () => {
            try {
                const operation = await checkVideoOperationStatus(operationName);
                if (operation.done) {
                    if (pollingRef.current) clearInterval(pollingRef.current);
                    
                    if (operation.error) {
                        throw new Error(operation.error.message || 'Operation failed with an error.');
                    }

                    const uri = operation.response?.generatedVideos?.[0]?.video?.uri;
                    if (!uri) {
                        throw new Error("Video URI not found in operation response.");
                    }

                    setProgressMessage('Processing completed video...');
                    const videoUrl = await fetchAndCreateVideoUrl(uri);
                    
                    setGeneratedVideoUrl(videoUrl);
                    setStage('complete');
                    
                    const newHistoryItem: VideoHistoryItem = {
                        id: operationName,
                        src: videoUrl,
                        prompt,
                        image
                    };
                    setHistory(prev => [newHistoryItem, ...prev.filter(item => item.id !== newHistoryItem.id)]);
                }
            } catch (err) {
                if (pollingRef.current) clearInterval(pollingRef.current);
                const message = err instanceof Error ? err.message : 'Polling for video status failed.';
                setError(message);
                setStage('failed');
            }
        }, POLLING_INTERVAL);
    };
    
    const handleReuse = (item: VideoHistoryItem) => {
        setPrompt(item.prompt);
        setImage(item.image || null);
        setGeneratedVideoUrl(item.src);
        setStage('complete');
        setError(null);
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const isLoading = stage === 'generating' || stage === 'polling';
    
    return (
        <div className="space-y-8">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
                <div className="bg-slate-800/50 p-6 rounded-2xl shadow-lg space-y-6">
                    <h2 className="text-2xl font-bold text-cyan-400">Video Prompt</h2>
                    <div>
                        <label htmlFor="prompt" className="block text-slate-300 font-semibold mb-2">Describe your video:</label>
                        <textarea
                            id="prompt"
                            value={prompt}
                            onChange={(e) => setPrompt(e.target.value)}
                            placeholder="e.g., 'A neon hologram of a cat driving a sports car at top speed on a rainy night in Tokyo'"
                            className="w-full h-32 p-3 bg-slate-700/50 border border-slate-600 rounded-lg"
                            disabled={isLoading}
                        />
                    </div>
                    <ImageUploader 
                        label="Add a Starting Image (Optional)"
                        onImageUpload={(base64) => setImage(base64)}
                        initialImage={image}
                    />
                    <button
                        onClick={handleGenerate}
                        disabled={isLoading || (!prompt.trim() && !image)}
                        className="w-full bg-cyan-500 hover:bg-cyan-400 disabled:bg-slate-600 text-white font-bold py-3 px-6 rounded-full text-lg flex items-center justify-center gap-2"
                    >
                        {isLoading ? <SpinnerIcon /> : 'Generate Video'}
                    </button>
                </div>

                <div className="bg-slate-800/50 p-6 rounded-2xl shadow-lg min-h-[400px] flex flex-col justify-center items-center">
                    <h2 className="text-2xl font-bold text-cyan-400 mb-6 text-center">Generated Video</h2>
                    
                    {stage === 'idle' && (
                        <div className="text-center text-slate-500">
                            <VideoIcon />
                            <p className="mt-4">Your generated video will appear here.</p>
                        </div>
                    )}

                    {(stage === 'generating' || stage === 'polling') && (
                        <div className="text-center text-slate-400">
                            <SpinnerIcon />
                            <p className="mt-4 text-lg font-semibold">{progressMessage}</p>
                            <p className="text-sm text-slate-500">Please be patient, video generation can take several minutes.</p>
                        </div>
                    )}
                    
                    {stage === 'failed' && error && (
                        <div className="text-center bg-red-900/20 p-4 rounded-lg">
                            <p className="text-red-400 font-semibold">Generation Failed</p>
                            <p className="text-slate-300 mt-2 text-sm break-words">{error}</p>
                        </div>
                    )}

                    {stage === 'complete' && generatedVideoUrl && (
                        <div className="w-full">
                            <video src={generatedVideoUrl} controls autoPlay loop className="w-full rounded-lg shadow-2xl" />
                            <div className="flex justify-center mt-4">
                                <a href={generatedVideoUrl} download={`ai-video-${Date.now()}.mp4`} className="bg-green-600 hover:bg-green-500 text-white font-bold py-2 px-6 rounded-full">
                                    Download Video
                                </a>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            <div className="mt-12">
                <h2 className="text-2xl font-bold text-cyan-400 mb-6 text-center lg:text-left">Video History</h2>
                {history.length > 0 ? (
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                        {history.map(item => (
                            <div key={item.id} onClick={() => handleReuse(item)} className="group relative aspect-video bg-slate-800 rounded-lg overflow-hidden shadow-lg cursor-pointer">
                                <video src={item.src} muted loop className="w-full h-full object-cover transition-transform group-hover:scale-105" />
                                <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                    <p className="text-white font-bold">Reuse</p>
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    <p className="text-center text-slate-500 mt-6 bg-slate-800/50 py-8 rounded-lg">
                        Your generated videos will appear here.
                    </p>
                )}
            </div>
        </div>
    );
};

export default VideoGenerator;
