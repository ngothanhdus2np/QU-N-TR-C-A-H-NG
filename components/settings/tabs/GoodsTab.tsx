import React, { useEffect, useMemo, useState } from 'react';
import { ChevronRight, Database, Package, ServerCog } from 'lucide-react';
import { INVENTORY_COST_METHOD_STORAGE_KEY, InventoryCostMethod } from '../../../src/lib';
import type { AlertConfig, POSInventorySettings, POSProduct } from '../../../types';

interface GoodsTabProps {
  products: POSProduct[];
  alertConfig: AlertConfig;
  inventorySettings: POSInventorySettings;
  onUpdateInventorySettings: (settings: POSInventorySettings) => Promise<void>;
  onNavigate: (id: string) => void;
  onSetActiveTab: (tab: string) => void;
}

type GoodsDetailView = 'units' | 'attributes' | 'categories' | 'brands' | 'locations';

const Chip: React.FC<{ label: string }> = ({ label }) => (
  <span className="inline-flex items-center rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs text-slate-700">
    {label}
  </span>
);

const DetailEmptyState = () => (
  <p className="py-6 text-center text-sm text-slate-400">Chưa có dữ liệu.</p>
);

const GOODS_BARCODE_MANUAL_MODE_STORAGE_KEY = 'goods_barcode_manual_mode';

const Section: React.FC<{
  id?: string;
  title: string;
  description?: string;
  icon: React.ElementType;
  children: React.ReactNode;
}> = ({ id, title, description, icon: Icon, children }) => (
  <section
    id={id}
    className="scroll-mt-6 bg-white border border-slate-100 rounded-xl shadow-sm overflow-hidden"
  >
    <div className="min-h-[88px] px-5 py-4 border-b border-slate-100 bg-slate-50/60 flex items-start gap-3">
      <div className="h-9 w-9 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
        <Icon className="h-4 w-4" />
      </div>
      <div className="min-w-0">
        <h3 className="text-sm font-bold text-slate-900">{title}</h3>
        {description && (
          <p className="min-h-10 text-xs text-slate-500 mt-1 leading-relaxed">{description}</p>
        )}
      </div>
    </div>
    <div className="p-5">{children}</div>
  </section>
);

const SettingLine: React.FC<{
  title: string;
  description: string;
  value?: string;
  children?: React.ReactNode;
  onClick?: () => void;
}> = ({ title, description, value, children, onClick }) => (
  <button
    type="button"
    onClick={onClick}
    className={`w-full px-5 py-4 text-left border-b border-slate-100 last:border-b-0 flex items-center justify-between gap-4 ${onClick ? 'hover:bg-slate-50' : 'cursor-default'}`}
  >
    <span className="min-w-0">
      <span className="block text-sm font-normal text-slate-900">{title}</span>
      <span className="block text-xs text-slate-500 mt-1 leading-relaxed">{description}</span>
    </span>
    <span className="shrink-0 text-sm font-normal text-slate-700">{children || value}</span>
  </button>
);

const TogglePill: React.FC<{ enabled: boolean }> = ({ enabled }) => (
  <span
    className={`relative inline-flex h-6 w-11 rounded-full transition-colors ${enabled ? 'bg-blue-600' : 'bg-slate-300'}`}
  >
    <span
      className={`absolute top-1 h-4 w-4 rounded-full bg-white transition-transform ${enabled ? 'translate-x-6' : 'translate-x-1'}`}
    />
  </span>
);

