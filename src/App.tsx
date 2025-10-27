import React, { useState, useCallback, useEffect, useRef } from 'react';
import Header from './components/Header';
import ImageUploader from './components/ImageUploader';
import ResultDisplay from './components/ResultDisplay';
import Footer from './components/Footer';
import HistoryGallery from './components/HistoryGallery';
import GuideModal from './components/GuideModal';
import { submitGenerationJob, checkJobStatus } from './services/vertexAIService';
import type { Job, HistoryItem } from './types';

function App() {
  const [personImage, setPersonImage] = useState<string | null>(null);
  const [productImage, setProductImage] = useState<string | null>(null);
  const [currentJob, setCurrentJob] = useState<Job | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [isGuideOpen, setIsGuideOpen] = useState(false);

  const pollingIntervalRef = useRef<number | null>(null);

  useEffect(() => {
    try {
      const storedHistory = localStorage.getItem('vto-history');
      if (storedHistory) {
        setHistory(JSON.parse(storedHistory));
      }
    } catch (e) {
      console.error("Failed to load history from local storage", e);
    }
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem('vto-history', JSON.stringify(history));
    } catch (e) {
      console.error("Failed to save history to local storage", e);
    }
  }, [history]);

  const stopPolling = useCallback(() => {
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
      pollingIntervalRef.current = null;
    }
  }, []);

  const pollJobStatus = useCallback(async (jobId: string) => {
    try {
      const job = await checkJobStatus(jobId);
      setCurrentJob(job);

      if (job.status === 'COMPLETED' || job.status === 'FAILED') {
        stopPolling();
        if (job.status === 'COMPLETED' && job.resultImage) {
          const newHistoryItem: HistoryItem = {
            id: job.id,
            resultImage: job.resultImage,
            personImage: job.personImage,
            productImage: job.productImage,
          };
          setHistory(prev => [newHistoryItem, ...prev.filter(h => h.id !== newHistoryItem.id)]);
        }
      }
    } catch (err) {
      if (err instanceof Error) {
        setError(`Polling failed: ${err.message}`);
      }
      stopPolling();
    }
  }, [stopPolling]);

  const startPolling = useCallback((jobId: string) => {
    stopPolling();
    // Initial check
    pollJobStatus(jobId);
    // Start interval
    pollingIntervalRef.current = window.setInterval(() => {
      pollJobStatus(jobId);
    }, 3000);
  }, [pollJobStatus, stopPolling]);

  useEffect(() => {
    // Cleanup on unmount
    return () => {
      stopPolling();
    };
  }, [stopPolling]);

  const handleGenerate = useCallback(async () => {
    if (!personImage || !productImage) {
      setError('Please upload both a person and a product image.');
      return;
    }
    
    setError(null);
    setCurrentJob(null);

    try {
      const { jobId } = await submitGenerationJob(personImage, productImage);
      
      const pendingJob: Job = { 
        id: jobId, 
        status: 'PENDING', 
        personImage, 
        productImage, 
        createdAt: Date.now() 
      };
      setCurrentJob(pendingJob);
      startPolling(jobId);

    } catch (err) {
      if (err instanceof Error) {
        setError(err.message); // Use the message directly from the service
      } else {
        setError('An unknown error occurred during job submission.');
      }
    }
  }, [personImage, productImage, startPolling]);

  const handleReuse = useCallback((item: HistoryItem) => {
    setPersonImage(item.personImage);
    setProductImage(item.productImage);
    setCurrentJob(null);
    setError(null);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  const handleDelete = useCallback((id: string) => {
    setHistory(prev => prev.filter(item => item.id !== id));
  }, []);

  const isLoading = currentJob?.status === 'PENDING' || currentJob?.status === 'PROCESSING';
  const canGenerate = personImage && productImage && !isLoading;

  return (
    <div className="flex flex-col min-h-screen bg-slate-900 text-slate-200 font-sans">
      <Header onOpenGuide={() => setIsGuideOpen(true)} />
      {isGuideOpen && <GuideModal onClose={() => setIsGuideOpen(false)} />}
      <main className="flex-grow container mx-auto p-4 md:p-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div className="bg-slate-800/50 p-6 rounded-2xl shadow-lg flex flex-col gap-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <ImageUploader label="Person Image" onImageUpload={setPersonImage} initialImage={personImage} />
              <ImageUploader label="Clothing Item" onImageUpload={setProductImage} initialImage={productImage} allowCropping />
            </div>
          </div>
          <div className="bg-slate-800/50 p-6 rounded-2xl shadow-lg">
            <h2 className="text-2xl font-bold text-cyan-400 mb-6">Generated Result</h2>
            <ResultDisplay job={currentJob} error={error} />
          </div>
        </div>
        <div className="sticky bottom-0 left-0 right-0 mt-8 p-4 bg-slate-900/80 backdrop-blur-sm border-t border-slate-700/50 flex justify-center">
          <button
            onClick={handleGenerate}
            disabled={!canGenerate}
            className="w-full max-w-md bg-cyan-500 hover:bg-cyan-400 disabled:bg-slate-600 disabled:cursor-not-allowed text-white font-bold py-4 px-8 rounded-full text-lg shadow-lg shadow-cyan-500/20 transition-all duration-300 transform hover:scale-105 disabled:scale-100 disabled:shadow-none"
          >
            {isLoading ? 'Processing in Background...' : '✨ Perform Virtual Try-On'}
          </button>
        </div>
        <HistoryGallery history={history} onReuse={handleReuse} onDelete={handleDelete} />
      </main>
      <Footer />
    </div>
  );
}

export default App;
