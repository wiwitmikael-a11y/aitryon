import React from 'react';
import HistoryItemCard from './HistoryItemCard';
import type { HistoryItem } from '../types';

interface HistoryGalleryProps {
    history: HistoryItem[];
    onReuse: (item: HistoryItem) => void;
    onDelete: (id: string) => void;
}

const HistoryGallery: React.FC<HistoryGalleryProps> = ({ history, onReuse, onDelete }) => {
  return (
    <div className="mt-12 bg-slate-900/50 p-6 rounded-2xl shadow-lg border border-slate-800">
        <h2 className="text-xl font-bold text-cyan-400 mb-6">Generation History</h2>
        {history.length > 0 ? (
             <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
                {history.map(item => (
                    <HistoryItemCard 
                        key={item.id}
                        item={item}
                        onReuse={() => onReuse(item)}
                        onDelete={() => onDelete(item.id)}
                    />
                ))}
            </div>
        ) : (
             <p className="text-center text-slate-500 mt-6 bg-slate-800/50 py-8 rounded-lg">
                Your generated images will appear here after you perform a virtual try-on.
            </p>
        )}
    </div>
  );
};

export default HistoryGallery;