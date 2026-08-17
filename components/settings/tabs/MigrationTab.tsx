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
  Skull,
} from 'lucide-react';

type ImportStatus = { status: 'running' | 'done' | 'error'; message: string };

const FACTORY_RESET_CONFIRM_PHRASE = 'XÓA TOÀN BỘ';

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

// Mũi tên nối các bước — bước đầu cạnh trái phẳng, các bước sau khoét khấc để lồng vào nhau
const CHEVRON_CLIP_FIRST = 'polygon(0 0, 82% 0, 100% 50%, 82% 100%, 0 100%)';
const CHEVRON_CLIP_NEXT = 'polygon(0 0, 82% 0, 100% 50%, 82% 100%, 0 100%, 18% 50%)';
const CHEVRON_COLORS = ['bg-indigo-500', 'bg-indigo-600', 'bg-indigo-700', 'bg-indigo-800', 'bg-indigo-900'];

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

  const [factoryResetInput, setFactoryResetInput] = useState('');
  const [factoryResetDialogOpen, setFactoryResetDialogOpen] = useState(false);
  const [isFactoryResetting, setIsFactoryResetting] = useState(false);
  const [factoryResetStatus, setFactoryResetStatus] = useState<ImportStatus | null>(null);

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

  const handleFactoryReset = async () => {
    setFactoryResetDialogOpen(false);
    setIsFactoryResetting(true);
    setFactoryResetStatus({ status: 'running', message: 'Đang trắng hóa toàn bộ hệ thống...' });
    try {
      const res = await fetch('/api/admin/factory-reset', { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Trắng hóa thất bại');
      setFactoryResetStatus({
        status: 'done',
        message: `Đã xóa sạch ${data.tablesCleared} bảng dữ liệu và ${data.accountsDeleted} tài khoản. Hệ thống sẽ đăng xuất sau vài giây — tạo lại tài khoản chủ cửa hàng ở màn hình đăng nhập.`,
      });
      setFactoryResetInput('');
      // Xóa cache phía trình duyệt (staffId, session Supabase cũ...) — không thì dù DB đã sạch,
      // trình duyệt vẫn có thể hiển thị nhầm dữ liệu cũ từ localStorage/sessionStorage.
      setTimeout(() => {
        try {
          localStorage.clear();
          sessionStorage.clear();
        } catch { /* Safari private mode có thể chặn — bỏ qua, không chặn redirect */ }
        window.location.href = '/login';
      }, 4000);
    } catch (err) {
      setFactoryResetStatus({
        status: 'error',
        message: err instanceof Error ? err.message : 'Lỗi không xác định',
      });
    } finally {
      setIsFactoryResetting(false);
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

  const importSteps: {
    key: string;
    label: string;
    desc: string;
    icon: typeof Package;
    status: ImportStatus | null;
    setStatus: (s: ImportStatus | null) => void;
    fileRef: React.RefObject<HTMLInputElement>;
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
    multiple?: boolean;
  }[] = [
    {
      key: 'products', label: 'Hàng hóa', desc: 'Sản phẩm, danh mục, tồn kho',
      icon: Package, status: productsStatus, setStatus: setProductsStatus,
      fileRef: productsFileRef, onChange: handleImportProducts,
    },
    {
      key: 'invoices', label: 'Hoá đơn', desc: 'Khách hàng, đơn hàng, doanh thu',
      icon: FileText, status: invoicesStatus, setStatus: setInvoicesStatus,
      fileRef: invoicesFileRef, onChange: handleImportInvoices, multiple: true,
    },
    {
      key: 'purchases', label: 'Phiếu nhập hàng', desc: 'Nhà cung cấp, công nợ NCC',
      icon: Truck, status: purchaseDetailsStatus, setStatus: setPurchaseDetailsStatus,
      fileRef: purchaseDetailsFileRef, onChange: handleImportPurchaseDetails,
    },
    {
      key: 'customers', label: 'Khách hàng', desc: 'Điểm, hạng, công nợ (sau bước Hoá đơn)',
      icon: Users, status: customersStatus, setStatus: setCustomersStatus,
      fileRef: customersFileRef, onChange: handleImportCustomers,
    },
    {
      key: 'suppliers', label: 'Nhà cung cấp', desc: 'Đối chiếu công nợ (sau bước Phiếu nhập)',
      icon: Building2, status: suppliersStatus, setStatus: setSuppliersStatus,
      fileRef: suppliersFileRef, onChange: handleImportSuppliers,
    },
  ];
  const activeImportStatuses = importSteps.filter(s => s.status);

  return (
    <div className="space-y-6">

      {/* Quy trình nhập dữ liệu — timeline mũi tên */}
      <section id="migration-import" className="rounded-2xl border border-slate-200 bg-white p-6">
        <h3 className="mb-1 text-sm font-semibold uppercase tracking-wide text-slate-800">
          Quy trình nhập dữ liệu từ KiotViet
        </h3>
        <p className="mb-5 text-xs font-normal text-slate-500">
          Có dữ liệu test cần dọn? Xóa ở khung "Xóa dữ liệu test" bên dưới trước khi bắt đầu.
        </p>

        <div className="flex">
          {importSteps.map((step, i) => (
            <div key={step.key} className={`flex-1 text-center ${i > 0 ? '-ml-4' : ''}`}>
              <step.icon className="mx-auto h-8 w-8 text-indigo-700" />
              <div
                className={`mt-2.5 flex h-16 items-center justify-center text-xs font-semibold uppercase tracking-wide text-white ${CHEVRON_COLORS[i]}`}
                style={{ clipPath: i === 0 ? CHEVRON_CLIP_FIRST : CHEVRON_CLIP_NEXT }}
              >
                Bước {i + 1}
              </div>
            </div>
          ))}
        </div>

        <div className="mt-3 flex">
          {importSteps.map(step => (
            <div key={step.key} className="flex-1 px-1.5 text-center">
              <p className="text-xs font-semibold text-slate-800">{step.label}</p>
              <p className="mt-0.5 text-2xs font-normal leading-snug text-slate-500">{step.desc}</p>
            </div>
          ))}
        </div>

        <div className="mt-3 flex">
          {importSteps.map(step => (
            <div key={step.key} className="flex-1 px-1.5">
              <button
                type="button"
                onClick={() => step.fileRef.current?.click()}
                disabled={step.status?.status === 'running'}
                className="mx-auto flex items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-white px-4 py-2 text-2xs font-normal uppercase tracking-wide text-slate-600 shadow-sm transition-colors hover:bg-slate-50 disabled:opacity-50"
              >
                {step.status?.status === 'running' ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : step.status?.status === 'done' ? (
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                ) : (
                  <Upload className="h-3.5 w-3.5" />
                )}
                {step.status?.status === 'running' ? 'Đang xử lý' : step.status?.status === 'done' ? 'Đã xong' : 'Chọn file'}
              </button>
              <input
                ref={step.fileRef}
                type="file"
                className="hidden"
                accept=".xlsx,.xls"
                multiple={step.multiple}
                onChange={step.onChange}
              />
            </div>
          ))}
        </div>

        {activeImportStatuses.length > 0 && (
          <div className="mt-3 space-y-2">
            {activeImportStatuses.map(step => (
              <StatusBanner
                key={step.key}
                status={{ ...step.status!, message: `${step.label}: ${step.status!.message}` }}
                onClose={() => step.setStatus(null)}
              />
            ))}
          </div>
        )}
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
        <div className="flex flex-wrap gap-3">
          {DELETE_DOMAINS.map(({ key, label, icon: Icon }) => (
            <label
              key={key}
              className="flex cursor-pointer items-center gap-2 rounded-xl border border-rose-100 bg-rose-50/40 px-4 py-2.5"
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

      {/* Trắng hóa toàn bộ hệ thống — bàn giao cho cửa hàng khác */}
      <section id="migration-factory-reset" className="rounded-2xl border-2 border-slate-900 bg-slate-900 p-6">
        <div className="mb-2 flex items-center gap-2">
          <Skull className="h-4 w-4 text-rose-400" />
          <h3 className="text-sm font-semibold uppercase tracking-wide text-rose-400">
            Trắng hóa toàn bộ hệ thống
          </h3>
        </div>
        <p className="mb-4 text-xs font-normal leading-relaxed text-slate-300">
          Dùng khi bàn giao app này cho <strong className="text-white">1 cửa hàng khác hoàn toàn</strong> —
          xóa sạch toàn bộ dữ liệu nghiệp vụ (hàng hóa, doanh thu, khách hàng, nhà cung cấp,
          nhân sự, lương, chi phí, bán online/Shopee), reset thương hiệu về mặc định, và
          xóa toàn bộ tài khoản đăng nhập. Sau khi xóa xong, hệ thống đăng xuất và yêu cầu
          tạo tài khoản chủ cửa hàng mới. <strong className="text-white">Không thể hoàn tác.</strong>
        </p>
        <p className="mb-4 text-xs font-normal leading-relaxed text-amber-300">
          Lưu ý: thao tác này chỉ xóa <strong>dữ liệu</strong>. File logo (<code className="text-amber-200">public/logo.png</code>,{' '}
          <code className="text-amber-200">favicon.png</code>) vẫn cần thay thủ công trước khi bàn giao —
          nút này không tự đổi được file ảnh vật lý trong code.
        </p>
        <label className="mb-2 block text-xs font-normal text-slate-300">
          Gõ chính xác <span className="font-semibold text-white">"{FACTORY_RESET_CONFIRM_PHRASE}"</span> để mở khóa nút xóa
        </label>
        <div className="flex flex-wrap items-center gap-3">
          <input
            type="text"
            value={factoryResetInput}
            onChange={e => setFactoryResetInput(e.target.value)}
            placeholder={FACTORY_RESET_CONFIRM_PHRASE}
            className="w-64 rounded-xl border border-slate-700 bg-slate-800 px-4 py-2 text-sm text-white outline-none placeholder:text-slate-500 focus:border-rose-500 focus:ring-2 focus:ring-rose-900"
          />
          <button
            type="button"
            onClick={() => setFactoryResetDialogOpen(true)}
            disabled={factoryResetInput !== FACTORY_RESET_CONFIRM_PHRASE || isFactoryResetting}
            className="flex items-center gap-1.5 rounded-xl bg-rose-600 px-4 py-2 text-xs font-normal uppercase tracking-wide text-white shadow-sm transition-colors hover:bg-rose-700 disabled:cursor-not-allowed disabled:opacity-30"
          >
            {isFactoryResetting ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Skull className="h-3.5 w-3.5" />
            )}
            Trắng hóa vĩnh viễn
          </button>
        </div>
        {factoryResetStatus && (
          <StatusBanner status={factoryResetStatus} onClose={() => setFactoryResetStatus(null)} />
        )}
      </section>

      <ConfirmDialog
        isOpen={factoryResetDialogOpen}
        variant="danger"
        title="Xác nhận trắng hóa toàn bộ hệ thống"
        message="Toàn bộ dữ liệu nghiệp vụ, cấu hình và tài khoản đăng nhập sẽ bị xóa vĩnh viễn — kể cả tài khoản bạn đang dùng. Hành động này KHÔNG thể hoàn tác. Bạn có chắc chắn muốn tiếp tục?"
        confirmLabel="Trắng hóa vĩnh viễn"
        cancelLabel="Hủy"
        onConfirm={handleFactoryReset}
        onCancel={() => setFactoryResetDialogOpen(false)}
      />
    </div>
  );
};

export default MigrationTab;
