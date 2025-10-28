import React, { useState } from 'react';
import Header from './components/Header';
import Dashboard from './components/Dashboard';
import VirtualTryOn from './components/VirtualTryOn';
import StockPhotoGenerator from './components/StockPhotoGenerator';
import VideoGenerator from './components/VideoGenerator';
import CreativeDirector from './components/CreativeDirector';
import Footer from './components/Footer';

export type Tool = 'dashboard' | 'try-on' | 'stock-photo' | 'video-generator' | 'creative-director';

function App() {
  const [activeTool, setActiveTool] = useState<Tool>('dashboard');

  const renderTool = () => {
    switch (activeTool) {
      case 'try-on':
        return <VirtualTryOn />;
      case 'stock-photo':
        return <StockPhotoGenerator />;
      case 'video-generator':
        return <VideoGenerator />;
      case 'creative-director':
        return <CreativeDirector />;
      case 'dashboard':
      default:
        return <Dashboard onSelectTool={setActiveTool} />;
    }
  };

  return (
    <div className="flex flex-col min-h-screen bg-slate-950 text-slate-200 font-sans relative">
      <div className="absolute inset-0 bg-grid-pattern z-0"></div>
      <div className="relative z-10 flex flex-col min-h-screen">
        <Header 
          activeTool={activeTool}
          onNavigateHome={() => setActiveTool('dashboard')} 
        />
        <main className="flex-grow container mx-auto px-4 py-8 md:py-12">
          {renderTool()}
        </main>
        <Footer />
      </div>
    </div>
  );
}

export default App;