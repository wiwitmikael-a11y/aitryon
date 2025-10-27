import React from 'react';

interface GuideModalProps {
  onClose: () => void;
}

const GuideModal: React.FC<GuideModalProps> = ({ onClose }) => {
  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex justify-center items-center z-50 p-4">
      <div className="bg-slate-800 rounded-lg shadow-xl w-full max-w-2xl flex flex-col">
        <h3 className="text-xl font-bold text-center p-4 border-b border-slate-700">How to Use</h3>
        <div className="p-4">
            <p>Guide content will be added here.</p>
        </div>
        <div className="p-4 flex justify-end">
          <button onClick={onClose} className="px-6 py-2 rounded-md bg-cyan-600 hover:bg-cyan-500 text-white transition-colors">
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default GuideModal;
