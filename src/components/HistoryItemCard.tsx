import React from 'react';
import type { HistoryItem } from '../types';
import { ReuseIcon } from './icons/ReuseIcon';
import { DeleteIcon } from './icons/DeleteIcon';
import { DownloadIcon } from './icons/DownloadIcon';

interface HistoryItemCardProps {
  item: HistoryItem;
  onReuse: () => void;
  onDelete: () => void;
}

const HistoryItemCard: React.FC<HistoryItemCardProps> = ({ item, onReuse, onDelete }) => {
  const handleDownload = (e: React.MouseEvent) => {
    e.stopPropagation();
    const link = document.createElement('a');
    link.href = item.resultImage;
    link.download = `try-on-${item.id.substring(0, 8)}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleReuseClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onReuse();
  }

  const handleDeleteClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onDelete();
  }

  return (
    <div className="group relative aspect-[4/5] bg-slate-800 rounded-lg overflow-hidden shadow-lg cursor-pointer">
      <img src={item.resultImage} alt="Generated try-on" className="w-full h-full object-cover transition-transform group-hover:scale-105" />
      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-between p-2">
        <div className="flex justify-end gap-2">
           <button onClick={handleDownload} className="p-2 rounded-full bg-slate-700/80 hover:bg-green-600 text-white transition-colors" title="Download">
            <DownloadIcon />
          </button>
          <button onClick={handleReuseClick} className="p-2 rounded-full bg-slate-700/80 hover:bg-cyan-600 text-white transition-colors" title="Reuse Images">
            <ReuseIcon />
          </button>
          <button onClick={handleDeleteClick} className="p-2 rounded-full bg-slate-700/80 hover:bg-red-600 text-white transition-colors" title="Delete">
            <DeleteIcon />
          </button>
        </div>
        <div className="flex gap-1 p-1 bg-black/50 rounded-md">
            <img src={item.personImage} alt="Person" className="w-8 h-8 object-cover rounded-sm border-2 border-slate-500" />
            <img src={item.productImage} alt="Product" className="w-8 h-8 object-cover rounded-sm border-2 border-slate-500" />
        </div>
      </div>
    </div>
  );
};

export default HistoryItemCard;
