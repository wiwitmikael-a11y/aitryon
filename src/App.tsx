import React, { useState } from 'react';
import Header from './components/Header';
import Footer from './components/Footer';
import VirtualTryOn from './components/VirtualTryOn';
import StockPhotoGenerator from './components/StockPhotoGenerator';
import VideoGenerator from './components/VideoGenerator';
import CreativeDirector from './components/CreativeDirector';
import Dashboard from './components/Dashboard';

export type Tool = 'try-on' | 'stock-photo' | 'video-generator' | 'creative-director';
type ActiveView = 'dashboard' | Tool;

function App() {
  const [activeView, setActiveView] = useState<ActiveView>('dashboard');

  const renderActiveView = () => {
    switch (activeView) {
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
        return <Dashboard onSelectTool={setActiveView} />;
    }
  };

  return (
    <div className="flex flex-col min-h-screen bg-slate-900 text-slate-200 font-sans">
      <Header 
        activeView={activeView} 
        onBack={() => setActiveView('dashboard')} 
      />
      <main className="flex-grow container mx-auto p-4 md:p-8">
        {renderActiveView()}
      </main>
      <Footer />
    </div>
  );
}

export default App;
