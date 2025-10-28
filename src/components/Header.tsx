import React from 'react';
import type { Tool } from '../App';

interface HeaderProps {
    activeTool: Tool;
    onNavigateHome: () => void;
}

const Header: React.FC<HeaderProps> = ({ activeTool, onNavigateHome }) => {

  const toolTitles: Record<Tool, string> = {
    'dashboard': 'AI Creative Suite',
    'try-on': 'Virtual Try-On',
    'stock-photo': 'Stock Photo Generator',
    'video-generator': 'B-Roll Video Generator',
    'creative-director': 'AI Creative Director'
  }

  return (
    <header className="bg-slate-800/50 border-b border-slate-700/50 shadow-md sticky top-0 z-40 backdrop-blur-sm">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center gap-4">
             <button onClick={onNavigateHome} className="text-xl sm:text-2xl font-bold text-white hover:text-cyan-400 transition-colors">
              AI Creative Suite
            </button>
            {activeTool !== 'dashboard' && (
              <>
                <span className="text-slate-500 text-xl">/</span>
                <span className="text-lg sm:text-xl font-semibold text-slate-300">{toolTitles[activeTool]}</span>
              </>
            )}
          </div>

          {activeTool !== 'dashboard' && (
             <button onClick={onNavigateHome} className="text-sm font-semibold text-cyan-400 hover:text-cyan-300 transition-colors">
              &larr; Back to Dashboard
            </button>
          )}
        </div>
      </div>
    </header>
  );
};

export default Header;