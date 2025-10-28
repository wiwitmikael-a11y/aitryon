import React, { useState, useCallback } from 'react';
import ImageUploader from './ImageUploader';
import ResultDisplay from './ResultDisplay';
import { performVirtualTryOn } from '../services/vertexAIService';
import type { HistoryItem } from '../types';
import HistoryGallery from './HistoryGallery';
import GuideModal from './GuideModal';
import CropperModal from './CropperModal';
import { getCroppedImg } from '../utils/imageUtils';
import { useLocalStorage } from '../hooks/useLocalStorage';
import { InfoIcon } from './icons/InfoIcon';
import { Area } from 'react-easy-crop';
import { GenerateIcon } from './icons/GenerateIcon';

function VirtualTryOn() {
  const [personImage, setPersonImage] = useState<string | null>(null);
  const [productImage, setProductImage] = useState<string | null>(null);
  const [generatedImage, setGeneratedImage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [history, setHistory] = useLocalStorage<HistoryItem[]>('vto-history', []);
  
  const [guideShown, setGuideShown] = useLocalStorage('vto-guide-shown', false);
  const [isGuideOpen, setIsGuideOpen] = useState(!guideShown);
  
  const [isCropperOpen, setIsCropperOpen] = useState(false);
  const [imageToCrop, setImageToCrop] = useState<string | null>(null);

  const handleGenerate = useCallback(async () => {
    if (!personImage || !productImage) {
      setError('Please upload both a person and a product image.');
      return;
    }
    setIsLoading(true);
    setError(null);
    setGeneratedImage(null);
    
    try {
      const { resultImage } = await performVirtualTryOn(personImage, productImage);
      setGeneratedImage(resultImage);

      const newHistoryItem: HistoryItem = {
        id: Date.now().toString(36) + Math.random().toString(36).substring(2),
        resultImage: resultImage,
        personImage: personImage,
        productImage: productImage,
      };
      setHistory(prevHistory => [newHistoryItem, ...prevHistory]);

    } catch (err) {
      setError(err instanceof Error ? err.message : 'An unknown error occurred during generation.');
    } finally {
      setIsLoading(false);
    }
  }, [personImage, productImage, setHistory]);
  
  const handleReuse = (item: HistoryItem) => {
    setPersonImage(item.personImage);
    setProductImage(item.productImage);
    setGeneratedImage(item.resultImage);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDelete = (id: string) => {
    setHistory(history.filter(item => item.id !== id));
  };
  
  const handleCropRequest = (base64: string) => {
      setImageToCrop(base64);
      setIsCropperOpen(true);
  };

  const handleCropComplete = async (croppedAreaPixels: Area) => {
      if(imageToCrop) {
          try {
              const croppedImageBase64 = await getCroppedImg(imageToCrop, croppedAreaPixels);
              setProductImage(croppedImageBase64);
          } catch(e) {
              console.error("Cropping failed:", e);
              setError("Failed to crop the image.");
          }
      }
      setIsCropperOpen(false);
      setImageToCrop(null);
  };
  
  const closeGuide = () => {
      setIsGuideOpen(false);
      setGuideShown(true);
  }

  const canGenerate = personImage && productImage && !isLoading;

  return (
    <>
      {isGuideOpen && <GuideModal onClose={closeGuide} />}
      {isCropperOpen && imageToCrop && (
        <CropperModal 
            imageSrc={imageToCrop}
            onClose={() => setIsCropperOpen(false)}
            onCropComplete={handleCropComplete}
        />
      )}
      <div className="space-y-8">
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
          <div className="lg:col-span-2 bg-slate-900/50 p-6 rounded-2xl shadow-lg flex flex-col gap-6 border border-slate-800">
            <div className="flex justify-between items-center">
              <h2 className="text-xl font-bold text-cyan-400">Upload Your Images</h2>
              <button onClick={() => setIsGuideOpen(true)} className="flex items-center gap-2 text-slate-400 hover:text-cyan-400 transition-colors text-sm">
                <InfoIcon />
                <span>Upload Guide</span>
              </button>
            </div>
            <ImageUploader label="1. Person Image" onImageUpload={(base64) => setPersonImage(base64)} initialImage={personImage}/>
            <ImageUploader label="2. Clothing Item" onImageUpload={(base64) => setProductImage(base64)} onCropRequest={handleCropRequest} initialImage={productImage}/>
            <div className="pt-4 mt-auto">
               <button
                  onClick={handleGenerate}
                  disabled={!canGenerate}
                  className="w-full flex items-center justify-center gap-2 bg-cyan-600 hover:bg-cyan-500 disabled:bg-slate-700 disabled:cursor-not-allowed disabled:text-slate-400 text-white font-bold py-3 px-6 rounded-full text-lg shadow-lg shadow-cyan-500/10 transition-all duration-300 transform hover:scale-105 disabled:scale-100 disabled:shadow-none"
              >
                  <GenerateIcon />
                  {isLoading ? 'Generating...' : 'Perform Virtual Try-On'}
              </button>
            </div>
          </div>

          <div className="lg:col-span-3 bg-slate-900/50 p-6 rounded-2xl shadow-lg border border-slate-800">
            <h2 className="text-xl font-bold text-cyan-400 mb-6">3. Generated Result</h2>
            <ResultDisplay
              generatedImage={generatedImage}
              isLoading={isLoading}
              error={error}
            />
          </div>
        </div>
      
        <HistoryGallery history={history} onReuse={handleReuse} onDelete={handleDelete} />
      </div>
    </>
  );
}

export default VirtualTryOn;
