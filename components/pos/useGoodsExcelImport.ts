import React from 'react';
import * as XLSX from 'xlsx';
import { POSProduct } from '../../types';
import { generateId } from '../../businessLogic';
import { ImportStatus } from './GoodsImportExport';

interface UseGoodsExcelImportArgs {
  products: POSProduct[];
  onUpdateProducts: (products: POSProduct[]) => void;
  onPushBatch?: (key: any, items: any[]) => Promise<void>;
  setImportStatus: React.Dispatch<React.SetStateAction<ImportStatus | null>>;
  fileInputRef: React.RefObject<HTMLInputElement>;
}

export const useGoodsExcelImport = ({
  products,
  onUpdateProducts,
  onPushBatch,
  setImportStatus,
  fileInputRef
}: UseGoodsExcelImportArgs) => {
  const handleExcelImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const buf = evt.target?.result as ArrayBuffer;
        const wb = XLSX.read(buf, { type: 'array', cellDates: true });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const rows: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null });

        const isKiotViet = rows[0] && String(rows[0][0] || '').trim() === 'Loại hàng' && String(rows[0][2] || '').trim() === 'Mã hàng';

        if (isKiotViet) {
          setImportStatus({ status: 'running', message: `Đang import ${rows.length - 1} sản phẩm từ KiotViet...` });
          const b64 = btoa(String.fromCharCode(...new Uint8Array(buf)));
          const res = await fetch('/api/import/kiotviet-products', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ fileBase64: b64 }),
          });
          const data = await res.json();
          if (!res.ok) throw new Error(data.error || 'Import thất bại');
          setImportStatus({ status: 'done', message: `✅ Import thành công ${data.imported}/${data.total} sản phẩm. Lỗi: ${data.errors}. Tải lại trang để thấy dữ liệu mới.` });
        } else {
          const data = XLSX.utils.sheet_to_json(ws) as any[];
          const importedProducts: POSProduct[] = data.map((item: any) => {
            const findKey = (aliases: string[]) => {
              const keys = Object.keys(item);
              for (const alias of aliases) {
                const found = keys.find(k => k.toLowerCase().trim() === alias.toLowerCase().trim());
                if (found) return item[found];
              }
              return null;
            };
            return {
              id: generateId(),
              name: findKey(['Tên sản phẩm', 'Tên hàng', 'Name']) || '',
              sku: String(findKey(['Mã hàng', 'SKU', 'Product Code']) || `SKU-${Date.now()}`),
              categoryId: findKey(['Nhóm hàng', 'Category']) || 'default',
              importPrice: Number(findKey(['Giá vốn', 'Cost']) || 0),
              salePrice: Number(findKey(['Giá bán', 'Price']) || 0),
              stock: Number(findKey(['Tồn kho', 'Stock']) || 0),
              minStock: 0,
              unit: findKey(['Đơn vị tính', 'Unit']) || 'Cái',
              status: 'Active' as const,
            };
          }).filter(p => p.name !== '');

          if (onPushBatch) {
            await onPushBatch('posProducts', importedProducts);
          } else {
            onUpdateProducts([...products, ...importedProducts]);
          }
          setImportStatus({ status: 'done', message: `✅ Đã import ${importedProducts.length} sản phẩm.` });
        }
      } catch (err: any) {
        console.error('Excel Import Error:', err);
        setImportStatus({ status: 'error', message: `❌ Lỗi: ${err.message || 'Kiểm tra định dạng file'}` });
      } finally {
        if (fileInputRef.current) fileInputRef.current.value = '';
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const downloadTemplate = () => {
    const ws = XLSX.utils.json_to_sheet([{ 'Tên sản phẩm': 'Mẫu', 'Mã hàng': 'SKU001', 'Giá vốn': 50000, 'Giá bán': 100000, 'Tồn kho': 10 }]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Mau');
    XLSX.writeFile(wb, 'Mau_Import.xlsx');
  };

  return { handleExcelImport, downloadTemplate };
};
