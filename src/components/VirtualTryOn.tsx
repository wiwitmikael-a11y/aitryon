import React, { useState, useEffect, useRef } from 'react';
import ImageUploader from './ImageUploader';
import ResultDisplay from './ResultDisplay';
import HistoryGallery from './HistoryGallery';
import CropperModal from './CropperModal';
import GuideModal from './GuideModal';
import { InfoIcon } from './icons/InfoIcon';
import { getCroppedImg } from '../utils/imageUtils';
import { startVirtualTryOnJob, checkVirtualTryOnJobStatus } from '../services/vertexAIService';
import { useLocalStorage } from '../hooks/useLocalStorage';
import type { HistoryItem } from '../types';
import type { Area } from 'react-easy-crop/types';

const POLLING_INTERVAL = 5000; // 5 seconds

const VirtualTryOn: React.FC = () => {
    const [personImage, setPersonImage] = useState<string | null>(null);
    const [productImage, setProductImage] = useState<string | null>(null); // This is the cropped image
    const [generatedImage, setGeneratedImage] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    
    const [history, setHistory] = useLocalStorage<HistoryItem[]>('vto-history', []);

    // Cropping state
    const [imageToCrop, setImageToCrop] = useState<string | null>(null);
    const [croppedProductImageForUploader, setCroppedProductImageForUploader] = useState<string | null>(null);

    // Polling state
    const [jobId, setJobId] = useState<string | null>(null);
    const pollingIntervalRef = useRef<number | null>(null);

    // Guide modal
    const [showGuide, setShowGuide] = useState(true);

    const handleImageUpload = (setter: React.Dispatch<React.SetStateAction<string | null>>) => (base64: string) => {
        setter(base64 || null);
    };
    
    const handleCropRequest = (base64: string) => {
        setImageToCrop(base64);
    };

    const onCropComplete = async (croppedAreaPixels: Area) => {
        if (imageToCrop) {
            try {
                const croppedImageBase64 = await getCroppedImg(imageToCrop, croppedAreaPixels);
                setProductImage(croppedImageBase64); // This is sent to the API
                setCroppedProductImageForUploader(croppedImageBase64); // This is to show in the uploader preview
            } catch (e) {
                console.error(e);
                setError('Failed to crop image.');
            } finally {
                setImageToCrop(null);
            }
        }
    };

    const clearPolling = () => {
        if (pollingIntervalRef.current) {
            clearInterval(pollingIntervalRef.current);
            pollingIntervalRef.current = null;
        }
    };

    useEffect(() => {
        return () => clearPolling(); // Cleanup on unmount
    }, []);

    const pollJobStatus = async (currentJobId: string) => {
        try {
            const status = await checkVirtualTryOnJobStatus(currentJobId);
            if (status.state === 'SUCCEEDED') {
                clearPolling();
                setJobId(null);
                setGeneratedImage(status.resultImageUrl!);
                setIsLoading(false);
                // Add to history
                if (personImage && productImage && status.resultImageUrl) {
                    const newHistoryItem: HistoryItem = {
                        id: new Date().toISOString(),
                        personImage,
                        productImage,
                        resultImage: status.resultImageUrl,
                    };
                    setHistory(prev => [newHistoryItem, ...prev]);
                }
            } else if (status.state === 'FAILED') {
                clearPolling();
                setJobId(null);
                setError(status.error || 'The generation process failed.');
                setIsLoading(false);
            }
        } catch (err) {
            clearPolling();
            setJobId(null);
            setError(err instanceof Error ? err.message : 'Failed to poll job status.');
            setIsLoading(false);
        }
    };

    useEffect(() => {
        if (jobId) {
            pollingIntervalRef.current = window.setInterval(() => {
                pollJobStatus(jobId);
            }, POLLING_INTERVAL);
        }
        return () => clearPolling();
    }, [jobId, pollJobStatus]);

    const handleGenerateClick = async () => {
        if (!personImage || !productImage) {
            setError('Please upload both a person and a clothing item image.');
            return;
        }
        setIsLoading(true);
        setError(null);
        setGeneratedImage(null);

        try {
            const { jobId: newJobId } = await startVirtualTryOnJob(personImage, productImage);
            setJobId(newJobId);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'An unknown error occurred.');
            setIsLoading(false);
        }
    };

    const handleReuseHistoryItem = (item: HistoryItem) => {
        setPersonImage(item.personImage);
        setProductImage(item.productImage);
        setCroppedProductImageForUploader(item.productImage);
        setGeneratedImage(item.resultImage);
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };
    
    const handleDeleteHistoryItem = (id: string) => {
        setHistory(prev => prev.filter(item => item.id !== id));
    };

    const isGenerateDisabled = !personImage || !productImage || isLoading;

    return (
        <div className="space-y-8">
            {showGuide && <GuideModal onClose={() => setShowGuide(false)} />}
            {imageToCrop && <CropperModal imageSrc={imageToCrop} onCropComplete={onCropComplete} onClose={() => setImageToCrop(null)} />}
            
            <div className="text-center max-w-3xl mx-auto">
                <h1 className="text-3xl font-bold text-white mb-2">Virtual Try-On</h1>
                <p className="text-lg text-slate-400">Upload a photo of a person and a clothing item to generate a new image showing the person wearing the garment.</p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
                <div className="bg-slate-900/50 p-6 rounded-2xl shadow-lg flex flex-col gap-6 border border-slate-800">
                    <div className="flex justify-between items-center">
                        <h2 className="text-xl font-bold text-slate-100">1. Upload Images</h2>
                        <button onClick={() => setShowGuide(true)} className="text-slate-400 hover:text-cyan-400 transition-colors flex items-center gap-2 text-sm">
                            <InfoIcon />
                            <span>Upload Guide</span>
                        </button>
                    </div>
                    <ImageUploader label="Person Image" onImageUpload={handleImageUpload(setPersonImage)} initialImage={personImage} />
                    <ImageUploader label="Clothing Item" onCropRequest={handleCropRequest} onImageUpload={handleImageUpload(setProductImage)} initialImage={croppedProductImageForUploader} />
                    
                    <button
                        onClick={handleGenerateClick}
                        disabled={isGenerateDisabled}
                        className="w-full bg-cyan-600 hover:bg-cyan-500 disabled:bg-slate-700 disabled:text-slate-400 text-white font-bold py-3 px-6 rounded-full text-lg transition-colors"
                    >
                        {isLoading ? 'Generating...' : '2. Generate Try-On'}
                    </button>
                </div>

                <div className="sticky top-24">
                    <ResultDisplay
                        generatedImage={generatedImage}
                        isLoading={isLoading}
                        error={error}
                    />
                </div>
            </div>

            <HistoryGallery 
                history={history} 
                onReuse={handleReuseHistoryItem} 
                onDelete={handleDeleteHistoryItem} 
            />
        </div>
    );
};

export default VirtualTryOn;
