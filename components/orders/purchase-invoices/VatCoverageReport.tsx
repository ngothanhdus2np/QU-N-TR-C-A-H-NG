import React from 'react';
import { Trash2 } from 'lucide-react';
import { VatDocument, VatCoverageRow } from '../../../types';
import { VatCenterTab, FilingTab, ReportMode, PurchasePeriodScope } from './types';
import { formatVatDate } from './utils';

type VatSuppliersRow = {
  supplierName: string;
  total: number;
  covered: number;
  missing: number;
  groups: Set<string>;
};

type VatDocumentItemSummary = { total: number; unmapped: number };
type VatDocumentAllocationStatus = 'unallocated' | 'partial' | 'completed' | 'over_allocated';

type VatCoverageReportProps = {
  vatDataError: string;
  purchasePeriodScope: PurchasePeriodScope;
  vatCenterTab: VatCenterTab;
  vatCoverageRows: VatCoverageRow[];
  vatSupplierRows: VatSuppliersRow[];
  vatUploadNotice: string | null;
  vatDocumentsByStatus: { total: number; unallocated: number; partial: number; unmapped: number };
  scopedVatDocuments: VatDocument[];
  visibleVatDocuments: VatDocument[];
  vatDocumentItemSummaryByDoc: Map<string, VatDocumentItemSummary>;
  vatDocumentAllocationStatusByDoc: Map<string, VatDocumentAllocationStatus>;
  selectedVatDocumentIds: string[];
  onSelectedVatDocumentIdsChange: (updater: (prev: string[]) => string[]) => void;
  allVisibleVatDocumentsSelected: boolean;
  onToggleAllVisibleVatDocuments: () => void;
  onDeleteSelectedVatDocuments: () => void;
  onOpenVatDocumentFormAndFilingTab: (doc: VatDocument) => void;
  onConfirmDeleteVatDocument: (doc: VatDocument) => void;
  getVatDocumentSupplierName: (doc: VatDocument) => string;
};

