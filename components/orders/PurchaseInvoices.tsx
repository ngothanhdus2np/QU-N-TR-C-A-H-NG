import React, { useState, useMemo, useEffect, useCallback } from 'react';
import * as XLSX from 'xlsx';
import {
  Receipt,
  Search,
  Download,
  Eye,
  TrendingUp,
  FileCheck,
  FileX,
  FileText,
  FileMinus,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  Paperclip,
  ExternalLink,
  BarChart2,
  List,
} from 'lucide-react';
import { AppData } from '../../types';
import { supabase } from '../../services/supabase';

interface PurchaseInvoicesProps {
  transactions: AppData['inventoryTransactions'];
  suppliers: AppData['suppliers'];
  supplierDebts: AppData['supplierDebts'];
}

type TabKey = 'all' | 'full' | 'partial' | 'memo_only' | 'none';

type InvoiceAttachment = {
  id: string;
  purchase_record_id: string;
  file_name: string;
  file_url: string;
  file_type: string | null;
  uploaded_at: string | null;
};

const TAB_CONFIG: { key: TabKey; label: string; Icon: React.ElementType }[] = [
  { key: 'all', label: 'Tất cả', Icon: Receipt },
  { key: 'full', label: 'Đủ HĐ', Icon: FileCheck },
  { key: 'partial', label: 'Một phần', Icon: FileMinus },
  { key: 'memo_only', label: 'Bảng kê', Icon: FileText },
  { key: 'none', label: 'Thiếu CT', Icon: FileX },
];

const BADGE_CONFIG = {
  full: { label: 'Đủ HĐ', Icon: FileCheck, cls: 'bg-green-100 text-green-700' },
  partial: { label: 'Một phần', Icon: FileMinus, cls: 'bg-yellow-100 text-yellow-700' },
  memo_only: { label: 'Bảng kê', Icon: FileText, cls: 'bg-blue-100 text-blue-700' },
  none: { label: 'Thiếu CT', Icon: FileX, cls: 'bg-red-100 text-red-600' },
} as const;

