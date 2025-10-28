import React from 'react';
import type { Tool } from '../App';
import { TryOnIcon } from './icons/TryOnIcon';
import { PhotoIcon } from './icons/PhotoIcon';
import { VideoGeneratorIcon } from './icons/VideoGeneratorIcon';
import { DirectorIcon } from './icons/DirectorIcon'; 
import { ViralVideoIcon } from './icons/ViralVideoIcon';

interface DashboardProps {
  onSelectTool: (tool: Tool) => void;
}

const tools: { id: Tool; title: string; description: string; icon: React.FC }[] = [
  {
    id: 'try-on',
    title: 'Virtual Try-On',
    description: 'Upload a photo of a person and a clothing item to see how it fits.',
    icon: TryOnIcon,
  },
  {
    id: 'stock-photo',
    title: 'AI Art Director',
    description: 'Generate high-quality, professional stock photos with precise art direction or in batches.',
    icon: PhotoIcon,
  },
  {
    id: 'video-generator',
    title: 'Cinematic Video Director',
    description: 'Create stunning, short videos from a text prompt or a reference image using Veo.',
    icon: VideoGeneratorIcon,
  },
  {
    id: 'creative-director',
    title: 'AI Creative Director',
    description: 'Develop a content strategy and generate a package of photos and videos from a single idea.',
    icon: DirectorIcon,
  },
  {
    id: 'viral-video',
    title: 'Viral Affiliate Video',
    description: 'Buat video afiliasi viral secara otomatis dari gambar dan deskripsi produk.',
    icon: ViralVideoIcon,
  },
];

const Dashboard: React.FC<DashboardProps> = ({ onSelectTool }) => {
  return (
    <div className="space-y-12">
      <div className="text-center max-w-3xl mx-auto">
        <h1 className="text-4xl md:text-5xl font-bold text-white mb-4">AI Creative Suite</h1>
        <p className="text-lg text-slate-400">Your comprehensive toolkit for next-generation content creation, strategy, and analysis.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {tools.map((tool) => (
          <button
            key={tool.id}
            onClick={() => onSelectTool(tool.id)}
            className="group bg-slate-900/50 hover:bg-slate-900 border border-slate-800 hover:border-cyan-500/50 p-6 rounded-2xl text-left transition-all duration-300 transform hover:-translate-y-1"
          >
            <div className="flex items-start gap-5">
              <div className="bg-slate-800/70 p-3 rounded-lg border border-slate-700">
                <tool.icon />
              </div>
              <div>
                <h3 className="text-xl font-bold text-slate-100 group-hover:text-cyan-400 transition-colors">{tool.title}</h3>
                <p className="text-slate-400 mt-1">{tool.description}</p>
              </div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
};

export default Dashboard;