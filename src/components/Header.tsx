import React from 'react';
import { InfoIcon } from './icons/InfoIcon';

interface HeaderProps {
  onShowGuide: () => void;
}

const Header: React.FC<HeaderProps> = ({ onShowGuide }) => {
  return (
    <header className="bg-slate-800/50 border-b border-slate-700/50 shadow-md">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center">
            <span className="text-2xl font-bold text-white">
              AI <span className="text-cyan-400">Virtual Try-On</span>
            </span>
          </div>
          <button onClick={onShowGuide} className="flex items-center gap-2 text-slate-300 hover:text-cyan-400 transition-colors">
            <InfoIcon />
            <span className="hidden sm:inline">Upload Guide</span>
          </button>
        </div>
      </div>
    </header>
  );
};

export default Header;
