import React, { useState, useCallback, useEffect, useRef } from 'react';
import ImageUploader from './ImageUploader';
import ResultDisplay from './ResultDisplay';
import { submitGenerationJob, checkJobStatus } from '../services/vertexAIService';
import type { HistoryItem, Job } from '../types';
import HistoryGallery from './HistoryGallery';
import GuideModal from './GuideModal';
import { InfoIcon } from './icons/InfoIcon';

const POLLING_INTERVAL = 3000; // 3 seconds

function VirtualTryOn() {
  const [personImage, setPersonImage] = useState<string | null>(null);
  const [productImage, setProductImage] = useState<string | null>(null);
  const [generatedImage, setGeneratedImage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [jobId, setJobId] = useState<string | null>(null);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [isGuideOpen, setIsGuideOpen] = useState(true);

  const pollingRef = useRef<number | null>(null);

  useEffect(() => {
    // Load history from local storage on mount
    try {
      const storedHistory = localStorage.getItem('vto-history');
      if (storedHistory) {
        setHistory(JSON.parse(storedHistory));
      }
    } catch (e) {
      console.error("Failed to load history from localStorage", e);
    }
  }, []);
  
  const saveHistory = (newHistory: HistoryItem[]) => {
      setHistory(newHistory);
      try {
        localStorage.setItem('vto-history', JSON.stringify(newHistory));
      } catch(e) {
          console.error("Failed to save history to localStorage", e);
      }
  };

  const handleJobSuccess = useCallback((job: Job) => {
    if (job.resultImage) {
      setGeneratedImage(job.resultImage);
      const newHistoryItem: HistoryItem = {
        id: job.id,
        resultImage: job.resultImage,
        personImage: job.personImage,
        productImage: job.productImage,
      };
      // Add to start of history and avoid duplicates
      saveHistory([newHistoryItem, ...history.filter(h => h.id !== job.id)]);
    } else {
      setError("Job completed but no image was returned.");
    }
  }, [history]);
  
  const pollJobStatus = useCallback(async (id: string) => {
    try {
      const job = await checkJobStatus(id);
      switch (job.status) {
        case 'COMPLETED':
          setIsLoading(false);
          setJobId(null);
          if (pollingRef.current) clearInterval(pollingRef.current);
          handleJobSuccess(job);
          break;
        case 'FAILED':
          setIsLoading(false);
          setJobId(null);
          if (pollingRef.current) clearInterval(pollingRef.current);
          setError(job.error || 'The generation job failed for an unknown reason.');
          break;
        case 'PENDING':
        case 'PROCESSING':
          // continue polling
          break;
        default:
            setIsLoading(false);
            setJobId(null);
            if (pollingRef.current) clearInterval(pollingRef.current);
            setError(`Unknown job status: ${job.status}`);
      }
    } catch (err) {
      setIsLoading(false);
      setJobId(null);
      if (pollingRef.current) clearInterval(pollingRef.current);
      if (err instanceof Error) {
        setError(`Failed to check job status: ${err.message}`);
      } else {
        setError('An unknown error occurred while polling for status.');
      }
    }
  }, [handleJobSuccess]);

  useEffect(() => {
    if (jobId) {
      pollingRef.current = window.setInterval(() => {
        pollJobStatus(jobId);
      }, POLLING_INTERVAL);
    }
    return () => {
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
      }
    };
  }, [jobId, pollJobStatus]);

  const handleGenerate = useCallback(async () => {
    if (!personImage || !productImage) {
      setError('Please upload both a person and a product image.');
      return;
    }

    setIsLoading(true);
    setError(null);
    setGeneratedImage(null);
    if (pollingRef.current) clearInterval(pollingRef.current);

    try {
      const { jobId } = await submitGenerationJob(personImage, productImage);
      setJobId(jobId);
    } catch (err) {
      if (err instanceof Error) {
        setError(`Submission failed: ${err.message}`);
      } else {
        setError('An unknown error occurred during job submission.');
      }
      setIsLoading(false);
    }
  }, [personImage, productImage]);
  
  const handleReuse = (item: HistoryItem) => {
    setPersonImage(item.personImage);
    setProductImage(item.productImage);
    setGeneratedImage(item.resultImage);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDelete = (id: string) => {
    saveHistory(history.filter(item => item.id !== id));
  };

  const canGenerate = personImage && productImage && !isLoading;

  return (
    <>
      {isGuideOpen && <GuideModal onClose={() => setIsGuideOpen(false)} />}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Input Section */}
        <div className="bg-slate-800/50 p-6 rounded-2xl shadow-lg flex flex-col gap-6">
          <div className="flex justify-between items-center">
            <h2 className="text-2xl font-bold text-cyan-400">Upload Your Images</h2>
             <button onClick={() => setIsGuideOpen(true)} className="flex items-center gap-2 text-slate-300 hover:text-cyan-400 transition-colors">
              <InfoIcon />
              <span className="hidden sm:inline">Upload Guide</span>
            </button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <ImageUploader label="Person Image" onImageUpload={setPersonImage} key={`person-${personImage}`} initialImage={personImage}/>
            <ImageUploader label="Clothing Item" onImageUpload={setProductImage} key={`product-${productImage}`} initialImage={productImage}/>
          </div>
        </div>

        {/* Output Section */}
        <div className="bg-slate-800/50 p-6 rounded-2xl shadow-lg">
           <h2 className="text-2xl font-bold text-cyan-400 mb-6">Generated Result</h2>
          <ResultDisplay
            generatedImage={generatedImage}
            isLoading={isLoading}
            error={error}
          />
        </div>
      </div>
      
      <HistoryGallery history={history} onReuse={handleReuse} onDelete={handleDelete} />

     {/* Sticky Action Bar */}
      <div className="sticky bottom-0 left-0 right-0 -mx-4 md:-mx-8 mt-8 p-4 bg-slate-900/80 backdrop-blur-sm border-t border-slate-700/50 flex justify-center">
          <button
              onClick={handleGenerate}
              disabled={!canGenerate}
              className="w-full max-w-md bg-cyan-500 hover:bg-cyan-400 disabled:bg-slate-600 disabled:cursor-not-allowed text-white font-bold py-4 px-8 rounded-full text-lg shadow-lg shadow-cyan-500/20 transition-all duration-300 transform hover:scale-105 disabled:scale-100 disabled:shadow-none"
          >
              {isLoading ? 'Generating...' : '✨ Perform Virtual Try-On'}
          </button>
      </div>
    </>
  );
}

export default VirtualTryOn;