function InvoiceBadge({ status }: { status?: string }) {
  const cfg = BADGE_CONFIG[status as keyof typeof BADGE_CONFIG] ?? BADGE_CONFIG.none;
  const { Icon } = cfg;
  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-black rounded-xl ${cfg.cls}`}
    >
      <Icon className="w-3 h-3" />
      {cfg.label}
    </span>
  );
}

const SEVEN_DAYS_AGO = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

export default function PurchaseInvoices({ transactions, suppliers }: PurchaseInvoicesProps) {
  const [activeTab, setActiveTab] = useState<TabKey>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [dateFilter, setDateFilter] = useState<'all' | 'today' | 'week' | 'month'>('all');
  const [supplierFilter, setSupplierFilter] = useState('all');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [attachments, setAttachments] = useState<Record<string, InvoiceAttachment[]>>({});
  const [loadingAttachments, setLoadingAttachments] = useState(false);
  const [signedUrls, setSignedUrls] = useState<Record<string, string>>({});
  const [loadingUrl, setLoadingUrl] = useState<string | null>(null);
  const [showReport, setShowReport] = useState(false);
  const [vatRate, setVatRate] = useState(10);
  const [supplierSearch, setSupplierSearch] = useState('');

  const today = new Date().toISOString().split('T')[0];
  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
  const monthAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

  useEffect(() => {
    const importIds = transactions.filter(t => t.type === 'Import').map(t => t.id);
    if (importIds.length === 0) return;
    setLoadingAttachments(true);
    supabase
      .from('invoice_attachments')
      .select('*')
      .in('purchase_record_id', importIds)
      .then(({ data }) => {
        if (!data) return;
        const grouped: Record<string, InvoiceAttachment[]> = {};
        data.forEach((a: InvoiceAttachment) => {
          if (!grouped[a.purchase_record_id]) grouped[a.purchase_record_id] = [];
          grouped[a.purchase_record_id].push(a);
        });
        setAttachments(grouped);
      })
      .then(
        () => setLoadingAttachments(false),
        () => setLoadingAttachments(false)
      );
  }, [transactions]);

  const handleViewFile = useCallback(
    async (attachmentId: string, filePath: string) => {
      if (signedUrls[attachmentId]) {
        window.open(signedUrls[attachmentId], '_blank');
        return;
      }
      setLoadingUrl(attachmentId);
      const { data, error } = await supabase.storage
        .from('purchase-invoices')
        .createSignedUrl(filePath, 3600);
      setLoadingUrl(null);
      if (error || !data?.signedUrl) {
        alert('Không thể mở file. Vui lòng thử lại.');
        return;
      }
      setSignedUrls(prev => ({ ...prev, [attachmentId]: data.signedUrl }));
      window.open(data.signedUrl, '_blank');
    },
    [signedUrls]
  );

  const allImports = useMemo(
    () =>
      transactions.filter(t => t.type === 'Import').sort((a, b) => b.date.localeCompare(a.date)),
    [transactions]
  );

  const tabCounts = useMemo(() => {
    const counts: Record<TabKey, number> = { all: 0, full: 0, partial: 0, memo_only: 0, none: 0 };
    allImports.forEach(t => {
      counts.all++;
      const s = (t.invoiceStatus as TabKey) || 'none';
      if (s in counts) counts[s]++;
    });
    return counts;
  }, [allImports]);

  const summary = useMemo(() => {
    const totalAmount = allImports.reduce((s, t) => s + (t.totalAmount || 0), 0);
    const hasFullHD = allImports
      .filter(t => t.invoiceStatus === 'full')
      .reduce((s, t) => s + (t.totalAmount || 0), 0);
    const hasPartialHD = allImports
      .filter(t => t.invoiceStatus === 'partial')
      .reduce((s, t) => s + (t.invoicedAmount || 0), 0);
    const missingHD = totalAmount - hasFullHD - hasPartialHD;
    return { totalAmount, hasFullHD, hasPartialHD, missingHD };
  }, [allImports]);

  const overdueCount = useMemo(
    () =>
      allImports.filter(
        t => (!t.invoiceStatus || t.invoiceStatus === 'none') && t.date < SEVEN_DAYS_AGO
      ).length,
    [allImports]
  );

  const filtered = useMemo(() => {
    return allImports.filter(t => {
      if (activeTab !== 'all') {
        const s = (t.invoiceStatus as TabKey) || 'none';
        if (s !== activeTab) return false;
      }
      if (searchTerm) {
        const q = searchTerm.toLowerCase();
        if (
          !t.note?.toLowerCase().includes(q) &&
          !t.supplierName?.toLowerCase().includes(q) &&
          !t.id.toLowerCase().includes(q)
        )
          return false;
      }
      if (dateFilter === 'today' && t.date < today) return false;
      if (dateFilter === 'week' && t.date < weekAgo) return false;
      if (dateFilter === 'month' && t.date < monthAgo) return false;
      if (supplierFilter !== 'all' && t.supplierId !== supplierFilter) return false;
      return true;
    });
  }, [allImports, activeTab, searchTerm, dateFilter, supplierFilter, today, weekAgo, monthAgo]);

  const monthlyReport = useMemo(() => {
    const byMonth: Record<
      string,
      { total: number; hasHD: number; missing: number; count: number }
    > = {};
    allImports.forEach(t => {
      const month = t.date.substring(0, 7);
      if (!byMonth[month]) byMonth[month] = { total: 0, hasHD: 0, missing: 0, count: 0 };
      const amount = t.totalAmount || 0;
      byMonth[month].total += amount;
      byMonth[month].count += 1;
      if (t.invoiceStatus === 'full') {
        byMonth[month].hasHD += amount;
      } else if (t.invoiceStatus === 'partial') {
        byMonth[month].hasHD += t.invoicedAmount || 0;
        byMonth[month].missing += amount - (t.invoicedAmount || 0);
      } else {
        byMonth[month].missing += amount;
      }
    });
    return Object.entries(byMonth)
      .sort(([a], [b]) => b.localeCompare(a))
      .map(([month, d]) => ({
        month,
        ...d,
        coverage: d.total > 0 ? Math.round((d.hasHD / d.total) * 100) : 0,
      }));
  }, [allImports]);

  const vatSummary = useMemo(() => {
    const invoicedTotal = summary.hasFullHD + summary.hasPartialHD;
    const vatDeductible = Math.round((invoicedTotal * vatRate) / (100 + vatRate));
    const vatMissing = Math.round((summary.missingHD * vatRate) / (100 + vatRate));
    return { invoicedTotal, vatDeductible, vatMissing };
  }, [summary, vatRate]);

  const handleExportExcel = () => {
    const wb = XLSX.utils.book_new();
    const sheet1Data = [
      [
        'Ngày',
        'Mã phiếu',
        'Nhà cung cấp',
        'Số SP',
        'Tổng tiền',
        'Chứng từ',
        'File đính kèm',
        'Ghi chú',
      ],
      ...allImports.map(t => [
        new Date(t.date).toLocaleDateString('vi-VN'),
        t.id.slice(0, 8).toUpperCase(),
        t.supplierName || 'N/A',
        t.items?.length || 0,
        t.totalAmount || 0,
        BADGE_CONFIG[(t.invoiceStatus as keyof typeof BADGE_CONFIG) || 'none']?.label || 'Thiếu CT',
        attachments[t.id]?.length || 0,
        t.note || '',
      ]),
    ];
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(sheet1Data), 'Danh sách phiếu');

    const sheet2Data = [
      [
        'Tháng',
        'Số phiếu',
        'Tổng nhập',
        'Có HĐ',
        'Thiếu HĐ',
        'Tỷ lệ phủ (%)',
        `VAT KT được (${vatRate}%)`,
        `VAT không KT (${vatRate}%)`,
      ],
      ...monthlyReport.map(r => {
        const vatKT = Math.round((r.hasHD * vatRate) / (100 + vatRate));
        const vatKKT = Math.round((r.missing * vatRate) / (100 + vatRate));
        return [r.month, r.count, r.total, r.hasHD, r.missing, r.coverage, vatKT, vatKKT];
      }),
      [],
      [
        'TỔNG CỘNG',
        allImports.length,
        summary.totalAmount,
        summary.hasFullHD + summary.hasPartialHD,
        summary.missingHD,
        summary.totalAmount > 0
          ? Math.round(((summary.hasFullHD + summary.hasPartialHD) / summary.totalAmount) * 100)
          : 0,
        vatSummary.vatDeductible,
        vatSummary.vatMissing,
      ],
    ];
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(sheet2Data), 'Tổng kết tháng');
    XLSX.writeFile(wb, `bao-cao-hoa-don-dau-vao-${today}.xlsx`);
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex flex-1 min-h-0 gap-4 p-4">
        {/* ===== LEFT SIDEBAR ===== */}
        <div className="w-64 shrink-0 flex flex-col bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
          {/* Title */}
          <div className="px-4 py-3 border-b border-slate-100 flex items-center gap-2">
            <Receipt className="w-4 h-4 text-indigo-500" />
            <span className="text-xs font-black text-slate-700 uppercase tracking-wide">
              Hóa đơn đầu vào
            </span>
          </div>

          {/* Summary numbers */}
          <div className="px-3 py-3 border-b border-slate-100">
            <div className="text-[10px] font-black text-slate-400 uppercase tracking-wide mb-2">
              Tổng quan
            </div>
            <div className="space-y-2">
              {[
                {
                  label: 'Tổng nhập',
                  value: summary.totalAmount,
                  color: 'text-slate-800',
                  Icon: TrendingUp,
                  iconColor: 'text-slate-300',
                },
                {
                  label: 'Có HĐ',
                  value: summary.hasFullHD + summary.hasPartialHD,
                  color: 'text-green-700',
                  Icon: FileCheck,
                  iconColor: 'text-green-400',
                },
                {
                  label: 'Thiếu CT',
                  value: summary.missingHD,
                  color: 'text-red-600',
                  Icon: FileX,
                  iconColor: 'text-red-400',
                },
              ].map(({ label, value, color, Icon, iconColor }) => (
                <div key={label} className="flex items-center justify-between">
                  <span className="flex items-center gap-1.5 text-[11px] text-slate-500">
                    <Icon className={`w-3 h-3 ${iconColor}`} />
                    {label}
                  </span>
                  <span className={`text-[11px] font-black ${color}`}>
                    {value >= 1_000_000
                      ? `${(value / 1_000_000).toFixed(1)}tr`
                      : value.toLocaleString('vi-VN') + 'đ'}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Status filter */}
          <div className="px-3 py-3 border-b border-slate-100">
            <div className="text-[10px] font-black text-slate-400 uppercase tracking-wide mb-2">
              Trạng thái
            </div>
            <div className="space-y-0.5">
              {TAB_CONFIG.map(({ key, label, Icon }) => (
                <button
                  key={key}
                  onClick={() => setActiveTab(key)}
                  className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-xl text-xs transition-all ${
                    activeTab === key
                      ? 'bg-indigo-50 text-indigo-700 font-black'
                      : 'text-slate-600 hover:bg-slate-50 font-medium'
                  }`}
                >
                  <span className="flex items-center gap-1.5">
                    <Icon className="w-3 h-3" />
                    {label}
                  </span>
                  <span
                    className={`px-1.5 py-0.5 rounded-full text-[10px] font-black ${
                      activeTab === key
                        ? 'bg-indigo-100 text-indigo-700'
                        : 'bg-slate-100 text-slate-400'
                    }`}
                  >
                    {tabCounts[key]}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Date filter */}
          <div className="px-3 py-3 border-b border-slate-100">
            <div className="text-[10px] font-black text-slate-400 uppercase tracking-wide mb-2">
              Thời gian
            </div>
            <div className="space-y-0.5">
              {(
                [
                  { value: 'all', label: 'Tất cả' },
                  { value: 'today', label: 'Hôm nay' },
                  { value: 'week', label: '7 ngày qua' },
                  { value: 'month', label: '30 ngày qua' },
                ] as const
              ).map(({ value, label }) => (
                <button
                  key={value}
                  onClick={() => setDateFilter(value)}
                  className={`w-full text-left px-2.5 py-1.5 rounded-xl text-xs transition-all ${
                    dateFilter === value
                      ? 'bg-indigo-50 text-indigo-700 font-black'
                      : 'text-slate-600 hover:bg-slate-50 font-medium'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Supplier filter */}
          <div className="px-3 py-3 flex flex-col flex-1 min-h-0 border-t border-slate-100">
            <div className="text-[10px] font-black text-slate-400 uppercase tracking-wide mb-2">
              Nhà cung cấp
            </div>
            <div className="relative mb-2">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-slate-400" />
              <input
                type="text"
                placeholder="Tìm nhà cung cấp..."
                value={supplierSearch}
                onChange={e => setSupplierSearch(e.target.value)}
                className="w-full pl-7 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-[11px] font-bold outline-none focus:border-indigo-400 focus:bg-white transition-all placeholder:text-slate-300"
              />
            </div>
            <div className="space-y-0.5 overflow-y-auto flex-1 min-h-0">
              {suppliers
                .filter(s => s.name.toLowerCase().includes(supplierSearch.toLowerCase()))
                .map(s => (
                  <button
                    key={s.id}
                    onClick={() => setSupplierFilter(supplierFilter === s.id ? 'all' : s.id)}
                    className={`w-full text-left px-2.5 py-1.5 rounded-xl text-xs transition-all truncate ${
                      supplierFilter === s.id
                        ? 'bg-indigo-50 text-indigo-700 font-black'
                        : 'text-slate-600 hover:bg-slate-50 font-medium'
                    }`}
                  >
                    {s.name}
                  </button>
                ))}
              {supplierSearch &&
                suppliers.filter(s => s.name.toLowerCase().includes(supplierSearch.toLowerCase()))
                  .length === 0 && (
                  <p className="px-2.5 py-2 text-[10px] text-slate-300 font-medium italic">
                    Không tìm thấy NCC
                  </p>
                )}
            </div>
          </div>

          {/* Overdue warning */}
          {overdueCount > 0 && (
            <div className="mx-3 mb-3 px-3 py-2 bg-red-50 rounded-xl border border-red-100">
              <div className="flex items-start gap-1.5">
                <AlertTriangle className="w-3 h-3 text-red-500 mt-0.5 shrink-0" />
                <p className="text-[10px] text-red-600 leading-snug">
                  <span className="font-black">{overdueCount} phiếu</span> quá 7 ngày chưa có chứng
                  từ
                </p>
              </div>
            </div>
          )}
        </div>

        {/* ===== RIGHT MAIN PANEL ===== */}
        <div className="flex-1 flex flex-col min-h-0 bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
          {/* Toolbar */}
          <div className="px-4 min-h-[52px] border-b border-slate-100 flex items-center gap-3 shrink-0">
            <div className="flex-1 relative max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
              <input
                type="text"
                placeholder="Tìm NCC, ghi chú, mã phiếu..."
                className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold outline-none focus:border-indigo-400 focus:bg-white transition-all placeholder:text-slate-300"
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
              />
            </div>
            <div className="flex items-center gap-2 ml-auto">
              <button
                onClick={() => setShowReport(v => !v)}
                className={`flex items-center gap-1.5 px-4 py-2 rounded-xl font-black text-[10px] uppercase tracking-wide transition-all ${
                  showReport
                    ? 'bg-indigo-600 text-white shadow-md shadow-indigo-200 hover:bg-indigo-700'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {showReport ? (
                  <List className="h-3.5 w-3.5" />
                ) : (
                  <BarChart2 className="h-3.5 w-3.5" />
                )}
                {showReport ? 'Danh sách' : 'Báo cáo'}
              </button>
              <button
                onClick={handleExportExcel}
                className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 text-white rounded-xl font-black text-[10px] uppercase tracking-wide shadow-md shadow-indigo-200 hover:bg-indigo-700 transition-all"
              >
                <Download className="h-3.5 w-3.5" />
                Xuất Excel
              </button>
            </div>
          </div>

          {/* Sub-toolbar */}
          <div className="px-4 py-2 bg-slate-50/60 border-b border-slate-100 flex items-center gap-3 shrink-0">
            <span className="text-[10px] font-bold text-slate-500">
              Hiển thị <span className="font-black text-slate-800">{filtered.length}</span> /{' '}
              {allImports.length} phiếu nhập
            </span>
            {loadingAttachments && (
              <span className="flex items-center gap-1 text-[10px] font-bold text-blue-500">
                <span className="inline-block w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" />
                Đang tải file đính kèm...
              </span>
            )}
            {showReport && (
              <div className="flex items-center gap-2 ml-auto">
                <span className="text-[10px] font-bold text-slate-400">Thuế suất VAT:</span>
                <select
                  value={vatRate}
                  onChange={e => setVatRate(Number(e.target.value))}
                  className="px-2 py-1 bg-white border border-slate-200 rounded-lg text-[10px] font-black text-slate-700 focus:ring-1 focus:ring-indigo-400 outline-none"
                >
                  {[0, 5, 8, 10].map(r => (
                    <option key={r} value={r}>
                      {r}%
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {/* ===== CONTENT AREA ===== */}
          <div className="flex-1 min-h-0 overflow-auto overscroll-contain">
            {showReport ? (
              /* ---- REPORT VIEW ---- */
              <div className="p-4 space-y-4">
                {/* VAT estimation cards */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {[
                    {
                      label: 'Giá trị có HĐ',
                      value: vatSummary.invoicedTotal,
                      color: 'text-green-700',
                      note: 'Đủ HĐ + một phần',
                      bg: 'bg-green-50 border-green-100',
                    },
                    {
                      label: 'VAT được khấu trừ',
                      value: vatSummary.vatDeductible,
                      color: 'text-green-700',
                      note: `${vatRate}% trên giá trị có HĐ`,
                      bg: 'bg-green-50 border-green-100',
                    },
                    {
                      label: 'Giá trị thiếu HĐ',
                      value: summary.missingHD,
                      color: 'text-red-600',
                      note: 'Bảng kê + không CT',
                      bg: 'bg-red-50 border-red-100',
                    },
                    {
                      label: 'VAT KHÔNG khấu trừ',
                      value: vatSummary.vatMissing,
                      color: 'text-red-600',
                      note: `${vatRate}% trên phần thiếu HĐ`,
                      bg: 'bg-red-50 border-red-100',
                    },
                  ].map(({ label, value, color, note, bg }) => (
                    <div key={label} className={`rounded-2xl border p-3 ${bg}`}>
                      <p className="text-[10px] font-black text-slate-500 uppercase tracking-wide mb-1">
                        {label}
                      </p>
                      <p className={`text-base font-black ${color}`}>
                        {value.toLocaleString('vi-VN')}đ
                      </p>
                      <p className="text-[10px] text-slate-400 mt-1">{note}</p>
                    </div>
                  ))}
                </div>

                {/* Monthly table */}
                <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden">
                  <div className="px-4 py-3 border-b border-slate-100">
                    <span className="text-xs font-black text-slate-700 uppercase tracking-wide">
                      Tổng kết theo tháng
                    </span>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead className="bg-slate-50 border-b border-slate-100">
                        <tr>
                          {[
                            'Tháng',
                            'Số phiếu',
                            'Tổng nhập',
                            'Có HĐ',
                            'Thiếu HĐ',
                            'Tỷ lệ phủ',
                            'VAT KT được',
                            'VAT không KT',
                          ].map(h => (
                            <th
                              key={h}
                              className="px-4 py-2.5 text-left text-[10px] font-black text-slate-400 uppercase tracking-wide whitespace-nowrap"
                            >
                              {h}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-50">
                        {monthlyReport.map(r => {
                          const vatKT = Math.round((r.hasHD * vatRate) / (100 + vatRate));
                          const vatKKT = Math.round((r.missing * vatRate) / (100 + vatRate));
                          return (
                            <tr key={r.month} className="hover:bg-slate-50/50 transition-colors">
                              <td className="px-4 py-3 text-xs font-black text-slate-800 whitespace-nowrap">
                                {r.month.substring(5)}/{r.month.substring(0, 4)}
                              </td>
                              <td className="px-4 py-3 text-xs font-bold text-slate-500">
                                {r.count}
                              </td>
                              <td className="px-4 py-3 text-xs font-black text-slate-800 whitespace-nowrap">
                                {r.total.toLocaleString('vi-VN')}đ
                              </td>
                              <td className="px-4 py-3 text-xs font-bold text-green-700 whitespace-nowrap">
                                {r.hasHD.toLocaleString('vi-VN')}đ
                              </td>
                              <td className="px-4 py-3 text-xs font-bold text-red-600 whitespace-nowrap">
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
                                  <span className="text-[10px] font-black text-slate-600 w-7 text-right">
                                    {r.coverage}%
                                  </span>
                                </div>
                              </td>
                              <td className="px-4 py-3 text-xs font-bold text-green-700 whitespace-nowrap">
                                {vatKT.toLocaleString('vi-VN')}đ
                              </td>
                              <td className="px-4 py-3 text-xs font-bold text-red-500 whitespace-nowrap">
                                {vatKKT.toLocaleString('vi-VN')}đ
                              </td>
                            </tr>
                          );
                        })}
                        {/* Total row */}
                        <tr className="bg-slate-50 border-t-2 border-slate-200">
                          <td className="px-4 py-3 text-xs font-black text-slate-900">Tổng cộng</td>
                          <td className="px-4 py-3 text-xs font-black text-slate-700">
                            {allImports.length}
                          </td>
                          <td className="px-4 py-3 text-xs font-black text-slate-900 whitespace-nowrap">
                            {summary.totalAmount.toLocaleString('vi-VN')}đ
                          </td>
                          <td className="px-4 py-3 text-xs font-black text-green-700 whitespace-nowrap">
                            {(summary.hasFullHD + summary.hasPartialHD).toLocaleString('vi-VN')}đ
                          </td>
                          <td className="px-4 py-3 text-xs font-black text-red-600 whitespace-nowrap">
                            {summary.missingHD.toLocaleString('vi-VN')}đ
                          </td>
                          <td className="px-4 py-3">
                            <span className="text-xs font-black text-slate-700">
                              {summary.totalAmount > 0
                                ? Math.round(
                                    ((summary.hasFullHD + summary.hasPartialHD) /
                                      summary.totalAmount) *
                                      100
                                  )
                                : 0}
                              %
                            </span>
                          </td>
                          <td className="px-4 py-3 text-xs font-black text-green-700 whitespace-nowrap">
                            {vatSummary.vatDeductible.toLocaleString('vi-VN')}đ
                          </td>
                          <td className="px-4 py-3 text-xs font-black text-red-500 whitespace-nowrap">
                            {vatSummary.vatMissing.toLocaleString('vi-VN')}đ
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>

                <p className="text-[10px] text-slate-400">
                  * Tính theo phương pháp khấu trừ: VAT = Giá trị × {vatRate}% / {100 + vatRate}.
                  Cần xác nhận với kế toán trước khi khai thuế.
                </p>
              </div>
            ) : (
              /* ---- LIST VIEW ---- */
              <table className="w-full">
                <thead className="sticky top-0 bg-slate-50 border-b border-slate-100 z-10">
                  <tr>
                    <th className="px-4 py-2.5 w-6" />
                    <th className="px-4 py-2.5 text-left text-[10px] font-black text-slate-400 uppercase tracking-wide whitespace-nowrap">
                      Ngày
                    </th>
                    <th className="px-4 py-2.5 text-left text-[10px] font-black text-slate-400 uppercase tracking-wide">
                      Nhà cung cấp
                    </th>
                    <th className="px-4 py-2.5 text-center text-[10px] font-black text-slate-400 uppercase tracking-wide">
                      SP
                    </th>
                    <th className="px-4 py-2.5 text-right text-[10px] font-black text-slate-400 uppercase tracking-wide whitespace-nowrap">
                      Tổng tiền
                    </th>
                    <th className="px-4 py-2.5 text-left text-[10px] font-black text-slate-400 uppercase tracking-wide">
                      Chứng từ
                    </th>
                    <th className="px-4 py-2.5 text-center text-[10px] font-black text-slate-400 uppercase tracking-wide">
                      Files
                    </th>
                    <th className="px-4 py-2.5 w-20" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {filtered.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="px-6 py-16 text-center text-slate-400">
                        <Receipt className="w-10 h-10 mx-auto mb-2 text-slate-200" />
                        <p className="text-xs font-bold">Không tìm thấy phiếu nào</p>
                      </td>
                    </tr>
                  ) : (
                    filtered.map(t => {
                      const isExpanded = expandedId === t.id;
                      const fileList = attachments[t.id] || [];
                      const fileCount = fileList.length;
                      const isOld =
                        (!t.invoiceStatus || t.invoiceStatus === 'none') && t.date < SEVEN_DAYS_AGO;

                      return (
                        <React.Fragment key={t.id}>
                          <tr
                            className={`hover:bg-slate-50/50 transition-colors cursor-pointer ${
                              isOld ? 'bg-red-50/20' : ''
                            }`}
                            onClick={() => setExpandedId(isExpanded ? null : t.id)}
                          >
                            <td className="px-4 py-3 text-slate-300">
                              {isExpanded ? (
                                <ChevronUp className="w-3.5 h-3.5" />
                              ) : (
                                <ChevronDown className="w-3.5 h-3.5" />
                              )}
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap">
                              <span className="text-sm font-bold text-slate-800">
                                {new Date(t.date).toLocaleDateString('vi-VN')}
                              </span>
                              {isOld && (
                                <span className="ml-1.5 text-[9px] font-black text-red-500 bg-red-50 px-1.5 py-0.5 rounded-lg">
                                  QH
                                </span>
                              )}
                            </td>
                            <td className="px-4 py-3">
                              <p className="text-sm font-bold text-slate-800">
                                {t.supplierName || 'N/A'}
                              </p>
                              {t.note && (
                                <p className="text-[10px] text-slate-400 truncate max-w-[200px]">
                                  {t.note}
                                </p>
                              )}
                            </td>
                            <td className="px-4 py-3 text-center text-sm font-bold text-slate-500">
                              {t.items?.length || 0}
                            </td>
                            <td className="px-4 py-3 text-right text-sm font-black text-slate-800 whitespace-nowrap">
                              {(t.totalAmount || 0).toLocaleString('vi-VN')}đ
                            </td>
                            <td className="px-4 py-3">
                              <InvoiceBadge status={t.invoiceStatus} />
                            </td>
                            <td className="px-4 py-3 text-center">
                              {fileCount > 0 ? (
                                <span className="inline-flex items-center gap-1 text-[10px] font-black text-indigo-500">
                                  <Paperclip className="w-3 h-3" />
                                  {fileCount}
                                </span>
                              ) : (
                                <span className="text-[10px] font-bold text-slate-200">—</span>
                              )}
                            </td>
                            <td className="px-4 py-3 text-center">
                              <button
                                onClick={e => {
                                  e.stopPropagation();
                                  setExpandedId(isExpanded ? null : t.id);
                                }}
                                className="inline-flex items-center gap-1 px-2.5 py-1 bg-indigo-50 text-indigo-600 text-[10px] font-black rounded-lg hover:bg-indigo-100 transition-colors"
                              >
                                <Eye className="w-3 h-3" />
                                Chi tiết
                              </button>
                            </td>
                          </tr>

                          {/* Expanded detail row */}
                          {isExpanded && (
                            <tr>
                              <td colSpan={8} className="bg-slate-50/50">
                                <div className="px-8 py-4 grid grid-cols-1 md:grid-cols-2 gap-6">
                                  {/* Products */}
                                  <div>
                                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-wide mb-2">
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
                                          <span className="text-slate-400 ml-2 whitespace-nowrap font-bold">
                                            {item.quantity} ×{' '}
                                            {(item.price || 0).toLocaleString('vi-VN')}đ
                                          </span>
                                        </div>
                                      ))}
                                    </div>
                                  </div>

                                  {/* File attachments */}
                                  <div>
                                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-wide mb-2">
                                      File hóa đơn đính kèm
                                    </p>
                                    {fileList.length === 0 ? (
                                      <p className="text-xs text-slate-300 italic font-medium">
                                        Chưa có file đính kèm
                                      </p>
                                    ) : (
                                      <div className="space-y-2">
                                        {fileList.map(f => (
                                          <div
                                            key={f.id}
                                            className="flex items-center justify-between bg-white rounded-xl border border-slate-100 px-3 py-2"
                                          >
                                            <div className="flex items-center gap-2 min-w-0">
                                              <Paperclip className="w-3 h-3 text-slate-300 shrink-0" />
                                              <span className="text-xs font-bold text-slate-700 truncate">
                                                {f.file_name}
                                              </span>
                                              {f.file_type && (
                                                <span className="text-[9px] font-black text-slate-300 uppercase">
                                                  {f.file_type}
                                                </span>
                                              )}
                                            </div>
                                            <button
                                              onClick={() => handleViewFile(f.id, f.file_url)}
                                              disabled={loadingUrl === f.id}
                                              className="flex items-center gap-1 px-2.5 py-1 text-[10px] font-black text-indigo-500 hover:bg-indigo-50 rounded-lg transition-colors shrink-0 ml-2"
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
            )}
          </div>

          {/* Footer */}
          {!showReport && filtered.length > 0 && (
            <div className="px-4 py-2 border-t border-slate-100 bg-slate-50/60 shrink-0">
              <span className="text-[10px] font-bold text-slate-400">
                Hiển thị <span className="font-black text-slate-600">{filtered.length}</span> /{' '}
                {allImports.length} phiếu nhập
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
