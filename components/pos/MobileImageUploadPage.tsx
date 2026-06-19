import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { BrowserMultiFormatReader } from '@zxing/browser';

const compressImage = (blob: Blob, maxPx = 1024, quality = 0.78): Promise<Blob> =>
  new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(blob);
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
        b => b ? resolve(b) : reject(new Error('Không thể nén ảnh')),
        'image/jpeg',
        quality
      );
    };
    img.onerror = () => reject(new Error('Không đọc được ảnh'));
    img.src = url;
  });

interface ProductInfo {
  id?: string;
  name: string;
  sku?: string;
  attributes?: { name: string; value: string }[];
}

type FlashState = 'none' | 'success' | 'error';

export const MobileImageUploadPage: React.FC = () => {
  const { productId: initialProductId } = useParams<{ productId: string }>();
  const videoRef = useRef<HTMLVideoElement>(null);
  const captureCanvasRef = useRef<HTMLCanvasElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const zxingControlsRef = useRef<{ stop: () => void } | null>(null);

  const [activeProductId, setActiveProductId] = useState(initialProductId ?? '');
  const [product, setProduct] = useState<ProductInfo | null>(null);
  const [productError, setProductError] = useState('');
  const [count, setCount] = useState(0);
  const [flash, setFlash] = useState<FlashState>('none');
  const [errorMsg, setErrorMsg] = useState('');
  const [uploading, setUploading] = useState(false);
  const [cameraReady, setCameraReady] = useState(false);
  const [cameraFallback, setCameraFallback] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [disconnected, setDisconnected] = useState(false);

  // Fetch thông tin sản phẩm khi activeProductId thay đổi
  useEffect(() => {
    if (!activeProductId) return;
    setProductError('');
    fetch(`/api/product-info/${activeProductId}`)
      .then(r => r.json())
      .then((d: ProductInfo & { error?: string }) => {
        if (d.error) { setProductError(d.error); return; }
        setProduct(d);
      })
      .catch((e: Error) => setProductError(e.message ?? 'Không tải được thông tin'));
  }, [activeProductId]);

  // Khởi động camera live stream
  useEffect(() => {
    let activeStream: MediaStream | null = null;

    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraFallback(true);
      return;
    }

    navigator.mediaDevices.getUserMedia({
      video: { facingMode: 'environment', width: { ideal: 1920 }, height: { ideal: 1080 } },
      audio: false,
    })
      .then(stream => {
        activeStream = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          setCameraReady(true);
        }
      })
      .catch(() => {
        setCameraFallback(true);
      });

    return () => {
      activeStream?.getTracks().forEach(t => t.stop());
    };
  }, []);

  // Dừng quét
  const stopScan = useCallback(() => {
    zxingControlsRef.current?.stop();
    zxingControlsRef.current = null;
    setScanning(false);
  }, []);

  // Bắt đầu quét bằng ZXing (iOS Safari + Android Chrome)
  const startScan = useCallback(() => {
    const video = videoRef.current;
    if (!video || !cameraReady) return;
    setScanning(true);
    setErrorMsg('');

    const reader = new BrowserMultiFormatReader();
    reader.decodeFromVideoElement(video, async (result, err, controls) => {
      if (!result) return; // frame chưa có barcode — bỏ qua
      controls.stop();
      zxingControlsRef.current = null;
      setScanning(false);

      const raw = result.getText();
      try {
        const resp = await fetch(`/api/product-info/barcode/${encodeURIComponent(raw)}`);
        const data = await resp.json() as ProductInfo & { error?: string };
        if (data.error || !resp.ok) {
          setErrorMsg(`Không tìm thấy sản phẩm với mã: ${raw}`);
          return;
        }
        setProduct(data);
        if (data.id) setActiveProductId(data.id);
        setCount(0);
      } catch {
        setErrorMsg('Lỗi khi tìm sản phẩm');
      }
    }).then(controls => {
      zxingControlsRef.current = controls;
    }).catch(() => {
      setScanning(false);
      setErrorMsg('Không thể khởi động quét mã');
    });
  }, [cameraReady]);

  // Dọn ZXing khi unmount
  useEffect(() => () => stopScan(), [stopScan]);

  const uploadBlob = useCallback(async (blob: Blob) => {
    if (!activeProductId) return;
    setUploading(true);
    setErrorMsg('');
    setFlash('none');

    try {
      const compressed = await compressImage(blob);
      const resp = await fetch(`/api/upload-product-image/${activeProductId}`, {
        method: 'POST',
        body: compressed,
        headers: { 'Content-Type': 'image/jpeg' },
      });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data.error || `Lỗi ${resp.status}`);

      setCount(c => c + 1);
      setFlash('success');
      setTimeout(() => setFlash('none'), 600);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Lỗi không xác định';
      setErrorMsg(msg);
      setFlash('error');
      setTimeout(() => setFlash('none'), 2000);
    } finally {
      setUploading(false);
    }
  }, [activeProductId]);

  // Chụp từ live stream bằng canvas
  const handleCaptureLive = useCallback(() => {
    const video = videoRef.current;
    const canvas = captureCanvasRef.current;
    if (!video || !canvas || !video.videoWidth) return;

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext('2d')?.drawImage(video, 0, 0);
    canvas.toBlob(blob => { if (blob) uploadBlob(blob); }, 'image/jpeg', 0.95);
  }, [uploadBlob]);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    await uploadBlob(file);
    if (fileRef.current) {
      fileRef.current.value = '';
      fileRef.current.click();
    }
  };

  const handleCapture = () => {
    if (scanning) stopScan();
    if (cameraFallback) {
      fileRef.current?.click();
    } else {
      handleCaptureLive();
    }
  };

  const handleScanToggle = () => {
    if (scanning) {
      stopScan();
    } else {
      startScan();
    }
  };

  const handleDisconnect = useCallback(() => {
    stopScan();
    setProduct(null);
    setActiveProductId('');
    setCount(0);
    setErrorMsg('');
    setProductError('');
    setDisconnected(true);
  }, [stopScan]);

  const colorAttr = product?.attributes?.find(a => /màu/i.test(a.name));
  const colorText = colorAttr?.value ?? '';

  if (disconnected) {
    return (
      <div className="flex flex-col h-screen bg-slate-900 items-center justify-center gap-6 px-8 text-center">
        <div className="w-20 h-20 rounded-full bg-slate-700 flex items-center justify-center">
          <svg className="w-10 h-10 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m13.35-.622l1.757-1.757a4.5 4.5 0 00-6.364-6.364l-4.5 4.5a4.5 4.5 0 001.242 7.244" />
          </svg>
        </div>
        <div>
          <p className="text-white font-semibold text-lg">Đã ngắt kết nối</p>
          <p className="text-slate-400 text-sm mt-1">Quét lại mã QR trên máy tính để bắt đầu phiên mới.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-slate-900">

      {/* Vùng camera live / fallback */}
      <div className={`relative flex-[2] bg-slate-900 overflow-hidden flex items-center justify-center transition-all ${scanning ? 'ring-4 ring-inset ring-emerald-400' : ''}`}>

        {/* Live video */}
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className={`absolute inset-0 w-full h-full object-cover ${cameraReady ? '' : 'hidden'}`}
        />

        {/* Đang mở camera */}
        {!cameraReady && !cameraFallback && (
          <div className="flex flex-col items-center gap-3 text-slate-400">
            <div className="w-8 h-8 border-2 border-slate-600/40 border-t-slate-400 rounded-full animate-spin" />
            <p className="text-sm">Đang mở camera...</p>
          </div>
        )}

        {/* Fallback: không có HTTPS */}
        {cameraFallback && (
          <div className="flex flex-col items-center gap-3 text-slate-400 px-6 text-center">
            <svg className="w-14 h-14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.774 48.774 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.821 1.316z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12.75a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0zM18.75 10.5h.008v.008h-.008V10.5z" />
            </svg>
            <p className="text-xs">Cần HTTPS để dùng camera trực tiếp.<br />Bấm "Chụp ảnh" để mở app camera.</p>
          </div>
        )}

        {/* Flash success */}
        {flash === 'success' && (
          <div className="absolute inset-0 bg-white/50 flex items-center justify-center pointer-events-none">
            <div className="w-16 h-16 rounded-full bg-emerald-500 flex items-center justify-center shadow-lg">
              <svg className="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </div>
          </div>
        )}

        {/* Flash error */}
        {flash === 'error' && (
          <div className="absolute inset-0 bg-black/50 flex items-center justify-center pointer-events-none">
            <div className="w-16 h-16 rounded-full bg-red-500 flex items-center justify-center shadow-lg">
              <svg className="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </div>
          </div>
        )}

        {/* Upload spinner */}
        {uploading && flash === 'none' && (
          <div className="absolute inset-0 bg-black/20 flex items-center justify-center pointer-events-none">
            <div className="w-10 h-10 border-4 border-white/30 border-t-white rounded-full animate-spin" />
          </div>
        )}

        {/* Badge đếm ảnh */}
        {count > 0 && (
          <div className="absolute top-3 left-3 px-3 py-1 bg-black/50 backdrop-blur-sm rounded-full flex items-center gap-1.5">
            <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm12 12H4l4-8 3 6 2-4 3 6z" clipRule="evenodd" />
            </svg>
            <span className="text-white text-xs font-medium">{count} ảnh</span>
          </div>
        )}

        {/* Nút X ngắt kết nối */}
        <button
          onClick={handleDisconnect}
          className="absolute top-3 right-3 w-9 h-9 rounded-full bg-black/50 backdrop-blur-sm flex items-center justify-center active:scale-90 transition-transform z-10"
        >
          <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        {/* Indicator đang quét */}
        {scanning && (
          <div className="absolute top-14 right-3 px-3 py-1 bg-emerald-500/90 backdrop-blur-sm rounded-full flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full bg-white animate-pulse" />
            <span className="text-white text-xs font-medium">Đang quét...</span>
          </div>
        )}

        {/* Dots indicator */}
        {count > 0 && (
          <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5">
            {Array.from({ length: Math.min(count, 5) }).map((_, i) => (
              <div
                key={i}
                className={`rounded-full transition-all ${i === Math.min(count, 5) - 1 ? 'w-4 h-2 bg-white' : 'w-2 h-2 bg-white/50'}`}
              />
            ))}
          </div>
        )}
      </div>

      {/* Thông tin sản phẩm + nút hành động */}
      <div className="flex-[1] bg-white px-5 flex flex-col justify-between pt-5 pb-[48px]">
        {/* 3 dòng text */}
        <div className="flex flex-col items-center text-center gap-1">
          {productError ? (
            <p className="text-sm text-red-500">{productError}</p>
          ) : (
            <>
              <h1 className="text-[17px] font-bold text-slate-900 leading-snug line-clamp-2">
                {product?.name ?? 'Đang tải...'}
              </h1>
              {(colorText || product?.sku) && (
                <p className="text-sm text-slate-400">{colorText || product?.sku}</p>
              )}
              <p className="text-sm text-slate-400">
                {count > 0 ? `${count} ảnh đã chụp` : 'Chưa có ảnh'}
              </p>
            </>
          )}
          {errorMsg && (
            <p className="text-xs text-red-500 mt-1 break-all">{errorMsg}</p>
          )}
        </div>

        {/* 2 nút hành động */}
        <div className="flex items-center gap-3">
          <button
            onClick={handleScanToggle}
            disabled={uploading || !cameraReady}
            className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-full text-sm font-semibold transition-all active:scale-95 ${
              scanning
                ? 'bg-emerald-500 text-white shadow-md'
                : 'bg-slate-100 text-slate-700'
            } ${(uploading || !cameraReady) ? 'opacity-40 cursor-not-allowed' : ''}`}
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 4.875c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5A1.125 1.125 0 013.75 9.375v-4.5zM3.75 14.625c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5a1.125 1.125 0 01-1.125-1.125v-4.5zM13.5 4.875c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5A1.125 1.125 0 0113.5 9.375v-4.5z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 6.75h.75v.75h-.75v-.75zM6.75 16.5h.75v.75h-.75V16.5zM16.5 6.75h.75v.75h-.75v-.75zM13.5 13.5h.75v.75h-.75v-.75zM13.5 19.5h.75v.75h-.75v-.75zM19.5 13.5h.75v.75h-.75v-.75zM19.5 19.5h.75v.75h-.75v-.75zM16.5 16.5h.75v.75h-.75v-.75z" />
            </svg>
            Quét mã
          </button>

          <button
            onClick={handleCapture}
            disabled={uploading}
            className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-full text-sm font-semibold transition-all ${
              uploading
                ? 'bg-slate-300 text-slate-500 cursor-not-allowed'
                : 'bg-slate-900 text-white active:scale-95 shadow-md'
            }`}
          >
            {uploading ? (
              <>
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Đang lưu
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.774 48.774 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.821 1.316z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12.75a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0zM18.75 10.5h.008v.008h-.008V10.5z" />
                </svg>
                Chụp ảnh
              </>
            )}
          </button>
        </div>
      </div>

      {/* Canvas ẩn để capture frame */}
      <canvas ref={captureCanvasRef} className="hidden" />

      {/* Input fallback khi không có HTTPS */}
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={handleFileChange}
      />
    </div>
  );
};
