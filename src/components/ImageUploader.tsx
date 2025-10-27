import React, { useRef, useState, useCallback, ChangeEvent } from 'react';
import { UploadIcon } from './icons/UploadIcon';
import CropperModal from './CropperModal';
import { getCroppedImg } from '../utils/imageUtils';

interface ImageUploaderProps {
  onImageUpload: (base64: string) => void;
  label: string;
  helperText?: string;
  croppable?: boolean;
}

const ImageUploader: React.FC<ImageUploaderProps> = ({ onImageUpload, label, helperText, croppable = false }) => {
  const [preview, setPreview] = useState<string | null>(null);
  const [imageToCrop, setImageToCrop] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = useCallback((event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64String = reader.result as string;
        if (croppable) {
          setImageToCrop(base64String);
        } else {
          setPreview(URL.createObjectURL(file));
          onImageUpload(base64String);
        }
      };
      reader.readAsDataURL(file);
    }
  }, [onImageUpload, croppable]);
  
  const handleCropComplete = useCallback(async (croppedAreaPixels: any) => {
    if (imageToCrop) {
      try {
        const croppedImageBase64 = await getCroppedImg(imageToCrop, croppedAreaPixels);
        setPreview(croppedImageBase64);
        onImageUpload(croppedImageBase64);
        setImageToCrop(null); 
      } catch (e) {
        console.error(e);
        // Fallback to original image if crop fails
        setPreview(imageToCrop);
        onImageUpload(imageToCrop);
        setImageToCrop(null);
      }
    }
  }, [imageToCrop, onImageUpload]);

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

  return (
    <div className="flex flex-col items-center justify-center w-full">
      <p className="text-slate-300 font-semibold mb-2">{label}</p>
      <div
        onClick={handleClick}
        className="relative flex flex-col items-center justify-center w-full h-64 border-2 border-slate-600 border-dashed rounded-lg cursor-pointer bg-slate-700/50 hover:bg-slate-700 transition-colors"
      >
        {preview ? (
            <>
                <img src={preview} alt="Preview" className="w-full h-full object-contain rounded-lg p-2" />
                <button onClick={handleClear} className="absolute top-2 right-2 bg-red-600/80 hover:bg-red-500 text-white rounded-full p-1.5 shadow-md transition-transform transform hover:scale-110">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                </button>
            </>
        ) : (
          <div className="flex flex-col items-center justify-center pt-5 pb-6 text-center">
            <UploadIcon />
            <p className="mb-2 text-sm text-slate-400 px-2">
              <span className="font-semibold">Click to upload</span>
            </p>
            <p className="text-xs text-slate-500">PNG, JPG, or WEBP</p>
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
       {helperText && <p className="text-xs text-slate-500 mt-2 text-center">{helperText}</p>}
       {imageToCrop && (
        <CropperModal
          imageSrc={imageToCrop}
          onCropComplete={handleCropComplete}
          onClose={() => setImageToCrop(null)}
        />
      )}
    </div>
  );
};

export default ImageUploader;
