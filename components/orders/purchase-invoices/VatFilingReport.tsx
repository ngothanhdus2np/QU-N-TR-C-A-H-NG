import React from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { VatReconciliationRow } from '../../../types';
import {
  FilingTab,
  PurchasePeriodScope,
  FilingReceiptDetailRow,
  PurchaseInvoicesProps,
  OPENING_VAT_STATUS_OPTIONS,
  ReconciliationRiskBadge,
  OpeningStockVatStatus,
} from './types';
import { formatVatDate } from './utils';

// ─── Local types ──────────────────────────────────────────────────────────────

type FilingSupplierTreeRow = {
  key: string;
  supplierId?: string;
  supplierName: string;
  itemCount: number;
  invoiceCount: number;
  goodsAmount: number;
  validAllocatedAmount: number;
  overAllocatedAmount: number;
  missingAmount: number;
  coveragePercent: number;
  riskStatus: VatReconciliationRow['riskStatus'];
  children: (VatReconciliationRow & { detailRows: FilingReceiptDetailRow[] })[];
};

type OpeningStockItemData = {
  id: string;
  sku: string;
  productName: string;
  vatGroupId?: string | null;
  supplierId?: string | null;
  quantity: number;
  unitCost: number;
  totalAmount: number;
  vatStatus: string;
  filingPeriodId?: string;
};

type PostFilingReceiptRow = {
  receipt: { id: string; date: string };
  purchaseReceiptItemId: string;
  supplierId?: string;
  supplierName?: string;
  vatGroupId?: string | null;
  amount: number;
  item: { name?: string; sku?: string; productId?: string };
};

type SuggestedVatItem = {
  item: {
    id: string;
    descriptionOnInvoice: string;
    quantity?: number;
    amountBeforeTax?: number;
    confirmedVatGroupId?: string;
    suggestedVatGroupId?: string;
  };
  document?: { id: string; invoiceNo: string; invoiceDate?: string; supplierId?: string };
  remainingAmount: number;
  remainingQuantity?: number;
  sameGroup?: boolean;
  beforeFiling?: boolean;
  afterFiling?: boolean;
  sameSupplier?: boolean;
  score: number;
  warning: string;
};

type SupplierNeedRow = {
  supplierName: string;
  goodsAmount: number;
  missingAmount: number;
  groups: Set<string>;
  stages: Set<string>;
};

export type VatFilingReportProps = {
  // Period
  purchasePeriodScope: PurchasePeriodScope;
  vatDataError: string;
  activeFilingPeriodStatus?: string;
  // Summary
  scopedFilingSummary: {
    goodsAmount: number;
    coveredAmount: number;
    missingAmount: number;
    suppliersNeedVatCount: number;
    overAllocatedAmount: number;
    unallocatedDocumentAmount: number;
  };
  // Filing tabs
  filingTab: FilingTab;
  onFilingTabChange: (tab: FilingTab) => void;
  showFilingGroupColumn: boolean;
  // group_supplier tab
  filingSupplierTreeRows: FilingSupplierTreeRow[];
  expandedFilingSupplierKey: string | null;
  onExpandedFilingSupplierKeyChange: (key: string | null) => void;
  expandedFilingGroupKey: string | null;
  onExpandedFilingGroupKeyChange: (key: string | null) => void;
  // supplier_need tab
  supplierNeedRows: SupplierNeedRow[];
  // opening_stock tab
  openingStockPreview: { count: number; totalQuantity: number; totalAmount: number };
  currentOpeningStockItems: OpeningStockItemData[];
  canResetOpeningStock: boolean;
  creatingOpeningStock: boolean;
  resettingOpeningStock: boolean;
  savingOpeningItemId: string | null;
  vatGroups: Array<{ id: string; name: string }>;
  suppliers: PurchaseInvoicesProps['suppliers'];
  onCreateOpeningStockFromProducts: () => void;
  onResetOpeningStockDraft: () => void;
  onUpdateOpeningStockVat: (id: string, data: Record<string, unknown>) => void;
  // vat_warehouse tab
  vatDocumentsByStatus: { total: number; unallocated: number; partial: number; completed: number };
};

// ─── Component ────────────────────────────────────────────────────────────────

