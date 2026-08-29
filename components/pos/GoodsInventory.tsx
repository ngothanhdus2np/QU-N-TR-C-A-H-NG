import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
  AppData,
  AppDataSurgicalUpdate,
  POSProduct,
  InventoryTransaction,
  ProductGroup,
  Supplier,
  POSOrder,
} from '../../types';
import { exportToExcel } from '../../services/exportService';
import { translateError } from '../../services/errorMessages';
import { GoodsKhoHistory, GoodsAuditForm } from './GoodsAuditForm';
import { GoodsPurchaseForm } from './GoodsPurchaseForm';
import { ImportStatus, toGoodsExportRows } from './GoodsImportExport';
import { GoodsSortKey, useGoodsFilters } from './useGoodsFilters';
import { GoodsPagination } from './GoodsPagination';
import { GoodsProductTableHeader } from './GoodsProductTableHeader';
import { GoodsProductTableBody } from './GoodsProductTableBody';
import { GoodsLegacyProductFormView } from './GoodsLegacyProductFormView';
import { DEFAULT_VISIBLE_COLS, COLUMN_PREFS_KEY } from './GoodsInventoryColumns';
import { GoodsInventoryFeedback } from './GoodsInventoryFeedback';
import { GoodsInventoryModals } from './GoodsInventoryModals';
import { GoodsInventorySecondaryToolbar } from './GoodsInventoryNavigation';
import { GoodsProductsWorkspace } from './GoodsProductsWorkspace';
import { useGoodsExcelImport } from './useGoodsExcelImport';
import { useGoodsPurchase } from './useGoodsPurchase';
import { useGoodsAudit } from './useGoodsAudit';
import { useGoodsVariantWorkflow } from './useGoodsVariantWorkflow';
import { useGoodsSelection } from './useGoodsSelection';
import { useGoodsProductEditor } from './useGoodsProductEditor';
import { ApplyToVariantsModal } from './ApplyToVariantsModal';
import { GoodsPriceSetupModal } from './GoodsPriceSetupModal';
import { GoodsWarrantyMaintenancePage } from './GoodsWarrantyMaintenancePage';
import { GroupTreePicker } from './GroupTreePicker';
import { GoodsGridView } from './GoodsGridView';
import { GoodsGridVariantPopup } from './GoodsGridVariantPopup';
import { GoodsGridDetailModal } from './GoodsGridDetailModal';
import { BulkChannelLinkModal } from './BulkChannelLinkModal';
import {
  getBarcodeLabelTemplateSettings,
  buildCode128Svg,
  buildLabelProductName,
  normalizeCode128Text,
} from './goods/barcodeUtils';
import DOMPurify from 'dompurify';

interface GoodsInventoryProps {
  products: POSProduct[];
  transactions: InventoryTransaction[];
  orders?: POSOrder[];
  productGroups: ProductGroup[];
  suppliers?: Supplier[];
  inventoryCostMethod?: 'fixed' | 'average';
  onUpdateProducts: (products: POSProduct[]) => void;
  onUpdateSurgical?: (updates: AppDataSurgicalUpdate[]) => Promise<void>;
  onPushBatch?: (key: keyof AppData, items: unknown[]) => Promise<void>;
  onAddTransaction?: (transaction: InventoryTransaction) => void;
  requestedTab?: 'goods' | 'purchase' | 'kho' | 'pricing' | 'warranty';
  initialProductId?: string;
  initialViewProductId?: string;
}

const PAGE_SIZE_STORAGE_KEY = 'goods_items_per_page';
const VIEW_MODE_STORAGE_KEY = 'goods_view_mode';
const PAGE_SIZE_OPTIONS = [30, 50, 100, 200];
const DEFAULT_PAGE_SIZE = 50;
type ProductFormTab = 'info' | 'desc' | 'warranty' | 'units' | 'related' | 'channels';

const escapeLabelText = (value: string | number | undefined) =>
  String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const CODE_128_PATTERNS = [
  '212222','222122','222221','121223','121322','131222','122213','122312','132212','221213',
  '221312','231212','112232','122132','122231','113222','123122','123221','223211','221132',
  '221231','213212','223112','312131','311222','321122','321221','312212','322112','322211',
  '212123','212321','232121','111323','131123','131321','112313','132113','132311','211313',
  '231113','231311','112133','112331','132131','113123','113321','133121','313121','211331',
  '231131','213113','213311','213131','311123','311321','331121','312113','312311','332111',
  '314111','221411','431111','111224','111422','121124','121421','141122','141221','112214',
  '112412','122114','122411','142112','142211','241211','221114','413111','241112','134111',
  '111242','121142','121241','114212','124112','124211','411212','421112','421211','212141',
  '214121','412121','111143','111341','131141','114113','114311','411113','411311','113141',
  '114131','311141','411131','211412','211214','211232','2331112',
];

const buildCode128SvgForLabel = (rawCode: string) => {
  const code = rawCode.trim().replace(/[^\x20-\x7E]/g, '').slice(0, 32) || 'UNKNOWN';
  const values = [104, ...Array.from(code).map(c => c.charCodeAt(0) - 32)];
  const checksum = values.reduce((sum, v, i) => sum + v * (i === 0 ? 1 : i), 0) % 103;
  const sequence = [...values, checksum, 106];
  let x = 0;
  const bars = sequence
    .map(v => CODE_128_PATTERNS[v])
    .map(pattern => {
      let patternBars = '';
      Array.from(pattern).forEach((wc, idx) => {
        const w = Number(wc);
        if (idx % 2 === 0) patternBars += `<rect x="${x}" y="0" width="${w}" height="50" />`;
        x += w;
      });
      return patternBars;
    })
    .join('');
  return `<svg class="barcode" viewBox="0 0 ${x} 50" preserveAspectRatio="none">${bars}</svg>`;
};

const printProductLabels = (selectedProducts: POSProduct[], labelsPerProduct: number) => {
  const labels = selectedProducts.flatMap(product =>
    Array.from({ length: labelsPerProduct }, () => product)
  );
  let widthMm = 35, heightMm = 22, columns = 2, showName = true, showCode = true, showPrice = true, showBorder = false;
  try {
    const raw = localStorage.getItem('barcode_label_template_settings');
    if (raw) {
      const s = JSON.parse(raw);
      if (typeof s.widthMm === 'number') widthMm = s.widthMm;
      if (typeof s.heightMm === 'number') heightMm = s.heightMm;
      if (typeof s.columns === 'number') columns = s.columns;
      if (typeof s.showName === 'boolean') showName = s.showName;
      if (typeof s.showCode === 'boolean') showCode = s.showCode;
      if (typeof s.showPrice === 'boolean') showPrice = s.showPrice;
      if (typeof s.showBorder === 'boolean') showBorder = s.showBorder;
    }
  } catch {}
  const totalWidthMm = widthMm * columns;

  const labelHtml = labels
    .map(product => {
      const code = product.barcode || product.sku || product.id;
      return `<section class="label">${showName ? `<div class="name">${escapeLabelText(product.name)}</div>` : ''}${buildCode128SvgForLabel(code)}${showCode ? `<div class="code">${escapeLabelText(code)}</div>` : ''}${showPrice ? `<div class="price">${escapeLabelText(product.salePrice.toLocaleString('vi-VN'))} VNĐ</div>` : ''}</section>`;
    })
    .join('');

  const iframe = document.createElement('iframe');
  iframe.style.cssText = 'position:fixed;top:-9999px;left:-9999px;width:0;height:0;border:none;';
  document.body.appendChild(iframe);

  const doc = iframe.contentDocument || iframe.contentWindow?.document;
  if (!doc || !iframe.contentWindow) {
    document.body.removeChild(iframe);
    return false;
  }

  doc.open();
  doc.write(`<html><head><meta charset="utf-8" /><title>In tem mã hàng</title><style>
@page { size: ${totalWidthMm}mm ${heightMm}mm; margin: 0; }
body { margin: 0; padding: 0; font-family: Inter, Arial, sans-serif; }
.sheet { display: flex; flex-wrap: wrap; width: ${totalWidthMm}mm; font-size: 0; }
.label {
  box-sizing: border-box;
  width: ${widthMm}mm;
  height: ${heightMm}mm;
  padding: 1mm;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: flex-start;
  overflow: hidden;
  ${showBorder ? 'border: 0.5px solid #000;' : ''}
  page-break-inside: avoid;
}
.name { font-size: 8px; font-weight: 700; text-align: center; line-height: 1.15; min-height: 4.5mm; display: flex; align-items: flex-end; justify-content: center; overflow: hidden; }
.barcode { width: 92%; height: auto; max-height: ${heightMm * 0.35}mm; margin-top: auto; }
.code { margin-top: 1mm; font-size: 8px; font-weight: 700; line-height: 1; }
.price { margin-top: 0.3mm; font-size: 9px; font-weight: 900; line-height: 1; }
</style></head><body><main class="sheet">${labelHtml}</main></body></html>`);
  doc.close();

  iframe.onload = () => {
    iframe.contentWindow!.focus();
    iframe.contentWindow!.print();
    setTimeout(() => document.body.removeChild(iframe), 2000);
  };
  return true;
};

