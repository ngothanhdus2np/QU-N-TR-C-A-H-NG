import React from 'react';
import { ChevronDown, ChevronUp, Paperclip, ExternalLink } from 'lucide-react';
import { AppData } from '../../../types';
import { InvoiceAttachment } from './types';
import { formatVatDate, getPurchaseCode } from './utils';

type PurchaseLegacyReportProps = {
  purchasePeriodScope: 'all' | 'pre' | 'post';
  summary: { totalAmount: number; hasFullHD: number; hasPartialHD: number; missingHD: number };
  vatSummary: { invoicedTotal: number; vatDeductible: number };
  monthlyReport: Array<{ month: string; total: number; hasHD: number; missing: number; count: number; vatDeductible: number; coverage: number }>;
  importsByReportMonth: Map<string, AppData['inventoryTransactions']>;
  expandedReportMonth: string | null;
  onExpandedReportMonthChange: (v: string | null) => void;
  expandedId: string | null;
  onExpandedIdChange: (v: string | null) => void;
  attachments: Record<string, InvoiceAttachment[]>;
  sevenDaysAgo: string;
  supplierById: Map<string, AppData['suppliers'][number]>;
  allocatedGoodsByReceiptId: Map<string, number>;
  allocatedVatByReceiptId: Map<string, number>;
  loadingUrl: string | null;
  onViewFile: (id: string, url: string) => void;
};