export default function VatCoverageReport({
  vatDataError,
  purchasePeriodScope,
  vatCenterTab,
  vatCoverageRows,
  vatSupplierRows,
  vatUploadNotice,
  vatDocumentsByStatus,
  scopedVatDocuments,
  visibleVatDocuments,
  vatDocumentItemSummaryByDoc,
  vatDocumentAllocationStatusByDoc,
  selectedVatDocumentIds,
  onSelectedVatDocumentIdsChange,
  allVisibleVatDocumentsSelected,
  onToggleAllVisibleVatDocuments,
  onDeleteSelectedVatDocuments,
  onOpenVatDocumentFormAndFilingTab,
  onConfirmDeleteVatDocument,
  getVatDocumentSupplierName,
}: VatCoverageReportProps) {
  return (
    <>
      {vatDataError && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs font-normal text-amber-700">
          {vatDataError}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-slate-100 bg-white p-3">
        <div>
          <p className="text-xs font-normal uppercase tracking-wide text-slate-700">Kho hóa đơn VAT</p>
          <p className="mt-1 text-2xs font-normal text-slate-400">Lưu trữ các file hóa đơn VAT người dùng đã upload.</p>
        </div>
      </div>

      {vatCenterTab === 'groups' && (
        <div className="overflow-hidden rounded-2xl border border-slate-100 bg-white">
          <div className="border-b border-slate-100 px-4 py-3">
            <span className="text-xs font-normal uppercase tracking-wide text-slate-700">
              VAT Coverage theo nhóm hàng
            </span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="border-b border-slate-100 bg-slate-50">
                <tr>
                  {[
                    'Nhóm hàng',
                    'Tổng nhập',
                    'Đã có VAT',
                    'Còn thiếu VAT',
                    '% phủ VAT',
                    'Số phiếu thiếu',
                    'NCC liên quan',
                    'Trạng thái',
                  ].map(header => (
                    <th key={header} className="whitespace-nowrap px-4 py-2.5 text-left text-2xs font-normal uppercase tracking-wide text-slate-400">
                      {header}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {vatCoverageRows.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-6 py-12 text-center text-xs font-normal text-slate-400">
                      Chưa có dữ liệu phiếu nhập để tính VAT Coverage.
                    </td>
                  </tr>
                ) : (
                  vatCoverageRows.map(row => (
                    <tr key={row.vatGroupId} className="hover:bg-slate-50/60">
                      <td className="px-4 py-3 text-xs font-normal text-slate-800">{row.vatGroupName}</td>
                      <td className="whitespace-nowrap px-4 py-3 text-xs font-normal text-slate-700">{row.totalPurchasedAmount.toLocaleString('vi-VN')}đ</td>
                      <td className="whitespace-nowrap px-4 py-3 text-xs font-normal text-green-700">{row.vatCoveredAmount.toLocaleString('vi-VN')}đ</td>
                      <td className="whitespace-nowrap px-4 py-3 text-xs font-normal text-red-600">{row.missingAmount.toLocaleString('vi-VN')}đ</td>
                      <td className="px-4 py-3">
                        <div className="flex min-w-[120px] items-center gap-2">
                          <div className="h-1.5 flex-1 rounded-full bg-slate-200">
                            <div
                              className={`h-1.5 rounded-full ${row.coveragePercent >= 80 ? 'bg-green-500' : row.coveragePercent >= 50 ? 'bg-yellow-400' : 'bg-red-400'}`}
                              style={{ width: `${row.coveragePercent}%` }}
                            />
                          </div>
                          <span className="w-8 text-right text-2xs font-normal text-slate-600">{row.coveragePercent}%</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-xs font-normal text-slate-600">{row.missingReceiptCount}</td>
                      <td className="max-w-[240px] px-4 py-3 text-xs font-normal text-slate-500">
                        <span className="line-clamp-2">{row.supplierNames.join(', ') || 'Không rõ'}</span>
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex rounded-full px-2.5 py-1 text-2xs font-normal uppercase tracking-wide ${
                            row.riskStatus === 'needs_mapping'
                              ? 'bg-amber-50 text-amber-700'
                              : 'bg-emerald-50 text-emerald-700'
                          }`}
                        >
                          {row.riskStatus === 'needs_mapping' ? 'Cần mapping' : 'Đã mapping'}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {vatCenterTab === 'suppliers' && (
        <div className="overflow-hidden rounded-2xl border border-slate-100 bg-white">
          <div className="border-b border-slate-100 px-4 py-3">
            <span className="text-xs font-normal uppercase tracking-wide text-slate-700">
              VAT Coverage theo nhà cung cấp
            </span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="border-b border-slate-100 bg-slate-50">
                <tr>
                  {['Nhà cung cấp', 'Tổng nhập', 'Đã có VAT', 'Còn thiếu VAT', 'Nhóm hàng liên quan'].map(header => (
                    <th key={header} className="whitespace-nowrap px-4 py-2.5 text-left text-2xs font-normal uppercase tracking-wide text-slate-400">
                      {header}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {vatSupplierRows.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-12 text-center text-xs font-normal text-slate-400">
                      Chưa có dữ liệu nhà cung cấp.
                    </td>
                  </tr>
                ) : (
                  vatSupplierRows.map(row => (
                    <tr key={row.supplierName} className="hover:bg-slate-50/60">
                      <td className="px-4 py-3 text-xs font-normal text-slate-800">{row.supplierName}</td>
                      <td className="whitespace-nowrap px-4 py-3 text-xs font-normal text-slate-700">{Math.round(row.total).toLocaleString('vi-VN')}đ</td>
                      <td className="whitespace-nowrap px-4 py-3 text-xs font-normal text-green-700">{Math.round(row.covered).toLocaleString('vi-VN')}đ</td>
                      <td className="whitespace-nowrap px-4 py-3 text-xs font-normal text-red-600">{Math.round(row.missing).toLocaleString('vi-VN')}đ</td>
                      <td className="px-4 py-3 text-xs font-normal text-slate-500">{Array.from(row.groups).join(', ')}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="space-y-3">
        {vatUploadNotice && (
          <div className="rounded-2xl border border-green-200 bg-green-50 px-4 py-3 text-xs font-normal text-green-700">
            {vatUploadNotice}
          </div>
        )}

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { label: 'Tổng hóa đơn VAT', value: vatDocumentsByStatus.total },
            { label: 'Chưa phân bổ', value: vatDocumentsByStatus.unallocated },
            { label: 'Phân bổ một phần', value: vatDocumentsByStatus.partial },
            { label: 'Chưa mapping', value: vatDocumentsByStatus.unmapped },
          ].map(card => (
            <div key={card.label} className="rounded-2xl border border-slate-100 bg-white p-4">
              <p className="text-2xs font-normal uppercase tracking-wide text-slate-400">{card.label}</p>
              <p className="mt-2 text-2xl font-normal text-slate-800">{card.value.toLocaleString('vi-VN')}</p>
            </div>
          ))}
        </div>

        <div className="overflow-hidden rounded-2xl border border-slate-100 bg-white">
          <div className="border-b border-slate-100 px-4 py-3">
            <div className="flex flex-wrap items-center gap-3">
              <span className="text-xs font-normal uppercase tracking-wide text-slate-700">
                File hóa đơn VAT đã upload
              </span>
              {selectedVatDocumentIds.length > 0 && (
                <button
                  onClick={onDeleteSelectedVatDocuments}
                  className="ml-auto inline-flex items-center gap-1.5 rounded-xl border border-red-100 bg-white px-3 py-1.5 text-2xs font-normal uppercase tracking-wide text-red-600 hover:bg-red-50"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  Xóa tất cả ({selectedVatDocumentIds.length})
                </button>
              )}
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="border-b border-slate-100 bg-slate-50">
                <tr>
                  <th className="w-10 px-4 py-2.5 text-left">
                    <input
                      type="checkbox"
                      checked={allVisibleVatDocumentsSelected}
                      onChange={onToggleAllVisibleVatDocuments}
                      className="h-3.5 w-3.5 rounded border-slate-300 text-indigo-600"
                    />
                  </th>
                  {['Số hóa đơn / tên file', 'Ngày HĐ', 'Nhà cung cấp', 'Tổng tiền', 'Mapping', 'Trạng thái', 'File', 'Xóa'].map(header => (
                    <th key={header} className="whitespace-nowrap px-4 py-2.5 text-left text-2xs font-normal uppercase tracking-wide text-slate-400">
                      {header}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {scopedVatDocuments.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="px-6 py-12 text-center text-xs font-normal text-slate-400">
                      {purchasePeriodScope === 'all'
                        ? 'Chưa có file VAT nào. Bấm Upload VAT để tải PDF lên.'
                        : purchasePeriodScope === 'post'
                          ? 'Chưa có file VAT nào từ ngày chốt trở đi. Bấm Upload VAT để tải PDF lên.'
                          : 'Chưa có file VAT nào trước ngày chốt.'}
                    </td>
                  </tr>
                ) : (
                  visibleVatDocuments.map(document => {
                    const itemSummary = vatDocumentItemSummaryByDoc.get(document.id);
                    const allocationStatus = vatDocumentAllocationStatusByDoc.get(document.id) || 'unallocated';
                    const allocationStatusLabel =
                      allocationStatus === 'completed'
                        ? 'Hoàn tất'
                        : allocationStatus === 'partial'
                          ? 'Một phần'
                          : allocationStatus === 'over_allocated'
                            ? 'Phân bổ dư'
                            : 'Chưa phân bổ';
                    const allocationStatusClass =
                      allocationStatus === 'completed'
                        ? 'bg-green-100 text-green-700'
                        : allocationStatus === 'partial'
                          ? 'bg-yellow-100 text-yellow-700'
                          : allocationStatus === 'over_allocated'
                            ? 'bg-purple-100 text-purple-700'
                            : 'bg-slate-100 text-slate-600';
                    return (
                      <tr key={document.id} className="hover:bg-slate-50/60">
                        <td className="px-4 py-3">
                          <input
                            type="checkbox"
                            checked={selectedVatDocumentIds.includes(document.id)}
                            onChange={() => onSelectedVatDocumentIdsChange(prev => prev.includes(document.id) ? prev.filter(id => id !== document.id) : [...prev, document.id])}
                            className="h-3.5 w-3.5 rounded border-slate-300 text-indigo-600"
                          />
                        </td>
                        <td className="px-4 py-3 text-xs font-normal text-slate-800">
                          {document.invoiceNo}
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-xs font-normal text-slate-600">
                          {formatVatDate(document.invoiceDate)}
                        </td>
                        <td className="px-4 py-3 text-xs font-normal text-slate-600">
                          <span className="block text-slate-800">{getVatDocumentSupplierName(document)}</span>
                          {document.supplierNameOnInvoice && document.supplierNameOnInvoice !== getVatDocumentSupplierName(document) && (
                            <span className="mt-0.5 block text-2xs text-slate-400">Trên HĐ: {document.supplierNameOnInvoice}</span>
                          )}
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-xs font-normal text-slate-700">
                          {Number(document.totalAmount || 0).toLocaleString('vi-VN')}đ
                        </td>
                        <td className="px-4 py-3">
                          <span className={`rounded-full px-2 py-0.5 text-2xs font-normal uppercase tracking-wide ${
                            itemSummary?.total && itemSummary.unmapped === 0
                              ? 'bg-green-100 text-green-700'
                              : itemSummary?.total
                                ? 'bg-yellow-100 text-yellow-700'
                                : 'bg-red-100 text-red-600'
                          }`}>
                            {itemSummary?.total
                              ? itemSummary.unmapped === 0
                                ? 'Đã mapping'
                                : `Còn ${itemSummary.unmapped}`
                              : 'Chưa có dòng'}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`rounded-full px-2 py-0.5 text-2xs font-normal uppercase tracking-wide ${allocationStatusClass}`}>
                            {allocationStatusLabel}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          {document.filePdfUrl ? (
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => onOpenVatDocumentFormAndFilingTab(document)}
                                className="rounded-xl bg-indigo-50 px-3 py-1.5 text-2xs font-normal uppercase tracking-wide text-indigo-700 hover:bg-indigo-100"
                              >
                                Bổ sung
                              </button>
                            </div>
                          ) : (
                            <span className="text-xs font-normal text-slate-400">Không có PDF</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <button
                            onClick={() => onConfirmDeleteVatDocument(document)}
                            className="inline-flex items-center gap-1.5 rounded-xl border border-red-100 bg-white px-3 py-1.5 text-2xs font-normal uppercase tracking-wide text-red-600 hover:bg-red-50"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                            Xóa
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
          {visibleVatDocuments.length < scopedVatDocuments.length && (
            <div className="border-t border-slate-100 bg-slate-50 px-4 py-2 text-2xs font-normal text-slate-400">
              Đang hiển thị {visibleVatDocuments.length.toLocaleString('vi-VN')} / {scopedVatDocuments.length.toLocaleString('vi-VN')} hóa đơn trong phạm vi hiện tại.
            </div>
          )}
        </div>
      </div>

      {(vatCenterTab === 'receipts' || vatCenterTab === 'tasks') && (
        <div className="rounded-2xl border border-slate-100 bg-white px-6 py-12 text-center">
          <p className="text-sm font-normal text-slate-700">
            {vatCenterTab === 'receipts' ? 'Theo phiếu nhập' : 'Cần xử lý'}
          </p>
          <p className="mt-1 text-xs font-normal text-slate-400">
            Bước này đã có nền dữ liệu ledger; phần drill down chi tiết sẽ nối sau khi xác nhận luồng UI.
          </p>
        </div>
      )}
    </>
  );
}
