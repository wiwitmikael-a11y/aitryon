import React from 'react';
import { SpinnerIcon } from './icons/SpinnerIcon';

interface ResultDisplayProps {
  generatedImage: string | null;
  isLoading: boolean;
  error: string | null;
}

const ResultDisplay: React.FC<ResultDisplayProps> = ({ generatedImage, isLoading, error }) => {
  const handleDownload = () => {
    if (generatedImage) {
      const link = document.createElement('a');
      link.href = generatedImage;
      link.download = 'virtual-try-on-result.png';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  const renderContent = () => {
    if (isLoading) {
      return (
        <div className="flex flex-col items-center justify-center h-full text-center">
          <SpinnerIcon />
          <p className="text-slate-400 mt-4 text-lg">Generating your image...</p>
          <p className="text-slate-500 text-sm">This may take a moment.</p>
        </div>
      );
    }

    if (error) {
      return (
        <div className="flex flex-col items-center justify-center h-full text-center bg-red-900/20 p-4 rounded-lg">
           <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
             <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
           </svg>
          <p className="text-red-400 mt-4 font-semibold">An Error Occurred</p>
          <p className="text-slate-300 mt-2 text-sm break-words">{error}</p>
        </div>
      );
    }

    if (generatedImage) {
      return (
        <div className="flex flex-col items-center gap-4">
            <img
                src={generatedImage}
                alt="Generated virtual try-on"
                className="w-full h-auto max-h-[60vh] object-contain rounded-lg shadow-2xl"
            />
            <button
              onClick={handleDownload}
              className="mt-4 bg-green-600 hover:bg-green-500 text-white font-bold py-2 px-6 rounded-full transition-colors duration-300"
            >
              Download Image
            </button>
        </div>
      );
    }

    return (
      <div className="flex flex-col items-center justify-center h-full text-center text-slate-500">
        <svg xmlns="http://www.w3.org/2000/svg" className="h-16 w-16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1">
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
        <p className="mt-4">Your generated image will appear here.</p>
        <p className="text-sm">Upload images and click generate to start.</p>
      </div>
    );
  };
  
  return (
    <div className="w-full h-full min-h-[300px] flex items-center justify-center bg-slate-900/50 rounded-lg p-4">
        {renderContent()}
    </div>
  );
};

export default ResultDisplay;
