import * as pdfjsLib from 'pdfjs-dist';
import { Receipt, FileCheck, FileMinus, FileX } from 'lucide-react';
import {
  AppData,
  OpeningStockVatStatus,
  VatCoverageRow,
  VatReconciliationRow,
} from '../../../types';
import { fetchVatCoverageData } from '../../../services/vatCoverageService';

export interface PurchaseInvoicesProps {
  transactions: AppData['inventoryTransactions'];
  suppliers: AppData['suppliers'];
  supplierDebts: AppData['supplierDebts'];
  products: AppData['posProducts'];
}

export type TabKey = 'all' | 'full' | 'partial' | 'none';
export type VatCenterTab = 'groups' | 'receipts' | 'suppliers' | 'warehouse' | 'tasks';
export type FilingTab = 'group_supplier' | 'supplier_need' | 'opening_stock' | 'vat_warehouse' | 'alerts';
export type ReportMode = 'filing' | 'coverage' | 'legacy';
type VatPeriodScope = 'post' | 'pre';
export type PurchasePeriodScope = VatPeriodScope | 'all';
export type VatCoverageData = Awaited<ReturnType<typeof fetchVatCoverageData>>;

export type VatDocumentForm = {
  supplierId: string;
  issuerName: string;
  issuerTaxCode: string;
  issuerPhone: string;
  issuerAddress: string;
  invoiceNo: string;
  invoiceDate: string;
  totalBeforeTax: string;
  vatAmount: string;
  totalAmount: string;
};

export type VatInvoiceOcrItem = {
  name: string;
  unit?: string;
  quantity?: number;
  unitPrice?: number;
  amountBeforeTax?: number;
  vatAmount?: number;
  totalAmount?: number;
};

export type VatInvoiceOcrResult = {
  issuerName: string;
  issuerTaxCode?: string;
  issuerPhone?: string;
  issuerAddress?: string;
  invoiceNo: string;
  invoiceDate: string;
  totalBeforeTax: number;
  vatAmount: number;
  totalAmount: number;
  items: VatInvoiceOcrItem[];
  confidence?: {
    issuer?: number;
    invoice?: number;
    items?: number;
  };
};

export type VatInvoiceMappingLineForm = {
  id: string;
  name: string;
  quantity: string;
  amount: string;
  vatGroupId: string;
  productGroupName: string;
};

export type SupplierProductGroupOption = {
  name: string;
  vatGroupId?: string;
};

export type FilingReceiptDetailRow = {
  id: string;
  supplierKey: string;
  groupKey: string;
  receiptCode: string;
  receiptDate: string;
  itemName: string;
  goodsAmount: number;
  validAllocatedAmount: number;
  overAllocatedAmount: number;
  missingAmount: number;
  coveragePercent: number;
  invoiceCount: number;
  riskStatus: VatReconciliationRow['riskStatus'];
};

export type InvoiceAttachment = {
  id: string;
  purchase_record_id: string;
  file_name: string;
  file_url: string;
  file_type: string | null;
  uploaded_at: string | null;
};

export const TAB_CONFIG: { key: TabKey; label: string; Icon: React.ElementType }[] = [
  { key: 'all', label: 'Tất cả', Icon: Receipt },
  { key: 'full', label: 'Đủ HĐ', Icon: FileCheck },
  { key: 'partial', label: 'Một phần', Icon: FileMinus },
  { key: 'none', label: 'Thiếu CT', Icon: FileX },
];

export const BADGE_CONFIG = {
  full: { label: 'Đủ HĐ', Icon: FileCheck, cls: 'bg-green-100 text-green-700' },
  partial: { label: 'Một phần', Icon: FileMinus, cls: 'bg-yellow-100 text-yellow-700' },
  none: { label: 'Thiếu CT', Icon: FileX, cls: 'bg-red-100 text-red-600' },
} as const;

export const VAT_RISK_CONFIG = {
  covered: { label: 'Đủ VAT', cls: 'bg-green-100 text-green-700' },
  partial: { label: 'Thiếu một phần', cls: 'bg-yellow-100 text-yellow-700' },
  missing: { label: 'Thiếu toàn bộ', cls: 'bg-red-100 text-red-600' },
  overdue_15: { label: 'Quá 15 ngày', cls: 'bg-orange-100 text-orange-700' },
  overdue_30: { label: 'Quá 30 ngày', cls: 'bg-red-100 text-red-700' },
  over_allocated: { label: 'VAT vượt nhập', cls: 'bg-purple-100 text-purple-700' },
  needs_mapping: { label: 'Cần mapping', cls: 'bg-slate-100 text-slate-600' },
  needs_allocation: { label: 'Cần phân bổ', cls: 'bg-indigo-100 text-indigo-700' },
} as const;

export const OPENING_VAT_STATUS_OPTIONS: { value: OpeningStockVatStatus; label: string }[] = [
  { value: 'has_vat', label: 'Có VAT' },
  { value: 'waiting_vat', label: 'Chờ VAT' },
  { value: 'missing_vat', label: 'Chưa VAT' },
  { value: 'no_vat', label: 'Không VAT' },
  { value: 'unknown', label: 'Không rõ nguồn' },
  { value: 'pending_supplement', label: 'Chờ bổ sung VAT' },
];

const RECONCILIATION_RISK_PRIORITY: Record<VatReconciliationRow['riskStatus'], number> = {
  covered: 0,
  partial: 1,
  needs_allocation: 2,
  overdue_15: 3,
  overdue_30: 4,
  missing: 5,
  needs_mapping: 6,
  over_allocated: 7,
};

export const LIST_PAGE_SIZE = 100;
export const PENDING_VAT_DOCUMENT_ID = '__pending_vat_upload__';
export const VAT_OCR_TIMEOUT_MS = 90000;

export const getWorseReconciliationRisk = (
  current: VatReconciliationRow['riskStatus'],
  next: VatReconciliationRow['riskStatus']
) => (RECONCILIATION_RISK_PRIORITY[next] > RECONCILIATION_RISK_PRIORITY[current] ? next : current);

export function ReconciliationRiskBadge({ risk }: { risk: VatReconciliationRow['riskStatus'] }) {
  const cfg = VAT_RISK_CONFIG[risk] ?? VAT_RISK_CONFIG.missing;
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-2xs font-normal ${cfg.cls}`}>
      {cfg.label}
    </span>
  );
}

export function InvoiceBadge({ status }: { status?: string }) {
  const cfg = BADGE_CONFIG[status as keyof typeof BADGE_CONFIG] ?? BADGE_CONFIG.none;
  const { Icon } = cfg;
  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 text-2xs font-normal rounded-xl ${cfg.cls}`}
    >
      <Icon className="w-3 h-3" />
      {cfg.label}
    </span>
  );
}

// Re-export types used across files
export type { VatCoverageRow, VatReconciliationRow, OpeningStockVatStatus };
