import React, { useState, useCallback, useEffect } from 'react';
import Cropper from 'react-easy-crop';
import { X, Loader2, Move, ZoomIn, ZoomOut } from 'lucide-react';

async function getCroppedImg(imageSrc, pixelCrop) {
  const image = await new Promise((resolve, reject) => {
    const img = new Image();
    img.addEventListener('load', () => resolve(img));
    img.addEventListener('error', (error) => reject(error));
    img.setAttribute('crossOrigin', 'anonymous');
    img.src = imageSrc;
  });
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  canvas.width = pixelCrop.width;
  canvas.height = pixelCrop.height;
  ctx.drawImage(
    image,
    pixelCrop.x,
    pixelCrop.y,
    pixelCrop.width,
    pixelCrop.height,
    0,
    0,
    pixelCrop.width,
    pixelCrop.height
  );
  return new Promise((resolve) => {
    canvas.toBlob((file) => resolve(file), 'image/png', 0.95);
  });
}

export default function ImageCropper({ isOpen, imageFile, onCropComplete, onCancel }) {
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [previewUrl, setPreviewUrl] = useState('');

  useEffect(() => {
    if (imageFile) {
      const url = URL.createObjectURL(imageFile);
      setPreviewUrl(url);
      return () => URL.revokeObjectURL(url);
    }
  }, [imageFile]);

  const onCropCompleteCb = useCallback((croppedArea, croppedAreaPixels) => {
    setCroppedAreaPixels(croppedAreaPixels);
  }, []);

  const handleCrop = async () => {
    setIsLoading(true);
    try {
      const croppedBlob = await getCroppedImg(previewUrl, croppedAreaPixels);
      if (croppedBlob) {
        const file = new File([croppedBlob], 'profile-pic.png', { type: 'image/png' });
        onCropComplete(file);
      }
    } catch (e) {
      console.error(e);
      onCancel();
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen || !imageFile || !previewUrl) return null;

  return (
    <div className="fixed inset-0 z-[9999] bg-black/75 flex items-center justify-center p-4 sm:p-6 animate-in fade-in zoom-in-95 duration-300">
      <div className="bg-white/90 backdrop-blur-xl rounded-3xl p-5 sm:p-8 w-full max-w-[480px] max-h-[95vh] overflow-y-auto shadow-2xl border border-white/50 animate-in slide-in-from-bottom-4 duration-300 flex flex-col">
        
        {/* Header */}
        <div className="flex items-center justify-between mb-4 pb-4 border-b border-slate-200 shrink-0">
          <div className="flex items-center gap-2 text-sm font-black text-slate-700 uppercase tracking-widest">
            <Move size={16} className="text-[#598791]" />
            Crop Picture
          </div>
          <button
            onClick={onCancel}
            className="h-10 w-10 rounded-2xl bg-slate-100 hover:bg-slate-200 flex items-center justify-center transition-all hover:scale-105"
          >
            <X size={20} />
          </button>
        </div>

        {/* Crop Area container: strictly shrinks properly on mobile */}
        <div className="relative w-full aspect-square min-h-[250px] bg-[#1e293b] rounded-3xl overflow-hidden shadow-inner mb-6 shrink-0 touch-manipulation">
          <Cropper
            image={previewUrl}
            crop={crop}
            zoom={zoom}
            aspect={1}
            cropShape="round"
            showGrid={false}
            zoomSpeed={0.2}
            onCropChange={setCrop}
            onCropComplete={onCropCompleteCb}
            onZoomChange={setZoom}
            style={{ containerStyle: { borderRadius: '1.5rem' } }}
          />
        </div>

        {/* Controls - Zoom */}
        <div className="flex gap-4 items-center justify-center mb-6 shrink-0 w-full px-2 sm:px-4">
          <ZoomOut size={16} className="cursor-pointer text-slate-400 hover:text-slate-800" onClick={() => setZoom(Math.max(1, zoom - 0.2))} />
          <input
            type="range"
            min="1"
            max="4"
            step="0.05"
            value={zoom}
            onChange={(e) => setZoom(Number(e.target.value))}
            className="flex-1 w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-[#598791] hover:accent-[#4a7079]"
          />
          <ZoomIn size={16} className="cursor-pointer text-slate-400 hover:text-slate-800" onClick={() => setZoom(Math.min(4, zoom + 0.2))} />
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-3 justify-end shrink-0 w-full mt-auto">
          <button
            onClick={onCancel}
            className="flex-1 sm:flex-none px-4 py-3 sm:px-6 sm:py-2.5 rounded-2xl border border-slate-200 bg-white text-[11px] sm:text-xs font-black text-slate-700 uppercase tracking-widest hover:bg-slate-50 transition-all shadow-sm"
          >
            Cancel
          </button>
          <button
            onClick={handleCrop}
            disabled={isLoading}
            className="flex-1 sm:flex-none inline-flex justify-center items-center gap-2 px-4 py-3 sm:px-6 sm:py-2.5 rounded-2xl bg-[#598791] text-[11px] sm:text-xs font-black text-white hover:bg-[#4a7079] shadow-lg disabled:opacity-50 transition-all disabled:cursor-not-allowed uppercase tracking-widest"
          >
            {isLoading && <Loader2 className="animate-spin w-4 h-4" />}
            {isLoading ? 'Wait...' : 'Save Photo'}
          </button>
        </div>
        
      </div>
    </div>
  );
}

