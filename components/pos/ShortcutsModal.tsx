import React from 'react';
import { X } from 'lucide-react';

const SHORTCUTS = [
  { key: 'F1', desc: 'Thêm hóa đơn mới' },
  { key: 'F2', desc: 'Bật/Tắt chế độ in tự động' },
  { key: 'F3', desc: 'Tìm hàng hóa' },
  { key: 'F4', desc: 'Tìm khách hàng' },
  { key: 'F6', desc: 'Thay đổi chế độ nhập số lượng' },
  { key: 'F7', desc: 'Mở két tiền' },
  { key: 'F8', desc: 'Khách thanh toán' },
  { key: 'F9', desc: 'Thanh toán' },
  { key: 'F10', desc: 'Quét mã vạch cân điện tử' },
  { key: 'F11', desc: 'Toàn màn hình' },
  { key: 'Home', desc: 'Thay đổi số lượng sản phẩm' },
  { key: '↑', desc: 'Tăng số lượng sản phẩm' },
  { key: '↓', desc: 'Giảm số lượng sản phẩm' },
  { key: 'Enter', desc: 'Di chuyển xuống sản phẩm tiếp theo' },
  { key: 'Shift', desc: 'Di chuyển lên sản phẩm phía trên' },
];

interface ShortcutsModalProps {
  onClose: () => void;
}

export default function ShortcutsModal({ onClose }: ShortcutsModalProps) {
  return (
    <div className="fixed inset-0 bg-black/40 z-[200] flex items-center justify-center p-6">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm flex flex-col overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 shrink-0">
          <h2 className="text-base font-semibold text-slate-800">Phím tắt chức năng</h2>
          <button
            onClick={onClose}
            className="h-8 w-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
          >
            <X className="h-4.5 w-4.5" />
          </button>
        </div>
        <div className="px-6 py-4 space-y-1 overflow-y-auto" style={{ maxHeight: '70vh' }}>
          {SHORTCUTS.map(({ key, desc }) => (
            <div
              key={key}
              className="flex items-start gap-6 py-2.5 border-b border-slate-50 last:border-0"
            >
              <span className="w-14 shrink-0 text-sm font-bold text-slate-800">{key}:</span>
              <span className="text-sm text-slate-600 leading-snug">{desc}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
