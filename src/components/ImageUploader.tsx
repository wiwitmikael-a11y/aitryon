import React, { useRef, useState, useCallback, ChangeEvent } from 'react';
import { UploadIcon } from './icons/UploadIcon';

interface ImageUploaderProps {
  onImageUpload: (base64: string, file?: File) => void;
  onCropRequest?: (base64: string) => void;
  label: string;
  initialImage?: string | null;
}

const ImageUploader: React.FC<ImageUploaderProps> = ({ onImageUpload, onCropRequest, label, initialImage }) => {
  const [preview, setPreview] = useState<string | null>(initialImage || null);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = useCallback((event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64String = reader.result as string;
        if (onCropRequest) {
          onCropRequest(base64String);
        } else {
          setPreview(base64String); // Use base64 for preview consistency
          onImageUpload(base64String, file);
        }
      };
      reader.readAsDataURL(file);
    }
  }, [onImageUpload, onCropRequest]);

  const handleClick = () => {
    inputRef.current?.click();
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    setPreview(null);
    onImageUpload('');
    if (inputRef.current) {
        inputRef.current.value = '';
    }
  }

  React.useEffect(() => {
    setPreview(initialImage || null);
  }, [initialImage]);

  return (
    <div className="w-full">
      <p className="text-slate-300 font-semibold mb-2 text-sm">{label}</p>
      <div
        onClick={handleClick}
        className="relative flex items-center justify-center w-full h-48 border-2 border-slate-700 border-dashed rounded-lg cursor-pointer bg-slate-800/50 hover:bg-slate-800 hover:border-cyan-500 transition-colors"
      >
        {preview ? (
            <>
                <img src={preview} alt="Preview" className="w-full h-full object-contain rounded-lg p-1" />
                <button onClick={handleClear} className="absolute top-2 right-2 bg-slate-900/80 hover:bg-red-600 text-white rounded-full p-1.5 shadow-md transition-all transform hover:scale-110 z-10">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                </button>
            </>
        ) : (
          <div className="flex flex-col items-center justify-center text-center">
            <UploadIcon />
            <p className="text-sm text-slate-400">
              <span className="font-semibold text-cyan-400">Click to upload</span>
            </p>
            <p className="text-xs text-slate-500 mt-1">PNG, JPG, or WEBP</p>
          </div>
        )}
        <input
          ref={inputRef}
          type="file"
          className="hidden"
          accept="image/png, image/jpeg, image/webp"
          onChange={handleFileChange}
        />
      </div>
    </div>
  );
};

export default ImageUploader;