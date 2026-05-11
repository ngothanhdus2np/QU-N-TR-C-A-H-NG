import React from 'react';
import { FileDown, Upload } from 'lucide-react';
import { POSProduct } from '../../types';
import { exportToExcel } from '../../services/exportService';

export type ImportStatus = {
  status: 'running' | 'done' | 'error';
  message: string;
};

interface GoodsImportExportProps {
  products: POSProduct[];
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  importStatus: ImportStatus | null;
  setImportStatus: React.Dispatch<React.SetStateAction<ImportStatus | null>>;
  onImportChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
}

export const GoodsImportExport: React.FC<GoodsImportExportProps> = ({
  products,
  fileInputRef,
  importStatus,
  setImportStatus,
  onImportChange,
}) => (
  <>
    <button onClick={() => fileInputRef.current?.click()} className="flex items-center gap-1.5 px-3 py-2 bg-white border border-slate-200 text-slate-600 rounded-xl font-black text-[10px] uppercase tracking-wide hover:bg-slate-50 transition-all shadow-sm">
      <Upload className="h-3.5 w-3.5" /> Import file
    </button>
    <button
      onClick={() => exportToExcel(
        products.map(p => ({
          'Mã hàng': p.sku,
          'Tên sản phẩm': p.name,
          'Nhóm hàng': p.categoryId || '',
          'Thương hiệu': p.brand || '',
          'Giá nhập': p.importPrice,
          'Giá bán': p.salePrice,
          'Tồn kho': p.stock,
          'Tồn tối thiểu': p.minStock ?? 0,
          'Đơn vị': p.unit || 'Cái',
          'Vị trí': p.location || '',
          'Trạng thái': p.status,
        })),
        'HangHoa'
      )}
      className="flex items-center gap-1.5 px-3 py-2 bg-white border border-slate-200 text-emerald-600 rounded-xl font-black text-[10px] uppercase tracking-wide hover:bg-emerald-50 hover:border-emerald-200 transition-all shadow-sm"
    >
      <FileDown className="h-3.5 w-3.5" /> Xuất Excel
    </button>

    <input type="file" ref={fileInputRef} className="hidden" accept=".xlsx,.xls" onChange={onImportChange} />

    {importStatus && (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 space-y-4">
          <div className="flex items-center gap-3">
            {importStatus.status === 'running' && (
              <div className="w-8 h-8 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin shrink-0" />
            )}
            <h3 className="font-black text-slate-800 text-sm uppercase tracking-wide">
              {importStatus.status === 'running' ? 'Đang Import...' : importStatus.status === 'done' ? 'Hoàn thành' : 'Lỗi Import'}
            </h3>
          </div>
          <p className="text-sm text-slate-600 leading-relaxed">{importStatus.message}</p>
          {importStatus.status !== 'running' && (
            <button
              onClick={() => setImportStatus(null)}
              className="w-full py-2 bg-indigo-600 text-white text-xs font-black uppercase rounded-xl hover:bg-indigo-700 transition-colors"
            >
              Đóng
            </button>
          )}
        </div>
      </div>
    )}
  </>
);
