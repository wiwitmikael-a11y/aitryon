import React from 'react';
import { InfoIcon } from './icons/InfoIcon';

interface HeaderProps {
    onOpenGuide: () => void;
}

const Header: React.FC<HeaderProps> = ({ onOpenGuide }) => {
  return (
    <header className="bg-slate-800/50 border-b border-slate-700/50 shadow-md">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center">
            <span className="text-2xl font-bold text-white">
              AI <span className="text-cyan-400">Virtual Try-On</span>
            </span>
          </div>
           <div className="flex items-center">
             <button onClick={onOpenGuide} className="text-slate-400 hover:text-cyan-400 transition-colors p-2 rounded-full hover:bg-slate-700/50">
                 <InfoIcon />
                 <span className="sr-only">Open Guide</span>
             </button>
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header;
