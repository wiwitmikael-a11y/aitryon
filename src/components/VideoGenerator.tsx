import React, { useState, useEffect, useRef } from 'react';
import { generateVideo, checkVideoOperationStatus, fetchAndCreateVideoUrl } from '../services/geminiService';
import ImageUploader from './ImageUploader';
import { SpinnerIcon } from './icons/SpinnerIcon';
import { VideoIcon } from './icons/VideoIcon';
import { VideoGeneratorIcon } from './icons/VideoGeneratorIcon';

const POLLING_INTERVAL = 10000; // 10 seconds

const VideoGenerator: React.FC = () => {
    const [prompt, setPrompt] = useState('');
    const [image, setImage] = useState<string | null>(null);
    const [videoSrc, setVideoSrc] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [loadingMessage, setLoadingMessage] = useState('Starting video generation...');
    const [error, setError] = useState<string | null>(null);
    const [operationName, setOperationName] = useState<string | null>(null);

    const pollingRef = useRef<number | null>(null);

    const loadingMessages = [
        "Initializing hyper-dimensional film reels...",
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
            messageInterval = window.setInterval(() => {
                i = (i + 1) % loadingMessages.length;
                setLoadingMessage(loadingMessages[i]);
            }, 5000);
        }
        return () => {
            if (messageInterval) clearInterval(messageInterval);
        };
    }, [isLoading, loadingMessages]);


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
            setError(err instanceof Error ? err.message : 'Failed to poll for video status.');
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
        if (!prompt.trim()) {
            setError('Please enter a prompt.');
            return;
        }
        setIsLoading(true);
        setError(null);
        setVideoSrc(null);
        setLoadingMessage('Starting video generation...');
        if (pollingRef.current) clearInterval(pollingRef.current);

        try {
            let imagePayload;
            if (image) {
                const [header, base64Data] = image.split(',');
                const mimeType = header.match(/:(.*?);/)?.[1] || 'image/png';
                imagePayload = { imageBytes: base64Data, mimeType };
            }

            const operation = await generateVideo(prompt, imagePayload);
            if (!operation.name) throw new Error("Video operation name not found.");
            
            setOperationName(operation.name);
            setLoadingMessage('Video generation in progress...');

        } catch (err) {
            setIsLoading(false);
            setError(err instanceof Error ? err.message : 'An unknown error occurred.');
        }
    };
    
    const canGenerate = prompt.trim() && !isLoading;

    return (
        <div className="space-y-8">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <div className="bg-slate-800/50 p-6 rounded-2xl shadow-lg flex flex-col gap-6">
                    <h2 className="text-2xl font-bold text-cyan-400">Video Prompt</h2>
                    <div>
                        <label className="block text-slate-300 font-semibold mb-2">Describe the video you want to create:</label>
                        <textarea value={prompt} onChange={e => setPrompt(e.target.value)} placeholder="e.g., 'A majestic eagle soaring over a misty mountain range at sunrise, cinematic, 4k.'" className="w-full h-32 p-3 bg-slate-700/50 border border-slate-600 rounded-lg"/>
                    </div>
                    <div>
                        <ImageUploader label="Optional: Starting Image" onImageUpload={base64 => setImage(base64)} initialImage={image} />
                    </div>
                     <button onClick={handleGenerate} disabled={!canGenerate} className="w-full bg-cyan-500 hover:bg-cyan-400 disabled:bg-slate-600 disabled:cursor-not-allowed text-white font-bold py-4 px-8 rounded-full text-lg shadow-lg flex items-center justify-center gap-2">
                        {isLoading ? 'Generating...' : <> <VideoGeneratorIcon /> Generate Video </>}
                    </button>
                </div>
                <div className="bg-slate-800/50 p-6 rounded-2xl shadow-lg flex items-center justify-center min-h-[400px]">
                    {isLoading && (
                        <div className="text-center">
                            <SpinnerIcon />
                            <p className="text-slate-300 mt-4 text-lg">Generating Video</p>
                            <p className="text-slate-400 mt-2 text-sm">{loadingMessage}</p>
                        </div>
                    )}
                    {error && (
                        <div className="text-center bg-red-900/20 p-4 rounded-lg">
                            <p className="text-red-400 font-semibold">An Error Occurred</p>
                            <p className="text-slate-300 mt-2 text-sm">{error}</p>
                        </div>
                    )}
                    {videoSrc && (
                        <div className="w-full">
                             <video src={videoSrc} controls autoPlay loop className="w-full rounded-lg shadow-2xl" />
                        </div>
                    )}
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
