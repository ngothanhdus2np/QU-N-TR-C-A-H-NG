import * as pdfjsLib from 'pdfjs-dist';
import { AppData } from '../../../types';
import { VAT_OCR_TIMEOUT_MS } from './types';
import type { VatInvoiceOcrItem, VatInvoiceOcrResult } from './types';

export const getPurchaseCode = (transaction: Pick<AppData['inventoryTransactions'][number], 'id'> & { referenceId?: string }) =>
  transaction.referenceId || transaction.id.slice(0, 8).toUpperCase();

export const formatPurchaseDateTime = (value: string) => {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value || '—';
  return d.toLocaleString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

export const normalizeVatDateValue = (value?: string | null) => {
  const raw = String(value || '').trim();
  if (!raw) return '';
  const iso = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  const vi = raw.match(/^(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{4})$/);
  if (vi) {
    const day = vi[1].padStart(2, '0');
    const month = vi[2].padStart(2, '0');
    return `${vi[3]}-${month}-${day}`;
  }
  const parsed = new Date(raw);
  if (!Number.isNaN(parsed.getTime())) return parsed.toLocaleDateString('en-CA');
  return raw;
};

export const formatVatDate = (value?: string) => {
  const normalized = normalizeVatDateValue(value);
  if (!normalized) return 'Chưa có';
  const parsed = new Date(`${normalized}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return normalized;
  return parsed.toLocaleDateString('vi-VN');
};

const fileToBase64 = (file: File) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || '').split(',')[1] || '');
    reader.onerror = () => reject(reader.error || new Error('Không thể đọc file.'));
    reader.readAsDataURL(file);
  });

const extractJsonObject = (value: string) => {
  const trimmed = value.trim();
  if (trimmed.startsWith('{')) return trimmed;
  return trimmed.match(/\{[\s\S]*\}/)?.[0] || trimmed;
};

export const firstString = (source: Record<string, unknown>, keys: string[]) => {
  for (const key of keys) {
    const value = source[key];
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return '';
};

export const firstNumber = (source: Record<string, unknown>, keys: string[]) => {
  for (const key of keys) {
    const value = source[key];
    const parsed = typeof value === 'string' ? Number(value.replace(/[^\d.-]/g, '')) : Number(value);
    if (Number.isFinite(parsed) && parsed > 0) return parsed;
  }
  return 0;
};

const getVatOcrItemArray = (source: Record<string, unknown>) => {
  const candidateKeys = ['items', 'lineItems', 'invoiceItems', 'goods', 'products', 'hangHoa', 'hangHoaDichVu', 'danhSachHangHoa'];
  for (const key of candidateKeys) {
    const value = source[key];
    if (Array.isArray(value)) return value;
  }
  return [];
};

export const normalizeVatOcrItems = (source: Record<string, unknown>): VatInvoiceOcrItem[] =>
  getVatOcrItemArray(source)
    .map(item => {
      const row = (item && typeof item === 'object' ? item : {}) as Record<string, unknown>;
      return {
        name: firstString(row, ['name', 'description', 'descriptionOnInvoice', 'productName', 'itemName', 'tenHangHoa', 'tenHangHoaDichVu', 'tenHHDV']),
        unit: firstString(row, ['unit', 'unitName', 'donViTinh', 'dvt']),
        quantity: firstNumber(row, ['quantity', 'qty', 'soLuong', 'sLuong']),
        unitPrice: firstNumber(row, ['unitPrice', 'price', 'donGia', 'dgBan']),
        amountBeforeTax: firstNumber(row, ['amountBeforeTax', 'subtotal', 'thanhTien', 'thTien', 'tienTruocVat']),
        vatAmount: firstNumber(row, ['vatAmount', 'taxAmount', 'tienVat', 'tienThue']),
        totalAmount: firstNumber(row, ['totalAmount', 'total', 'thanhTienSauThue', 'tongTien']),
      };
    })
    .filter(item => item.name || item.totalAmount || item.amountBeforeTax);

const parsePdfMoneyValue = (value: string) => {
  const normalized = value.replace(/[^\d,.-]/g, '');
  if (!normalized) return 0;
  const withoutThousands = normalized.replace(/\./g, '').replace(/,/g, '.');
  return Number(withoutThousands) || 0;
};

const isPdfNumericToken = (value: string) => /^[+-]?\d+(?:[.,]\d+)*$/.test(value.trim());

const isVatItemRowLine = (line: string) => /^\d+\s*(?:\||\s+)/.test(line.trim());

const parseVatItemLineFromText = (line: string, nameOverride = ''): VatInvoiceOcrItem | null => {
  const normalized = line.replace(/\s+/g, ' ').trim();
  if (!/^\d+\s+/.test(normalized)) return null;
  if (/^(stt|số|tong|tổng)\b/i.test(normalized)) return null;

  if (normalized.includes('|')) {
    const parts = normalized.split('|').map(part => part.trim()).filter(Boolean);
    if (!/^\d+$/.test(parts[0] || '')) return null;
    const hasInlineName = parts.length >= 7;
    const name = (hasInlineName ? parts[1] : nameOverride).trim();
    const unit = hasInlineName ? parts[2] : parts[1];
    const quantity = parsePdfMoneyValue(hasInlineName ? parts[3] : parts[2]);
    const unitPrice = parsePdfMoneyValue(hasInlineName ? parts[4] : parts[3]);
    const amountBeforeTax = parsePdfMoneyValue(parts[parts.length - 1] || '');
    if (!name || amountBeforeTax <= 0) return null;
    return {
      name,
      unit,
      quantity,
      unitPrice,
      amountBeforeTax,
      vatAmount: 0,
      totalAmount: amountBeforeTax,
    };
  }

  const tokens = normalized.split(' ');
  const stt = tokens.shift();
  if (!stt || !/^\d+$/.test(stt)) return null;

  const numericTail: string[] = [];
  while (tokens.length > 0 && isPdfNumericToken(tokens[tokens.length - 1]) && numericTail.length < 5) {
    numericTail.unshift(tokens.pop() || '');
  }
  if (tokens.length < 1 || numericTail.length < 1) return null;

  const unit = tokens.length > 1 || nameOverride ? tokens.pop() || '' : '';
  const name = (nameOverride && tokens.length === 0 ? nameOverride : tokens.join(' ')).trim();
  if (!name || /^(tên|hàng|dịch|vụ|đơn|thành|tiền|chiết|khấu)$/i.test(name)) return null;

  const quantity = numericTail.length >= 3 ? parsePdfMoneyValue(numericTail[0]) : 0;
  const unitPrice = numericTail.length >= 3 ? parsePdfMoneyValue(numericTail[1]) : 0;
  const amountBeforeTax = parsePdfMoneyValue(numericTail[numericTail.length - 1]);
  return {
    name,
    unit,
    quantity,
    unitPrice,
    amountBeforeTax,
    vatAmount: 0,
    totalAmount: amountBeforeTax,
  };
};

const extractVatItemsFromPdfTextLines = (lines: string[]) => {
  const normalizedLines = lines.map(line => line.replace(/\s+/g, ' ').trim()).filter(Boolean);
  const startIndex = normalizedLines.findIndex(line =>
    /tên\s+hàng|hàng\s+hóa|dịch\s+vụ|don\s+vi\s+tinh|đơn\s+vị\s+tính/i.test(line)
  );
  const candidateLines = (startIndex >= 0 ? normalizedLines.slice(startIndex + 1) : normalizedLines).filter(line =>
    !/tổng\s+cộng|tổng\s+tiền|tien\s+thue|tiền\s+thuế|số\s+tiền\s+viết|người\s+mua|người\s+bán|ký\s+hiệu/i.test(line)
  );
  const isNameFragment = (line: string) =>
    !isVatItemRowLine(line) &&
    !/^(stt|tên hàng|đơn giá|thành tiền|chiết khấu|đơn vị|số lượng)$/i.test(line) &&
    !/^\d+(?:[.,]\d+)*$/.test(line);
  return candidateLines
    .map((line, index) => {
      const nearbyName = [
        candidateLines[index - 1],
        candidateLines[index + 1],
      ]
        .filter((value): value is string => Boolean(value && isNameFragment(value)))
        .join(' ')
        .trim();
      return parseVatItemLineFromText(line, nearbyName);
    })
    .filter((item): item is VatInvoiceOcrItem => Boolean(item));
};

export const extractVatItemsFromPdfText = async (file: File): Promise<VatInvoiceOcrItem[]> => {
  const buffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: buffer }).promise;
  const lines: string[] = [];
  for (let pageNo = 1; pageNo <= pdf.numPages; pageNo += 1) {
    const page = await pdf.getPage(pageNo);
    const textContent = await page.getTextContent();
    const spans = textContent.items
      .map(item => {
        const textItem = item as { str?: string; transform?: number[] };
        return {
          text: String(textItem.str || '').trim(),
          x: Number(textItem.transform?.[4] || 0),
          y: Number(textItem.transform?.[5] || 0),
        };
      })
      .filter(item => item.text);
    const rows: Array<{ y: number; items: typeof spans }> = [];
    spans
      .sort((a, b) => Math.abs(b.y - a.y) > 2 ? b.y - a.y : a.x - b.x)
      .forEach(span => {
        const row = rows.find(item => Math.abs(item.y - span.y) <= 2);
        if (row) {
          row.items.push(span);
          row.y = (row.y + span.y) / 2;
        } else {
          rows.push({ y: span.y, items: [span] });
        }
      });
    rows
      .sort((a, b) => b.y - a.y)
      .forEach(row => {
        lines.push(row.items.sort((a, b) => a.x - b.x).map(item => item.text).join(' '));
      });
  }
  return extractVatItemsFromPdfTextLines(lines);
};

export const normalizeVatOcrResult = (raw: unknown): VatInvoiceOcrResult => {
  const source = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const seller = (source.seller && typeof source.seller === 'object' ? source.seller : {}) as Record<string, unknown>;
  const issuer = (source.issuer && typeof source.issuer === 'object' ? source.issuer : {}) as Record<string, unknown>;
  const invoice = (source.invoice && typeof source.invoice === 'object' ? source.invoice : {}) as Record<string, unknown>;
  const flat = { ...source, ...seller, ...issuer, ...invoice };

  return {
    issuerName: firstString(flat, ['issuerName', 'sellerName', 'supplierName', 'companyName', 'name', 'tenDonViXuatHoaDon', 'tenNguoiBan']),
    issuerTaxCode: firstString(flat, ['issuerTaxCode', 'sellerTaxCode', 'taxCode', 'mst', 'maSoThue', 'maSoThueNguoiBan']),
    issuerPhone: firstString(flat, ['issuerPhone', 'sellerPhone', 'phone', 'telephone', 'dienThoai', 'soDienThoai']),
    issuerAddress: firstString(flat, ['issuerAddress', 'sellerAddress', 'address', 'diaChi', 'diaChiNguoiBan']),
    invoiceNo: firstString(flat, ['invoiceNo', 'invoiceNumber', 'soHoaDon', 'so', 'soHd']),
    invoiceDate: normalizeVatDateValue(firstString(flat, ['invoiceDate', 'date', 'ngayHoaDon', 'ngayXuatHoaDon', 'ngayLap'])),
    totalBeforeTax: firstNumber(flat, ['totalBeforeTax', 'amountBeforeTax', 'subtotal', 'tongTienTruocVat', 'tongTienHang']),
    vatAmount: firstNumber(flat, ['vatAmount', 'taxAmount', 'tienVat', 'tienThue', 'tongTienThue']),
    totalAmount: firstNumber(flat, ['totalAmount', 'grandTotal', 'total', 'tongTien', 'tongThanhToan']),
    items: normalizeVatOcrItems(source),
    confidence: source.confidence as VatInvoiceOcrResult['confidence'],
  };
};

export const fetchVatInvoiceOcr = async (file: File) => {
  const base64Data = await fileToBase64(file);
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), VAT_OCR_TIMEOUT_MS);
  try {
    const response = await fetch('/api/ai/vat-invoice-ocr', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ base64Data, mimeType: file.type || 'application/pdf' }),
      signal: controller.signal,
    });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error || 'AI không đọc được hóa đơn VAT.');
    return normalizeVatOcrResult(JSON.parse(extractJsonObject(String(payload.result || '{}'))));
  } finally {
    window.clearTimeout(timeout);
  }
};

export const getSupabaseErrorMessage = (error: unknown) => {
  if (!error) return '';
  if (error instanceof Error) return error.message;
  if (typeof error === 'object') {
    const source = error as { message?: unknown; details?: unknown; hint?: unknown; code?: unknown };
    return [source.message, source.details, source.hint, source.code]
      .filter(Boolean)
      .map(value => String(value))
      .join(' ');
  }
  return String(error);
};

export const isMissingSupplierInvoiceColumnError = (error: unknown) => {
  const message = getSupabaseErrorMessage(error).toLowerCase();
  return (
    message.includes('invoice_') &&
    (message.includes('column') || message.includes('schema cache') || message.includes('pgrst204') || message.includes('42703'))
  );
};

export const isMissingFilingTableError = (error: unknown) => {
  const message = getSupabaseErrorMessage(error).toLowerCase();
  return (
    message.includes('tax_filing_periods') ||
    message.includes('opening_stock_items') ||
    message.includes('could not find the table')
  );
};

export const normalizeDuplicateInvoiceText = (value?: string | null) =>
  String(value || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'd')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
    .trim();

export const getVatDocumentDuplicateKey = ({
  invoiceNo,
  invoiceDate,
  supplierId,
  supplierTaxCode,
  supplierName,
  totalAmount,
}: {
  invoiceNo?: string | null;
  invoiceDate?: string | null;
  supplierId?: string | null;
  supplierTaxCode?: string | null;
  supplierName?: string | null;
  totalAmount?: number | string | null;
}) => {
  const normalizedInvoiceNo = normalizeDuplicateInvoiceText(invoiceNo);
  const normalizedDate = normalizeVatDateValue(invoiceDate);
  const normalizedSupplier =
    normalizeDuplicateInvoiceText(supplierId) ||
    normalizeDuplicateInvoiceText(supplierTaxCode) ||
    normalizeDuplicateInvoiceText(supplierName);
  const normalizedAmount = Math.round(Number(totalAmount || 0));
  if (!normalizedInvoiceNo || !normalizedDate || !normalizedSupplier || normalizedAmount <= 0) return '';
  return `${normalizedInvoiceNo}|${normalizedDate}|${normalizedSupplier}|${normalizedAmount}`;
};

export const parseVatMoneyInput = (value: string | number | null | undefined) => {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
  const normalized = String(value || '').replace(/,/g, '').replace(/[^\d.-]/g, '');
  return Number(normalized) || 0;
};

export const formatVatMoneyInput = (value: string | number | null | undefined) => {
  const amount = parseVatMoneyInput(value);
  return amount > 0 ? amount.toLocaleString('en-US') : '';
};

export const getSupplierInvoiceDefaults = (supplier?: { invoiceCompanyName?: string; companyName?: string; name?: string; invoiceTaxCode?: string; taxCode?: string; invoicePhone?: string; phone?: string; invoiceAddress?: string; address?: string }) => ({
  issuerName: supplier?.invoiceCompanyName || supplier?.companyName || supplier?.name || '',
  issuerTaxCode: supplier?.invoiceTaxCode || supplier?.taxCode || '',
  issuerPhone: supplier?.invoicePhone || supplier?.phone || '',
  issuerAddress: supplier?.invoiceAddress || supplier?.address || '',
});
