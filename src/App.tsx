import React, { useState, useCallback, useEffect, useRef } from 'react';
import Header from './components/Header';
import ImageUploader from './components/ImageUploader';
import ResultDisplay from './components/ResultDisplay';
import Footer from './components/Footer';
import HistoryGallery from './components/HistoryGallery';
import { submitGenerationJob, checkJobStatus } from './services/vertexAIService';
import type { HistoryItem, Job } from './types';

const POLLING_INTERVAL = 3000; // Poll every 3 seconds

function App() {
  const [personImage, setPersonImage] = useState<string | null>(null);
  const [productImage, setProductImage] = useState<string | null>(null);
  const [activeJob, setActiveJob] = useState<Job | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [allowAdult, setAllowAdult] = useState(false);
  const [history, setHistory] = useState<HistoryItem[]>(() => {
    try {
      const savedHistory = localStorage.getItem('vto-history');
      return savedHistory ? JSON.parse(savedHistory) : [];
    } catch {
      return [];
    }
  });

  const pollingIntervalRef = useRef<number | null>(null);

  const saveHistory = (newHistory: HistoryItem[]) => {
    setHistory(newHistory);
    localStorage.setItem('vto-history', JSON.stringify(newHistory));
  };

  const handleJobCompletion = useCallback((completedJob: Job) => {
    if (completedJob.resultImage) {
      const newHistoryItem: HistoryItem = {
        id: completedJob.id,
        personImage: completedJob.personImage,
        productImage: completedJob.productImage,
        resultImage: completedJob.resultImage,
        createdAt: Date.now(),
      };
      saveHistory([newHistoryItem, ...history]);
    }
    setActiveJob(null);
  }, [history]);

  const pollJobStatus = useCallback(async (jobId: string) => {
    try {
      const response = await checkJobStatus(jobId);
      const job = response.job;
      setActiveJob(job);

      if (job.status === 'COMPLETED' || job.status === 'FAILED') {
        if (pollingIntervalRef.current) {
          clearInterval(pollingIntervalRef.current);
          pollingIntervalRef.current = null;
        }
        if (job.status === 'FAILED') {
          setError(`Job ${job.id} failed: ${job.error || 'Unknown reason'}`);
        }
        handleJobCompletion(job);
      }
    } catch (err) {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
        pollingIntervalRef.current = null;
      }
      setError(err instanceof Error ? err.message : 'Failed to poll job status.');
      setActiveJob(null);
    }
  }, [handleJobCompletion]);

  useEffect(() => {
    // Cleanup interval on unmount
    return () => {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
      }
    };
  }, []);
  
  const handleGenerate = useCallback(async () => {
    if (!personImage || !productImage) {
      setError('Please upload both a person and a product image.');
      return;
    }
    if (activeJob) return;

    setError(null);
    setActiveJob({ id: 'temp', status: 'PENDING', personImage, productImage, createdAt: Date.now() });

    try {
      const { jobId } = await submitGenerationJob(personImage, productImage, allowAdult);
      setActiveJob(prev => prev ? { ...prev, id: jobId, status: 'PROCESSING' } : null);
      
      if (pollingIntervalRef.current) clearInterval(pollingIntervalRef.current);
      pollingIntervalRef.current = window.setInterval(() => {
        pollJobStatus(jobId);
      }, POLLING_INTERVAL);

    } catch (err) {
      setError(err instanceof Error ? `Submission failed: ${err.message}` : 'An unknown error occurred.');
      setActiveJob(null);
    }
  }, [personImage, productImage, allowAdult, activeJob, pollJobStatus]);

  const handleReuse = (item: HistoryItem) => {
    setPersonImage(item.personImage);
    setProductImage(item.productImage);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDelete = (id: string) => {
    saveHistory(history.filter(item => item.id !== id));
  };
  
  const canGenerate = personImage && productImage && !activeJob;

  return (
    <div className="flex flex-col min-h-screen bg-slate-900 text-slate-200 font-sans">
      <Header />
      <main className="flex-grow container mx-auto p-4 md:p-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div className="bg-slate-800/50 p-6 rounded-2xl shadow-lg flex flex-col gap-6">
            <h2 className="text-2xl font-bold text-cyan-400">Upload Your Images</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <ImageUploader label="Person Image" onImageUpload={setPersonImage} value={personImage}/>
              <ImageUploader label="Clothing Item" onImageUpload={setProductImage} value={productImage}/>
            </div>
            <div className="flex items-center space-x-3 mt-4 bg-slate-700/50 p-4 rounded-lg">
              <input
                type="checkbox"
                id="allowAdult"
                checked={allowAdult}
                onChange={(e) => setAllowAdult(e.target.checked)}
                className="h-5 w-5 rounded border-gray-300 text-cyan-500 focus:ring-cyan-500 bg-slate-800"
              />
              <label htmlFor="allowAdult" className="text-slate-300 select-none">
                Restrict Generation to Adults Only
              </label>
            </div>
          </div>
          <div className="bg-slate-800/50 p-6 rounded-2xl shadow-lg">
             <h2 className="text-2xl font-bold text-cyan-400 mb-6">Generated Result</h2>
            <ResultDisplay
              job={activeJob}
              error={error}
            />
          </div>
        </div>
        <HistoryGallery history={history} onReuse={handleReuse} onDelete={handleDelete} />
      </main>
      <div className="sticky bottom-0 left-0 right-0 mt-8 p-4 bg-slate-900/80 backdrop-blur-sm border-t border-slate-700/50 flex justify-center">
          <button
              onClick={handleGenerate}
              disabled={!canGenerate}
              className="w-full max-w-md bg-cyan-500 hover:bg-cyan-400 disabled:bg-slate-600 disabled:cursor-not-allowed text-white font-bold py-4 px-8 rounded-full text-lg shadow-lg shadow-cyan-500/20 transition-all duration-300 transform hover:scale-105 disabled:scale-100 disabled:shadow-none"
          >
              {activeJob ? `Processing (${activeJob.status})...` : '✨ Perform Virtual Try-On'}
          </button>
      </div>
      <Footer />
    </div>
  );
}

export default App;
