import React from 'react';
import { CheckIcon } from './icons/CheckIcon';
import { CrossIcon } from './icons/CrossIcon';

interface GuideModalProps {
  onClose: () => void;
}

const GuideModal: React.FC<GuideModalProps> = ({ onClose }) => {
  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-slate-900 border border-slate-700 rounded-2xl shadow-xl w-full max-w-4xl max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="sticky top-0 bg-slate-900/80 backdrop-blur-sm z-10 p-4 sm:p-6 border-b border-slate-700 flex justify-between items-center">
          <h2 className="text-2xl font-bold text-cyan-400">Image Upload Guide</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-4 sm:p-6 grid grid-cols-1 md:grid-cols-2 gap-8">
          <div>
            <h3 className="text-xl font-semibold text-white mb-4">Person Image Tips</h3>
            <ul className="space-y-3 text-slate-300">
              <li className="flex items-start gap-3"><span className="text-green-400 mt-1"><CheckIcon /></span><span>Full body or upper body shots work best.</span></li>
              <li className="flex items-start gap-3"><span className="text-green-400 mt-1"><CheckIcon /></span><span>Simple backgrounds are preferred.</span></li>
              <li className="flex items-start gap-3"><span className="text-green-400 mt-1"><CheckIcon /></span><span>Good lighting, clear and high-resolution images.</span></li>
              <li className="flex items-start gap-3"><span className="text-red-400 mt-1"><CrossIcon /></span><span>Avoid group photos or multiple people.</span></li>
              <li className="flex items-start gap-3"><span className="text-red-400 mt-1"><CrossIcon /></span><span>Avoid major obstructions (e.g., holding a large object).</span></li>
              <li className="flex items-start gap-3"><span className="text-red-400 mt-1"><CrossIcon /></span><span>Avoid blurry or low-quality images.</span></li>
            </ul>
          </div>
          <div>
            <h3 className="text-xl font-semibold text-white mb-4">Clothing Item Tips</h3>
            <ul className="space-y-3 text-slate-300">
              <li className="flex items-start gap-3"><span className="text-green-400 mt-1"><CheckIcon /></span><span>Image should show only the clothing item.</span></li>
              <li className="flex items-start gap-3"><span className="text-green-400 mt-1"><CheckIcon /></span><span>Use a "flat lay" or mannequin photo.</span></li>
              <li className="flex items-start gap-3"><span className="text-green-400 mt-1"><CheckIcon /></span><span>Clear, well-lit, and high-resolution.</span></li>
              <li className="flex items-start gap-3"><span className="text-red-400 mt-1"><CrossIcon /></span><span>Don't use images where a person is wearing the item.</span></li>
              <li className="flex items-start gap-3"><span className="text-red-400 mt-1"><CrossIcon /></span><span>Avoid cluttered backgrounds or extra items in the photo.</span></li>
              <li className="flex items-start gap-3"><span className="text-red-400 mt-1"><CrossIcon /></span><span>Avoid images with heavy shadows or poor lighting.</span></li>
            </ul>
          </div>
        </div>

        <div className="px-6 pb-6 text-center">
            <button onClick={onClose} className="w-full max-w-xs mt-4 bg-cyan-600 hover:bg-cyan-500 text-white font-bold py-3 px-6 rounded-full transition-colors duration-300">
                Got it, let's start!
            </button>
        </div>
      </div>
    </div>
  );
};

export default GuideModal;