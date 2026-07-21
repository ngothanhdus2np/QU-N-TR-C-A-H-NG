// Helper THUẦN tách khỏi God component PurchaseInvoices.tsx (2627 dòng, GĐ5 audit)
// để test được độc lập. vatGroupMatchesSourceText ảnh hưởng phân loại nhóm hàng theo
// hóa đơn VAT (logic thuế) — cần có test. Chỉ phụ thuộc normalizeVatText (src/lib —
// thuần), KHÔNG kéo theo ./purchase-invoices/utils (module đó import pdfjs-dist, không
// chạy được trong môi trường test node). shiftDate giữ lại trong component vì nó phụ
// thuộc normalizeVatDateValue nằm trong utils.ts có pdfjs.

import { normalizeVatText } from '../../src/lib/vatCoverage';

// Khớp tên nhóm hàng với text nguồn (từ hóa đơn VAT). Khớp khi:
//  - text nguồn trùng/khớp chứa toàn bộ tên nhóm đã chuẩn hóa, HOẶC
//  - khớp 1 phần đường dẫn nhóm (tách theo '>' hoặc '/'), mỗi phần >= 4 ký tự.
export const vatGroupMatchesSourceText = (groupName: string, sourceText: string): boolean => {
  const normalizedSource = normalizeVatText(sourceText);
  if (!normalizedSource) return false;
  const normalizedGroup = normalizeVatText(groupName);
  if (normalizedGroup && (normalizedSource === normalizedGroup || normalizedSource.includes(normalizedGroup))) return true;
  return String(groupName || '')
    .split(/\s*(?:>{1,2}|\/)\s*/)
    .map(part => normalizeVatText(part))
    .filter(part => part.length >= 4)
    .some(part => normalizedSource === part || normalizedSource.includes(part));
};
