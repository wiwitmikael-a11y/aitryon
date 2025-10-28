import React from 'react';
import type { Tool } from '../App';

type ActiveView = 'dashboard' | Tool;

interface HeaderProps {
  activeView: ActiveView;
  onBack: () => void;
}

const viewTitles: Record<ActiveView, string> = {
  'dashboard': 'AI Creative Suite',
  'try-on': 'Virtual Try-On',
  'stock-photo': 'Stock Photo Generator',
  'video-generator': 'B-Roll Video Generator',
  'creative-director': 'AI Creative Director'
};

const Header: React.FC<HeaderProps> = ({ activeView, onBack }) => {
  return (
    <header className="bg-slate-800/50 border-b border-slate-700/50 shadow-md sticky top-0 z-40 backdrop-blur-sm">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center gap-4">
            {activeView !== 'dashboard' && (
              <button onClick={onBack} className="text-slate-300 hover:text-cyan-400 transition-colors p-2 rounded-full -ml-2">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
            )}
            <span className="text-xl sm:text-2xl font-bold text-white">
              {viewTitles[activeView]}
            </span>
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header;
