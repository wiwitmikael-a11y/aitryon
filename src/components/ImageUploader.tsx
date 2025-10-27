import React, { useRef, useState, useCallback, ChangeEvent, useEffect } from 'react';
import { Area } from 'react-easy-crop';
import { UploadIcon } from './icons/UploadIcon';
import CropperModal from './CropperModal';
import { getCroppedImg } from '../utils/imageUtils';

interface ImageUploaderProps {
  onImageUpload: (base64: string | null) => void;
  label: string;
  initialImage?: string | null;
  allowCropping?: boolean;
}

const ImageUploader: React.FC<ImageUploaderProps> = ({ onImageUpload, label, initialImage, allowCropping }) => {
  const [preview, setPreview] = useState<string | null>(null);
  const [originalImage, setOriginalImage] = useState<string | null>(null);
  const [isCropperOpen, setIsCropperOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setPreview(initialImage || null);
  }, [initialImage]);

  const handleFileChange = useCallback((event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64String = reader.result as string;
        if (allowCropping) {
          setOriginalImage(base64String);
          setIsCropperOpen(true);
        } else {
          setPreview(URL.createObjectURL(file));
          onImageUpload(base64String);
        }
      };
      reader.readAsDataURL(file);
    }
  }, [onImageUpload, allowCropping]);

  const handleClick = () => {
    inputRef.current?.click();
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    setPreview(null);
    onImageUpload(null);
    if (inputRef.current) {
      inputRef.current.value = '';
    }
  };

  const handleCropComplete = useCallback(async (croppedAreaPixels: Area) => {
    if (originalImage) {
      try {
        const croppedImageBase64 = await getCroppedImg(originalImage, croppedAreaPixels);
        setPreview(croppedImageBase64);
        onImageUpload(croppedImageBase64);
      } catch (e) {
        console.error('Cropping failed:', e);
        // Fallback to original image if crop fails
        setPreview(originalImage);
        onImageUpload(originalImage);
      } finally {
        setIsCropperOpen(false);
        setOriginalImage(null);
      }
    }
  }, [originalImage, onImageUpload]);

  return (
    <>
      {isCropperOpen && originalImage && (
        <CropperModal
          imageSrc={originalImage}
          onCropComplete={handleCropComplete}
          onClose={() => {
            setIsCropperOpen(false);
            setOriginalImage(null);
          }}
        />
      )}
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
              <p className="mb-2 text-sm text-slate-400">
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
      </div>
    </>
  );
};

export default ImageUploader;
