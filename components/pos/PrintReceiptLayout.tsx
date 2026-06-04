import React, { ReactNode } from 'react';
import { X, Printer, LucideIcon } from 'lucide-react';

interface PrintReceiptLayoutProps {
  // Header props
  title: string;
  titleIcon?: LucideIcon;
  titleIconColor?: string;
  orderCode: string;
  date: string;
  
  // Content
  children: ReactNode;
  
  // Actions
  onClose: () => void;
  onPrint: () => void;
  onFinish: () => void;
  
  // Optional customization
  printButtonText?: string;
  finishButtonText?: string;
  maxWidth?: string;
}

const PrintReceiptLayout: React.FC<PrintReceiptLayoutProps> = ({
  title,
  titleIcon: TitleIcon,
  titleIconColor = 'text-indigo-500',
  orderCode,
  date,
  children,
  onClose,
  onPrint,
  onFinish,
  printButtonText = 'In phiếu',
  finishButtonText = 'Hoàn tất',
  maxWidth = 'max-w-lg',
}) => (
  <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-modal flex items-center justify-center p-4">
    <div className={`bg-white rounded-[2.5rem] shadow-[0_32px_64px_-16px_rgba(0,0,0,0.3)] w-full ${maxWidth} overflow-hidden animate-in fade-in zoom-in-95 duration-500 flex flex-col max-h-[90vh]`}>
      {/* Header */}
      <div className="bg-slate-50 p-6 border-b border-slate-200 flex justify-between items-center shrink-0">
        <div>
          <h3 className="font-semibold text-lg text-slate-900 uppercase tracking-tight flex items-center gap-2">
            {TitleIcon && <TitleIcon className={`h-5 w-5 ${titleIconColor}`} />}
            {title}
          </h3>
          <p className="text-2xs font-normal text-slate-400 uppercase tracking-[0.2em] mt-1">
            {orderCode} • {new Date(date).toLocaleString('vi-VN')}
          </p>
        </div>
        <button 
          onClick={onClose} 
          className="h-10 w-10 flex items-center justify-center hover:bg-white rounded-2xl hover:text-rose-500 transition-all shadow-sm border border-transparent hover:border-slate-100"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      {/* Content Area */}
      <div className="flex-1 overflow-y-auto p-8 no-scrollbar print-area">
        {/* Company Header */}
        <div className="text-center mb-8 border-b-2 border-dashed border-slate-200 pb-6">
          <h1 className="text-2xl font-semibold text-slate-900 uppercase tracking-tighter">CFO BRAIN PROFESSIONAL</h1>
          <p className="text-xs font-normal text-slate-500 mt-2">123 Đường Công Nghệ, Quận 1, TP. HCM</p>
          <p className="text-xs font-normal text-slate-500">Hotline: 1900 1234</p>
        </div>

        {/* Dynamic Content */}
        {children}

        {/* Footer Note */}
        <div className="text-center mt-12 mb-4 italic">
          <p className="text-2xs font-normal text-slate-400 uppercase tracking-widest">Cảm ơn quý khách và hẹn gặp lại!</p>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="p-8 bg-slate-50 border-t border-slate-200 grid grid-cols-2 gap-4 shrink-0">
        <button
          onClick={onPrint}
          className="flex items-center justify-center gap-3 bg-white border border-slate-200 text-slate-700 py-4 rounded-[1.5rem] font-normal uppercase text-2xs tracking-[0.2em] shadow-sm hover:border-indigo-400 hover:text-indigo-600 active:scale-95 transition-all"
        >
          <Printer className="h-4 w-4" />
          {printButtonText}
        </button>
        <button
          onClick={onFinish}
          className="bg-slate-950 text-white py-4 rounded-[1.5rem] font-normal uppercase text-2xs tracking-[0.2em] shadow-2xl shadow-slate-950/20 active:scale-95 transition-all hover:bg-indigo-600"
        >
          {finishButtonText}
        </button>
      </div>
    </div>
  </div>
);

export default PrintReceiptLayout;