export default function PurchaseLegacyReport({
  purchasePeriodScope,
  summary,
  vatSummary,
  monthlyReport,
  importsByReportMonth,
  expandedReportMonth,
  onExpandedReportMonthChange,
  expandedId,
  onExpandedIdChange,
  attachments,
  sevenDaysAgo,
  supplierById,
  allocatedGoodsByReceiptId,
  allocatedVatByReceiptId,
  loadingUrl,
  onViewFile,
}: PurchaseLegacyReportProps) {
  return (
    <>
      {/* VAT estimation cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          {
            label: 'Tổng giá trị hàng',
            value: summary.totalAmount,
            color: 'text-slate-800',
            note: purchasePeriodScope === 'post' ? 'Sau ngày chốt' : purchasePeriodScope === 'pre' ? 'Trước ngày chốt' : 'Theo phạm vi lọc',
            bg: 'bg-white border-slate-100',
          },
          {
            label: 'Giá trị có hóa đơn',
            value: vatSummary.invoicedTotal,
            color: 'text-green-700',
            note: 'Theo VAT đã phân bổ',
            bg: 'bg-green-50 border-green-100',
          },
          {
            label: 'Giá trị thiếu hóa đơn',
            value: summary.missingHD,
            color: 'text-red-600',
            note: 'Chưa được phân bổ VAT',
            bg: 'bg-red-50 border-red-100',
          },
          {
            label: 'VAT được khấu trừ',
            value: vatSummary.vatDeductible,
            color: 'text-green-700',
            note: 'Theo VAT thực tế đã phân bổ',
            bg: 'bg-green-50 border-green-100',
          },
        ].map(({ label, value, color, note, bg }) => (
          <div key={label} className={`rounded-2xl border p-3 ${bg}`}>
            <p className="text-2xs font-normal text-slate-500 uppercase tracking-wide mb-1">
              {label}
            </p>
            <p className={`text-base font-normal ${color}`}>
              {value.toLocaleString('vi-VN')}đ
            </p>
            <p className="text-2xs text-slate-400 mt-1">{note}</p>
          </div>
        ))}
      </div>

      {/* Monthly table */}
      <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-100">
          <span className="text-xs font-normal text-slate-700 uppercase tracking-wide">
            Tổng kết theo tháng
          </span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-50 border-b border-slate-100">
              <tr>
                {[
                  'Tháng',
                  ...(expandedReportMonth ? ['Nhà cung cấp'] : []),
                  'Số phiếu',
                  'Tổng nhập',
                  'Có HĐ',
                  'Thiếu HĐ',
                  'Tỷ lệ phủ',
                  'VAT KT được',
                ].map(h => (
                  <th
                    key={h}
                    className="px-4 py-2.5 text-left text-2xs font-normal text-slate-400 uppercase tracking-wide whitespace-nowrap"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              <tr className="bg-slate-50/80">
                <td className="px-4 py-3 text-xs text-slate-300" />
                {expandedReportMonth && <td className="px-4 py-3 text-xs text-slate-300" />}
                <td className="px-4 py-3 text-xs text-slate-700">
                  {monthlyReport.reduce((sum, row) => sum + row.count, 0)}
                </td>
                <td className="px-4 py-3 text-xs text-slate-300" />
                <td className="px-4 py-3 text-xs text-slate-300" />
                <td className="px-4 py-3 text-xs text-slate-300" />
                <td className="px-4 py-3">
                  <span className="text-xs text-slate-700">
                    {summary.totalAmount > 0
                      ? Math.round(((summary.hasFullHD + summary.hasPartialHD) / summary.totalAmount) * 100)
                      : 0}
                    %
                  </span>
                </td>
                <td className="px-4 py-3 text-xs text-slate-300" />
              </tr>
              {monthlyReport.map(r => {
                const isMonthExpanded = expandedReportMonth === r.month;
                const monthImports = importsByReportMonth.get(r.month) || [];
                return (
                  <React.Fragment key={r.month}>
                    <tr
                      className="cursor-pointer hover:bg-slate-50/50 transition-colors"
                      onClick={() => {
                        onExpandedReportMonthChange(isMonthExpanded ? null : r.month);
                        onExpandedIdChange(null);
                      }}
                    >
                      <td className="px-4 py-3 text-xs text-slate-800 whitespace-nowrap">
                        <span className="inline-flex items-center gap-1.5">
                          {isMonthExpanded ? (
                            <ChevronUp className="h-3.5 w-3.5 text-slate-400" />
                          ) : (
                            <ChevronDown className="h-3.5 w-3.5 text-slate-400" />
                          )}
                          {r.month.substring(5)}/{r.month.substring(0, 4)}
                        </span>
                      </td>
                      {expandedReportMonth && <td className="px-4 py-3 text-xs text-slate-300" />}
                      <td className="px-4 py-3 text-xs text-slate-500">
                        {r.count}
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-800 whitespace-nowrap">
                        {r.total.toLocaleString('vi-VN')}đ
                      </td>
                      <td className="px-4 py-3 text-xs text-green-700 whitespace-nowrap">
                        {r.hasHD.toLocaleString('vi-VN')}đ
                      </td>
                      <td className="px-4 py-3 text-xs text-red-600 whitespace-nowrap">
                        {r.missing.toLocaleString('vi-VN')}đ
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className="flex-1 bg-slate-200 rounded-full h-1.5 min-w-[50px]">
                            <div
                              className={`h-1.5 rounded-full ${
                                r.coverage >= 80
                                  ? 'bg-green-500'
                                  : r.coverage >= 50
                                    ? 'bg-yellow-400'
                                    : 'bg-red-400'
                              }`}
                              style={{ width: `${r.coverage}%` }}
                            />
                          </div>
                          <span className="text-2xs text-slate-600 w-7 text-right">
                            {r.coverage}%
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-xs text-green-700 whitespace-nowrap">
                        {r.vatDeductible.toLocaleString('vi-VN')}đ
                      </td>
                    </tr>
                    {isMonthExpanded && (
                      monthImports.map(t => {
                        const isExpanded = expandedId === t.id;
                        const fileList = attachments[t.id] || [];
                        const isOld =
                          (!t.invoiceStatus || t.invoiceStatus === 'none') && t.date < sevenDaysAgo;
                        const total = Number(t.totalAmount || 0);
	                        const hasInvoice = Math.min(total, allocatedGoodsByReceiptId.get(t.id) || 0);
                        const missingInvoice = Math.max(0, total - hasInvoice);
                        const coverage = total > 0 ? Math.round((hasInvoice / total) * 100) : 0;
                        const vatDeductible = allocatedVatByReceiptId.get(t.id) || 0;
                        const supplier = t.supplierId ? supplierById.get(t.supplierId) : undefined;
                        const supplierCode = supplier?.code || t.supplierId || getPurchaseCode(t);
                        return (
                          <React.Fragment key={t.id}>
                            <tr
                              className={`cursor-pointer border-l-4 border-indigo-100 transition-colors hover:bg-slate-50/50 ${isOld ? 'bg-red-50/20' : 'bg-white'}`}
                              onClick={() => onExpandedIdChange(isExpanded ? null : t.id)}
                            >
                              <td className="whitespace-nowrap px-4 py-3 pl-8">
                                <span className="inline-flex items-center gap-1.5 text-xs text-slate-800">
                                  {isExpanded ? (
                                    <ChevronUp className="h-3.5 w-3.5 text-slate-400" />
                                  ) : (
                                    <ChevronDown className="h-3.5 w-3.5 text-slate-400" />
                                  )}
                                  {formatVatDate(t.date)}
                                </span>
                                {isOld && (
                                  <span className="ml-1.5 rounded-lg bg-red-50 px-1.5 py-0.5 text-[9px] text-red-500">
                                    QH
                                  </span>
                                )}
                              </td>
                              <td className="px-4 py-3">
                                <span className="block max-w-[220px] truncate text-xs text-slate-700">{t.supplierName || 'N/A'}</span>
                                <span className="mt-0.5 block max-w-[220px] truncate font-mono text-2xs text-slate-400">{supplierCode}</span>
                              </td>
                              <td className="whitespace-nowrap px-4 py-3 text-xs text-slate-500">1</td>
                              <td className="whitespace-nowrap px-4 py-3 text-xs text-slate-800">{total.toLocaleString('vi-VN')}đ</td>
                              <td className="whitespace-nowrap px-4 py-3 text-xs text-green-700">{hasInvoice.toLocaleString('vi-VN')}đ</td>
                              <td className="whitespace-nowrap px-4 py-3 text-xs text-red-600">{missingInvoice.toLocaleString('vi-VN')}đ</td>
                              <td className="px-4 py-3">
                                <div className="flex items-center gap-2">
                                  <div className="h-1.5 min-w-[50px] flex-1 rounded-full bg-slate-200">
                                    <div
                                      className={`h-1.5 rounded-full ${coverage >= 80 ? 'bg-green-500' : coverage >= 50 ? 'bg-yellow-400' : 'bg-red-400'}`}
                                      style={{ width: `${coverage}%` }}
                                    />
                                  </div>
                                  <span className="w-7 text-right text-2xs text-slate-600">{coverage}%</span>
                                </div>
                              </td>
                              <td className="whitespace-nowrap px-4 py-3 text-xs text-green-700">{vatDeductible.toLocaleString('vi-VN')}đ</td>
                            </tr>
                            {isExpanded && (
                              <tr>
                                <td colSpan={expandedReportMonth ? 8 : 7} className="bg-slate-50/60">
                                  <div className="grid grid-cols-1 gap-6 px-8 py-4 md:grid-cols-2">
                                    <div>
                                      <p className="mb-2 text-2xs font-normal uppercase tracking-wide text-slate-400">
                                        Sản phẩm trong phiếu
                                      </p>
                                      <div className="space-y-1">
                                        {(t.items || []).map((item, i) => (
                                          <div
                                            key={`${t.id}:${i}`}
                                            className="flex justify-between border-b border-slate-100 py-1.5 text-xs text-slate-600 last:border-0"
                                          >
                                            <span className="max-w-[240px] truncate font-medium">{item.name || item.productId}</span>
                                            <span className="ml-2 whitespace-nowrap font-normal text-slate-400">
                                              {item.quantity} x {(item.price || 0).toLocaleString('vi-VN')}đ
                                            </span>
                                          </div>
                                        ))}
                                      </div>
                                    </div>
                                    <div>
                                      <p className="mb-2 text-2xs font-normal uppercase tracking-wide text-slate-400">
                                        File hóa đơn đính kèm
                                      </p>
                                      {fileList.length === 0 ? (
                                        <p className="text-xs font-medium italic text-slate-300">Chưa có file đính kèm</p>
                                      ) : (
                                        <div className="space-y-2">
                                          {fileList.map(f => (
                                            <div
                                              key={f.id}
                                              className="flex items-center justify-between rounded-xl border border-slate-100 bg-white px-3 py-2"
                                            >
                                              <div className="flex min-w-0 items-center gap-2">
                                                <Paperclip className="h-3 w-3 shrink-0 text-slate-300" />
                                                <span className="truncate text-xs font-normal text-slate-700">{f.file_name}</span>
                                                {f.file_type && (
                                                  <span className="text-[9px] font-normal uppercase text-slate-300">{f.file_type}</span>
                                                )}
                                              </div>
                                              <button
                                                onClick={event => {
                                                  event.stopPropagation();
                                                  onViewFile(f.id, f.file_url);
                                                }}
                                                disabled={loadingUrl === f.id}
                                                className="ml-2 flex shrink-0 items-center gap-1 rounded-lg px-2.5 py-1 text-2xs font-normal text-indigo-500 transition-colors hover:bg-indigo-50"
                                              >
                                                {loadingUrl === f.id ? (
                                                  <span>Đang tải...</span>
                                                ) : (
                                                  <>
                                                    <ExternalLink className="h-3 w-3" />
                                                    Xem
                                                  </>
                                                )}
                                              </button>
                                            </div>
                                          ))}
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                </td>
                              </tr>
                            )}
                          </React.Fragment>
                        );
                      })
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <p className="text-2xs text-slate-400">
        * VAT được khấu trừ lấy theo tiền VAT thực tế trên hóa đơn đã phân bổ. Hóa đơn không có dòng thuế được hiểu là VAT 0%.
      </p>
    </>
  );
}
