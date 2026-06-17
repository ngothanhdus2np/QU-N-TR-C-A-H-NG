import React from 'react';
import * as XLSX from 'xlsx';
import { AppData, InventoryTransaction, POSProduct } from '../../types';
import { formatAutoSku, generateId, getNextSKUNumber, isAutoSkuValue } from '../../src/lib';
import { EXCEL_MAX_ROWS, assertSafeExcelBuffer, assertSafeExcelFile } from '../../src/lib/excelSafety';
import { ImportStatus } from './GoodsImportExport';

interface UseGoodsExcelImportArgs {
  products: POSProduct[];
  onUpdateProducts: (products: POSProduct[]) => void;
  onPushBatch?: (key: keyof AppData, items: unknown[]) => Promise<void>;
  setImportStatus: React.Dispatch<React.SetStateAction<ImportStatus | null>>;
  fileInputRef: React.RefObject<HTMLInputElement>;
}

export const useGoodsExcelImport = ({
  products,
  onUpdateProducts,
  onPushBatch,
  setImportStatus,
  fileInputRef,
}: UseGoodsExcelImportArgs) => {
  const handleExcelImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async evt => {
      try {
        assertSafeExcelFile(file);
        const buf = evt.target?.result as ArrayBuffer;
        assertSafeExcelBuffer(buf, file.name);
        const wb = XLSX.read(buf, {
          type: 'array',
          cellDates: true,
          dense: true,
          sheetRows: EXCEL_MAX_ROWS,
        });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const rows: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null });

        const isKiotViet =
          rows[0] &&
          String(rows[0][0] || '').trim() === 'Loại hàng' &&
          String(rows[0][2] || '').trim() === 'Mã hàng';

        if (isKiotViet) {
          setImportStatus({
            status: 'running',
            message: `Đang import ${rows.length - 1} sản phẩm từ KiotViet...`,
          });
          // Đọc theo chunk để tránh stack overflow với file lớn
          const bytes = new Uint8Array(buf);
          let binary = '';
          const CHUNK = 8192;
          for (let i = 0; i < bytes.length; i += CHUNK) {
            binary += String.fromCharCode(...bytes.subarray(i, Math.min(i + CHUNK, bytes.length)));
          }
          const b64 = btoa(binary);
          const res = await fetch('/api/import/kiotviet-products', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ fileBase64: b64 }),
          });
          const data = await res.json();
          if (!res.ok) throw new Error(data.error || 'Import thất bại');
          setImportStatus({
            status: 'done',
            message: `✅ Import thành công ${data.imported}/${data.total} sản phẩm. Lỗi: ${data.errors}. Tải lại trang để thấy dữ liệu mới.`,
          });
        } else {
          const data = XLSX.utils.sheet_to_json(ws) as any[];
          const nextSkuNumber = getNextSKUNumber(products);
          const usedSkus = new Set(products.map(product => product.sku).filter(Boolean));
          let autoSkuOffset = 0;
          const importedProducts: POSProduct[] = data
            .map((item: any, index) => {
              const findKey = (aliases: string[]) => {
                const keys = Object.keys(item);
                for (const alias of aliases) {
                  const found = keys.find(
                    k => k.toLowerCase().trim() === alias.toLowerCase().trim()
                  );
                  if (found) return item[found];
                }
                return null;
              };
              const importedSku = String(findKey(['Mã hàng', 'SKU', 'Product Code']) || '').trim();
              let resolvedSku = importedSku;
              if (isAutoSkuValue(importedSku) || usedSkus.has(importedSku)) {
                do {
                  resolvedSku = formatAutoSku(nextSkuNumber + autoSkuOffset);
                  autoSkuOffset += 1;
                } while (usedSkus.has(resolvedSku));
              }
              usedSkus.add(resolvedSku);
              return {
                id: generateId(),
                name: findKey(['Tên sản phẩm', 'Tên hàng', 'Name']) || '',
                sku: resolvedSku,
                categoryId: findKey(['Nhóm hàng', 'Category']) || 'default',
                importPrice: Number(findKey(['Giá vốn', 'Cost']) || 0),
                salePrice: Number(findKey(['Giá bán', 'Price']) || 0),
                stock: Math.max(0, Number(findKey(['Tồn kho', 'Stock']) || 0)), // [FIX M6] không cho import tồn kho âm
                minStock: 0,
                unit: findKey(['Đơn vị tính', 'Unit']) || 'Cái',
                status: 'Active' as const,
              };
            })
            // [FIX m6] Lọc tên rỗng, khoảng trắng, hoặc 'null'/'undefined' do cột không tìm thấy
            .filter(p => {
              const n = String(p.name || '').trim();
              return n !== '' && n !== 'null' && n !== 'undefined';
            });

          if (onPushBatch) {
            await onPushBatch('posProducts', importedProducts);
            // Tạo transaction tồn kho ban đầu để buildCostHistory có thể đọc nextImportPrice
            const openingStockItems = importedProducts.filter(
              p => p.stock > 0 && p.importPrice > 0
            );
            if (openingStockItems.length > 0) {
              const openingTransaction: InventoryTransaction = {
                id: generateId(),
                date: new Date().toISOString(),
                type: 'Import',
                status: 'completed',
                note: 'Tồn kho ban đầu từ import Excel',
                items: openingStockItems.map(p => ({
                  productId: p.id,
                  sku: p.sku,
                  name: p.name,
                  quantity: p.stock,
                  previousStock: 0,
                  newStock: p.stock,
                  price: p.importPrice,
                  costMethod: 'fixed' as const,
                  previousImportPrice: 0,
                  nextImportPrice: p.importPrice,
                })),
              };
              await onPushBatch('inventoryTransactions', [openingTransaction]);
            }
          } else {
            onUpdateProducts([...products, ...importedProducts]);
          }
          setImportStatus({
            status: 'done',
            message: `✅ Đã import ${importedProducts.length} sản phẩm.`,
          });
        }
      } catch (err: any) {
        console.error('Excel Import Error:', err);
        setImportStatus({
          status: 'error',
          message: `❌ Lỗi: ${err.message || 'Kiểm tra định dạng file'}`,
        });
      } finally {
        if (fileInputRef.current) fileInputRef.current.value = '';
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const downloadTemplate = () => {
    const ws = XLSX.utils.json_to_sheet([
      {
        'Tên sản phẩm': 'Mẫu',
        'Mã hàng': 'SP000001',
        'Giá vốn': 50000,
        'Giá bán': 100000,
        'Tồn kho': 10,
      },
    ]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Mau');
    XLSX.writeFile(wb, 'Mau_Import.xlsx');
  };

  return { handleExcelImport, downloadTemplate };
};
