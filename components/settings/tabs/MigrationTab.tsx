import React, { useRef, useState } from 'react';
import * as XLSX from 'xlsx';
import { appDataCache } from '../../../services/appDataCache';
import type { AppData } from '../../../types';
import { assertSafeExcelBuffer, assertSafeExcelFile, EXCEL_MAX_ROWS } from '../../../src/lib/excelSafety';
import ConfirmDialog from '../../ui/ConfirmDialog';
import {
  Upload,
  Trash2,
  Package,
  BarChart3,
  Truck,
  CheckCircle2,
  XCircle,
  Loader2,
  AlertTriangle,
  FileText,
  Users,
  Building2,
} from 'lucide-react';

type ImportStatus = { status: 'running' | 'done' | 'error'; message: string };

const DELETE_DOMAINS = [
  {
    key: 'products' as const,
    label: 'Hàng hóa',
    icon: Package,
    endpoint: '/api/admin/reset-products',
    cacheKeys: ['posProducts', 'inventoryTransactions'] as (keyof AppData)[],
  },
  {
    key: 'revenue' as const,
    label: 'Doanh thu',
    icon: BarChart3,
    endpoint: '/api/admin/reset-revenue',
    cacheKeys: ['revenue', 'posOrders', 'productGroups', 'productGroupRevenue'] as (keyof AppData)[],
  },
  {
    key: 'suppliers' as const,
    label: 'Nhà cung cấp',
    icon: Building2,
    endpoint: '/api/admin/reset-suppliers',
    cacheKeys: ['suppliers', 'supplierDebts'] as (keyof AppData)[],
  },
  {
    key: 'customers' as const,
    label: 'Khách hàng',
    icon: Users,
    endpoint: '/api/admin/reset-customers',
    cacheKeys: ['posCustomers'] as (keyof AppData)[],
  },
];

type DeleteDomainKey = (typeof DELETE_DOMAINS)[number]['key'];

const readImportResponse = async (res: Response) => {
  const text = await res.text();
  if (!text.trim()) {
    if (!res.ok) throw new Error(`Import thất bại (${res.status}). Server không trả nội dung lỗi.`);
    return {};
  }
  try {
    return JSON.parse(text);
  } catch {
    if (!res.ok) throw new Error(`Import thất bại (${res.status}): ${text.slice(0, 300)}`);
    throw new Error(`Server trả dữ liệu không đúng định dạng JSON: ${text.slice(0, 300)}`);
  }
};

const fileToBase64 = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = evt => {
      const buf = evt.target?.result as ArrayBuffer;
      const bytes = new Uint8Array(buf);
      let binary = '';
      const CHUNK = 8192;
      for (let i = 0; i < bytes.length; i += CHUNK)
        binary += String.fromCharCode(...bytes.subarray(i, Math.min(i + CHUNK, bytes.length)));
      resolve(btoa(binary));
    };
    reader.onerror = reject;
    reader.readAsArrayBuffer(file);
  });

const StatusBanner: React.FC<{ status: ImportStatus; onClose: () => void }> = ({
  status,
  onClose,
}) => (
  <div
    className={`mt-3 flex items-start gap-3 rounded-xl border p-3 text-sm ${
      status.status === 'running'
        ? 'border-indigo-100 bg-indigo-50 text-indigo-700'
        : status.status === 'done'
          ? 'border-emerald-100 bg-emerald-50 text-emerald-700'
          : 'border-rose-100 bg-rose-50 text-rose-700'
    }`}
  >
    {status.status === 'running' ? (
      <Loader2 className="mt-0.5 h-4 w-4 shrink-0 animate-spin" />
    ) : status.status === 'done' ? (
      <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
    ) : (
      <XCircle className="mt-0.5 h-4 w-4 shrink-0" />
    )}
    <p className="flex-1 font-normal leading-relaxed">{status.message}</p>
    {status.status !== 'running' && (
      <button
        type="button"
        onClick={onClose}
        className="shrink-0 text-xs font-normal underline opacity-60 hover:opacity-100"
      >
        Đóng
      </button>
    )}
  </div>
);

