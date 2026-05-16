import React from 'react';
import { CheckCircle2, PackageOpen } from 'lucide-react';

interface POSToastsProps {
  scanFeedback: string | null;
  stockWarning: string | null;
}

const POSToasts: React.FC<POSToastsProps> = ({ scanFeedback, stockWarning }) => (
  <>
    {scanFeedback && (
      <div className="fixed top-20 left-1/2 -translate-x-1/2 z-[200] animate-in fade-in slide-in-from-top-4 duration-300">
        <div className="bg-emerald-600 text-white px-6 py-3 rounded-2xl shadow-2xl flex items-center gap-3 border-2 border-emerald-400">
          <CheckCircle2 className="h-5 w-5" />
          <div>
            <div className="text-xs font-normal uppercase tracking-wider opacity-80">Đã thêm vào giỏ</div>
            <div className="text-sm font-normal">{scanFeedback}</div>
          </div>
        </div>
      </div>
    )}

    {stockWarning && (
      <div className="fixed top-20 left-1/2 -translate-x-1/2 z-[200] animate-in fade-in slide-in-from-top-4 duration-300">
        <div className="bg-rose-600 text-white px-6 py-3 rounded-2xl shadow-2xl flex items-center gap-3 border-2 border-rose-400">
          <PackageOpen className="h-5 w-5" />
          <div>
            <div className="text-xs font-normal uppercase tracking-wider opacity-80">Không đủ hàng</div>
            <div className="text-sm font-normal">{stockWarning}</div>
          </div>
        </div>
      </div>
    )}
  </>
);

export default POSToasts;