const BarcodePrintModal: React.FC<{
  isOpen: boolean;
  product: POSProduct | null;
  qty: number;
  showName: boolean;
  showPrice: boolean;
  showCode: boolean;
  showBorder: boolean;
  onQtyChange: (v: number) => void;
  onShowNameChange: (v: boolean) => void;
  onShowPriceChange: (v: boolean) => void;
  onShowCodeChange: (v: boolean) => void;
  onShowBorderChange: (v: boolean) => void;
  onClose: () => void;
  onPrintError: (msg: string) => void;
}> = ({ isOpen, product, qty, showName, showPrice, showCode, showBorder, onQtyChange, onShowNameChange, onShowPriceChange, onShowCodeChange, onShowBorderChange, onClose, onPrintError }) => {
  if (!isOpen || !product) return null;
  const t = getBarcodeLabelTemplateSettings();
  const code = product.sku || product.barcode || product.id;
  const displayName = buildLabelProductName(product);
  const displayCode = normalizeCode128Text(code) || code;
  const barcodeSvg = buildCode128Svg(code);
  const previewCount = Math.min(qty, 20);
  const previewCss = `
    .bp-sheet { display: flex; flex-wrap: wrap; width: ${t.widthMm * t.columns}mm; font-size: 0; }
    .bp-label {
      box-sizing: border-box; width: ${t.widthMm}mm; height: ${t.heightMm}mm;
      padding: 1.4mm 1.8mm 1mm; display: flex; flex-direction: column;
      align-items: center; justify-content: flex-start; text-align: center;
      overflow: hidden; ${showBorder ? 'border: 0.2mm solid #cbd5e1;' : ''}
    }
    .bp-name { width: 100%; font-size: 8px; line-height: 1.15; font-weight: 700; text-transform: uppercase; min-height: 4.5mm; display: flex; align-items: flex-end; justify-content: center; overflow: hidden; white-space: normal; overflow-wrap: anywhere; word-break: break-word; }
    .bp-barcode { width: ${Math.max(18, t.widthMm - 4)}mm; height: ${Math.max(7, t.heightMm * 0.35)}mm; margin-top: auto; display: block; fill: #020617; }
    .bp-code { width: 100%; margin-top: 1mm; font-family: "Courier New", monospace; font-size: 8px; font-weight: 700; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .bp-price { margin-top: 0.3mm; font-size: 9px; font-weight: 900; line-height: 1; }
  `;
  const escHtml = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const singleLabelHtml = `<div class="bp-label">${showName ? `<div class="bp-name">${escHtml(displayName)}</div>` : ''}${barcodeSvg.replace('class="barcode"', 'class="bp-barcode"')}${showCode ? `<div class="bp-code">${escHtml(displayCode)}</div>` : ''}${showPrice ? `<div class="bp-price">${product.salePrice.toLocaleString('vi-VN')}đ</div>` : ''}</div>`;
  const previewHtml = Array(previewCount).fill(singleLabelHtml).join('');

  const handlePrint = () => {
    const totalWidthMm = t.widthMm * t.columns;
    const allLabelsHtml = Array(qty).fill(singleLabelHtml.replace(/bp-/g, '')).join('');

    const iframe = document.createElement('iframe');
    iframe.style.cssText = 'position:fixed;top:-9999px;left:-9999px;width:0;height:0;border:none;';
    document.body.appendChild(iframe);

    const doc = iframe.contentDocument || iframe.contentWindow?.document;
    if (!doc || !iframe.contentWindow) {
      onPrintError('Không thể tạo khung in.');
      document.body.removeChild(iframe);
      return;
    }

    doc.open();
    doc.write(`<html>
      <head>
        <meta charset="utf-8" />
        <title>In tem mã hàng</title>
        <style>
          @page { size: ${totalWidthMm}mm ${t.heightMm}mm; margin: 0; }
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body { font-family: Inter, Arial, sans-serif; }
          .sheet { display: flex; flex-wrap: wrap; width: ${totalWidthMm}mm; font-size: 0; }
          .label {
            box-sizing: border-box;
            width: ${t.widthMm}mm;
            height: ${t.heightMm}mm;
            padding: 1.4mm 1.8mm 1mm;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: flex-start;
            text-align: center;
            overflow: hidden;
            ${showBorder ? 'border: 0.5px solid #000;' : ''}
            page-break-inside: avoid;
          }
          .name { width: 100%; font-size: 8px; line-height: 1.15; font-weight: 700; text-transform: uppercase; min-height: 4.5mm; display: flex; align-items: flex-end; justify-content: center; overflow: hidden; white-space: normal; overflow-wrap: anywhere; word-break: break-word; }
          .barcode { width: ${Math.max(18, t.widthMm - 4)}mm; height: ${Math.max(7, t.heightMm * 0.35)}mm; margin-top: auto; display: block; }
          .code { width: 100%; margin-top: 1mm; font-family: "Courier New", monospace; font-size: 8px; font-weight: 700; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
          .price { margin-top: 0.3mm; font-size: 9px; font-weight: 900; line-height: 1; }
        </style>
      </head>
      <body><div class="sheet">${allLabelsHtml}</div></body>
    </html>`);
    doc.close();

    onClose();

    iframe.onload = () => {
      iframe.contentWindow!.focus();
      iframe.contentWindow!.print();
      setTimeout(() => document.body.removeChild(iframe), 2000);
    };
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-[680px] max-h-[90vh] overflow-hidden flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-200">
          <div className="flex items-center gap-2">
            <svg className="h-5 w-5 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M6.72 13.829c-.24.03-.48.062-.72.096m.72-.096a42.415 42.415 0 0110.56 0m-10.56 0L6.34 18m10.94-4.171c.24.03.48.062.72.096m-.72-.096L17.66 18m0 0 .229 2.523a1.125 1.125 0 01-1.12 1.227H7.231c-.662 0-1.18-.568-1.12-1.227L6.34 18m11.318 0h1.091A2.25 2.25 0 0021 15.75V9.456c0-1.081-.768-2.015-1.837-2.175a48.055 48.055 0 00-1.913-.247M6.34 18H5.25A2.25 2.25 0 013 15.75V9.456c0-1.081.768-2.015 1.837-2.175a48.041 48.041 0 011.913-.247m10.5 0a48.536 48.536 0 00-10.5 0m10.5 0V3.375c0-.621-.504-1.125-1.125-1.125h-8.25c-.621 0-1.125.504-1.125 1.125v3.659M18.25 7.034V3.375" /></svg>
            <h2 className="text-base font-semibold text-slate-900">In tem mã vạch</h2>
          </div>
          <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-colors">
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>
        <div className="flex flex-1 min-h-0">
          <div className="w-[200px] shrink-0 border-r border-slate-200 p-4 flex flex-col gap-3.5 overflow-y-auto">
            <div>
              <label className="block text-xs text-slate-500 mb-1.5">Số lượng in</label>
              <input
                type="number" min={1} max={500} value={qty}
                onChange={e => { const v = Math.max(1, Math.min(500, Math.floor(Number(e.target.value) || 1))); onQtyChange(v); }}
                className="w-full h-9 rounded-lg border border-slate-200 px-3 text-center text-sm font-semibold focus:border-indigo-400 focus:ring-1 focus:ring-indigo-200 outline-none"
              />
            </div>
            <div className="border-t border-slate-100" />
            <label className="flex items-center gap-2 text-[13px] text-slate-700 cursor-pointer select-none">
              <input type="checkbox" checked={showName} onChange={e => onShowNameChange(e.target.checked)} className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500" />
              Tên sản phẩm
            </label>
            <label className="flex items-center gap-2 text-[13px] text-slate-700 cursor-pointer select-none">
              <input type="checkbox" checked={showPrice} onChange={e => onShowPriceChange(e.target.checked)} className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500" />
              Giá bán
            </label>
            <label className="flex items-center gap-2 text-[13px] text-slate-700 cursor-pointer select-none">
              <input type="checkbox" checked={showCode} onChange={e => onShowCodeChange(e.target.checked)} className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500" />
              Mã hàng
            </label>
            <label className="flex items-center gap-2 text-[13px] text-slate-700 cursor-pointer select-none">
              <input type="checkbox" checked={showBorder} onChange={e => onShowBorderChange(e.target.checked)} className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500" />
              Đường viền tem
            </label>
            <div className="border-t border-slate-100" />
            <div className="bg-slate-50 rounded-lg p-2.5">
              <div className="text-[11px] text-slate-400 mb-0.5">Mẫu tem hiện tại</div>
              <div className="text-xs font-semibold text-slate-700">{t.widthMm}×{t.heightMm}mm · {t.columns} cột</div>
              <div className="text-[11px] text-slate-400 mt-0.5">Thay đổi tại Cài đặt → Mẫu in</div>
            </div>
          </div>
          <div className="flex-1 flex flex-col p-4 gap-3 min-w-0">
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-500">Xem trước ({previewCount}{qty > 20 ? ` / ${qty}` : ''} tem)</span>
            </div>
            <div className="flex-1 bg-slate-50 rounded-lg border border-slate-100 flex items-start justify-center p-4 overflow-auto min-h-[280px]">
              <style>{previewCss}</style>
              <div className="inline-block bg-white rounded p-2 shadow-sm">
                <main
                  className="bp-sheet"
                  dangerouslySetInnerHTML={{
                    __html: DOMPurify.sanitize(previewHtml, {
                      ADD_TAGS: ['svg', 'rect', 'path', 'section'],
                      ADD_ATTR: ['viewBox', 'xmlns', 'preserveAspectRatio', 'fill', 'stroke', 'width', 'height', 'd', 'x', 'y', 'aria-label'],
                    }),
                  }}
                />
              </div>
            </div>
            <button
              onClick={handlePrint}
              className="w-full py-2.5 bg-indigo-600 text-white rounded-xl text-sm font-semibold hover:bg-indigo-700 transition-colors flex items-center justify-center gap-2"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6.72 13.829c-.24.03-.48.062-.72.096m.72-.096a42.415 42.415 0 0110.56 0m-10.56 0L6.34 18m10.94-4.171c.24.03.48.062.72.096m-.72-.096L17.66 18m0 0 .229 2.523a1.125 1.125 0 01-1.12 1.227H7.231c-.662 0-1.18-.568-1.12-1.227L6.34 18m11.318 0h1.091A2.25 2.25 0 0021 15.75V9.456c0-1.081-.768-2.015-1.837-2.175a48.055 48.055 0 00-1.913-.247M6.34 18H5.25A2.25 2.25 0 013 15.75V9.456c0-1.081.768-2.015 1.837-2.175a48.041 48.041 0 011.913-.247m10.5 0a48.536 48.536 0 00-10.5 0m10.5 0V3.375c0-.621-.504-1.125-1.125-1.125h-8.25c-.621 0-1.125.504-1.125 1.125v3.659M18.25 7.034V3.375" /></svg>
              In {qty} tem
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

const GoodsInventory: React.FC<GoodsInventoryProps> = ({
  products,
  transactions,
  orders = [],
  productGroups,
  suppliers = [],
  inventoryCostMethod,
  onUpdateProducts,
  onUpdateSurgical,
  onPushBatch,
  onAddTransaction,
  requestedTab,
  initialProductId,
  initialViewProductId,
}) => {
  // === Toast & Modal State ===
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 2500);
  };
  const [inputModal, setInputModal] = useState<{
    isOpen: boolean;
    title: string;
    label: string;
    placeholder?: string;
    type?: 'text' | 'number';
    defaultValue?: string | number;
    onConfirm: (val: string) => void;
  }>({ isOpen: false, title: '', label: '', onConfirm: () => {} });
  const openInputModal = (config: Omit<typeof inputModal, 'isOpen'>) =>
    setInputModal({ ...config, isOpen: true });
  const closeInputModal = () => setInputModal(prev => ({ ...prev, isOpen: false }));
  const [bulkChannelLinkOpen, setBulkChannelLinkOpen] = useState(false);
  const [changeGroupModal, setChangeGroupModal] = useState<{ isOpen: boolean; selectedGroupId: string }>({ isOpen: false, selectedGroupId: '' });
  const [createGroupModal, setCreateGroupModal] = useState<{ isOpen: boolean; name: string; parentId: string }>({ isOpen: false, name: '', parentId: '' });

  // AUDIT-011: Cảnh báo khi hoàn thành nhập hàng mà chưa chọn NCC
  const [showNoSupplierConfirm, setShowNoSupplierConfirm] = useState(false);

  // Barcode label print modal
  const [barcodePrintModal, setBarcodePrintModal] = useState<{ isOpen: boolean; product: POSProduct | null }>({ isOpen: false, product: null });
  const [barcodePrintQty, setBarcodePrintQty] = useState(6);
  const [barcodePrintShowName, setBarcodePrintShowName] = useState(true);
  const [barcodePrintShowPrice, setBarcodePrintShowPrice] = useState(true);
  const [barcodePrintShowCode, setBarcodePrintShowCode] = useState(true);
  const [barcodePrintShowBorder, setBarcodePrintShowBorder] = useState(false);

  useEffect(() => {
    if (barcodePrintModal.isOpen) {
      const t = getBarcodeLabelTemplateSettings();
      setBarcodePrintShowName(t.showName);
      setBarcodePrintShowPrice(t.showPrice);
      setBarcodePrintShowCode(t.showCode);
      setBarcodePrintShowBorder(t.showBorder);
    }
  }, [barcodePrintModal.isOpen]);

  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    variant?: 'danger' | 'warning' | 'info' | 'success';
    confirmLabel?: string;
    onConfirm: () => void;
  }>({ isOpen: false, title: '', message: '', onConfirm: () => {} });
  const openConfirm = (config: Omit<typeof confirmDialog, 'isOpen'>) =>
    setConfirmDialog({ ...config, isOpen: true });
  const closeConfirm = () => setConfirmDialog(prev => ({ ...prev, isOpen: false }));
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('');
  const [searchTags, setSearchTags] = useState<string[]>([]);

  // Debounce search
  React.useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearchTerm(searchTerm), 300);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  const handleSearchChange = (val: string) => {
    setSearchTerm(val);
    setCurrentPage(1);
  };

  const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      const term = searchTerm.trim();
      if (term && !searchTags.includes(term)) {
        setSearchTags(prev => [...prev, term]);
        setSearchTerm('');
        setDebouncedSearchTerm('');
        setCurrentPage(1);
      }
    }
  };

  const handleTagRemove = (tag: string) => {
    setSearchTags(prev => prev.filter(t => t !== tag));
    setCurrentPage(1);
  };
  const [viewingProduct, setViewingProduct] = useState<POSProduct | null>(null);
  const [activeTab, setActiveTab] = useState<
    'goods' | 'purchase' | 'kho' | 'pricing' | 'warranty' | 'audit_form' | 'product_form'
  >('goods');

  useEffect(() => {
    if (requestedTab) setActiveTab(requestedTab);
  }, [requestedTab]);
  const {
    showPurchaseForm,
    setShowPurchaseForm,
    purchaseItems,
    purchaseSupplier,
    setPurchaseSupplier,
    purchaseNote,
    setPurchaseNote,
    handleAddProductToPurchase,
    handleAddProductsToPurchase,
    updatePurchaseItem,
    removePurchaseItem,
    handleCompletePurchase,
    purchaseDiscountValue,
    purchaseDiscountType,
    setPurchaseDiscountValue,
    setPurchaseDiscountType,
    invoiceStatus,
    setInvoiceStatus,
    invoiceFile,
    setInvoiceFile,
  } = useGoodsPurchase({ products, suppliers, inventoryCostMethod, onUpdateProducts, onUpdateSurgical, onAddTransaction, showToast });

  // AUDIT-011: Intercept "Hoàn thành nhập hàng" — cảnh báo nếu chưa nhập NCC
  const handleCompletePurchaseWithCheck = () => {
    if (!purchaseSupplier.trim()) {
      setShowNoSupplierConfirm(true);
    } else {
      handleCompletePurchase();
    }
  };
  const {
    auditSearchTerm,
    setAuditSearchTerm,
    auditItems,
    setAuditItems,
    handleConfirmAudit,
    cancelAudit,
  } = useGoodsAudit({ products, onUpdateProducts, onUpdateSurgical, onAddTransaction, showToast, setActiveTab });

  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(() => {
    try {
      const saved = Number(localStorage.getItem(PAGE_SIZE_STORAGE_KEY));
      return PAGE_SIZE_OPTIONS.includes(saved) ? saved : DEFAULT_PAGE_SIZE;
    } catch {
      return DEFAULT_PAGE_SIZE;
    }
  });
  const [viewMode, setViewMode] = useState<'table' | 'grid'>(() => {
    try {
      const saved = localStorage.getItem(VIEW_MODE_STORAGE_KEY);
      return saved === 'grid' ? 'grid' : 'table';
    } catch {
      return 'table';
    }
  });

  const handleViewModeChange = useCallback((mode: 'table' | 'grid') => {
    setViewMode(mode);
    try {
      localStorage.setItem(VIEW_MODE_STORAGE_KEY, mode);
    } catch {
      // ignore
    }
  }, []);

  const [variantPickerProduct, setVariantPickerProduct] = useState<POSProduct | null>(null);
  const [gridDetailProduct, setGridDetailProduct] = useState<POSProduct | null>(null);
  const [gridDetailSiblings, setGridDetailSiblings] = useState<POSProduct[]>([]);
  const [gridCardWidth, setGridCardWidth] = useState(160);

  const [filterCategories, setFilterCategories] = useState<string[]>([]);
  const [filterBrand, setFilterBrand] = useState('');
  const [filterStock, setFilterStock] = useState<'all' | 'in_stock' | 'out_of_stock' | 'low_stock'>(
    'all'
  );
  const [filterLocation, setFilterLocation] = useState('');
  const [filterAttrs, setFilterAttrs] = useState<string[]>([]);
  const [filterSupplier, setFilterSupplier] = useState<string[]>([]);
  const [filterPlatforms, setFilterPlatforms] = useState<string[]>([]);
  const [platformProductIds, setPlatformProductIds] = useState<Map<string, Set<string>>>(new Map());
  const [availablePlatforms, setAvailablePlatforms] = useState<{ key: string; label: string }[]>([]);
  const [sortKey, setSortKey] = useState<GoodsSortKey>('sku');
  const [sortDirection, setSortDirection] = useState<'desc' | 'asc'>('desc');

  // Column visibility
  const [visibleColumns, setVisibleColumns] = useState<string[]>(() => {
    try {
      const s = localStorage.getItem(COLUMN_PREFS_KEY);
      return s ? JSON.parse(s) : DEFAULT_VISIBLE_COLS;
    } catch {
      return DEFAULT_VISIBLE_COLS;
    }
  });
  const [showColumnPopup, setShowColumnPopup] = useState(false);
  const [columnPopupPos, setColumnPopupPos] = useState({ top: 0, left: 0, width: 340 });
  const columnTriggerRef = useRef<HTMLButtonElement>(null);

  const {
    showAddUnitInView,
    setShowAddUnitInView,
    showAddAttributeInView,
    setShowAddAttributeInView,
    viewModeNewUnit,
    setViewModeNewUnit,
    viewModeAttributes,
    setViewModeAttributes,
    previewVariants,
    setPreviewVariants,
    showAddMoreVariants,
    addingToParentId,
    handleAddUnitInViewMode,
    handleAddAttributeInViewMode,
    generatePreviewVariants,
    openAddMoreVariants,
    closeAddMoreVariantsModal,
    closeAddAttributeInViewModal,
    handleSaveMoreVariants,
  } = useGoodsVariantWorkflow({
    products,
    onUpdateProducts,
    onUpdateSurgical,
    viewingProduct,
    setViewingProduct,
    showToast,
    showConfirm: (message, onConfirm) => {
      openConfirm({
        title: 'Xác nhận',
        message,
        confirmLabel: 'Tiếp tục',
        onConfirm: () => { onConfirm(); closeConfirm(); },
      });
    },
  });

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [importStatus, setImportStatus] = useState<ImportStatus | null>(null);
  const { handleExcelImport, downloadTemplate } = useGoodsExcelImport({
    products,
    onUpdateProducts,
    onPushBatch,
    setImportStatus,
    fileInputRef,
  });

  const {
    editingProduct,
    setEditingProduct,
    formData,
    setFormData,
    showCreateModal,
    setShowCreateModal,
    showProductModal,
    setShowProductModal,
    setIsQuickAddMode,
    activeFormTab,
    setActiveFormTab,
    createModalTab,
    setCreateModalTab,
    showStockSection,
    setShowStockSection,
    showLocationSection,
    setShowLocationSection,
    showUnitsSection,
    setShowUnitsSection,
    showAddUnitModal,
    setShowAddUnitModal,
    newUnitName,
    setNewUnitName,
    newUnitPrice,
    setNewUnitPrice,
    newUnitDirectSale,
    setNewUnitDirectSale,
    openCreateProduct,
    openCreateSameType,
    openProductEditor,
    handleSaveProduct,
    handleOpenQuickAddProduct,
    addBaseUnit,
    handleSaveBaseUnit,
    addConversionUnit,
    applyToVariants,
    setApplyToVariants,
    showApplyVariantsModal,
    variantSiblings,
    selectedSiblingIds,
    handleToggleSibling,
    handleToggleAllSiblings,
    handleConfirmApplyVariants,
    handleCancelApplyVariants,
  } = useGoodsProductEditor({
    products,
    onUpdateProducts,
    onUpdateSurgical,
    activeTab,
    setActiveTab,
    handleAddProductToPurchase,
    showToast,
    openInputModal,
    closeInputModal,
  });

  // Mở modal chỉnh sửa sản phẩm khi có initialProductId từ URL (?edit=<id>)
  React.useEffect(() => {
    if (!initialProductId) return;
    const prod = products.find(p => p.id === initialProductId);
    if (prod) openProductEditor(prod);
  }, [initialProductId, products, openProductEditor]);

  // Mở panel xem chi tiết sản phẩm khi có initialViewProductId từ URL (?view=<id>)
  // — bước 1: xóa hết filter/search đang áp dụng để sản phẩm không bị che khuất,
  // vẫn giữ nguyên toàn bộ danh sách hàng hóa (không lọc riêng theo SKU)
  const [pendingViewProductId, setPendingViewProductId] = useState<string | undefined>(undefined);
  const shouldScrollToViewRef = useRef(false);
  React.useEffect(() => {
    if (!initialViewProductId) return;
    setFilterCategories([]);
    setFilterBrand('');
    setFilterStock('all');
    setFilterLocation('');
    setFilterAttrs([]);
    setFilterSupplier([]);
    setFilterPlatforms([]);
    setSearchTags([]);
    setSearchTerm('');
    setDebouncedSearchTerm('');
    setPendingViewProductId(initialViewProductId);
  }, [initialViewProductId]);

  React.useEffect(() => {
    localStorage.setItem(COLUMN_PREFS_KEY, JSON.stringify(visibleColumns));
  }, [visibleColumns]);

  React.useEffect(() => {
    if (!showColumnPopup) return;
    const handler = (e: MouseEvent) => {
      const popup = document.getElementById('column-visibility-popup');
      const trigger = columnTriggerRef.current;
      if (
        popup &&
        !popup.contains(e.target as Node) &&
        trigger &&
        !trigger.contains(e.target as Node)
      ) {
        setShowColumnPopup(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showColumnPopup]);

  React.useEffect(() => {
    fetch('/api/channel-links/platforms', { credentials: 'include' })
      .then(r => r.json())
      .then((data: { ok: boolean; shops: { id: string; name: string }[]; websiteIds: string[]; shopeeByShop: Record<string, string[]> }) => {
        if (!data.ok) return;
        const idMap = new Map<string, Set<string>>();
        idMap.set('website', new Set(data.websiteIds));
        for (const [shopId, ids] of Object.entries(data.shopeeByShop)) {
          idMap.set(`shopee:${shopId}`, new Set(ids));
        }
        setPlatformProductIds(idMap);
        const platforms: { key: string; label: string }[] = [
          { key: 'website', label: 'Website' },
          ...data.shops.map(s => ({ key: `shopee:${s.id}`, label: `Shopee — ${s.name}` })),
        ];
        setAvailablePlatforms(platforms);
      })
      .catch(() => {});
  }, []);

  const {
    lowStockProducts,
    uniqueCategories,
    uniqueBrands,
    uniqueLocations,
    uniqueSuppliers,
    attrValuesByName,
    categoryCounts,
    filteredProducts,
    sellableSkuCount,
    totalPages,
    currentProducts,
    variantsByParentId,
  } = useGoodsFilters({
    products,
    transactions,
    suppliers,
    debouncedSearchTerm,
    searchTags,
    filterCategories,
    filterBrand,
    filterStock,
    filterLocation,
    filterAttrs,
    filterSupplier,
    filterPlatforms,
    platformProductIds,
    sortKey,
    sortDirection,
    currentPage,
    itemsPerPage,
  });

  const pendingOrdersMap = React.useMemo(() => {
    const map = new Map<string, number>();
    for (const order of orders) {
      if (order.status !== 'pending') continue;
      for (const item of order.items) {
        map.set(item.productId, (map.get(item.productId) || 0) + item.quantity);
      }
    }
    return map;
  }, [orders]);

  const enrichProduct = React.useCallback((p: POSProduct): POSProduct => {
    const pending = pendingOrdersMap.get(p.id) || 0;
    const imported = Number(p.customerOrders || 0);
    const computed = Math.max(pending, imported);
    return computed !== imported ? { ...p, customerOrders: computed } : p;
  }, [pendingOrdersMap]);

  const enrichedCurrentProducts = React.useMemo(
    () => currentProducts.map(enrichProduct),
    [currentProducts, enrichProduct]
  );

  const enrichedViewingProduct = React.useMemo(
    () => viewingProduct ? enrichProduct(viewingProduct) : null,
    [viewingProduct, enrichProduct]
  );

  React.useEffect(() => {
    if (totalPages > 0 && currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  // 5 fixed cols (checkbox + star + sku + name + actions) + N visible cols
  const colCount = 5 + visibleColumns.length;
  const {
    selectedIds,
    setSelectedIds,
    favoriteIds,
    expandedParents,
    toggleSelectAll,
    toggleSelectOne,
    toggleFavorite,
    toggleExpandedParent,
    handleBulkDelete,
  } = useGoodsSelection({
    products,
    filteredProducts,
    currentProducts,
    onUpdateProducts,
    onUpdateSurgical,
    openConfirm,
    showToast,
  });

  // ?view=<id> bước 2: sau khi filter đã xóa (filteredProducts cập nhật lại đầy đủ), tìm
  // đúng trang chứa sản phẩm trong danh sách đầy đủ rồi nhảy tới + mở panel chi tiết.
  // Nếu là biến thể (có parentId) thì tính trang theo dòng cha + tự mở rộng dòng cha.
  React.useEffect(() => {
    if (!pendingViewProductId) return;
    const prod = products.find(p => p.id === pendingViewProductId);
    if (!prod) return;
    const rowId = prod.parentId || prod.id;
    const idx = filteredProducts.findIndex(p => p.id === rowId);
    if (idx === -1) return;
    setCurrentPage(Math.floor(idx / itemsPerPage) + 1);
    if (prod.parentId) toggleExpandedParent(prod.parentId);
    setViewingProduct(prod);
    setActiveFormTab('info');
    setPendingViewProductId(undefined);
    shouldScrollToViewRef.current = true;
  }, [pendingViewProductId, products, filteredProducts, itemsPerPage, toggleExpandedParent]);

  // Cuộn thẳng tới panel chi tiết vừa mở từ ?view=<id> — người dùng không cần tự vuốt xuống
  React.useEffect(() => {
    if (!shouldScrollToViewRef.current || !viewingProduct) return;
    shouldScrollToViewRef.current = false;
    const timer = setTimeout(() => {
      document
        .querySelector('[data-viewing-product-panel="true"]')
        ?.scrollIntoView({ behavior: 'instant', block: 'start' });
    }, 50);
    return () => clearTimeout(timer);
  }, [viewingProduct]);

  const selectedProducts = React.useMemo(
    () => products.filter(product => selectedIds.includes(product.id)),
    [products, selectedIds]
  );

  const selectedIdSet = React.useMemo(() => new Set(selectedIds), [selectedIds]);
  const favoriteIdSet = React.useMemo(() => new Set(favoriteIds), [favoriteIds]);

  const handleStartAudit = useCallback(
    (_mode: 'actual' | 'damaged') => {
      setAuditItems([]);
      setActiveTab('audit_form');
    },
    [setAuditItems]
  );

  const handlePrintLabel = useCallback((product: POSProduct) => {
    setBarcodePrintModal({ isOpen: true, product });
    setBarcodePrintQty(Math.max(1, product.stock || 1));
  }, []);

  const handleAddSameType = useCallback(
    (product: POSProduct) => {
      openCreateSameType(product);
    },
    [openCreateSameType]
  );

  const handlePurchaseProduct = useCallback(
    (product: POSProduct) => {
      handleAddProductToPurchase(product);
      setActiveTab('purchase');
    },
    [handleAddProductToPurchase]
  );

  const handleStopBusiness = useCallback(
    (product: POSProduct) => {
      openConfirm({
        title: 'Ngừng kinh doanh',
        message: `Xác nhận ngừng kinh doanh "${product.name}"?`,
        variant: 'warning',
        confirmLabel: 'Ngừng KD',
        onConfirm: async () => {
          try {
            const affected = products
              .filter(p => p.id === product.id || p.parentId === product.id)
              .map(p => ({ ...p, status: 'Inactive' as const }));
            if (onUpdateSurgical) {
              await onUpdateSurgical(affected.map(p => ({ key: 'posProducts' as const, item: p })));
            } else {
              onUpdateProducts(products.map(p =>
                p.id === product.id || p.parentId === product.id ? { ...p, status: 'Inactive' } : p
              ));
            }
            showToast(`Đã ngừng kinh doanh "${product.name}".`);
          } catch (err: unknown) {
            showToast(translateError(err, 'Lỗi ngừng kinh doanh'), 'error');
          } finally {
            closeConfirm();
          }
        },
      });
    },
    [products, onUpdateProducts, onUpdateSurgical, openConfirm, closeConfirm, showToast]
  );

  const selectedSellableProducts = React.useMemo(
    () => selectedProducts.filter(product => !product.isParent),
    [selectedProducts]
  );

  const handleExportSelected = useCallback(() => {
    if (selectedProducts.length === 0) return;
    exportToExcel(toGoodsExportRows(selectedProducts), 'HangHoaDaChon');
  }, [selectedProducts]);

  const handlePrintSelectedLabels = useCallback(() => {
    if (selectedSellableProducts.length === 0) {
      showToast('Không có hàng hóa bán thật để in tem mã.', 'error');
      return;
    }
    openInputModal({
      title: 'In tem mã hàng loạt',
      label: 'Số lượng tem mỗi sản phẩm',
      placeholder: 'VD: 1',
      type: 'number',
      defaultValue: 1,
      onConfirm: value => {
        const labelsPerProduct = Math.floor(Number(value));
        if (!Number.isFinite(labelsPerProduct) || labelsPerProduct <= 0) {
          showToast('Số lượng tem phải lớn hơn 0.', 'error');
          return;
        }
        const printed = printProductLabels(selectedSellableProducts, labelsPerProduct);
        if (printed) {
          showToast(
            `Đã mở cửa sổ in ${selectedSellableProducts.length * labelsPerProduct} tem mã.`
          );
          closeInputModal();
        } else {
          showToast('Trình duyệt đã chặn cửa sổ in tem mã.', 'error');
        }
      },
    });
  }, [selectedSellableProducts, showToast]);

  const handlePurchaseSelected = useCallback(() => {
    handleAddProductsToPurchase(selectedProducts);
    if (selectedSellableProducts.length > 0) {
      setActiveTab('purchase');
      setSelectedIds([]);
    }
  }, [
    handleAddProductsToPurchase,
    selectedProducts,
    selectedSellableProducts.length,
    setSelectedIds,
  ]);

  const handleBulkStopBusiness = useCallback(() => {
    if (selectedProducts.length === 0) return;
    openConfirm({
      title: 'Ngừng kinh doanh hàng loạt',
      message: `Xác nhận ngừng kinh doanh ${selectedProducts.length} mặt hàng đã chọn?`,
      variant: 'warning',
      confirmLabel: 'Ngừng KD',
      onConfirm: async () => {
        try {
          const selectedIdSet = new Set(selectedProducts.map(p => p.id));
          const affected = products
            .filter(p => selectedIdSet.has(p.id) || (p.parentId && selectedIdSet.has(p.parentId)))
            .map(p => ({ ...p, status: 'Inactive' as const }));
          if (onUpdateSurgical) {
            await onUpdateSurgical(affected.map(p => ({ key: 'posProducts' as const, item: p })));
          } else {
            onUpdateProducts(products.map(p =>
              selectedIdSet.has(p.id) || (p.parentId && selectedIdSet.has(p.parentId))
                ? { ...p, status: 'Inactive' } : p
            ));
          }
          setSelectedIds([]);
          showToast(`Đã ngừng kinh doanh ${selectedProducts.length} mặt hàng.`);
        } catch (err: unknown) {
          showToast(translateError(err, 'Lỗi ngừng kinh doanh'), 'error');
        } finally {
          closeConfirm();
        }
      },
    });
  }, [selectedProducts, products, onUpdateProducts, onUpdateSurgical, openConfirm, closeConfirm, showToast, setSelectedIds]);

  const handleBulkChangeGroup = useCallback(() => {
    setChangeGroupModal({ isOpen: true, selectedGroupId: '' });
  }, []);

  const handleConfirmChangeGroup = useCallback(async () => {
    if (!changeGroupModal.selectedGroupId) {
      showToast('Vui lòng chọn nhóm hàng.', 'error');
      return;
    }
    try {
      const selectedIdSet = new Set(selectedProducts.map(p => p.id));
      const affected = products
        .filter(p => selectedIdSet.has(p.id) || (p.parentId && selectedIdSet.has(p.parentId)))
        .map(p => ({ ...p, categoryId: changeGroupModal.selectedGroupId, categoryPath: undefined }));
      if (onUpdateSurgical) {
        await onUpdateSurgical(affected.map(p => ({ key: 'posProducts' as const, item: p })));
      } else {
        onUpdateProducts(products.map(p =>
          selectedIdSet.has(p.id) || (p.parentId && selectedIdSet.has(p.parentId))
            ? { ...p, categoryId: changeGroupModal.selectedGroupId, categoryPath: undefined } : p
        ));
      }
      setSelectedIds([]);
      setChangeGroupModal({ isOpen: false, selectedGroupId: '' });
      showToast(`Đã chuyển ${selectedProducts.length} sản phẩm sang nhóm "${changeGroupModal.selectedGroupId}".`);
    } catch (err: unknown) {
      showToast(translateError(err, 'Lỗi chuyển nhóm'), 'error');
    }
  }, [changeGroupModal, selectedProducts, products, onUpdateProducts, onUpdateSurgical, setSelectedIds, showToast]);

  const handleCreateGroup = useCallback(async () => {
    const trimmed = createGroupModal.name.trim();
    if (!trimmed) {
      showToast('Vui lòng nhập tên nhóm hàng.', 'error');
      return;
    }
    try {
      const fullName = createGroupModal.parentId ? `${createGroupModal.parentId} >> ${trimmed}` : trimmed;
      const newGroup: ProductGroup = { id: crypto.randomUUID(), name: fullName };
      await onPushBatch?.('productGroups', [newGroup]);
      setCreateGroupModal({ isOpen: false, name: '', parentId: '' });
      setChangeGroupModal(prev => ({ ...prev, selectedGroupId: newGroup.name }));
      showToast(`Đã tạo nhóm hàng "${fullName}".`);
    } catch (err: unknown) {
      showToast(translateError(err, 'Lỗi tạo nhóm hàng'), 'error');
    }
  }, [createGroupModal, onPushBatch, showToast]);

  const handleGoToWarranty = useCallback(() => {
    setActiveTab('warranty');
  }, [setActiveTab]);

  const handleToggleView = useCallback(
    (prod: POSProduct) => {
      if (viewingProduct?.id === prod.id) {
        setViewingProduct(null);
      } else {
        setViewingProduct(prod);
        setActiveFormTab('info');
      }
    },
    [viewingProduct?.id]
  );

  const handleToggleExpanded = useCallback(
    (id: string) => {
      toggleExpandedParent(id);
      setViewingProduct(null);
    },
    [toggleExpandedParent]
  );

  const handleGridCardClick = useCallback(
    (prod: POSProduct) => {
      if (prod.isParent && prod.variantCount && prod.variantCount > 0) {
        setVariantPickerProduct(prod);
      } else {
        setGridDetailProduct(prod);
      }
    },
    []
  );

  const handleGridVariantSelect = useCallback((variant: POSProduct) => {
    const siblings = products.filter(
      p => p.parentId === variantPickerProduct?.id && p.status === 'Active'
    );
    setVariantPickerProduct(null);
    setGridDetailSiblings(siblings);
    setGridDetailProduct(variant);
  }, [products, variantPickerProduct?.id]);

  const handleChangeDetailTab = useCallback((tab: ProductFormTab) => {
    setActiveFormTab(tab);
  }, []);

  const handleDeleteViewed = useCallback(
    async (id: string) => {
      try {
        if (onUpdateSurgical) {
          const idsToDelete = [id, ...products.filter(p => p.parentId === id).map(p => p.id)];
          await onUpdateSurgical(idsToDelete.map(delId => ({ key: 'posProducts' as const, item: { id: delId }, isDelete: true })));
        } else {
          onUpdateProducts(products.filter(prod => prod.id !== id && prod.parentId !== id));
        }
        setViewingProduct(null);
      } catch (err: unknown) {
        showToast(translateError(err, 'Lỗi xóa sản phẩm'), 'error');
      }
    },
    [onUpdateProducts, onUpdateSurgical, products, showToast]
  );

  const handleEditViewed = useCallback(
    (prod: POSProduct) => {
      openProductEditor(prod);
      setViewingProduct(null);
    },
    [openProductEditor]
  );

  const handleAddUnitInView = useCallback(() => setShowAddUnitInView(true), []);

  const handleAddAttributeInView = useCallback(() => setShowAddAttributeInView(true), []);

  const handleItemsPerPageChange = useCallback((nextItemsPerPage: number) => {
    setItemsPerPage(nextItemsPerPage);
    setCurrentPage(1);
    try {
      localStorage.setItem(PAGE_SIZE_STORAGE_KEY, String(nextItemsPerPage));
    } catch {
      // Page size is a device preference; ignore storage failures.
    }
  }, []);

  const handleSort = useCallback((key: GoodsSortKey) => {
    setSortKey(prevKey => {
      if (prevKey === key) {
        setSortDirection(prevDirection => (prevDirection === 'desc' ? 'asc' : 'desc'));
        return prevKey;
      }
      setSortDirection('desc');
      return key;
    });
    setCurrentPage(1);
  }, []);

  const renderMainContent = () => {
    switch (activeTab) {
      case 'goods':
        return (
          <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
            <div className="flex-1 min-h-0 overflow-auto overscroll-contain no-scrollbar">
              {viewMode === 'grid' ? (
                <GoodsGridView
                  products={enrichedCurrentProducts}
                  viewingProductId={gridDetailProduct?.id}
                  onToggleView={handleGridCardClick}
                  onCardWidthChange={setGridCardWidth}
                  variantsByParentId={variantsByParentId}
                />
              ) : (
              <table className="w-full text-sm">
                <GoodsProductTableHeader
                  visibleColumns={visibleColumns}
                  isAllSelected={
                    currentProducts.length > 0 &&
                    currentProducts.every(p => selectedIds.includes(p.id))
                  }
                  onToggleSelectAll={toggleSelectAll}
                  sortKey={sortKey}
                  sortDirection={sortDirection}
                  onSort={handleSort}
                />
                <GoodsProductTableBody
                  currentProducts={enrichedCurrentProducts}
                  variantsByParentId={variantsByParentId}
                  transactions={transactions}
                  orders={orders}
                  colCount={colCount}
                  selectedIdSet={selectedIdSet}
                  favoriteIdSet={favoriteIdSet}
                  expandedParents={expandedParents}
                  viewingProduct={enrichedViewingProduct}
                  activeFormTab={activeFormTab}
                  visibleColumns={visibleColumns}
                  onSelect={toggleSelectOne}
                  onToggleFavorite={toggleFavorite}
                  onOpenEditor={openProductEditor}
                  onToggleView={handleToggleView}
                  onToggleExpanded={handleToggleExpanded}
                  onChangeDetailTab={handleChangeDetailTab}
                  onDeleteViewed={handleDeleteViewed}
                  onEditViewed={handleEditViewed}
                  onAddMoreVariants={openAddMoreVariants}
                  onAddUnitInView={handleAddUnitInView}
                  onAddAttributeInView={handleAddAttributeInView}
                  onPrintLabel={handlePrintLabel}
                  onAddSameType={handleAddSameType}
                  onPurchaseProduct={handlePurchaseProduct}
                  onStopBusiness={handleStopBusiness}
                />
              </table>
              )}
            </div>
            <GoodsPagination
              currentPage={currentPage}
              totalPages={totalPages}
              itemsPerPage={itemsPerPage}
              totalItems={filteredProducts.length}
              totalSkuItems={sellableSkuCount}
              setCurrentPage={setCurrentPage}
              onItemsPerPageChange={handleItemsPerPageChange}
            />
          </div>
        );
      case 'purchase':
        return (
          <GoodsPurchaseForm
            showPurchaseForm={showPurchaseForm}
            setShowPurchaseForm={setShowPurchaseForm}
            purchaseItems={purchaseItems}
            suppliers={suppliers}
            purchaseSupplier={purchaseSupplier}
            setPurchaseSupplier={setPurchaseSupplier}
            purchaseNote={purchaseNote}
            setPurchaseNote={setPurchaseNote}
            products={products}
            transactions={transactions}
            onClickFileInput={() => fileInputRef.current?.click()}
            onOpenQuickAddProduct={handleOpenQuickAddProduct}
            onAddProductToPurchase={handleAddProductToPurchase}
            purchaseDiscountValue={purchaseDiscountValue}
            purchaseDiscountType={purchaseDiscountType}
            setPurchaseDiscountValue={setPurchaseDiscountValue}
            setPurchaseDiscountType={setPurchaseDiscountType}
            onUpdatePurchaseItem={updatePurchaseItem}
            onRemovePurchaseItem={removePurchaseItem}
            onCompletePurchase={handleCompletePurchaseWithCheck}
            onDownloadTemplate={downloadTemplate}
            invoiceStatus={invoiceStatus}
            setInvoiceStatus={setInvoiceStatus}
            invoiceFile={invoiceFile}
            setInvoiceFile={setInvoiceFile}
          />
        );
      case 'kho':
        return <GoodsKhoHistory transactions={transactions} />;
      case 'pricing':
        return (
          <GoodsPriceSetupModal
            isOpen={true}
            products={products}
            productGroups={productGroups}
            currentProduct={{}}
            editingProduct={null}
            mode="page"
            onClose={() => setActiveTab('goods')}
            onApplyPrice={() => {}}
            onSavePrices={async (updates) => {
              try {
                if (onUpdateSurgical) {
                  const existing = new Map(products.map(p => [p.id, p]));
                  await onUpdateSurgical(
                    updates
                      .filter(u => existing.has(u.id))
                      .map(u => {
                        const patch: Partial<POSProduct> = {};
                        if (u.salePrice > 0) patch.salePrice = u.salePrice;
                        if (u.discountPercent != null && u.discountPercent >= 0) patch.discountPercent = u.discountPercent;
                        return { key: 'posProducts' as const, item: { ...existing.get(u.id)!, ...patch } };
                      })
                  );
                } else {
                  onUpdateProducts(
                    products.map(p => {
                      const u = updates.find(x => x.id === p.id);
                      if (!u) return p;
                      const patch: Partial<POSProduct> = {};
                      if (u.salePrice > 0) patch.salePrice = u.salePrice;
                      if (u.discountPercent != null && u.discountPercent >= 0) patch.discountPercent = u.discountPercent;
                      return { ...p, ...patch };
                    })
                  );
                }
              } catch (err: unknown) {
                showToast(translateError(err, 'Lỗi lưu giá'), 'error');
              }
            }}
          />
        );
      case 'warranty':
        return <GoodsWarrantyMaintenancePage products={products} />;
      case 'audit_form':
        return (
          <GoodsAuditForm
            products={products}
            transactions={transactions}
            productGroups={productGroups}
            lowStockProducts={lowStockProducts}
            auditItems={auditItems}
            setAuditItems={setAuditItems}
            auditSearchTerm={auditSearchTerm}
            setAuditSearchTerm={setAuditSearchTerm}
            onConfirmAudit={handleConfirmAudit}
            onCancel={cancelAudit}
          />
        );
      case 'product_form':
        return (
          <GoodsLegacyProductFormView
            formData={formData}
            setFormData={setFormData}
            editingProduct={editingProduct}
            productGroups={productGroups}
            activeFormTab={activeFormTab}
            setActiveFormTab={setActiveFormTab}
            onBack={() => setActiveTab('goods')}
            onSave={() => handleSaveProduct(false)}
            onAddConversionUnit={addConversionUnit}
            allProducts={products}
          />
        );
      default:
        return null;
    }
  };

  const isFixedShellTab = activeTab === 'pricing' || activeTab === 'warranty';

  return (
    <div className={activeTab === 'goods' || isFixedShellTab ? 'flex h-full min-h-0 flex-col' : 'space-y-6'}>
      <GoodsInventoryFeedback
        toast={toast}
        inputModal={inputModal}
        confirmDialog={confirmDialog}
        onCloseInput={closeInputModal}
        onCloseConfirm={closeConfirm}
      />

      {activeTab === 'goods' ? (
        <GoodsProductsWorkspace
          products={products}
          filteredProducts={filteredProducts}
          searchTerm={searchTerm}
          onSearchChange={handleSearchChange}
          searchTags={searchTags}
          onTagRemove={handleTagRemove}
          onSearchKeyDown={handleSearchKeyDown}
          onOpenCreate={openCreateProduct}
          fileInputRef={fileInputRef}
          importStatus={importStatus}
          setImportStatus={setImportStatus}
          onImportChange={handleExcelImport}
          visibleColumns={visibleColumns}
          setVisibleColumns={setVisibleColumns}
          showColumnPopup={showColumnPopup}
          setShowColumnPopup={setShowColumnPopup}
          columnPopupPos={columnPopupPos}
          setColumnPopupPos={setColumnPopupPos}
          columnTriggerRef={columnTriggerRef}
          filterCategories={filterCategories}
          setFilterCategories={setFilterCategories}
          filterBrand={filterBrand}
          setFilterBrand={setFilterBrand}
          filterAttrs={filterAttrs}
          setFilterAttrs={setFilterAttrs}
          filterLocation={filterLocation}
          setFilterLocation={setFilterLocation}
          filterStock={filterStock}
          setFilterStock={setFilterStock}
          filterSupplier={filterSupplier}
          setFilterSupplier={setFilterSupplier}
          filterPlatforms={filterPlatforms}
          setFilterPlatforms={(v) => { setFilterPlatforms(v); setCurrentPage(1); }}
          availablePlatforms={availablePlatforms}
          productGroups={productGroups}
          uniqueCategories={uniqueCategories}
          categoryCounts={categoryCounts}
          attrValuesByName={attrValuesByName}
          uniqueLocations={uniqueLocations}
          uniqueBrands={uniqueBrands}
          uniqueSuppliers={uniqueSuppliers}
          lowStockCount={lowStockProducts.length}
          selectedCount={selectedIds.length}
          onClearSelection={() => setSelectedIds([])}
          onExportSelected={handleExportSelected}
          onPrintSelectedLabels={handlePrintSelectedLabels}
          onPurchaseSelected={handlePurchaseSelected}
          onBulkDelete={handleBulkDelete}
          onBulkStopBusiness={handleBulkStopBusiness}
          onBulkChangeGroup={handleBulkChangeGroup}
          onBulkChannelLink={() => setBulkChannelLinkOpen(true)}
          onGoToWarranty={handleGoToWarranty}
          onResetPage={() => setCurrentPage(1)}
          onCreateGroup={() => setCreateGroupModal({ isOpen: true, name: '', parentId: '' })}
          viewMode={viewMode}
          onViewModeChange={handleViewModeChange}
          sidebarTitle="Danh sách hàng hóa"
          sidebarDescription="Quản lý sản phẩm và tồn kho"
        >
          {renderMainContent()}
        </GoodsProductsWorkspace>
      ) : (
        <>
          {activeTab !== 'product_form' &&
            activeTab !== 'audit_form' &&
            activeTab !== 'pricing' &&
            activeTab !== 'warranty' && (
              <GoodsInventorySecondaryToolbar
                activeTab={activeTab}
                showPurchaseForm={showPurchaseForm}
                searchTerm={searchTerm}
                onSearchChange={handleSearchChange}
                onStartAudit={handleStartAudit}
                setShowPurchaseForm={setShowPurchaseForm}
              />
            )}
          {isFixedShellTab ? (
            <div className="flex-1 min-h-0 overflow-hidden">
              {renderMainContent()}
            </div>
          ) : (
            renderMainContent()
          )}
        </>
      )}

      <GoodsInventoryModals
        products={products}
        productGroups={productGroups}
        showProductModal={showProductModal}
        formData={formData}
        setFormData={setFormData}
        onCloseProductModal={() => {
          setShowProductModal(false);
          setIsQuickAddMode(false);
        }}
        onSaveProductModal={() => handleSaveProduct(false)}
        showAddUnitModal={showAddUnitModal}
        newUnitName={newUnitName}
        newUnitPrice={newUnitPrice}
        newUnitDirectSale={newUnitDirectSale}
        setNewUnitName={setNewUnitName}
        setNewUnitPrice={setNewUnitPrice}
        setNewUnitDirectSale={setNewUnitDirectSale}
        onCloseAddUnitModal={() => setShowAddUnitModal(false)}
        onSaveBaseUnit={handleSaveBaseUnit}
        showCreateModal={showCreateModal}
        editingProduct={editingProduct}
        createModalTab={createModalTab}
        setCreateModalTab={setCreateModalTab}
        onCloseCreateModal={() => {
          setShowCreateModal(false);
          setEditingProduct(null);
        }}
        onSaveAndCreateMore={() => {
          handleSaveProduct(true);
          setFormData({
            name: '',
            sku: 'Tự động',
            categoryId: '',
            brand: '',
            importPrice: 0,
            salePrice: 0,
            stock: 0,
            minStock: 0,
            maxStock: 999999999,
            unit: 'Cái',
            description: '',
            warranty: '',
            allowPoints: true,
            weight: 0,
            weightUnit: 'g',
            location: '',
            relatedSku: '',
            images: [],
            status: 'Active',
            units: [],
            attributes: [],
          });
        }}
        onSaveCreateModal={() => {
          handleSaveProduct(false);
          setShowCreateModal(false);
        }}
        showStockSection={showStockSection}
        setShowStockSection={setShowStockSection}
        showLocationSection={showLocationSection}
        setShowLocationSection={setShowLocationSection}
        showUnitsSection={showUnitsSection}
        setShowUnitsSection={setShowUnitsSection}
        addBaseUnit={addBaseUnit}
        showAddUnitInView={showAddUnitInView}
        viewModeNewUnit={viewModeNewUnit}
        setViewModeNewUnit={setViewModeNewUnit}
        onCloseAddUnitInView={() => setShowAddUnitInView(false)}
        onSaveAddUnitInView={handleAddUnitInViewMode}
        showAddAttributeInView={showAddAttributeInView}
        viewModeAttributes={viewModeAttributes}
        setViewModeAttributes={setViewModeAttributes}
        previewVariants={previewVariants}
        setPreviewVariants={setPreviewVariants}
        generatePreviewVariants={generatePreviewVariants}
        onCloseAddAttributeInView={closeAddAttributeInViewModal}
        onSaveAddAttributeInView={handleAddAttributeInViewMode}
        showAddMoreVariants={showAddMoreVariants}
        addingToParentId={addingToParentId}
        onCloseAddMoreVariants={closeAddMoreVariantsModal}
        onSaveMoreVariants={handleSaveMoreVariants}
        brands={uniqueBrands}
        applyToVariants={applyToVariants}
        onApplyToVariantsChange={setApplyToVariants}
        onCreateGroup={() => setCreateGroupModal({ isOpen: true, name: '', parentId: '' })}
      />
      <ApplyToVariantsModal
        isOpen={showApplyVariantsModal}
        siblings={variantSiblings}
        selectedIds={selectedSiblingIds}
        onToggle={handleToggleSibling}
        onToggleAll={handleToggleAllSiblings}
        onConfirm={handleConfirmApplyVariants}
        onCancel={handleCancelApplyVariants}
      />
    {changeGroupModal.isOpen && (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
        <div className="bg-white rounded-2xl shadow-2xl w-[480px] p-8">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-semibold text-slate-900">Chuyển nhóm hàng</h2>
            <button
              onClick={() => setChangeGroupModal({ isOpen: false, selectedGroupId: '' })}
              className="text-slate-400 hover:text-slate-600 transition-colors"
            >
              <span className="text-xl leading-none">×</span>
            </button>
          </div>
          <div className="flex items-center gap-3 py-4 border-t border-b border-slate-100">
            <label className="flex items-center gap-1.5 text-sm font-semibold text-slate-700 w-32 shrink-0">
              Nhóm hàng
              <span
                title="Chọn nhóm hàng mới cho tất cả sản phẩm đã chọn"
                className="text-slate-400 cursor-help text-xs border border-slate-300 rounded-full w-4 h-4 flex items-center justify-center leading-none"
              >
                i
              </span>
            </label>
            <GroupTreePicker
              productGroups={productGroups}
              products={products}
              value={changeGroupModal.selectedGroupId}
              onChange={id => setChangeGroupModal(prev => ({ ...prev, selectedGroupId: id }))}
            />
            <button
              onClick={() => setCreateGroupModal({ isOpen: true, name: '', parentId: '' })}
              className="w-8 h-8 flex items-center justify-center rounded-lg border border-slate-300 text-slate-500 hover:bg-slate-50 transition-colors text-lg font-bold shrink-0"
              title="Tạo nhóm hàng mới"
            >
              +
            </button>
          </div>
          <div className="flex justify-end gap-3 mt-6">
            <button
              onClick={() => setChangeGroupModal({ isOpen: false, selectedGroupId: '' })}
              className="px-6 py-2.5 rounded-xl border border-slate-200 text-sm font-semibold text-slate-600 hover:bg-slate-50 transition-colors"
            >
              Bỏ qua
            </button>
            <button
              onClick={handleConfirmChangeGroup}
              className="px-6 py-2.5 rounded-xl bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700 transition-colors shadow-md shadow-indigo-200"
            >
              Lưu
            </button>
          </div>
        </div>
      </div>
    )}
    {createGroupModal.isOpen && (
      <div className="fixed inset-0 z-toast flex items-center justify-center bg-black/40">
        <div className="bg-white rounded-2xl shadow-2xl w-[500px]">
          <div className="flex items-center justify-between px-6 py-5 border-b border-slate-100">
            <h2 className="text-base font-semibold text-slate-900">Tạo nhóm hàng</h2>
            <button
              onClick={() => setCreateGroupModal({ isOpen: false, name: '', parentId: '' })}
              className="text-slate-400 hover:text-slate-600 transition-colors"
            >
              <span className="text-xl leading-none">×</span>
            </button>
          </div>
          <div className="px-6 py-5 space-y-5">
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">Tên nhóm</label>
              <input
                type="text"
                autoFocus
                value={createGroupModal.name}
                onChange={e => setCreateGroupModal(prev => ({ ...prev, name: e.target.value }))}
                onKeyDown={e => { if (e.key === 'Enter') handleCreateGroup(); }}
                className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 transition-colors"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">Nhóm cha</label>
              <GroupTreePicker
                productGroups={productGroups}
                products={products}
                value={createGroupModal.parentId}
                onChange={id => setCreateGroupModal(prev => ({ ...prev, parentId: id }))}
                placeholder="Chọn nhóm hàng"
              />
            </div>
          </div>
          <div className="flex justify-end gap-3 px-6 py-4 border-t border-slate-100">
            <button
              onClick={() => setCreateGroupModal({ isOpen: false, name: '', parentId: '' })}
              className="px-6 py-2.5 rounded-xl border border-slate-200 text-sm font-semibold text-slate-600 hover:bg-slate-50 transition-colors"
            >
              Bỏ qua
            </button>
            <button
              onClick={handleCreateGroup}
              className="px-6 py-2.5 rounded-xl bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700 transition-colors shadow-md shadow-indigo-200"
            >
              Lưu
            </button>
          </div>
        </div>
      </div>
    )}

    {variantPickerProduct && (
      <GoodsGridVariantPopup
        parent={variantPickerProduct}
        variants={products.filter(p => p.parentId === variantPickerProduct.id && p.status === 'Active')}
        cardWidth={gridCardWidth}
        onSelectVariant={handleGridVariantSelect}
        onClose={() => setVariantPickerProduct(null)}
      />
    )}

    {gridDetailProduct && (
      <GoodsGridDetailModal
        product={enrichProduct(gridDetailProduct)}
        siblings={gridDetailSiblings.length > 1 ? gridDetailSiblings : undefined}
        parentName={gridDetailProduct.parentId ? products.find(p => p.id === gridDetailProduct.parentId)?.name : undefined}
        transactions={transactions}
        orders={orders}
        onClose={() => { setGridDetailProduct(null); setGridDetailSiblings([]); }}
        onEdit={prod => {
          setGridDetailProduct(null);
          setGridDetailSiblings([]);
          openProductEditor(prod);
        }}
        onDelete={async id => {
          try {
            if (onUpdateSurgical) {
              const idsToDelete = [id, ...products.filter(p => p.parentId === id).map(p => p.id)];
              await onUpdateSurgical(idsToDelete.map(delId => ({ key: 'posProducts' as const, item: { id: delId }, isDelete: true })));
            } else {
              onUpdateProducts(products.filter(p => p.id !== id && p.parentId !== id));
            }
            setGridDetailProduct(null);
            setGridDetailSiblings([]);
          } catch (err: unknown) {
            showToast(translateError(err, 'Lỗi xóa sản phẩm'), 'error');
          }
        }}
        onStopBusiness={handleStopBusiness}
        onPrintLabel={handlePrintLabel}
        onAddSameType={handleAddSameType}
        onPurchaseProduct={handlePurchaseProduct}
        onAddUnit={handleAddUnitInView}
        onAddAttribute={handleAddAttributeInView}
      />
    )}
    {/* Modal in tem mã vạch */}
    <BarcodePrintModal
      isOpen={barcodePrintModal.isOpen}
      product={barcodePrintModal.product}
      qty={barcodePrintQty}
      showName={barcodePrintShowName}
      showPrice={barcodePrintShowPrice}
      showCode={barcodePrintShowCode}
      showBorder={barcodePrintShowBorder}
      onQtyChange={setBarcodePrintQty}
      onShowNameChange={setBarcodePrintShowName}
      onShowPriceChange={setBarcodePrintShowPrice}
      onShowCodeChange={setBarcodePrintShowCode}
      onShowBorderChange={setBarcodePrintShowBorder}
      onClose={() => setBarcodePrintModal({ isOpen: false, product: null })}
      onPrintError={msg => showToast(msg, 'error')}
    />

    {/* AUDIT-011: Modal cảnh báo khi chưa chọn NCC */}
    {showNoSupplierConfirm && (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
        <div className="bg-white rounded-2xl shadow-2xl w-[400px] p-6">
          <h2 className="text-base font-semibold text-slate-900 mb-2">Chưa nhập nhà cung cấp</h2>
          <p className="text-sm text-slate-600 mb-5">
            Phiếu nhập chưa chọn nhà cung cấp. Tiếp tục sẽ ghi vào <strong>NCC lẻ</strong>.
          </p>
          <div className="flex justify-end gap-2">
            <button
              onClick={() => setShowNoSupplierConfirm(false)}
              className="px-4 py-2 text-sm text-slate-600 hover:text-slate-900 transition-colors"
            >
              Quay lại
            </button>
            <button
              onClick={() => {
                setShowNoSupplierConfirm(false);
                handleCompletePurchase('NCC lẻ');
              }}
              className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              Tiếp tục
            </button>
          </div>
        </div>
      </div>
    )}
    <BulkChannelLinkModal
      isOpen={bulkChannelLinkOpen}
      onClose={() => setBulkChannelLinkOpen(false)}
      selectedIds={selectedIds}
      products={products}
      onSuccess={() => showToast('Đã cập nhật liên kết kênh thành công', 'success')}
    />
    </div>
  );
};

export default GoodsInventory;
