import React from 'react';
import {
  Calendar,
  ChevronRight,
  Download,
  HelpCircle,
  Inbox,
  LayoutList,
  Search,
  Settings,
  SlidersHorizontal,
  X,
} from 'lucide-react';
import { POSProduct } from '../../types';
import { exportToExcel } from '../../services/exportService';
import { FilterDateRange } from '../shared';

type DateFilter = 'this_month' | 'all' | 'custom';
type WarrantyStatusFilter = 'active' | 'missing' | 'all';
type MaintenanceFilter = 'all' | 'configured' | 'missing' | 'custom';

type GoodsWarrantyMaintenancePageProps = {
  products: POSProduct[];
};

const formatDate = (value?: string) => {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString('vi-VN');
};

const normalizeText = (value?: string) => (value || '').toLowerCase().trim();

const toDateString = (date: Date) => date.toLocaleDateString('sv-SE');

const getThisMonthRange = () => {
  const now = new Date();
  return {
    start: toDateString(new Date(now.getFullYear(), now.getMonth(), 1)),
    end: toDateString(now),
  };
};

export const GoodsWarrantyMaintenancePage: React.FC<GoodsWarrantyMaintenancePageProps> = ({
  products,
}) => {
  const [searchTerm, setSearchTerm] = React.useState('');
  const [purchaseDateRange, setPurchaseDateRange] = React.useState(getThisMonthRange);
  const [warrantyStatus, setWarrantyStatus] = React.useState<WarrantyStatusFilter>('active');
  const [warrantyExpiryFilter, setWarrantyExpiryFilter] = React.useState<DateFilter>('all');
  const [maintenanceFilter, setMaintenanceFilter] = React.useState<MaintenanceFilter>('all');
  const [showInfo, setShowInfo] = React.useState(false);

  const rows = React.useMemo(() => products.filter(product => !product.isParent), [products]);

  const filteredRows = React.useMemo(() => {
    const query = normalizeText(searchTerm);

    return rows.filter(product => {
      const matchesSearch =
        !query ||
        normalizeText(product.sku).includes(query) ||
        normalizeText(product.name).includes(query) ||
        normalizeText(product.barcode).includes(query);

      const hasWarranty = Boolean(product.warranty?.trim());
      const hasMaintenance = Boolean(product.periodicMaintenance?.trim());
      const createdDate = product.createdAt?.slice(0, 10) || '';
      const matchesDate =
        (!purchaseDateRange.start || createdDate >= purchaseDateRange.start) &&
        (!purchaseDateRange.end || createdDate <= purchaseDateRange.end);
      const matchesWarranty =
        warrantyStatus === 'all' ||
        (warrantyStatus === 'active' && hasWarranty) ||
        (warrantyStatus === 'missing' && !hasWarranty);
      const matchesMaintenance =
        maintenanceFilter === 'all' ||
        maintenanceFilter === 'custom' ||
        (maintenanceFilter === 'configured' && hasMaintenance) ||
        (maintenanceFilter === 'missing' && !hasMaintenance);

      return matchesSearch && matchesDate && matchesWarranty && matchesMaintenance;
    });
  }, [maintenanceFilter, purchaseDateRange.end, purchaseDateRange.start, rows, searchTerm, warrantyStatus]);

  const defaultPurchaseRange = React.useMemo(() => getThisMonthRange(), []);

  const hasActiveFilters =
    searchTerm ||
    purchaseDateRange.start !== defaultPurchaseRange.start ||
    purchaseDateRange.end !== defaultPurchaseRange.end ||
    warrantyStatus !== 'active' ||
    warrantyExpiryFilter !== 'all' ||
    maintenanceFilter !== 'all';

  const resetFilters = () => {
    setSearchTerm('');
    setPurchaseDateRange(defaultPurchaseRange);
    setWarrantyStatus('active');
    setWarrantyExpiryFilter('all');
    setMaintenanceFilter('all');
  };

  const exportRows = () => {
    exportToExcel(
      filteredRows.map(product => ({
        'Mã hàng': product.sku,
        'Tên hàng': product.name,
        'Serial/IMEI/Biển số': product.barcode || '',
        'Hóa đơn mua': '',
        'Khách hàng': '',
        'Bảo hành tối đa': product.warranty || '',
        'Bảo trì định kỳ': product.periodicMaintenance || '',
        'Ngày tạo': formatDate(product.createdAt),
      })),
      'BaoHanhBaoTri'
    );
  };

  const RadioRow = ({
    checked,
    label,
    rightIcon,
    onClick,
  }: {
    checked: boolean;
    label: string;
    rightIcon?: React.ReactNode;
    onClick: () => void;
  }) => (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center gap-3 text-left text-sm text-slate-700"
    >
      <span
        className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full border ${
          checked ? 'border-indigo-600' : 'border-slate-300'
        }`}
      >
        {checked && <span className="h-2 w-2 rounded-full bg-indigo-600" />}
      </span>
      <span className="flex min-h-10 flex-1 items-center justify-between rounded-xl border border-slate-200 bg-white px-3">
        <span>{label}</span>
        {rightIcon}
      </span>
    </button>
  );

  return (
    <div className="flex h-full min-h-0 gap-4">
      <aside className="flex h-full min-h-0 w-64 shrink-0 flex-col overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm">
        <div className="flex min-h-[58px] flex-col justify-center border-b border-slate-100 px-4">
          <h2 className="text-sm font-semibold uppercase tracking-widest text-slate-900">
            Bảo hành, bảo trì
          </h2>
          <p className="text-2xs uppercase tracking-wide text-slate-400">Hàng hóa</p>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto">
          <div className="border-b border-slate-100 p-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-900">Bộ lọc</h3>
              {hasActiveFilters && (
                <button
                  type="button"
                  onClick={resetFilters}
                  className="text-2xs font-bold uppercase tracking-wide text-indigo-600 hover:text-indigo-700"
                >
                  Xóa lọc
                </button>
              )}
            </div>
          </div>
          <div className="space-y-6 p-4">
              <section className="space-y-3">
                <h3 className="text-sm font-bold text-slate-900">Thời gian mua hàng</h3>
                <FilterDateRange
                  startDate={purchaseDateRange.start}
                  endDate={purchaseDateRange.end}
                  onStartDateChange={date => setPurchaseDateRange(prev => ({ ...prev, start: date }))}
                  onEndDateChange={date => setPurchaseDateRange(prev => ({ ...prev, end: date }))}
                />
              </section>

              <section className="space-y-3">
                <h3 className="text-sm font-bold text-slate-900">Trạng thái bảo hành</h3>
                <select
                  value={warrantyStatus}
                  onChange={event => setWarrantyStatus(event.target.value as WarrantyStatusFilter)}
                  className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none transition-colors focus:border-indigo-500"
                >
                  <option value="active">Còn hạn</option>
                  <option value="missing">Chưa cấu hình</option>
                  <option value="all">Tất cả</option>
                </select>
              </section>

              <section className="space-y-3">
                <h3 className="text-sm font-bold text-slate-900">Hết hạn bảo hành</h3>
                <RadioRow
                  checked={warrantyExpiryFilter === 'all'}
                  label="Toàn thời gian"
                  rightIcon={<ChevronRight className="h-4 w-4 text-slate-400" />}
                  onClick={() => setWarrantyExpiryFilter('all')}
                />
                <RadioRow
                  checked={warrantyExpiryFilter === 'custom'}
                  label="Tùy chỉnh"
                  rightIcon={<Calendar className="h-4 w-4 text-slate-400" />}
                  onClick={() => setWarrantyExpiryFilter('custom')}
                />
              </section>

              <section className="space-y-3">
                <h3 className="text-sm font-bold text-slate-900">Lịch bảo trì</h3>
                <RadioRow
                  checked={maintenanceFilter === 'all'}
                  label="Toàn thời gian"
                  onClick={() => setMaintenanceFilter('all')}
                />
                <RadioRow
                  checked={maintenanceFilter === 'custom'}
                  label="Tùy chỉnh"
                  rightIcon={<Calendar className="h-4 w-4 text-slate-400" />}
                  onClick={() => setMaintenanceFilter('custom')}
                />
                <button
                  type="button"
                  onClick={() => setMaintenanceFilter('configured')}
                  className={`w-full rounded-xl border px-3 py-2 text-left text-sm transition-colors ${
                    maintenanceFilter === 'configured'
                      ? 'border-indigo-200 bg-indigo-50 text-indigo-700'
                      : 'border-slate-200 bg-white text-slate-600 hover:border-indigo-200'
                  }`}
                >
                  Có lịch bảo trì
                </button>
              </section>
            <button
              type="button"
              onClick={exportRows}
              className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 shadow-sm transition-colors hover:border-indigo-200 hover:text-indigo-600"
            >
              <Download className="h-4 w-4" />
              Xuất file
            </button>
          </div>
        </div>
      </aside>

        <main className="flex min-w-0 flex-1 flex-col overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm">
          <div className="flex min-h-[60px] shrink-0 flex-wrap items-center gap-3 border-b border-slate-100 px-4">
            <div className="min-w-[260px] max-w-xl flex-1">
              <div className="flex h-10 items-center rounded-xl border border-slate-200 bg-white px-3 transition-colors focus-within:border-indigo-500">
                <Search className="mr-2 h-4 w-4 shrink-0 text-slate-400" />
                <input
                  value={searchTerm}
                  onChange={event => setSearchTerm(event.target.value)}
                  placeholder="Theo mã hàng, tên hàng hoặc serial"
                  className="min-w-0 flex-1 border-none bg-transparent text-sm text-slate-800 outline-none placeholder:text-slate-400"
                />
                {searchTerm && (
                  <button
                    type="button"
                    onClick={() => setSearchTerm('')}
                    className="ml-2 rounded-lg p-1 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
                    aria-label="Xóa tìm kiếm"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
                <SlidersHorizontal className="ml-2 h-4 w-4 text-slate-400" />
              </div>
            </div>
            <div className="ml-auto flex items-center gap-2">
              <button
                type="button"
                className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 text-slate-500 transition-colors hover:border-indigo-200 hover:text-indigo-600"
                title="Chế độ hiển thị"
              >
                <LayoutList className="h-4 w-4" />
              </button>
              <button
                type="button"
                className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 text-slate-500 transition-colors hover:border-indigo-200 hover:text-indigo-600"
                title="Cài đặt cột"
              >
                <Settings className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => setShowInfo(true)}
                className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 text-slate-500 transition-colors hover:border-indigo-200 hover:text-indigo-600"
                title="Thông tin"
              >
                <HelpCircle className="h-4 w-4" />
              </button>
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-auto">
            <table className="w-full min-w-[980px] text-sm">
              <thead className="sticky top-0 z-10 bg-indigo-50">
                <tr className="border-b border-indigo-100 text-left text-xs text-slate-700">
                  <th className="px-4 py-3 font-bold">Mã hàng</th>
                  <th className="px-4 py-3 font-bold">Tên hàng</th>
                  <th className="px-4 py-3 font-bold">Serial/IMEI/Biển số</th>
                  <th className="px-4 py-3 font-bold">Hóa đơn mua</th>
                  <th className="px-4 py-3 font-bold">Khách hàng</th>
                  <th className="px-4 py-3 font-bold">Bảo hành tối đa</th>
                  <th className="px-4 py-3 font-bold">Bảo trì định kỳ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredRows.map(product => (
                  <tr key={product.id} className="text-slate-700 hover:bg-slate-50">
                    <td className="whitespace-nowrap px-4 py-3 text-slate-900">{product.sku}</td>
                    <td className="min-w-[260px] px-4 py-3">{product.name}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-slate-500">
                      {product.barcode || '—'}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-slate-400">—</td>
                    <td className="whitespace-nowrap px-4 py-3 text-slate-400">—</td>
                    <td className="whitespace-nowrap px-4 py-3 text-slate-600">
                      {product.warranty || <span className="text-slate-300">—</span>}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-slate-600">
                      {product.periodicMaintenance || <span className="text-slate-300">—</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {filteredRows.length === 0 && (
              <div className="flex min-h-[520px] flex-col items-center justify-center px-6 text-center">
                <div className="mb-5 flex h-24 w-24 items-center justify-center rounded-full bg-indigo-50">
                  <div className="flex h-16 w-16 items-center justify-center rounded-full bg-indigo-100 text-indigo-600">
                    <Inbox className="h-9 w-9" />
                  </div>
                </div>
                <h3 className="text-lg font-bold text-slate-900">Không tìm thấy kết quả</h3>
                <p className="mt-2 max-w-md text-sm text-slate-500">
                  Không tìm thấy giao dịch nào phù hợp trong bộ lọc hiện tại.
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setPurchaseDateRange({ start: '', end: '' });
                    setWarrantyStatus('all');
                  }}
                  className="mt-2 text-sm text-indigo-600 hover:text-indigo-700"
                >
                  Tìm kiếm trên toàn thời gian
                </button>
              </div>
            )}
          </div>
        </main>

      {showInfo && (
        <div className="fixed inset-0 z-modal flex items-center justify-center bg-slate-950/40 p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
              <h2 className="text-lg font-bold text-slate-900">Bảo hành, bảo trì</h2>
              <button
                type="button"
                onClick={() => setShowInfo(false)}
                className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
                aria-label="Đóng thông tin"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="space-y-4 px-5 py-4 text-sm text-slate-600">
              <section>
                <h3 className="mb-1 font-bold text-slate-900">Dùng để làm gì</h3>
                <p>
                  Theo dõi hàng hóa có chính sách bảo hành hoặc lịch bảo trì để nhân viên dễ tra cứu
                  khi hỗ trợ khách.
                </p>
              </section>
              <section>
                <h3 className="mb-1 font-bold text-slate-900">Thao tác chính</h3>
                <p>
                  Lọc theo thời gian, trạng thái bảo hành, lịch bảo trì; tìm nhanh theo mã hàng, tên
                  hàng hoặc serial; xuất danh sách đang lọc ra Excel.
                </p>
              </section>
              <section>
                <h3 className="mb-1 font-bold text-slate-900">Lưu ý nghiệp vụ</h3>
                <p>
                  Màn hình hiện dùng thông tin bảo hành/bảo trì đã khai báo trên hàng hóa. Chưa ghi
                  nhận lịch sử phiếu bảo hành riêng hoặc cập nhật tồn kho.
                </p>
              </section>
            </div>
            <div className="flex justify-end border-t border-slate-100 px-5 py-4">
              <button
                type="button"
                onClick={() => setShowInfo(false)}
                className="rounded-xl bg-indigo-600 px-4 py-2 text-sm text-white transition-colors hover:bg-indigo-700"
              >
                Đã hiểu
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