const MigrationTab: React.FC<{ onRefresh?: () => void }> = ({ onRefresh }) => {
  const productsFileRef = useRef<HTMLInputElement>(null);
  const purchaseDetailsFileRef = useRef<HTMLInputElement>(null);
  const invoicesFileRef = useRef<HTMLInputElement>(null);
  const customersFileRef = useRef<HTMLInputElement>(null);
  const suppliersFileRef = useRef<HTMLInputElement>(null);

  const [productsStatus, setProductsStatus] = useState<ImportStatus | null>(null);
  const [purchaseDetailsStatus, setPurchaseDetailsStatus] = useState<ImportStatus | null>(null);
  const [invoicesStatus, setInvoicesStatus] = useState<ImportStatus | null>(null);
  const [customersStatus, setCustomersStatus] = useState<ImportStatus | null>(null);
  const [suppliersStatus, setSuppliersStatus] = useState<ImportStatus | null>(null);
  const [checkedDomains, setCheckedDomains] = useState<Record<DeleteDomainKey, boolean>>({
    products: false, revenue: false, suppliers: false, customers: false,
  });
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteStatus, setDeleteStatus] = useState<ImportStatus | null>(null);

  const handleImportProducts = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';
    setProductsStatus({ status: 'running', message: `Đang import hàng hóa từ "${file.name}"...` });
    try {
      const fileBase64 = await fileToBase64(file);
      const res = await fetch('/api/import/kiotviet-products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fileBase64 }),
      });
      const data = await readImportResponse(res);
      if (!res.ok) throw new Error(data.error || 'Import thất bại');
      setProductsStatus({
        status: 'done',
        message: `Đã import ${data.imported ?? data.upserted ?? '?'} sản phẩm thành công. Tải lại trang để thấy dữ liệu mới.`,
      });
    } catch (err) {
      setProductsStatus({
        status: 'error',
        message: err instanceof Error ? err.message : 'Lỗi không xác định',
      });
    }
  };

  const handleImportPurchaseDetails = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';
    setPurchaseDetailsStatus({
      status: 'running',
      message: `Đang import phiếu nhập chi tiết từ "${file.name}"...`,
    });
    try {
      const fileBase64 = await fileToBase64(file);
      const res = await fetch('/api/import/kiotviet-purchase-details', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fileBase64 }),
      });
      const data = await readImportResponse(res);
      if (!res.ok) throw new Error(data.error || 'Import thất bại');
      await appDataCache.clearDataKeys(['suppliers', 'supplierDebts', 'inventoryTransactions']);
      const skipped = data.skippedByStatus ? Object.entries(data.skippedByStatus)
        .map(([status, count]) => `${status}: ${count}`)
        .join(', ') : '';
      setPurchaseDetailsStatus({
        status: 'done',
        message: `Đã import ${data.purchases} phiếu nhập, ${data.items} dòng sản phẩm, ${data.suppliers} nhà cung cấp. Không cộng tồn kho tự động.${skipped ? ` Bỏ qua ${skipped}.` : ''}`,
      });
      onRefresh?.();
    } catch (err) {
      setPurchaseDetailsStatus({
        status: 'error',
        message: err instanceof Error ? err.message : 'Lỗi không xác định',
      });
    }
  };

  const handleImportCustomers = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';
    setCustomersStatus({ status: 'running', message: `Đang import khách hàng từ "${file.name}"...` });
    try {
      const fileBase64 = await fileToBase64(file);
      const res = await fetch('/api/import/kiotviet-customers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fileBase64 }),
      });
      const data = await readImportResponse(res);
      if (!res.ok) throw new Error(data.error || 'Import thất bại');
      await appDataCache.clearDataKeys(['posCustomers']);
      setCustomersStatus({
        status: 'done',
        message: `Đã import ${data.upserted ?? data.customers ?? '?'} khách hàng (điểm, hạng, công nợ). Tải lại trang để thấy dữ liệu mới.`,
      });
      onRefresh?.();
    } catch (err) {
      setCustomersStatus({
        status: 'error',
        message: err instanceof Error ? err.message : 'Lỗi không xác định',
      });
    }
  };

  const handleImportSuppliers = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';
    setSuppliersStatus({ status: 'running', message: `Đang import nhà cung cấp từ "${file.name}"...` });
    try {
      assertSafeExcelFile(file);
      const buf = await file.arrayBuffer();
      assertSafeExcelBuffer(buf, file.name);
      const wb = XLSX.read(buf, { type: 'array', cellDates: true, dense: true, sheetRows: EXCEL_MAX_ROWS });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const rows: unknown[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null });

      const res = await fetch('/api/import/kiotviet-suppliers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rows }),
      });
      const data = await readImportResponse(res);
      if (!res.ok) throw new Error(data.error || 'Import thất bại');
      await appDataCache.clearDataKeys(['suppliers', 'supplierDebts']);
      setSuppliersStatus({
        status: 'done',
        message: `Đã import ${data.suppliers} nhà cung cấp, điều chỉnh công nợ ${data.adjustments} NCC theo số liệu KiotViet. Tải lại trang để thấy dữ liệu mới.`,
      });
      onRefresh?.();
    } catch (err) {
      setSuppliersStatus({
        status: 'error',
        message: err instanceof Error ? err.message : 'Lỗi không xác định',
      });
    }
  };

  const selectedDomains = DELETE_DOMAINS.filter(d => checkedDomains[d.key]);
  const allDomainsSelected = selectedDomains.length === DELETE_DOMAINS.length;

  const handleConfirmDelete = async () => {
    setDeleteDialogOpen(false);
    setIsDeleting(true);
    setDeleteStatus({ status: 'running', message: `Đang xóa: ${selectedDomains.map(d => d.label).join(', ')}...` });
    try {
      const results = await Promise.all(
        selectedDomains.map(d => fetch(d.endpoint, { method: 'DELETE' }))
      );
      if (results.some(r => !r.ok)) throw new Error('Xóa dữ liệu thất bại ở ít nhất 1 mục.');

      if (allDomainsSelected) {
        const auditRes = await fetch('/api/admin/reset-audit-logs', { method: 'DELETE' });
        if (!auditRes.ok) throw new Error('Xóa dữ liệu thành công nhưng xóa nhật ký hoạt động thất bại.');
      }

      await appDataCache.clearDataKeys(selectedDomains.flatMap(d => d.cacheKeys));
      setDeleteStatus({
        status: 'done',
        message: `Đã xóa xong: ${selectedDomains.map(d => d.label).join(', ')}.${
          allDomainsSelected ? ' Đã xóa toàn bộ nhật ký hoạt động.' : ''
        }`,
      });
      setCheckedDomains({ products: false, revenue: false, suppliers: false, customers: false });
      onRefresh?.();
    } catch (err) {
      setDeleteStatus({
        status: 'error',
        message: err instanceof Error ? err.message : 'Lỗi không xác định',
      });
    } finally {
      setIsDeleting(false);
    }
  };

  const handleImportInvoices = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    if (files.length === 0) return;
    e.target.value = '';

    let totalCustomers = 0, totalOrders = 0, totalDays = 0;
    const errors: string[] = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      setInvoicesStatus({ status: 'running', message: `(${i + 1}/${files.length}) Đang xử lý "${file.name}"...` });
      try {
        const fileBase64 = await fileToBase64(file);
        const res = await fetch('/api/import/kiotviet-invoices', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ fileBase64 }),
        });
        const data = await readImportResponse(res);
        if (!res.ok) throw new Error(data.error || 'Import thất bại');
        totalCustomers += data.customers ?? 0;
        totalOrders   += data.orders   ?? 0;
        totalDays     += data.revenuedays ?? 0;
      } catch (err) {
        errors.push(`${file.name}: ${err instanceof Error ? err.message : 'Lỗi không xác định'}`);
      }
    }

    if (errors.length > 0 && totalOrders === 0) {
      setInvoicesStatus({ status: 'error', message: errors.join(' | ') });
    } else {
      const suffix = errors.length > 0 ? ` (${errors.length} file lỗi: ${errors.join('; ')})` : '';
      setInvoicesStatus({
        status: errors.length > 0 ? 'error' : 'done',
        message: `Hoàn tất ${files.length} file: ${totalCustomers} khách hàng, ${totalOrders} đơn hàng, ${totalDays} ngày doanh thu.${suffix}`,
      });
      onRefresh?.();
    }
  };

  return (
    <div className="space-y-6">

      {/* Hướng dẫn quy trình */}
      <section id="migration-guide" className="rounded-2xl border border-slate-200 bg-white p-6">
        <h3 className="mb-4 text-sm font-semibold uppercase tracking-wide text-slate-800">
          Quy trình chuyển dữ liệu từ KiotViet
        </h3>
        <ol className="space-y-3">
          {[
            {
              step: '1',
              label: 'Xóa dữ liệu test (nếu có)',
              desc: 'Xóa hàng hóa và doanh thu đang test trước khi import dữ liệu thật.',
            },
            {
              step: '2',
              label: 'Import hàng hóa',
              desc: 'Xuất file "Danh sách hàng hóa" từ KiotViet → Hàng hóa → Xuất file. Cần import trước để sản phẩm có đúng nhóm hàng.',
            },
            {
              step: '3',
              label: 'Import hoá đơn',
              desc: 'Xuất file "Danh sách chi tiết hoá đơn" từ KiotViet → Bán hàng. Tự động tạo khách hàng, đơn hàng và doanh thu — kể cả đơn trả (mã TH).',
            },
            {
              step: '4',
              label: 'Import phiếu nhập hàng',
              desc: 'Xuất file "Danh sách chi tiết nhập hàng" từ KiotViet → Nhập hàng. Tự động tạo nhà cung cấp và công nợ NCC.',
            },
            {
              step: '5',
              label: 'Import khách hàng (làm SAU bước hoá đơn)',
              desc: 'Xuất file "Danh sách khách hàng" từ KiotViet → Khách hàng → Xuất file. Cập nhật đúng điểm tích lũy, hạng thành viên và công nợ hiện tại — ghi đè lên khách hàng đã tạo ở bước 3.',
            },
            {
              step: '6',
              label: 'Import nhà cung cấp (làm SAU bước phiếu nhập)',
              desc: 'Xuất file "Danh sách nhà cung cấp" từ KiotViet → Nhà cung cấp → Xuất file. Đối chiếu và tự động điều chỉnh công nợ NCC theo đúng số liệu KiotViet.',
            },
          ].map(({ step, label, desc }) => (
            <li key={step} className="flex items-start gap-3">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-indigo-600 text-xs font-semibold text-white">
                {step}
              </span>
              <div>
                <p className="text-sm font-semibold text-slate-800">{label}</p>
                <p className="text-xs font-normal text-slate-500">{desc}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      {/* Import dữ liệu */}
      <section id="migration-import" className="rounded-2xl border border-slate-200 bg-white p-6">
        <h3 className="mb-4 text-sm font-semibold uppercase tracking-wide text-slate-800">
          Import dữ liệu
        </h3>
        <div className="space-y-4">
          {/* Import hàng hóa */}
          <div className="rounded-xl border border-slate-100 bg-slate-50 p-4">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-indigo-100 text-indigo-600">
                  <Package className="h-4 w-4" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-slate-800">Hàng hóa</p>
                  <p className="text-xs font-normal text-slate-500">
                    File "Danh sách hàng hóa" xuất từ KiotViet (.xlsx)
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => productsFileRef.current?.click()}
                disabled={productsStatus?.status === 'running'}
                className="flex shrink-0 items-center gap-1.5 rounded-xl border border-indigo-200 bg-white px-3 py-2 text-2xs font-normal uppercase tracking-wide text-indigo-600 shadow-sm transition-colors hover:bg-indigo-50 disabled:opacity-50"
              >
                <Upload className="h-3.5 w-3.5" />
                Chọn file
              </button>
            </div>
            {productsStatus && (
              <StatusBanner status={productsStatus} onClose={() => setProductsStatus(null)} />
            )}
            <input
              ref={productsFileRef}
              type="file"
              className="hidden"
              accept=".xlsx,.xls"
              onChange={handleImportProducts}
            />
          </div>

          {/* Import hoá đơn — tự động tạo khách + đơn hàng + doanh thu */}
          <div className="rounded-xl border border-slate-100 bg-slate-50 p-4">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-violet-100 text-violet-600">
                  <FileText className="h-4 w-4" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-slate-800">Hoá đơn</p>
                  <p className="text-xs font-normal text-slate-500">
                    File "Danh sách chi tiết hoá đơn" — tự động tạo khách hàng, đơn hàng, doanh thu và đơn trả (TH)
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => invoicesFileRef.current?.click()}
                disabled={invoicesStatus?.status === 'running'}
                className="flex shrink-0 items-center gap-1.5 rounded-xl border border-violet-200 bg-white px-3 py-2 text-2xs font-normal uppercase tracking-wide text-violet-600 shadow-sm transition-colors hover:bg-violet-50 disabled:opacity-50"
              >
                <Upload className="h-3.5 w-3.5" />
                Chọn file
              </button>
            </div>
            {invoicesStatus && (
              <StatusBanner status={invoicesStatus} onClose={() => setInvoicesStatus(null)} />
            )}
            <input
              ref={invoicesFileRef}
              type="file"
              className="hidden"
              accept=".xlsx,.xls"
              multiple
              onChange={handleImportInvoices}
            />
          </div>

          {/* Import phiếu nhập chi tiết */}
          <div className="rounded-xl border border-slate-100 bg-slate-50 p-4">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-amber-100 text-amber-600">
                  <Truck className="h-4 w-4" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-slate-800">Phiếu nhập hàng</p>
                  <p className="text-xs font-normal text-slate-500">
                    File "Danh sách chi tiết nhập hàng" — tự động tạo nhà cung cấp và công nợ NCC
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => purchaseDetailsFileRef.current?.click()}
                disabled={purchaseDetailsStatus?.status === 'running'}
                className="flex shrink-0 items-center gap-1.5 rounded-xl border border-amber-200 bg-white px-3 py-2 text-2xs font-normal uppercase tracking-wide text-amber-600 shadow-sm transition-colors hover:bg-amber-50 disabled:opacity-50"
              >
                <Upload className="h-3.5 w-3.5" />
                Chọn file
              </button>
            </div>
            {purchaseDetailsStatus && (
              <StatusBanner
                status={purchaseDetailsStatus}
                onClose={() => setPurchaseDetailsStatus(null)}
              />
            )}
            <input
              ref={purchaseDetailsFileRef}
              type="file"
              className="hidden"
              accept=".xlsx,.xls"
              onChange={handleImportPurchaseDetails}
            />
          </div>

          {/* Import khách hàng — điểm, hạng, công nợ */}
          <div className="rounded-xl border border-slate-100 bg-slate-50 p-4">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-sky-100 text-sky-600">
                  <Users className="h-4 w-4" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-slate-800">Khách hàng</p>
                  <p className="text-xs font-normal text-slate-500">
                    File "Danh sách khách hàng" — cập nhật điểm tích lũy, hạng thành viên và công nợ. Làm SAU bước Hoá đơn.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => customersFileRef.current?.click()}
                disabled={customersStatus?.status === 'running'}
                className="flex shrink-0 items-center gap-1.5 rounded-xl border border-sky-200 bg-white px-3 py-2 text-2xs font-normal uppercase tracking-wide text-sky-600 shadow-sm transition-colors hover:bg-sky-50 disabled:opacity-50"
              >
                <Upload className="h-3.5 w-3.5" />
                Chọn file
              </button>
            </div>
            {customersStatus && (
              <StatusBanner status={customersStatus} onClose={() => setCustomersStatus(null)} />
            )}
            <input
              ref={customersFileRef}
              type="file"
              className="hidden"
              accept=".xlsx,.xls"
              onChange={handleImportCustomers}
            />
          </div>

          {/* Import nhà cung cấp — đối chiếu công nợ */}
          <div className="rounded-xl border border-slate-100 bg-slate-50 p-4">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-teal-100 text-teal-600">
                  <Building2 className="h-4 w-4" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-slate-800">Nhà cung cấp</p>
                  <p className="text-xs font-normal text-slate-500">
                    File "Danh sách nhà cung cấp" — đối chiếu và tự động điều chỉnh công nợ theo KiotViet. Làm SAU bước Phiếu nhập hàng.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => suppliersFileRef.current?.click()}
                disabled={suppliersStatus?.status === 'running'}
                className="flex shrink-0 items-center gap-1.5 rounded-xl border border-teal-200 bg-white px-3 py-2 text-2xs font-normal uppercase tracking-wide text-teal-600 shadow-sm transition-colors hover:bg-teal-50 disabled:opacity-50"
              >
                <Upload className="h-3.5 w-3.5" />
                Chọn file
              </button>
            </div>
            {suppliersStatus && (
              <StatusBanner status={suppliersStatus} onClose={() => setSuppliersStatus(null)} />
            )}
            <input
              ref={suppliersFileRef}
              type="file"
              className="hidden"
              accept=".xlsx,.xls"
              onChange={handleImportSuppliers}
            />
          </div>
        </div>
      </section>

      {/* Xóa dữ liệu */}
      <section id="migration-delete" className="rounded-2xl border border-rose-100 bg-white p-6">
        <div className="mb-4 flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-rose-500" />
          <h3 className="text-sm font-semibold uppercase tracking-wide text-rose-700">
            Xóa dữ liệu test
          </h3>
        </div>
        <p className="mb-4 text-xs font-normal text-slate-500">
          Chọn mục cần xóa sạch trước khi import dữ liệu thật. Hành động này không thể hoàn tác.
          Chọn đủ cả 4 mục sẽ tự động xóa luôn toàn bộ nhật ký hoạt động.
        </p>
        <div className="space-y-2">
          {DELETE_DOMAINS.map(({ key, label, icon: Icon }) => (
            <label
              key={key}
              className="flex cursor-pointer items-center gap-3 rounded-xl border border-rose-100 bg-rose-50/40 p-3"
            >
              <input
                type="checkbox"
                checked={checkedDomains[key]}
                onChange={e => setCheckedDomains(prev => ({ ...prev, [key]: e.target.checked }))}
                className="h-4 w-4 rounded border-rose-300 text-rose-600 focus:ring-rose-500"
              />
              <Icon className="h-4 w-4 text-rose-400" />
              <span className="text-sm font-normal text-slate-700">{label}</span>
            </label>
          ))}
        </div>
        <button
          type="button"
          onClick={() => setDeleteDialogOpen(true)}
          disabled={selectedDomains.length === 0 || isDeleting}
          className="mt-4 flex items-center gap-1.5 rounded-xl bg-rose-600 px-4 py-2 text-xs font-normal uppercase tracking-wide text-white shadow-sm transition-colors hover:bg-rose-700 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {isDeleting ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Trash2 className="h-3.5 w-3.5" />
          )}
          Xóa dữ liệu đã chọn
        </button>
        {deleteStatus && (
          <StatusBanner status={deleteStatus} onClose={() => setDeleteStatus(null)} />
        )}
      </section>

      <ConfirmDialog
        isOpen={deleteDialogOpen}
        variant="danger"
        title="Xác nhận xóa dữ liệu"
        message={`Sắp xóa vĩnh viễn: ${selectedDomains.map(d => d.label).join(', ')}.${
          allDomainsSelected ? ' Toàn bộ nhật ký hoạt động cũng sẽ bị xóa.' : ''
        } Hành động này không thể hoàn tác.`}
        confirmLabel="Xóa vĩnh viễn"
        cancelLabel="Hủy"
        onConfirm={handleConfirmDelete}
        onCancel={() => setDeleteDialogOpen(false)}
      />
    </div>
  );
};

export default MigrationTab;
