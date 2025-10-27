// FIX: Restored file content that was corrupted, causing it to be an invalid module.
import React, { useState, useCallback } from 'react';
import Header from './components/Header';
import ImageUploader from './components/ImageUploader';
import ResultDisplay from './components/ResultDisplay';
import Footer from './components/Footer';
import { generateTryOnImage } from './services/vertexAIService';

function App() {
  const [personImage, setPersonImage] = useState<string | null>(null);
  const [productImage, setProductImage] = useState<string | null>(null);
  const [generatedImage, setGeneratedImage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [allowAdult, setAllowAdult] = useState(true);

  const handleGenerate = useCallback(async () => {
    if (!personImage || !productImage) {
      setError('Please upload both a person and a product image.');
      return;
    }

    setIsLoading(true);
    setError(null);
    setGeneratedImage(null);

    try {
      const result = await generateTryOnImage(personImage, productImage, allowAdult);
      setGeneratedImage(result);
    } catch (err) {
      if (err instanceof Error) {
        setError(`Generation failed: ${err.message}`);
      } else {
        setError('An unknown error occurred during image generation.');
      }
    } finally {
      setIsLoading(false);
    }
  }, [personImage, productImage, allowAdult]);

  const canGenerate = personImage && productImage && !isLoading;

  return (
    <div className="flex flex-col min-h-screen bg-slate-900 text-slate-200 font-sans">
      <Header />
      <main className="flex-grow container mx-auto p-4 md:p-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Input Section */}
          <div className="bg-slate-800/50 p-6 rounded-2xl shadow-lg flex flex-col gap-6">
            <h2 className="text-2xl font-bold text-cyan-400">Upload Your Images</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <ImageUploader label="Person Image" onImageUpload={setPersonImage} />
              <ImageUploader label="Clothing Item" onImageUpload={setProductImage} />
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
                Allow Adult Generation Mode
              </label>
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

        {/* Sticky Action Bar */}
        <div className="sticky bottom-0 left-0 right-0 mt-8 p-4 bg-slate-900/80 backdrop-blur-sm border-t border-slate-700/50 flex justify-center">
            <button
                onClick={handleGenerate}
                disabled={!canGenerate}
                className="w-full max-w-md bg-cyan-500 hover:bg-cyan-400 disabled:bg-slate-600 disabled:cursor-not-allowed text-white font-bold py-4 px-8 rounded-full text-lg shadow-lg shadow-cyan-500/20 transition-all duration-300 transform hover:scale-105 disabled:scale-100 disabled:shadow-none"
            >
                {isLoading ? 'Generating...' : '✨ Perform Virtual Try-On'}
            </button>
        </div>
      </main>
      <Footer />
    </div>
  );
}

export default App;