const GoodsOverviewLine: React.FC<{
  title: string;
  description: string;
  countLabel: string;
  onOpen: () => void;
}> = ({ title, description, countLabel, onOpen }) => (
  <div className="w-full border-b border-slate-100 px-5 py-4 last:border-b-0">
    <div className="grid gap-4 lg:grid-cols-[minmax(180px,1fr)_auto] lg:items-center">
      <span className="min-w-0">
        <span className="block text-sm font-normal text-slate-900">{title}</span>
        <span className="mt-1 block text-xs leading-relaxed text-slate-500">{description}</span>
        <span className="mt-2 block text-xs font-normal text-slate-400">{countLabel}</span>
      </span>
      <button
        type="button"
        onClick={onOpen}
        className="inline-flex h-9 items-center justify-center gap-2 rounded border border-slate-200 bg-white px-3 text-xs font-normal text-slate-700 transition-colors hover:border-indigo-200 hover:bg-indigo-50 hover:text-indigo-700"
      >
        Xem chi tiết
        <ChevronRight className="h-3.5 w-3.5" />
      </button>
    </div>
  </div>
);

const GoodsTab: React.FC<GoodsTabProps> = ({
  products,
  alertConfig,
  inventorySettings,
  onUpdateInventorySettings,
  onNavigate,
  onSetActiveTab,
}) => {
  const [goodsDetailView, setGoodsDetailView] = useState<GoodsDetailView | null>(null);
  const [goodsBarcodeManualMode, setGoodsBarcodeManualMode] = useState(() => {
    try {
      return localStorage.getItem(GOODS_BARCODE_MANUAL_MODE_STORAGE_KEY) === 'true';
    } catch {
      return false;
    }
  });
  const [costMethod, setCostMethod] = useState<InventoryCostMethod>(() => {
    try {
      const saved = localStorage.getItem(INVENTORY_COST_METHOD_STORAGE_KEY);
      return saved === 'fixed' || saved === 'average' ? saved : 'fixed';
    } catch {
      return 'fixed';
    }
  });
  const [inventoryForm, setInventoryForm] = useState<POSInventorySettings>(inventorySettings);
  const [inventorySaveStatus, setInventorySaveStatus] = useState<
    'idle' | 'saving' | 'saved' | 'error'
  >('idle');

  const [goodsCounts, setGoodsCounts] = useState({
    units: 0,
    categories: 0,
    brands: 0,
    locations: 0,
    attributes: 0,
  });
  const [countsReady, setCountsReady] = useState(false);

  // Compute counts off the render thread — runs during browser idle time
  useEffect(() => {
    setCountsReady(false);
    const compute = () => {
      const units = new Set<string>();
      const categories = new Set<string>();
      const brands = new Set<string>();
      const locations = new Set<string>();
      const attributeNames = new Set<string>();
      for (const p of products) {
        const u = p.unit?.trim();
        if (u) units.add(u);
        (p.units || []).forEach(pu => {
          const n = pu.name?.trim();
          if (n) units.add(n);
        });
        const cat = String(p.categoryPath || p.categoryId || '').trim();
        if (cat) categories.add(cat);
        const br = p.brand?.trim();
        if (br) brands.add(br);
        const loc = p.location?.trim();
        if (loc) locations.add(loc);
        (p.attributes || []).forEach(a => {
          const n = String(a.name || '').trim();
          if (n) attributeNames.add(n);
        });
        Object.keys(p.variantAttributes || {}).forEach(k => {
          const n = k.trim();
          if (n) attributeNames.add(n);
        });
      }
      setGoodsCounts({
        units: units.size,
        categories: categories.size,
        brands: brands.size,
        locations: locations.size,
        attributes: attributeNames.size,
      });
      setCountsReady(true);
    };
    if (typeof requestIdleCallback !== 'undefined') {
      const id = requestIdleCallback(compute);
      return () => cancelIdleCallback(id);
    }
    const id = setTimeout(compute, 0);
    return () => clearTimeout(id);
  }, [products]);

  // Full sorted detail — only computed when user opens a detail view
  const goodsDetail = useMemo(() => {
    if (!goodsDetailView) return null;

    const collect = (values: Array<string | undefined | null>) =>
      Array.from(new Set(values.map(v => String(v || '').trim()).filter(Boolean))).sort((a, b) =>
        a.localeCompare(b, 'vi', { numeric: true })
      );

    const units = collect([
      ...products.map(p => p.unit),
      ...products.flatMap(p => (p.units || []).map(u => u.name)),
    ]);
    const categoryValues = collect(products.map(p => p.categoryPath || p.categoryId));
    const brands = collect(products.map(p => p.brand));
    const locations = collect(products.map(p => p.location));

    const attributeMap = new Map<string, Set<string>>();
    products.forEach(p => {
      (p.attributes || []).forEach(a => {
        const name = String(a.name || '').trim();
        if (!name) return;
        if (!attributeMap.has(name)) attributeMap.set(name, new Set());
        a.values?.forEach(v => {
          const cv = String(v || '').trim();
          if (cv) attributeMap.get(name)!.add(cv);
        });
      });
      Object.entries(p.variantAttributes || {}).forEach(([name, value]) => {
        const n = String(name || '').trim();
        const v = String(value || '').trim();
        if (!n || !v) return;
        if (!attributeMap.has(n)) attributeMap.set(n, new Set());
        attributeMap.get(n)!.add(v);
      });
    });

    const attributes = Array.from(attributeMap.entries())
      .map(([name, values]) => ({
        name,
        values: Array.from(values).sort((a, b) => a.localeCompare(b, 'vi', { numeric: true })),
      }))
      .sort((a, b) => a.name.localeCompare(b.name, 'vi', { numeric: true }));

    return { units, categoryValues, brands, locations, attributes };
  }, [goodsDetailView, products]);

  const toggleAllowSellOutOfStock = async () => {
    const nextSettings = {
      ...inventoryForm,
      allowSellOutOfStock: !inventoryForm.allowSellOutOfStock,
    };
    setInventoryForm(nextSettings);
    setInventorySaveStatus('saving');
    try {
      await onUpdateInventorySettings(nextSettings);
      setInventorySaveStatus('saved');
      setTimeout(() => setInventorySaveStatus('idle'), 2000);
    } catch {
      setInventorySaveStatus('error');
      setTimeout(() => setInventorySaveStatus('idle'), 2500);
    }
  };

  const navigateAndClose = (id: string) => {
    onNavigate(id);
  };

  if (goodsDetailView) {
    const detailTitles: Record<GoodsDetailView, string> = {
      units: 'Đơn vị tính',
      attributes: 'Thuộc tính',
      categories: 'Nhóm hàng',
      brands: 'Thương hiệu',
      locations: 'Vị trí',
    };

    const simpleItems =
      goodsDetailView === 'units'
        ? goodsDetail?.units
        : goodsDetailView === 'categories'
          ? goodsDetail?.categoryValues
          : goodsDetailView === 'brands'
            ? goodsDetail?.brands
            : goodsDetailView === 'locations'
              ? goodsDetail?.locations
              : null;

    return (
      <div className="space-y-4">
        <button
          type="button"
          onClick={() => setGoodsDetailView(null)}
          className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800 transition-colors"
        >
          ← Quay lại tổng quan
        </button>
        <Section title={detailTitles[goodsDetailView]} icon={Package}>
          {goodsDetailView === 'attributes' ? (
            !goodsDetail || goodsDetail.attributes.length === 0 ? (
              <DetailEmptyState />
            ) : (
              <div className="space-y-5">
                {goodsDetail.attributes.map(attr => (
                  <div key={attr.name}>
                    <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                      {attr.name}
                      <span className="ml-1.5 font-normal normal-case text-slate-400">
                        ({attr.values.length} giá trị)
                      </span>
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {attr.values.map(v => (
                        <Chip key={v} label={v} />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )
          ) : simpleItems && simpleItems.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {simpleItems.map(item => (
                <Chip key={item} label={item} />
              ))}
            </div>
          ) : (
            <DetailEmptyState />
          )}
        </Section>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <Section
        id="goods-info"
        title="Thông tin hàng hóa"
        description="Các thiết lập nền cho danh mục sản phẩm, biến thể và mã hàng."
        icon={Package}
      >
        <div className="flex items-center justify-between gap-4 border-b border-slate-100 px-5 py-4">
          <span className="min-w-0">
            <span className="block text-sm font-normal text-slate-900">Mã vạch hàng hóa</span>
            <span className="mt-1 block text-xs leading-relaxed text-slate-500">
              {goodsBarcodeManualMode
                ? 'Bật: khi thêm hàng, mã vạch để trống để nhập tay hoặc quét mã có sẵn.'
                : 'Tắt: khi thêm hàng, dòng mã vạch hiển thị Tự động và không yêu cầu nhập.'}
            </span>
          </span>
          <button
            type="button"
            onClick={() => {
              const newValue = !goodsBarcodeManualMode;
              setGoodsBarcodeManualMode(newValue);
              try {
                localStorage.setItem(GOODS_BARCODE_MANUAL_MODE_STORAGE_KEY, String(newValue));
              } catch {
                // Ignore localStorage errors
              }
            }}
            className={`inline-flex h-10 shrink-0 items-center gap-2 rounded-xl px-1 text-sm font-normal transition-colors ${
              goodsBarcodeManualMode ? 'text-blue-700' : 'text-slate-600'
            }`}
            aria-pressed={goodsBarcodeManualMode}
            aria-label="Bật tắt nhập mã vạch hàng hóa"
          >
            <span>{goodsBarcodeManualMode ? 'Bật' : 'Tắt'}</span>
            <span
              className={`relative inline-flex h-5 w-9 rounded transition-colors ${
                goodsBarcodeManualMode ? 'bg-blue-600' : 'bg-slate-300'
              }`}
            >
              <span
                className={`absolute top-0.5 h-4 w-4 rounded bg-white transition-transform ${
                  goodsBarcodeManualMode ? 'translate-x-4' : 'translate-x-0.5'
                }`}
              />
            </span>
          </button>
        </div>
        <GoodsOverviewLine
          title="Đơn vị tính"
          description="Tất cả đơn vị đang dùng trong hàng hóa và quy đổi."
          countLabel={countsReady ? `Có ${goodsCounts.units} đơn vị tính` : 'Đang tính...'}
          onOpen={() => setGoodsDetailView('units')}
        />
        <GoodsOverviewLine
          title="Thuộc tính"
          description="Các nhóm thuộc tính biến thể đang có trong danh mục."
          countLabel={countsReady ? `Có ${goodsCounts.attributes} nhóm thuộc tính` : 'Đang tính...'}
          onOpen={() => setGoodsDetailView('attributes')}
        />
        <GoodsOverviewLine
          title="Nhóm hàng"
          description="Các nhóm hàng đang được gán cho sản phẩm."
          countLabel={countsReady ? `Có ${goodsCounts.categories} nhóm hàng` : 'Đang tính...'}
          onOpen={() => setGoodsDetailView('categories')}
        />
        <GoodsOverviewLine
          title="Thương hiệu"
          description="Các thương hiệu đang xuất hiện trong danh sách hàng hóa."
          countLabel={countsReady ? `Có ${goodsCounts.brands} thương hiệu` : 'Đang tính...'}
          onOpen={() => setGoodsDetailView('brands')}
        />
        <GoodsOverviewLine
          title="Vị trí"
          description="Các vị trí bán hàng hoặc lưu trữ đang được dùng."
          countLabel={countsReady ? `Có ${goodsCounts.locations} vị trí` : 'Đang tính...'}
          onOpen={() => setGoodsDetailView('locations')}
        />
      </Section>

      <Section
        id="goods-stock"
        title="Giá vốn, tồn kho"
        description="Các quy tắc liên quan đến tồn kho và giá vốn hàng hóa."
        icon={Database}
      >
        <div className="space-y-4">
          <div className="pb-4 border-b border-slate-100">
            <h4 className="text-sm font-semibold text-slate-900 mb-3">Phương pháp tính giá vốn</h4>

            {/* Giá vốn cố định */}
            <label className="flex items-start gap-3 p-4 rounded-xl border border-slate-200 hover:border-blue-300 hover:bg-blue-50/30 cursor-pointer transition-all mb-3">
              <input
                type="radio"
                name="costMethod"
                value="fixed"
                checked={costMethod === 'fixed'}
                onChange={e => {
                  const newValue = e.target.value as InventoryCostMethod;
                  setCostMethod(newValue);
                  try {
                    localStorage.setItem(INVENTORY_COST_METHOD_STORAGE_KEY, newValue);
                  } catch {
                    // Ignore localStorage errors
                  }
                }}
                className="mt-0.5 h-5 w-5 text-blue-600 border-slate-300 focus:ring-blue-500"
              />
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-slate-900 mb-1">Giá vốn cố định</div>
                <div className="text-xs text-slate-500 leading-relaxed">
                  Giá vốn được xác định theo{' '}
                  <span className="font-medium text-slate-700">giá nhập đầu tiên</span> hoặc do
                  người dùng tự nhập.
                </div>
              </div>
            </label>

            {/* Giá vốn trung bình */}
            <label className="flex items-start gap-3 p-4 rounded-xl border border-slate-200 hover:border-blue-300 hover:bg-blue-50/30 cursor-pointer transition-all">
              <input
                type="radio"
                name="costMethod"
                value="average"
                checked={costMethod === 'average'}
                onChange={e => {
                  const newValue = e.target.value as InventoryCostMethod;
                  setCostMethod(newValue);
                  try {
                    localStorage.setItem(INVENTORY_COST_METHOD_STORAGE_KEY, newValue);
                  } catch {
                    // Ignore localStorage errors
                  }
                }}
                className="mt-0.5 h-5 w-5 text-blue-600 border-slate-300 focus:ring-blue-500"
              />
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-slate-900 mb-1">Giá vốn trung bình</div>
                <div className="text-xs text-slate-500 leading-relaxed">
                  Giá vốn được tính theo phương pháp trung bình dựa trên giao dịch nhập hàng và trả
                  hàng nhập.
                </div>
              </div>
            </label>
          </div>

          <SettingLine
            title="Ngưỡng tồn kho thấp"
            description="Thiết lập cảnh báo mặc định cho sản phẩm chưa có ngưỡng riêng."
            value={`${alertConfig.defaultMinStock} sản phẩm`}
            onClick={() => onSetActiveTab('notifications')}
          />
        </div>
      </Section>

      <Section
        id="goods-other"
        title="Khác"
        description="Các quy tắc vận hành hàng hóa có thể bổ sung sau."
        icon={ServerCog}
      >
        <SettingLine
          title="Cho phép bán hàng khi hết tồn kho"
          description="Khi bật, POS vẫn cho tạo đơn bán hoặc hàng đổi dù tồn kho không đủ; tồn kho sau giao dịch có thể âm."
          onClick={toggleAllowSellOutOfStock}
        >
          <span className="inline-flex items-center gap-3">
            <span
              className={`text-xs ${inventoryForm.allowSellOutOfStock ? 'text-blue-600' : 'text-slate-500'}`}
            >
              {inventorySaveStatus === 'saving'
                ? 'Đang lưu'
                : inventorySaveStatus === 'error'
                  ? 'Lỗi lưu'
                  : inventoryForm.allowSellOutOfStock
                    ? 'Đang bật'
                    : 'Đang khóa'}
            </span>
            <TogglePill enabled={inventoryForm.allowSellOutOfStock} />
          </span>
        </SettingLine>
      </Section>
    </div>
  );
};

export default React.memo(GoodsTab);
