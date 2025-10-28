import React from 'react';
import type { Tool } from '../App';
import { TryOnIcon } from './icons/TryOnIcon';
import { PhotoIcon } from './icons/PhotoIcon';
import { VideoGeneratorIcon } from './icons/VideoGeneratorIcon';
import { DirectorIcon } from './icons/DirectorIcon';

interface DashboardProps {
  onSelectTool: (tool: Tool) => void;
}

const ToolCard: React.FC<{
  title: string;
  description: string;
  icon: React.ReactNode;
  onClick: () => void;
  isFeatured?: boolean;
}> = ({ title, description, icon, onClick, isFeatured }) => {
  const baseClasses = "bg-slate-800/50 rounded-2xl shadow-lg p-6 flex flex-col items-start hover:bg-slate-800 transition-all duration-300 cursor-pointer transform hover:-translate-y-1";
  const featuredClasses = isFeatured ? "ring-2 ring-cyan-500/50" : "";
  
  return (
    <div onClick={onClick} className={`${baseClasses} ${featuredClasses}`}>
      <div className="bg-slate-700/50 p-3 rounded-lg mb-4">
        {icon}
      </div>
      <h3 className="text-xl font-bold text-white mb-2">{title}</h3>
      <p className="text-slate-400 text-sm flex-grow">{description}</p>
      <span className="mt-4 text-cyan-400 font-semibold group-hover:text-cyan-300">
        Open Tool &rarr;
      </span>
    </div>
  );
};

const Dashboard: React.FC<DashboardProps> = ({ onSelectTool }) => {
  return (
    <div>
      <div className="text-center mb-12">
        <h1 className="text-4xl font-bold text-white">Welcome to the AI Creative Suite</h1>
        <p className="text-slate-400 mt-2 max-w-2xl mx-auto">Your all-in-one platform for next-generation content creation. Choose a tool below to get started.</p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        
        {/* AI Creative Director - Spanning two columns */}
        <div className="lg:col-span-2">
            <div onClick={() => onSelectTool('creative-director')} className="bg-gradient-to-br from-slate-800 to-slate-900 p-1 rounded-2xl shadow-2xl cursor-pointer transform hover:-translate-y-1 transition-transform duration-300 h-full">
                <div className="bg-slate-900 rounded-xl p-6 flex flex-col md:flex-row items-start gap-6 h-full">
                    <div className="bg-gradient-to-br from-cyan-500 to-teal-400 p-4 rounded-lg">
                       <DirectorIcon />
                    </div>
                    <div className="flex-grow">
                        <h3 className="text-2xl font-bold text-white mb-2">AI Creative Director</h3>
                        <p className="text-slate-400 mb-4">The ultimate automated workflow. From trend analysis to generating a complete batch of photos, videos, and metadata. Your entire content campaign, ready to download.</p>
                        <button className="bg-cyan-500 hover:bg-cyan-400 text-white font-bold py-2 px-6 rounded-full transition-colors">
                            Start New Project
                        </button>
                    </div>
                </div>
            </div>
        </div>

        <ToolCard
          title="Virtual Try-On"
          description="Upload an image of a person and a clothing item to see them wearing it."
          icon={<TryOnIcon />}
          onClick={() => onSelectTool('try-on')}
        />
        
        <ToolCard
          title="AI Art Director"
          description="Two modes: Use 'Art Director' mode for full creative control over style, or use 'Automated' mode to let AI research and produce a complete photo batch for you."
          icon={<PhotoIcon />}
          onClick={() => onSelectTool('stock-photo')}
        />

        <ToolCard
          title="Cinematic Video Director"
          description="Manually direct a story or let the AI research market trends and suggest themes, then automatically generate a complete, 35-second cinematic video."
          icon={<VideoGeneratorIcon />}
          onClick={() => onSelectTool('video-generator')}
        />

      </div>
    </div>
  );
};

export default Dashboard;