import React, { useState, useCallback } from 'react';
import Cropper from 'react-easy-crop';
import { Point, Area } from 'react-easy-crop/types';

interface CropperModalProps {
  imageSrc: string;
  onCropComplete: (croppedAreaPixels: Area) => void;
  onClose: () => void;
}

const CropperModal: React.FC<CropperModalProps> = ({ imageSrc, onCropComplete, onClose }) => {
  const [crop, setCrop] = useState<Point>({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);

  const onCropCompleteCallback = useCallback((croppedArea: Area, croppedAreaPixels: Area) => {
    setCroppedAreaPixels(croppedAreaPixels);
  }, []);
  
  const handleConfirmCrop = () => {
    if (croppedAreaPixels) {
      onCropComplete(croppedAreaPixels);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex justify-center items-center z-50 p-4">
      <div className="bg-slate-800 rounded-lg shadow-xl w-full max-w-2xl flex flex-col">
        <h3 className="text-xl font-bold text-center p-4 border-b border-slate-700">Crop Clothing Item</h3>
        <div className="relative w-full h-96">
          <Cropper
            image={imageSrc}
            crop={crop}
            zoom={zoom}
            aspect={4 / 5}
            onCropChange={setCrop}
            onZoomChange={setZoom}
            onCropComplete={onCropCompleteCallback}
          />
        </div>
        <div className="p-4 flex flex-col gap-4">
            <div className='flex items-center gap-4'>
                <label className="text-slate-400">Zoom</label>
                 <input
                    type="range"
                    value={zoom}
                    min={1}
                    max={3}
                    step={0.1}
                    aria-labelledby="Zoom"
                    onChange={(e) => setZoom(Number(e.target.value))}
                    className="w-full"
                />
            </div>
          
            <div className="flex justify-end gap-4 mt-2">
                <button onClick={onClose} className="px-6 py-2 rounded-md bg-slate-600 hover:bg-slate-500 transition-colors">
                    Cancel
                </button>
                <button onClick={handleConfirmCrop} className="px-6 py-2 rounded-md bg-cyan-600 hover:bg-cyan-500 text-white transition-colors">
                    Confirm Crop
                </button>
            </div>
        </div>
      </div>
    </div>
  );
};

export default CropperModal;
