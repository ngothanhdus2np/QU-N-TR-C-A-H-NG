import React, { useState, useRef } from 'react';
import { useParams } from 'react-router-dom';

type UploadState = 'idle' | 'uploading' | 'success' | 'error';

// Resize + compress ảnh về JPEG max 1024px để giữ dung lượng nhỏ
const compressImage = (file: File, maxPx = 1024, quality = 0.75): Promise<Blob> =>
  new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const ratio = Math.min(1, maxPx / Math.max(img.width, img.height));
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(img.width * ratio);
      canvas.height = Math.round(img.height * ratio);
      const ctx = canvas.getContext('2d');
      if (!ctx) return reject(new Error('Canvas không khả dụng'));
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(url);
      canvas.toBlob(
        blob => blob ? resolve(blob) : reject(new Error('Không thể nén ảnh')),
        'image/jpeg',
        quality
      );
    };
    img.onerror = () => reject(new Error('Không đọc được ảnh'));
    img.src = url;
  });

export const MobileImageUploadPage: React.FC = () => {
  const { productId } = useParams<{ productId: string }>();
  const [state, setState] = useState<UploadState>('idle');
  const [preview, setPreview] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !productId) return;

    setPreview(URL.createObjectURL(file));
    setState('uploading');
    setErrorMsg('');

    try {
      const compressed = await compressImage(file);

      const response = await fetch(`/api/upload-product-image/${productId}`, {
        method: 'POST',
        body: compressed,
        headers: { 'Content-Type': 'image/jpeg' },
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || `Lỗi ${response.status}`);

      setState('success');
    } catch (err: unknown) {
      setState('error');
      setErrorMsg(err instanceof Error ? err.message : 'Lỗi không xác định');
    }
  };

  const handleRetry = () => {
    setState('idle');
    setPreview(null);
    setErrorMsg('');
    if (fileRef.current) fileRef.current.value = '';
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-sm bg-white rounded-2xl shadow-lg p-6 flex flex-col items-center gap-5">
        <div className="text-center">
          <div className="text-4xl mb-2">📷</div>
          <h1 className="text-lg font-semibold text-slate-800">Thêm ảnh hàng hóa</h1>
          <p className="text-sm text-slate-500 mt-1">Chụp hoặc chọn ảnh để tải lên</p>
        </div>

        {preview && (
          <div className="w-full aspect-square rounded-xl overflow-hidden border border-slate-200 bg-slate-100">
            <img src={preview} alt="preview" className="w-full h-full object-cover" />
          </div>
        )}

        {state === 'idle' && (
          <label className="w-full cursor-pointer">
            <div className="w-full py-3 px-4 bg-indigo-600 text-white rounded-xl text-center text-sm font-medium hover:bg-indigo-700 transition-colors">
              Chụp / Chọn ảnh
            </div>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={handleFileChange}
            />
          </label>
        )}

        {state === 'uploading' && (
          <div className="flex flex-col items-center gap-2 text-slate-500">
            <div className="w-8 h-8 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin" />
            <span className="text-sm">Đang xử lý và tải lên...</span>
          </div>
        )}

        {state === 'success' && (
          <div className="flex flex-col items-center gap-3 text-center">
            <div className="w-12 h-12 bg-emerald-100 rounded-full flex items-center justify-center text-2xl">✓</div>
            <p className="text-emerald-700 font-medium text-sm">Tải ảnh thành công!</p>
            <p className="text-slate-400 text-xs">Ảnh đã cập nhật trên máy tính</p>
            <button onClick={handleRetry} className="mt-1 text-indigo-600 text-sm underline">
              Thêm ảnh khác
            </button>
          </div>
        )}

        {state === 'error' && (
          <div className="flex flex-col items-center gap-3 text-center">
            <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center text-2xl">✕</div>
            <p className="text-red-600 font-medium text-sm">Tải ảnh thất bại</p>
            {errorMsg && <p className="text-slate-400 text-xs break-all">{errorMsg}</p>}
            <button
              onClick={handleRetry}
              className="mt-1 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm"
            >
              Thử lại
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
