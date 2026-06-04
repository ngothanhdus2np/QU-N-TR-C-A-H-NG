import React from 'react';
import { ChevronDown, ChevronUp, Paperclip, ExternalLink, Eye, Receipt } from 'lucide-react';
import { AppData } from '../../../types';
import type { InvoiceAttachment, TabKey } from './types';
import { InvoiceBadge } from './types';
import { formatPurchaseDateTime, getPurchaseCode } from './utils';

type Transaction = AppData['inventoryTransactions'][number];

type PurchaseInvoicesListViewProps = {
  filtered: Transaction[];
  visibleFiltered: Transaction[];
  expandedId: string | null;
  onExpandedIdChange: (id: string | null) => void;
  attachments: Record<string, InvoiceAttachment[]>;
  effectiveInvoiceStatusByReceiptId: Map<string, Exclude<TabKey, 'all'>>;
  sevenDaysAgo: string;
  loadingUrl: string | null;
  onViewFile: (id: string, url: string) => void;
  onLoadMore: () => void;
};

export default function PurchaseInvoicesListView({
  filtered,
  visibleFiltered,
  expandedId,
  onExpandedIdChange,
  attachments,
  effectiveInvoiceStatusByReceiptId,
  sevenDaysAgo,
  loadingUrl,
  onViewFile,
  onLoadMore,
}: PurchaseInvoicesListViewProps) {
  return (
    <>
      <table className="w-full">
        <thead className="sticky top-0 bg-slate-50 border-b border-slate-100 z-10">
          <tr>
            <th className="px-4 py-2.5 w-6" />
            <th className="px-4 py-2.5 text-left text-2xs font-normal text-slate-400 uppercase tracking-wide whitespace-nowrap">
              Ngày
            </th>
            <th className="px-4 py-2.5 text-left text-2xs font-normal text-slate-400 uppercase tracking-wide whitespace-nowrap">
              Mã phiếu
            </th>
            <th className="px-4 py-2.5 text-left text-2xs font-normal text-slate-400 uppercase tracking-wide">
              Nhà cung cấp
            </th>
            <th className="px-4 py-2.5 text-center text-2xs font-normal text-slate-400 uppercase tracking-wide">
              SP
            </th>
            <th className="px-4 py-2.5 text-right text-2xs font-normal text-slate-400 uppercase tracking-wide whitespace-nowrap">
              Tổng tiền
            </th>
            <th className="px-4 py-2.5 text-left text-2xs font-normal text-slate-400 uppercase tracking-wide">
              Chứng từ
            </th>
            <th className="px-4 py-2.5 text-center text-2xs font-normal text-slate-400 uppercase tracking-wide">
              Files
            </th>
            <th className="px-4 py-2.5 w-20" />
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-50">
          {filtered.length === 0 ? (
            <tr>
              <td colSpan={9} className="px-6 py-16 text-center text-slate-400">
                <Receipt className="w-10 h-10 mx-auto mb-2 text-slate-200" />
                <p className="text-xs font-normal">Không tìm thấy phiếu nào</p>
              </td>
            </tr>
          ) : (
            visibleFiltered.map(t => {
              const isExpanded = expandedId === t.id;
              const fileList = attachments[t.id] || [];
              const fileCount = fileList.length;
              const invoiceStatus = effectiveInvoiceStatusByReceiptId.get(t.id) || 'none';
              const isOld = invoiceStatus === 'none' && t.date < sevenDaysAgo;

              return (
                <React.Fragment key={t.id}>
                  <tr
                    className={`hover:bg-slate-50/50 transition-colors cursor-pointer ${isOld ? 'bg-red-50/20' : ''}`}
                    onClick={() => onExpandedIdChange(isExpanded ? null : t.id)}
                  >
                    <td className="px-4 py-3 text-slate-300">
                      {isExpanded ? (
                        <ChevronUp className="w-3.5 h-3.5" />
                      ) : (
                        <ChevronDown className="w-3.5 h-3.5" />
                      )}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className="text-sm font-normal text-slate-800">
                        {formatPurchaseDateTime(t.date)}
                      </span>
                      {isOld && (
                        <span className="ml-1.5 text-[9px] font-normal text-red-500 bg-red-50 px-1.5 py-0.5 rounded-lg">
                          QH
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className="font-mono text-xs font-normal text-indigo-600">
                        {getPurchaseCode(t)}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <p className="text-sm font-normal text-slate-800">{t.supplierName || 'N/A'}</p>
                      {t.note && (
                        <p className="text-2xs text-slate-400 truncate max-w-[200px]">{t.note}</p>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center text-sm font-normal text-slate-500">
                      {t.items?.length || 0}
                    </td>
                    <td className="px-4 py-3 text-right text-sm font-normal text-slate-800 whitespace-nowrap">
                      {(t.totalAmount || 0).toLocaleString('vi-VN')}đ
                    </td>
                    <td className="px-4 py-3">
                      <InvoiceBadge status={invoiceStatus} />
                    </td>
                    <td className="px-4 py-3 text-center">
                      {fileCount > 0 ? (
                        <span className="inline-flex items-center gap-1 text-2xs font-normal text-indigo-500">
                          <Paperclip className="w-3 h-3" />
                          {fileCount}
                        </span>
                      ) : (
                        <span className="text-2xs font-normal text-slate-200">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <button
                        onClick={e => {
                          e.stopPropagation();
                          onExpandedIdChange(isExpanded ? null : t.id);
                        }}
                        className="inline-flex items-center gap-1 px-2.5 py-1 bg-indigo-50 text-indigo-600 text-2xs font-normal rounded-lg hover:bg-indigo-100 transition-colors"
                      >
                        <Eye className="w-3 h-3" />
                        Chi tiết
                      </button>
                    </td>
                  </tr>

                  {isExpanded && (
                    <tr>
                      <td colSpan={9} className="bg-slate-50/50">
                        <div className="px-8 py-4 grid grid-cols-1 md:grid-cols-2 gap-6">
                          <div>
                            <p className="text-2xs font-normal text-slate-400 uppercase tracking-wide mb-2">
                              Sản phẩm trong phiếu
                            </p>
                            <div className="space-y-1">
                              {(t.items || []).map((item, i) => (
                                <div
                                  key={i}
                                  className="flex justify-between text-xs text-slate-600 py-1.5 border-b border-slate-100 last:border-0"
                                >
                                  <span className="truncate max-w-[200px] font-medium">
                                    {item.name || item.productId}
                                  </span>
                                  <span className="text-slate-400 ml-2 whitespace-nowrap font-normal">
                                    {item.quantity} × {(item.price || 0).toLocaleString('vi-VN')}đ
                                  </span>
                                </div>
                              ))}
                            </div>
                          </div>

                          <div>
                            <p className="text-2xs font-normal text-slate-400 uppercase tracking-wide mb-2">
                              File hóa đơn đính kèm
                            </p>
                            {fileList.length === 0 ? (
                              <p className="text-xs text-slate-300 italic font-medium">Chưa có file đính kèm</p>
                            ) : (
                              <div className="space-y-2">
                                {fileList.map(f => (
                                  <div
                                    key={f.id}
                                    className="flex items-center justify-between bg-white rounded-xl border border-slate-100 px-3 py-2"
                                  >
                                    <div className="flex items-center gap-2 min-w-0">
                                      <Paperclip className="w-3 h-3 text-slate-300 shrink-0" />
                                      <span className="text-xs font-normal text-slate-700 truncate">
                                        {f.file_name}
                                      </span>
                                      {f.file_type && (
                                        <span className="text-[9px] font-normal text-slate-300 uppercase">
                                          {f.file_type}
                                        </span>
                                      )}
                                    </div>
                                    <button
                                      onClick={() => onViewFile(f.id, f.file_url)}
                                      disabled={loadingUrl === f.id}
                                      className="flex items-center gap-1 px-2.5 py-1 text-2xs font-normal text-indigo-500 hover:bg-indigo-50 rounded-lg transition-colors shrink-0 ml-2"
                                    >
                                      {loadingUrl === f.id ? (
                                        <span>Đang tải...</span>
                                      ) : (
                                        <>
                                          <ExternalLink className="w-3 h-3" />
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
        </tbody>
      </table>

      {filtered.length > 0 && (
        <div className="flex items-center justify-between gap-3 px-4 py-2 border-t border-slate-100 bg-slate-50/60 shrink-0">
          <span className="text-2xs font-normal text-slate-400">
            Hiển thị <span className="font-normal text-slate-600">{visibleFiltered.length}</span> /{' '}
            {filtered.length} phiếu nhập theo bộ lọc
          </span>
          {visibleFiltered.length < filtered.length && (
            <button
              onClick={onLoadMore}
              className="rounded-lg border border-slate-200 bg-white px-3 py-1 text-2xs font-normal uppercase tracking-wide text-slate-600 hover:bg-slate-50"
            >
              Tải thêm
            </button>
          )}
        </div>
      )}
    </>
  );
}
