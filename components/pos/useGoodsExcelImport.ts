import React from 'react';
import * as XLSX from 'xlsx';
import { AppData, InventoryTransaction, POSProduct } from '../../types';
import { formatAutoSku, generateId, getNextSKUNumber, isAutoSkuValue } from '../../src/lib';
import { EXCEL_MAX_ROWS, assertSafeExcelBuffer, assertSafeExcelFile } from '../../src/lib/excelSafety';
import { ImportStatus } from './GoodsImportExport';

interface UseGoodsExcelImportArgs {
  products: POSProduct[];
  onUpdateProducts: (products: POSProduct[]) => void;
  onPushBatch?: <K extends keyof AppData>(key: K, items: Extract<AppData[K], unknown[]>) => Promise<void>;
  setImportStatus: React.Dispatch<React.SetStateAction<ImportStatus | null>>;
  fileInputRef: React.RefObject<HTMLInputElement>;
}

type ExcelRow = Record<string, unknown>;

const findRowValue = (row: ExcelRow, aliases: string[]) => {
  const keys = Object.keys(row);
  for (const alias of aliases) {
    const found = keys.find(k => k.toLowerCase().trim() === alias.toLowerCase().trim());
    if (found) return row[found];
  }
  return null;
};

// 'null'/'undefined' xuất hiện khi giá trị null bị String() hóa
const cleanText = (value: unknown): string => {
  const s = String(value ?? '').trim();
  return s === 'null' || s === 'undefined' ? '' : s;
};

