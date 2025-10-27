import React from 'react';
import { DownloadIcon } from './icons/DownloadIcon';
import { ReuseIcon } from './icons/ReuseIcon';
import { DeleteIcon } from './icons/DeleteIcon';
import type { HistoryItem } from '../types';

interface HistoryItemCardProps {
    item: HistoryItem;
    onReuse: () => void;
    onDelete: () => void;
}

const HistoryItemCard: React.FC<HistoryItemCardProps> = ({ item, onReuse, onDelete }) => {
    
    const handleDownload = () => {
        const link = document.createElement('a');
        link.href = item.resultImage;
        link.download = `vto-result-${item.id}.png`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    return (
        <div className="group relative bg-slate-700/50 rounded-lg overflow-hidden shadow-md">
            <img src={item.resultImage} alt={`Generated result ${item.id}`} className="w-full aspect-[4/5] object-cover"/>
            <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex justify-center items-center gap-4">
                <button onClick={handleDownload} title="Download" className="p-3 text-white hover:text-cyan-400 transition-colors rounded-full bg-slate-900/50 hover:bg-slate-800/70">
                    <DownloadIcon />
                </button>
                <button onClick={onReuse} title="Reuse Images" className="p-3 text-white hover:text-cyan-400 transition-colors rounded-full bg-slate-900/50 hover:bg-slate-800/70">
                    <ReuseIcon />
                </button>
                <button onClick={onDelete} title="Delete" className="p-3 text-white hover:text-red-500 transition-colors rounded-full bg-slate-900/50 hover:bg-slate-800/70">
                    <DeleteIcon />
                </button>
            </div>
        </div>
    );
};

export default HistoryItemCard;