export default function VatFilingReport({
  purchasePeriodScope,
  vatDataError,
  activeFilingPeriodStatus,
  scopedFilingSummary,
  filingTab,
  onFilingTabChange,
  showFilingGroupColumn,
  filingSupplierTreeRows,
  expandedFilingSupplierKey,
  onExpandedFilingSupplierKeyChange,
  expandedFilingGroupKey,
  onExpandedFilingGroupKeyChange,
  supplierNeedRows,
  openingStockPreview,
  currentOpeningStockItems,
  canResetOpeningStock,
  creatingOpeningStock,
  resettingOpeningStock,
  savingOpeningItemId,
  vatGroups,
  suppliers,
  onCreateOpeningStockFromProducts,
  onResetOpeningStockDraft,
  onUpdateOpeningStockVat,
  vatDocumentsByStatus,
}: VatFilingReportProps) {
  return (
    <>
      {vatDataError && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs font-normal text-amber-700">
          {vatDataError}
        </div>
      )}

      <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
        {[
          {
            label:
              purchasePeriodScope === 'all'
                ? 'Tất cả nhập hàng'
                : purchasePeriodScope === 'post'
                  ? 'Nhập sau chốt'
                  : 'Trước ngày chốt',
            value: scopedFilingSummary.goodsAmount,
            note:
              purchasePeriodScope === 'all'
                ? 'Không lọc theo ngày chốt'
                : purchasePeriodScope === 'post'
                  ? 'Từ ngày chốt trở đi'
                  : 'Chỉ dữ liệu trước ngày chốt',
          },
          { label: 'Đã phân bổ VAT', value: scopedFilingSummary.coveredAmount, note: 'Phân bổ hợp lệ' },
          { label: 'Còn thiếu VAT', value: scopedFilingSummary.missingAmount, note: 'Cần xử lý' },
          { label: 'NCC cần hóa đơn', value: scopedFilingSummary.suppliersNeedVatCount, note: 'Có thiếu VAT', count: true },
        ].map(card => (
          <div key={card.label} className="rounded-2xl border border-slate-100 bg-white p-3 shadow-sm">
            <p className="text-2xs font-normal uppercase tracking-wide text-slate-400">{card.label}</p>
            <p className="mt-1 truncate text-base font-normal text-slate-800">
              {card.count ? Number(card.value).toLocaleString('vi-VN') : `${Number(card.value).toLocaleString('vi-VN')}đ`}
            </p>
            <p className="mt-1 text-2xs font-normal text-slate-400">{card.note}</p>
          </div>
        ))}
      </div>

      <div>
        <p className="text-xs font-normal uppercase tracking-wide text-slate-700">
          Đối soát theo nhà cung cấp + nhóm hàng
        </p>
        <p className="mt-1 text-2xs font-normal text-slate-400">
          Chọn tab bên dưới để xem từng nhóm dữ liệu đối soát.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-slate-100 bg-white p-2">
        {[
          { key: 'group_supplier' as FilingTab, label: 'Theo nhóm + NCC' },
          { key: 'supplier_need' as FilingTab, label: 'NCC cần hóa đơn' },
          { key: 'opening_stock' as FilingTab, label: 'Tồn đầu kỳ' },
          { key: 'vat_warehouse' as FilingTab, label: 'Kho VAT' },
          { key: 'alerts' as FilingTab, label: 'Cảnh báo' },
        ].map(tab => (
          <button
            key={tab.key}
            onClick={() => onFilingTabChange(tab.key)}
            className={`rounded-xl px-3 py-2 text-xs font-normal transition-colors ${
              filingTab === tab.key
                ? 'bg-indigo-50 text-indigo-700'
                : 'text-slate-500 hover:bg-slate-50'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {filingTab === 'group_supplier' && (
        <div className="overflow-hidden rounded-2xl border border-slate-100 bg-white">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="border-b border-slate-100 bg-slate-50">
                <tr>
                  {[
                    'Nhà cung cấp',
                    ...(showFilingGroupColumn ? ['Nhóm hàng'] : []),
                    'Giá trị hàng',
                    'VAT hợp lệ',
                    '% phủ',
                    'Còn thiếu',
                    'VAT dư',
                    'HĐ',
                    'Trạng thái',
                  ].map(header => (
                    <th key={header} className="whitespace-nowrap px-4 py-2.5 text-left text-2xs font-normal uppercase tracking-wide text-slate-400">
                      {header}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {filingSupplierTreeRows.length === 0 ? (
                  <tr>
                    <td colSpan={showFilingGroupColumn ? 9 : 8} className="px-6 py-12 text-center text-xs font-normal text-slate-400">
                      {purchasePeriodScope === 'all'
                        ? 'Chưa có dữ liệu để đối soát.'
                        : purchasePeriodScope === 'post'
                          ? 'Chưa có phiếu nhập từ ngày chốt trở đi để đối soát.'
                          : 'Chưa có tồn đầu kỳ hoặc dữ liệu trước ngày chốt để đối soát.'}
                    </td>
                  </tr>
                ) : (
                  filingSupplierTreeRows.map(row => {
                    const expanded = expandedFilingSupplierKey === row.key;
                    return (
                      <React.Fragment key={row.key}>
                        <tr
                          onClick={() => onExpandedFilingSupplierKeyChange(expanded ? null : row.key)}
                          className="cursor-pointer bg-white hover:bg-slate-50/60"
                        >
                          <td className="whitespace-nowrap px-4 py-3 text-xs font-normal text-slate-800">
                            <div className="flex items-center gap-2">
                              {expanded ? <ChevronUp className="h-3.5 w-3.5 text-slate-400" /> : <ChevronDown className="h-3.5 w-3.5 text-slate-400" />}
                              <span>{row.supplierName}</span>
                              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-2xs font-normal text-slate-500">
                                {row.children.length} nhóm
                              </span>
                            </div>
                          </td>
                          {showFilingGroupColumn && <td className="px-4 py-3 text-xs font-normal text-slate-300" />}
                          <td className="whitespace-nowrap px-4 py-3 text-xs font-normal text-slate-700">{row.goodsAmount.toLocaleString('vi-VN')}đ</td>
                          <td className="whitespace-nowrap px-4 py-3 text-xs font-normal text-green-700">{row.validAllocatedAmount.toLocaleString('vi-VN')}đ</td>
                          <td className="px-4 py-3">
                            <div className="flex min-w-[110px] items-center gap-2">
                              <div className="h-1.5 flex-1 rounded-full bg-slate-200">
                                <div
                                  className={`h-1.5 rounded-full ${row.coveragePercent >= 80 ? 'bg-green-500' : row.coveragePercent >= 50 ? 'bg-yellow-400' : 'bg-red-400'}`}
                                  style={{ width: `${row.coveragePercent}%` }}
                                />
                              </div>
                              <span className="w-8 text-right text-2xs font-normal text-slate-600">{row.coveragePercent}%</span>
                            </div>
                          </td>
                          <td className="whitespace-nowrap px-4 py-3 text-xs font-normal text-red-600">{row.missingAmount.toLocaleString('vi-VN')}đ</td>
                          <td className="whitespace-nowrap px-4 py-3 text-xs font-normal text-purple-600">{row.overAllocatedAmount.toLocaleString('vi-VN')}đ</td>
                          <td className="px-4 py-3 text-xs font-normal text-slate-600">{row.invoiceCount}</td>
                          <td className="px-4 py-3"><ReconciliationRiskBadge risk={row.riskStatus} /></td>
                        </tr>
                        {expanded &&
                          row.children.map(child => {
                            const groupExpanded = expandedFilingGroupKey === child.id;
                            return (
                              <React.Fragment key={child.id}>
                                <tr
                                  onClick={() => {
                                    if (child.detailRows.length > 0) onExpandedFilingGroupKeyChange(groupExpanded ? null : child.id);
                                  }}
                                  className={`${child.detailRows.length > 0 ? 'cursor-pointer' : ''} bg-slate-50/40 hover:bg-slate-50`}
                                >
                                  <td className="px-4 py-3 text-xs font-normal text-slate-400" />
                                  {showFilingGroupColumn && (
                                    <td className="px-4 py-3 text-xs font-normal text-slate-800">
                                      <div className="flex items-center gap-2">
                                        {child.detailRows.length > 0 ? (
                                          groupExpanded ? <ChevronUp className="h-3.5 w-3.5 text-slate-400" /> : <ChevronDown className="h-3.5 w-3.5 text-slate-400" />
                                        ) : (
                                          <span className="h-3.5 w-3.5" />
                                        )}
                                        <span>{child.vatGroupName}</span>
                                        {child.detailRows.length > 0 && (
                                          <span className="rounded-full bg-white px-2 py-0.5 text-2xs font-normal text-slate-500">
                                            {child.detailRows.length} dòng
                                          </span>
                                        )}
                                      </div>
                                    </td>
                                  )}
                                  <td className="whitespace-nowrap px-4 py-3 text-xs font-normal text-slate-700">{child.goodsAmount.toLocaleString('vi-VN')}đ</td>
                                  <td className="whitespace-nowrap px-4 py-3 text-xs font-normal text-green-700">{child.validAllocatedAmount.toLocaleString('vi-VN')}đ</td>
                                  <td className="px-4 py-3">
                                    <div className="flex min-w-[110px] items-center gap-2">
                                      <div className="h-1.5 flex-1 rounded-full bg-slate-200">
                                        <div
                                          className={`h-1.5 rounded-full ${child.coveragePercent >= 80 ? 'bg-green-500' : child.coveragePercent >= 50 ? 'bg-yellow-400' : 'bg-red-400'}`}
                                          style={{ width: `${child.coveragePercent}%` }}
                                        />
                                      </div>
                                      <span className="w-8 text-right text-2xs font-normal text-slate-600">{child.coveragePercent}%</span>
                                    </div>
                                  </td>
                                  <td className="whitespace-nowrap px-4 py-3 text-xs font-normal text-red-600">{child.missingAmount.toLocaleString('vi-VN')}đ</td>
                                  <td className="whitespace-nowrap px-4 py-3 text-xs font-normal text-purple-600">{child.overAllocatedAmount.toLocaleString('vi-VN')}đ</td>
                                  <td className="px-4 py-3 text-xs font-normal text-slate-600">{child.invoiceCount}</td>
                                  <td className="px-4 py-3"><ReconciliationRiskBadge risk={child.riskStatus} /></td>
                                </tr>
                                {groupExpanded &&
                                  child.detailRows.map(detail => (
                                    <tr key={detail.id} className="bg-white hover:bg-slate-50">
                                      <td className="px-4 py-3 text-xs font-normal text-slate-300" />
                                      {showFilingGroupColumn && (
                                        <td className="px-4 py-3 text-xs font-normal text-slate-600">
                                          <span className="block text-slate-700">{detail.receiptCode} · {formatVatDate(detail.receiptDate)}</span>
                                          <span className="mt-0.5 block max-w-[260px] truncate text-2xs text-slate-400">{detail.itemName}</span>
                                        </td>
                                      )}
                                      <td className="whitespace-nowrap px-4 py-3 text-xs font-normal text-slate-700">{detail.goodsAmount.toLocaleString('vi-VN')}đ</td>
                                      <td className="whitespace-nowrap px-4 py-3 text-xs font-normal text-green-700">{detail.validAllocatedAmount.toLocaleString('vi-VN')}đ</td>
                                      <td className="px-4 py-3">
                                        <div className="flex min-w-[110px] items-center gap-2">
                                          <div className="h-1.5 flex-1 rounded-full bg-slate-200">
                                            <div
                                              className={`h-1.5 rounded-full ${detail.coveragePercent >= 80 ? 'bg-green-500' : detail.coveragePercent >= 50 ? 'bg-yellow-400' : 'bg-red-400'}`}
                                              style={{ width: `${detail.coveragePercent}%` }}
                                            />
                                          </div>
                                          <span className="w-8 text-right text-2xs font-normal text-slate-600">{detail.coveragePercent}%</span>
                                        </div>
                                      </td>
                                      <td className="whitespace-nowrap px-4 py-3 text-xs font-normal text-red-600">{detail.missingAmount.toLocaleString('vi-VN')}đ</td>
                                      <td className="whitespace-nowrap px-4 py-3 text-xs font-normal text-purple-600">{detail.overAllocatedAmount.toLocaleString('vi-VN')}đ</td>
                                      <td className="px-4 py-3 text-xs font-normal text-slate-600">{detail.invoiceCount}</td>
                                      <td className="px-4 py-3"><ReconciliationRiskBadge risk={detail.riskStatus} /></td>
                                    </tr>
                                  ))}
                              </React.Fragment>
                            );
                          })}
                      </React.Fragment>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {filingTab === 'supplier_need' && (
        <div className="overflow-hidden rounded-2xl border border-slate-100 bg-white">
          <div className="border-b border-slate-100 px-4 py-3">
            <span className="text-xs font-normal uppercase tracking-wide text-slate-700">
              Nhà cung cấp cần xin thêm hóa đơn
            </span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="border-b border-slate-100 bg-slate-50">
                <tr>
                  {['Nhà cung cấp', 'Giá trị hàng', 'Cần xin thêm HĐ', 'Nhóm hàng thiếu', 'Giai đoạn'].map(header => (
                    <th key={header} className="whitespace-nowrap px-4 py-2.5 text-left text-2xs font-normal uppercase tracking-wide text-slate-400">
                      {header}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {supplierNeedRows.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-12 text-center text-xs font-normal text-slate-400">
                      Chưa có nhà cung cấp nào cần xin thêm hóa đơn.
                    </td>
                  </tr>
                ) : (
                  supplierNeedRows.map(row => (
                    <tr key={row.supplierName} className="hover:bg-slate-50/60">
                      <td className="px-4 py-3 text-xs font-normal text-slate-800">{row.supplierName}</td>
                      <td className="whitespace-nowrap px-4 py-3 text-xs font-normal text-slate-700">{row.goodsAmount.toLocaleString('vi-VN')}đ</td>
                      <td className="whitespace-nowrap px-4 py-3 text-xs font-normal text-red-600">{row.missingAmount.toLocaleString('vi-VN')}đ</td>
                      <td className="px-4 py-3 text-xs font-normal text-slate-500">{Array.from(row.groups).join(', ')}</td>
                      <td className="px-4 py-3 text-xs font-normal text-slate-500">{Array.from(row.stages).join(', ')}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {filingTab === 'opening_stock' && (
        <div className="overflow-hidden rounded-2xl border border-slate-100 bg-white">
          <div className="border-b border-slate-100 px-4 py-3">
            <div className="flex flex-wrap items-center gap-3">
              <div>
                <span className="text-xs font-normal uppercase tracking-wide text-slate-700">
                  Tồn đầu kỳ đã ghi nhận
                </span>
                <p className="mt-1 text-2xs font-normal text-slate-400">
                  Preview từ tồn hiện tại: {openingStockPreview.count.toLocaleString('vi-VN')} SKU · {openingStockPreview.totalQuantity.toLocaleString('vi-VN')} sản phẩm · {openingStockPreview.totalAmount.toLocaleString('vi-VN')}đ
                </p>
              </div>
              <button
                onClick={onCreateOpeningStockFromProducts}
                disabled={
                  creatingOpeningStock ||
                  resettingOpeningStock ||
                  openingStockPreview.count === 0 ||
                  currentOpeningStockItems.length > 0 ||
                  activeFilingPeriodStatus === 'locked'
                }
                className="ml-auto rounded-xl bg-indigo-600 px-3 py-2 text-2xs font-normal uppercase tracking-wide text-white shadow-md shadow-indigo-100 disabled:opacity-60"
              >
                {creatingOpeningStock
                  ? 'Đang tạo...'
                  : currentOpeningStockItems.length > 0
                    ? 'Đã có tồn đầu kỳ'
                    : 'Tạo từ tồn hiện tại'}
              </button>
              <button
                onClick={onResetOpeningStockDraft}
                disabled={!canResetOpeningStock || resettingOpeningStock || creatingOpeningStock}
                className="rounded-xl border border-red-200 bg-white px-3 py-2 text-2xs font-normal uppercase tracking-wide text-red-600 hover:bg-red-50 disabled:opacity-50"
              >
                {resettingOpeningStock ? 'Đang reset...' : 'Reset bản nháp'}
              </button>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="border-b border-slate-100 bg-slate-50">
                <tr>
                  {['SKU', 'Tên hàng', 'Nhóm VAT', 'Nhà cung cấp', 'SL', 'Giá vốn', 'Giá trị tồn', 'Trạng thái VAT'].map(header => (
                    <th key={header} className="whitespace-nowrap px-4 py-2.5 text-left text-2xs font-normal uppercase tracking-wide text-slate-400">
                      {header}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {currentOpeningStockItems.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-6 py-12 text-center text-xs font-normal text-slate-400">
                      Chưa có dữ liệu tồn đầu kỳ. Bước tiếp theo sẽ thêm import/nhập tồn đầu kỳ.
                    </td>
                  </tr>
                ) : (
                  currentOpeningStockItems.map(item => (
                    <tr key={item.id} className="hover:bg-slate-50/60">
                      <td className="px-4 py-3 text-xs font-normal text-indigo-600">{item.sku}</td>
                      <td className="px-4 py-3 text-xs font-normal text-slate-800">{item.productName}</td>
                      <td className="px-4 py-3">
                        <select
                          value={item.vatGroupId || ''}
                          disabled={savingOpeningItemId === item.id}
                          onChange={event =>
                            onUpdateOpeningStockVat(item.id, {
                              vatGroupId: event.target.value || null,
                              vatStatus: event.target.value ? 'waiting_vat' : 'unknown',
                            })
                          }
                          className="min-w-[160px] rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs font-normal text-slate-700 outline-none focus:border-indigo-400 disabled:opacity-60"
                        >
                          <option value="">Chưa mapping VAT</option>
                          {vatGroups.map(group => (
                            <option key={group.id} value={group.id}>
                              {group.name}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="px-4 py-3">
                        <select
                          value={item.supplierId || ''}
                          disabled={savingOpeningItemId === item.id}
                          onChange={event => {
                            const supplier = suppliers.find(s => s.id === event.target.value);
                            onUpdateOpeningStockVat(item.id, {
                              supplierId: supplier?.id || null,
                              supplierName: supplier?.name || null,
                            });
                          }}
                          className="min-w-[160px] rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs font-normal text-slate-700 outline-none focus:border-indigo-400 disabled:opacity-60"
                        >
                          <option value="">Không rõ NCC</option>
                          {suppliers.map(supplier => (
                            <option key={supplier.id} value={supplier.id}>
                              {supplier.name}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="px-4 py-3 text-xs font-normal text-slate-600">{item.quantity.toLocaleString('vi-VN')}</td>
                      <td className="whitespace-nowrap px-4 py-3 text-xs font-normal text-slate-600">{item.unitCost.toLocaleString('vi-VN')}đ</td>
                      <td className="whitespace-nowrap px-4 py-3 text-xs font-normal text-slate-800">{item.totalAmount.toLocaleString('vi-VN')}đ</td>
                      <td className="px-4 py-3">
                        <select
                          value={item.vatStatus}
                          disabled={savingOpeningItemId === item.id}
                          onChange={event =>
                            onUpdateOpeningStockVat(item.id, {
                              vatStatus: event.target.value as OpeningStockVatStatus,
                            })
                          }
                          className="min-w-[140px] rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs font-normal text-slate-700 outline-none focus:border-indigo-400 disabled:opacity-60"
                        >
                          {OPENING_VAT_STATUS_OPTIONS.map(option => (
                            <option key={option.value} value={option.value}>
                              {option.label}
                            </option>
                          ))}
                        </select>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {filingTab === 'vat_warehouse' && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { label: 'Tổng hóa đơn VAT', value: vatDocumentsByStatus.total },
            { label: 'Chưa phân bổ', value: vatDocumentsByStatus.unallocated },
            { label: 'Phân bổ một phần', value: vatDocumentsByStatus.partial },
            { label: 'Hoàn tất', value: vatDocumentsByStatus.completed },
          ].map(card => (
            <div key={card.label} className="rounded-2xl border border-slate-100 bg-white p-4">
              <p className="text-2xs font-normal uppercase tracking-wide text-slate-400">{card.label}</p>
              <p className="mt-2 text-2xl font-normal text-slate-800">{card.value.toLocaleString('vi-VN')}</p>
            </div>
          ))}
        </div>
      )}

      {filingTab === 'alerts' && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {[
            { label: 'Cần xin hóa đơn', value: scopedFilingSummary.suppliersNeedVatCount, note: 'Nhà cung cấp còn thiếu VAT' },
            { label: 'VAT dư', value: scopedFilingSummary.overAllocatedAmount, note: 'Vượt giá trị hàng cùng NCC/nhóm', money: true },
            { label: 'Hóa đơn chưa phân bổ', value: scopedFilingSummary.unallocatedDocumentAmount, note: 'Còn lại trên dòng hóa đơn', money: true },
          ].map(card => (
            <div key={card.label} className="rounded-2xl border border-slate-100 bg-white p-4">
              <p className="text-2xs font-normal uppercase tracking-wide text-slate-400">{card.label}</p>
              <p className="mt-2 text-xl font-normal text-slate-800">
                {card.money ? `${Number(card.value).toLocaleString('vi-VN')}đ` : Number(card.value).toLocaleString('vi-VN')}
              </p>
              <p className="mt-1 text-2xs font-normal text-slate-400">{card.note}</p>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