const finiteNumber = (value: unknown): number | null => {
  if (value == null || String(value).trim() === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
};

// [IMPORT-02] Import theo SKU (yêu cầu user 2026-07-14):
// - SKU đã có trong danh sách → CẬP NHẬT tên/nhóm/giá/đơn vị từ file, GIỮ NGUYÊN tồn kho
//   (tồn kho do app quản lý qua nhập/xuất/kiểm kho — không ghi đè từ Excel).
// - SKU mới hoặc trống → tạo sản phẩm mới (SKU trống → sinh mã SPxxxxxx tự động).
// - Dòng trùng SKU trong cùng file → dòng sau ghi đè dòng trước, không nhân bản sản phẩm.
// Hàm thuần, tách khỏi FileReader/XLSX để unit-test trực tiếp.
export const planExcelImport = (
  products: POSProduct[],
  rows: ExcelRow[]
): { toCreate: POSProduct[]; toUpdate: POSProduct[] } => {
  const nextSkuNumber = getNextSKUNumber(products);
  const usedSkus = new Set(products.map(product => product.sku).filter(Boolean));
  let autoSkuOffset = 0;

  const bySku = new Map<string, POSProduct>();
  for (const p of products) {
    const sku = String(p.sku || '').trim();
    if (sku) bySku.set(sku, p);
  }
  const existingIds = new Set(products.map(p => p.id));

  const toCreateById = new Map<string, POSProduct>();
  const toUpdateById = new Map<string, POSProduct>();

  for (const row of rows) {
    const importedSku = cleanText(findRowValue(row, ['Mã hàng', 'SKU', 'Product Code']));
    const name = cleanText(findRowValue(row, ['Tên sản phẩm', 'Tên hàng', 'Name']));
    const category = cleanText(findRowValue(row, ['Nhóm hàng', 'Category']));
    const importPrice = finiteNumber(findRowValue(row, ['Giá vốn', 'Cost']));
    const salePrice = finiteNumber(findRowValue(row, ['Giá bán', 'Price']));
    const unit = cleanText(findRowValue(row, ['Đơn vị tính', 'Unit']));

    const matched = !isAutoSkuValue(importedSku) ? bySku.get(importedSku) : undefined;

    if (matched) {
      // SKU đã tồn tại → cập nhật thông tin, giữ id + tồn kho + mọi field khác
      const updated: POSProduct = {
        ...matched,
        ...(name ? { name } : {}),
        ...(category ? { categoryId: category } : {}),
        ...(importPrice != null ? { importPrice } : {}),
        ...(salePrice != null ? { salePrice } : {}),
        ...(unit ? { unit } : {}),
      };
      bySku.set(importedSku, updated);
      if (existingIds.has(matched.id)) {
        toUpdateById.set(updated.id, updated);
      } else {
        // dòng trước đó trong CÙNG file đã tạo sản phẩm này → gộp vào bản tạo mới
        toCreateById.set(updated.id, updated);
      }
      continue;
    }

    // [FIX m6] Dòng rác: không có tên → bỏ qua (chỉ áp cho sản phẩm mới;
    // dòng cập nhật nhận diện bằng SKU nên không cần tên)
    if (!name) continue;

    let resolvedSku = importedSku;
    if (isAutoSkuValue(importedSku) || usedSkus.has(importedSku)) {
      do {
        resolvedSku = formatAutoSku(nextSkuNumber + autoSkuOffset);
        autoSkuOffset += 1;
      } while (usedSkus.has(resolvedSku));
    }
    usedSkus.add(resolvedSku);
    const created: POSProduct = {
      id: generateId(),
      name,
      sku: resolvedSku,
      categoryId: category || 'default',
      importPrice: importPrice ?? 0,
      salePrice: salePrice ?? 0,
      stock: Math.max(0, finiteNumber(findRowValue(row, ['Tồn kho', 'Stock'])) ?? 0), // [FIX M6] không cho import tồn kho âm
      minStock: 0,
      unit: unit || 'Cái',
      status: 'Active' as const,
    };
    bySku.set(resolvedSku, created);
    toCreateById.set(created.id, created);
  }

  return { toCreate: [...toCreateById.values()], toUpdate: [...toUpdateById.values()] };
};

// [IMPORT-02] Khi CẬP NHẬT sản phẩm cũ, KHÔNG được ghi đè tồn kho DB bằng tồn kho trong bộ
// nhớ (có thể cũ nếu kênh khác — POS mobile, bot Shopee, đơn website — vừa đổi tồn). Bỏ hẳn
// field 'stock' khỏi payload gửi server → apiService.sanitizeItem không gửi cột stock →
// PostgREST giữ nguyên tồn kho hiện tại (khớp đúng luồng server /api/import/kiotviet-products,
// vốn đã `delete rest.stock`). State local vẫn giữ stock nhờ pushBatch merge field-level.
export const stripStockForUpdate = (products: POSProduct[]): Omit<POSProduct, 'stock'>[] =>
  products.map(({ stock: _stock, ...rest }) => rest);

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

        const isLegacyExcelFormat =
          rows[0] &&
          String(rows[0][0] || '').trim() === 'Loại hàng' &&
          String(rows[0][2] || '').trim() === 'Mã hàng';

        if (isLegacyExcelFormat) {
          setImportStatus({
            status: 'running',
            message: `Đang import ${rows.length - 1} sản phẩm...`,
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
            message: `✅ Import thành công ${data.imported}/${data.total} sản phẩm (thêm mới ${data.created ?? '?'}, cập nhật ${data.updated ?? '?'} — tồn kho sản phẩm cũ giữ nguyên). Lỗi: ${data.errors}. Tải lại trang để thấy dữ liệu mới.`,
          });
        } else {
          const data = XLSX.utils.sheet_to_json(ws) as ExcelRow[];
          // [IMPORT-02] SKU đã có → cập nhật (giữ tồn kho); SKU mới → thêm sản phẩm mới
          const { toCreate, toUpdate } = planExcelImport(products, data);

          if (onPushBatch) {
            // Cập nhật: bỏ stock để giữ tồn kho DB. Tạo mới: giữ stock (tồn kho ban đầu từ file).
            if (toUpdate.length > 0)
              // Ép kiểu CÓ CHỦ ĐÍCH: [IMPORT-02] cố tình bỏ hẳn field `stock` khỏi
              // payload để apiService.sanitizeItem không gửi cột stock, nhờ đó
              // PostgREST giữ nguyên tồn kho đang có trên DB thay vì ghi đè bằng số
              // trong file Excel. Chữ ký generic của pushBatch (thêm 30/08/2026) đòi
              // POSProduct[] đầy đủ nên phải nói rõ ngoại lệ này ở đây — trước đó
              // chữ ký là `unknown[]` nên chênh lệch bị che hoàn toàn.
              await onPushBatch('posProducts', stripStockForUpdate(toUpdate) as POSProduct[]);
            if (toCreate.length > 0) {
              await onPushBatch('posProducts', toCreate);
              // Tạo transaction tồn kho ban đầu (chỉ cho sản phẩm MỚI) để buildCostHistory
              // có thể đọc nextImportPrice
              const openingStockItems = toCreate.filter(p => p.stock > 0 && p.importPrice > 0);
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
            }
          } else {
            const updatedById = new Map(toUpdate.map(p => [p.id, p] as const));
            onUpdateProducts([...products.map(p => updatedById.get(p.id) || p), ...toCreate]);
          }
          setImportStatus({
            status: 'done',
            message: `✅ Import xong: thêm ${toCreate.length} sản phẩm mới, cập nhật ${toUpdate.length} sản phẩm (tồn kho sản phẩm cũ giữ nguyên).`,
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
