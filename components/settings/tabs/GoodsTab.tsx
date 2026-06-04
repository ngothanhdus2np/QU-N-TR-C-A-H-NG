import React, { useEffect, useMemo, useState } from 'react';
import { ChevronDown, ChevronRight, Database, Package, Pencil, ServerCog, X } from 'lucide-react';
import { INVENTORY_COST_METHOD_STORAGE_KEY, InventoryCostMethod } from '../../../src/lib';
import type { AlertConfig, POSInventorySettings, POSProduct } from '../../../types';

interface GoodsTabProps {
  products: POSProduct[];
  alertConfig: AlertConfig;
  inventorySettings: POSInventorySettings;
  onUpdateInventorySettings: (settings: POSInventorySettings) => Promise<void>;
  onNavigate: (id: string) => void;
  onSetActiveTab: (tab: string) => void;
  onRefresh?: () => void;
}

type GoodsDetailView = 'units' | 'attributes' | 'categories' | 'brands' | 'locations';

type CategoryRecord = { path: string; location?: string };
type CatNode = {
  name: string;
  path: string;
  count: number;
  location?: string;
  children: CatNode[];
};

const isChildCategoryPath = (path: string) => path.includes(' >> ');

const Chip: React.FC<{ label: string }> = ({ label }) => (
  <span className="inline-flex items-center rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs text-slate-700">
    {label}
  </span>
);

const DetailEmptyState = () => (
  <p className="py-6 text-center text-sm text-slate-400">Chưa có dữ liệu.</p>
);

const CategoryTreeView: React.FC<{ nodes: CatNode[]; onEdit: (node: CatNode) => void }> = ({
  nodes,
  onEdit,
}) => {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const toggle = (path: string) =>
    setExpanded(prev => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });

  const renderNode = (node: CatNode, depth: number): React.ReactNode => {
    const hasChildren = node.children.length > 0;
    const isExpanded = expanded.has(node.path);
    const canHaveLocation = isChildCategoryPath(node.path);
    return (
      <div key={node.path}>
        <div
          className="grid grid-cols-[minmax(0,1fr)_minmax(110px,180px)_72px_32px] items-center rounded-lg transition-colors hover:bg-slate-50 group"
          style={{ paddingRight: 4 }}
        >
          <button
            type="button"
            onClick={() => hasChildren && toggle(node.path)}
            className={`flex items-center gap-2 py-2.5 text-left text-sm min-w-0 ${hasChildren ? 'cursor-pointer' : 'cursor-default'}`}
            style={{ paddingLeft: `${12 + depth * 20}px` }}
          >
            <span className="w-4 shrink-0 flex items-center justify-center text-slate-400">
              {hasChildren ? (
                isExpanded ? (
                  <ChevronDown className="h-3.5 w-3.5" />
                ) : (
                  <ChevronRight className="h-3.5 w-3.5" />
                )
              ) : (
                <span className="h-1.5 w-1.5 rounded-full bg-slate-300 mx-auto" />
              )}
            </span>
            <span
              className={`flex-1 min-w-0 truncate ${depth === 0 ? 'font-medium text-slate-800' : depth === 1 ? 'text-slate-700' : 'text-slate-600'}`}
            >
              {node.name}
            </span>
          </button>
          <span className="min-w-0 truncate px-2 text-xs text-slate-500">
            {canHaveLocation ? node.location?.trim() || 'Chưa gắn' : '-'}
          </span>
          <span className="shrink-0 text-right text-xs text-slate-400 mr-1">{node.count} SP</span>
          <button
            type="button"
            onClick={() => onEdit(node)}
            className="shrink-0 p-1.5 rounded-lg text-slate-300 hover:text-indigo-600 hover:bg-indigo-50 opacity-0 group-hover:opacity-100 transition-all"
            title="Sửa nhóm hàng"
          >
            <Pencil className="h-3.5 w-3.5" />
          </button>
        </div>
        {isExpanded && hasChildren && (
          <div>{node.children.map(child => renderNode(child, depth + 1))}</div>
        )}
      </div>
    );
  };

  return (
    <div className="-mx-1">
      <div className="grid grid-cols-[minmax(0,1fr)_minmax(110px,180px)_72px_32px] px-3 pb-2 text-xs font-medium uppercase text-slate-400">
        <span>Nhóm hàng</span>
        <span>Vị trí</span>
        <span className="text-right">Số SP</span>
        <span />
      </div>
      {nodes.map(node => renderNode(node, 0))}
    </div>
  );
};

const CategoryEditPopup: React.FC<{
  node: CatNode;
  allNodes: CatNode[];
  onSave: (oldPath: string, newPath: string, location: string) => Promise<void>;
  onClose: () => void;
}> = ({ node, allNodes, onSave, onClose }) => {
  const parts = node.path.split(' >> ');
  const currentName = parts[parts.length - 1];
  const currentParentPath = parts.length > 1 ? parts.slice(0, -1).join(' >> ') : '';

  const [name, setName] = useState(currentName);
  const [parentPath, setParentPath] = useState(currentParentPath);
  const [location, setLocation] = useState(node.location || '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const canHaveLocation = Boolean(parentPath);

  const parentOptions = useMemo(() => {
    const result: { label: string; value: string; depth: number }[] = [];
    const descPrefix = node.path + ' >> ';
    const traverse = (nodes: CatNode[], depth: number) => {
      for (const n of nodes) {
        if (n.path === node.path || n.path.startsWith(descPrefix)) continue;
        result.push({ label: n.name, value: n.path, depth });
        traverse(n.children, depth + 1);
      }
    };
    traverse(allNodes, 0);
    return result;
  }, [allNodes, node.path]);

  const handleSave = async () => {
    const trimmed = name.trim();
    if (!trimmed) {
      setError('Tên không được để trống');
      return;
    }
    const newPath = parentPath ? `${parentPath} >> ${trimmed}` : trimmed;
    setSaving(true);
    try {
      await onSave(node.path, newPath, canHaveLocation ? location.trim() : '');
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Lỗi lưu');
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-modal flex items-center justify-center bg-slate-950/40 backdrop-blur-sm p-4">
      <div className="w-full max-w-sm bg-white rounded-xl shadow-xl overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <h3 className="text-sm font-bold text-slate-900">Sửa nhóm hàng</h3>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-50 hover:text-slate-700 transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="p-5 space-y-4">
          <label className="block space-y-1.5">
            <span className="text-xs font-medium text-slate-700">Tên nhóm hàng</span>
            <input
              type="text"
              value={name}
              onChange={e => {
                setName(e.target.value);
                setError('');
              }}
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100"
              autoFocus
            />
          </label>
          <label className="block space-y-1.5">
            <span className="text-xs font-medium text-slate-700">Nhóm cha</span>
            <select
              value={parentPath}
              onChange={e => {
                setParentPath(e.target.value);
                if (!e.target.value) setLocation('');
              }}
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100"
            >
              <option value="">— Không có nhóm cha —</option>
              {parentOptions.map(opt => (
                <option key={opt.value} value={opt.value}>
                  {' '.repeat(opt.depth * 4)}
                  {opt.label}
                </option>
              ))}
            </select>
          </label>
          {canHaveLocation && (
            <label className="block space-y-1.5">
              <span className="text-xs font-medium text-slate-700">Vị trí nhóm con</span>
              <input
                type="text"
                value={location}
                onChange={e => setLocation(e.target.value)}
                placeholder="VD: Kệ A1, Tầng 2..."
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100"
              />
            </label>
          )}
          {error && <p className="text-xs text-rose-500">{error}</p>}
        </div>
        <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-slate-100 bg-slate-50/60">
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="rounded-xl px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 transition-colors disabled:opacity-50"
          >
            Hủy
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving || !name.trim()}
            className="rounded-xl px-4 py-2 text-sm bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50 transition-colors"
          >
            {saving ? 'Đang lưu...' : 'Lưu'}
          </button>
        </div>
      </div>
    </div>
  );
};

const CategoryAddPopup: React.FC<{
  allNodes: CatNode[];
  onSave: (path: string, location: string) => Promise<void>;
  onClose: () => void;
}> = ({ allNodes, onSave, onClose }) => {
  const [name, setName] = useState('');
  const [parentPath, setParentPath] = useState('');
  const [location, setLocation] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const allNames = useMemo(() => {
    const names = new Set<string>();
    const traverse = (nodes: CatNode[]) =>
      nodes.forEach(n => {
        names.add(n.name);
        traverse(n.children);
      });
    traverse(allNodes);
    return Array.from(names).sort((a, b) => a.localeCompare(b, 'vi'));
  }, [allNodes]);

  const suggestions = useMemo(() => {
    if (!name.trim()) return [];
    const lower = name.toLowerCase();
    return allNames.filter(n => n.toLowerCase().includes(lower)).slice(0, 8);
  }, [name, allNames]);

  const parentOptions = useMemo(() => {
    const result: { label: string; value: string; depth: number }[] = [];
    const traverse = (nodes: CatNode[], depth: number) =>
      nodes.forEach(n => {
        result.push({ label: n.name, value: n.path, depth });
        traverse(n.children, depth + 1);
      });
    traverse(allNodes, 0);
    return result;
  }, [allNodes]);

  const handleSave = async () => {
    const trimmed = name.trim();
    if (!trimmed) {
      setError('Tên không được để trống');
      return;
    }
    const path = parentPath ? `${parentPath} >> ${trimmed}` : trimmed;
    setSaving(true);
    try {
      await onSave(path, parentPath ? location.trim() : '');
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Lỗi lưu');
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-modal flex items-center justify-center bg-slate-950/40 backdrop-blur-sm p-4">
      <div className="w-full max-w-sm bg-white rounded-xl shadow-xl overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <h3 className="text-sm font-bold text-slate-900">Thêm nhóm hàng</h3>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-50 hover:text-slate-700 transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="p-5 space-y-4">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-slate-700">Tên nhóm hàng</label>
            <div className="relative">
              <input
                type="text"
                value={name}
                onChange={e => {
                  setName(e.target.value);
                  setError('');
                  setShowSuggestions(true);
                }}
                onFocus={() => name && setShowSuggestions(true)}
                onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
                placeholder="Nhập tên hoặc chọn từ danh sách..."
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100"
                autoFocus
              />
              {showSuggestions && suggestions.length > 0 && (
                <div className="absolute top-full left-0 right-0 z-20 mt-1 bg-white border border-slate-200 rounded-xl shadow-lg max-h-40 overflow-y-auto">
                  {suggestions.map(s => (
                    <button
                      key={s}
                      type="button"
                      onMouseDown={() => {
                        setName(s);
                        setShowSuggestions(false);
                      }}
                      className="w-full px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50 first:rounded-t-xl last:rounded-b-xl"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
          <label className="block space-y-1.5">
            <span className="text-xs font-medium text-slate-700">
              Nhóm cha{' '}
              <span className="font-normal text-slate-400">(để trống = thêm nhóm cha)</span>
            </span>
            <select
              value={parentPath}
              onChange={e => {
                setParentPath(e.target.value);
                if (!e.target.value) setLocation('');
              }}
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100"
            >
              <option value="">— Không có (nhóm cha) —</option>
              {parentOptions.map(opt => (
                <option key={opt.value} value={opt.value}>
                  {' '.repeat(opt.depth * 4)}
                  {opt.label}
                </option>
              ))}
            </select>
          </label>
          {parentPath && (
            <label className="block space-y-1.5">
              <span className="text-xs font-medium text-slate-700">Vị trí nhóm con</span>
              <input
                type="text"
                value={location}
                onChange={e => setLocation(e.target.value)}
                placeholder="VD: Kệ A1, Tầng 2..."
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100"
              />
            </label>
          )}
          {error && <p className="text-xs text-rose-500">{error}</p>}
        </div>
        <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-slate-100 bg-slate-50/60">
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="rounded-xl px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 transition-colors disabled:opacity-50"
          >
            Hủy
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving || !name.trim()}
            className="rounded-xl px-4 py-2 text-sm bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50 transition-colors"
          >
            {saving ? 'Đang lưu...' : 'Thêm'}
          </button>
        </div>
      </div>
    </div>
  );
};

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
    className={`relative inline-flex h-6 w-11 rounded-full transition-colors ${enabled ? 'bg-indigo-600' : 'bg-slate-300'}`}
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
  onRefresh,
}) => {
  const [goodsDetailView, setGoodsDetailView] = useState<GoodsDetailView | null>(null);
  const [editingNode, setEditingNode] = useState<CatNode | null>(null);
  const [addingCategory, setAddingCategory] = useState(false);
  const [savedCategories, setSavedCategories] = useState<CategoryRecord[]>([]);

  useEffect(() => {
    if (goodsDetailView !== 'categories') return;
    fetch('/api/categories')
      .then(r => r.json())
      .then(d => {
        if (d.ok) {
          setSavedCategories(
            (d.categories ?? []).map((category: string | CategoryRecord) =>
              typeof category === 'string' ? { path: category } : category
            )
          );
        }
      })
      .catch(() => {});
  }, [goodsDetailView]);
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

  // Compute counts in chunks to avoid blocking UI - processes 1000 products at a time
  useEffect(() => {
    setCountsReady(false);
    const compute = () => {
      const units = new Set<string>();
      const categories = new Set<string>();
      const brands = new Set<string>();
      const locations = new Set<string>();
      const attributeNames = new Set<string>();
      
      // Process products in chunks to keep UI responsive
      const CHUNK_SIZE = 1000;
      let index = 0;
      
      const processChunk = () => {
        const end = Math.min(index + CHUNK_SIZE, products.length);
        
        for (let i = index; i < end; i++) {
          const p = products[i];
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
        
        index = end;
        
        if (index < products.length) {
          // Process next chunk - yield to browser between chunks
          if (typeof requestIdleCallback !== 'undefined') {
            requestIdleCallback(processChunk);
          } else {
            setTimeout(processChunk, 0);
          }
        } else {
          // All chunks processed - update state
          setGoodsCounts({
            units: units.size,
            categories: categories.size,
            brands: brands.size,
            locations: locations.size,
            attributes: attributeNames.size,
          });
          setCountsReady(true);
        }
      };
      
      // Start processing after a small delay to let UI render first
      processChunk();
    };
    
    // Delay computation slightly to prioritize initial render
    const timer = setTimeout(compute, 100);
    return () => clearTimeout(timer);
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

    // Build category tree — separator >>
    type NodeDraft = {
      name: string;
      path: string;
      count: number;
      location?: string;
      childMap: Map<string, NodeDraft>;
    };
    const rootMap = new Map<string, NodeDraft>();
    for (const p of products) {
      const raw = p.categoryPath || p.categoryId;
      if (!raw) continue;
      const parts = String(raw)
        .split('>>')
        .map(s => s.trim())
        .filter(Boolean);
      let currentMap = rootMap;
      let pathSoFar = '';
      for (const part of parts) {
        pathSoFar = pathSoFar ? `${pathSoFar} >> ${part}` : part;
        if (!currentMap.has(part)) {
          currentMap.set(part, { name: part, path: pathSoFar, count: 0, childMap: new Map() });
        }
        const node = currentMap.get(part)!;
        node.count++;
        currentMap = node.childMap;
      }
    }
    const toNodes = (map: Map<string, NodeDraft>): CatNode[] =>
      Array.from(map.values())
        .sort((a, b) => a.name.localeCompare(b.name, 'vi', { numeric: true }))
        .map(n => ({
          name: n.name,
          path: n.path,
          count: n.count,
          location: n.location,
          children: toNodes(n.childMap),
        }));
    for (const category of savedCategories) {
      const savedPath = category.path;
      const parts = String(savedPath)
        .split('>>')
        .map(s => s.trim())
        .filter(Boolean);
      let currentMap = rootMap;
      let pathSoFar = '';
      for (const part of parts) {
        pathSoFar = pathSoFar ? `${pathSoFar} >> ${part}` : part;
        if (!currentMap.has(part)) {
          currentMap.set(part, { name: part, path: pathSoFar, count: 0, childMap: new Map() });
        }
        if (pathSoFar === savedPath && isChildCategoryPath(savedPath)) {
          currentMap.get(part)!.location = category.location || '';
        }
        currentMap = currentMap.get(part)!.childMap;
      }
    }

    const categoryTree = toNodes(rootMap);

    return { units, categoryTree, brands, locations, attributes };
  }, [goodsDetailView, products, savedCategories]);

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

  const handleSaveCategory = async (oldPath: string, newPath: string, location: string) => {
    const res = await fetch('/api/categories/rename', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ oldPath, newPath, location }),
    });
    const data = await res.json();
    if (!data.ok) throw new Error(data.error || 'Lỗi lưu');
    setSavedCategories(prev => {
      const renamed = prev
        .filter(category => category.path !== oldPath)
        .map(category =>
          category.path.startsWith(`${oldPath} >> `)
            ? {
                ...category,
                path: `${newPath}${category.path.slice(oldPath.length)}`,
              }
            : category
        );
      const nextRecord = { path: newPath, location: isChildCategoryPath(newPath) ? location : '' };
      const next = [...renamed.filter(category => category.path !== newPath), nextRecord];
      return next.sort((a, b) => a.path.localeCompare(b.path, 'vi'));
    });
    onRefresh?.();
  };

  const handleAddCategory = async (path: string, location: string) => {
    const res = await fetch('/api/categories/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path, location }),
    });
    const data = await res.json();
    if (!data.ok) throw new Error(data.error || 'Lỗi lưu');
    setSavedCategories(prev => {
      const nextRecord = { path, location: isChildCategoryPath(path) ? location : '' };
      return [...prev.filter(category => category.path !== path), nextRecord].sort((a, b) =>
        a.path.localeCompare(b.path, 'vi')
      );
    });
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
        : goodsDetailView === 'brands'
          ? goodsDetail?.brands
          : goodsDetailView === 'locations'
            ? goodsDetail?.locations
            : null;

    return (
      <>
        {editingNode && goodsDetail && (
          <CategoryEditPopup
            node={editingNode}
            allNodes={goodsDetail.categoryTree}
            onSave={handleSaveCategory}
            onClose={() => setEditingNode(null)}
          />
        )}
        {addingCategory && goodsDetail && (
          <CategoryAddPopup
            allNodes={goodsDetail.categoryTree}
            onSave={handleAddCategory}
            onClose={() => setAddingCategory(false)}
          />
        )}
        <div className="space-y-4">
          <button
            type="button"
            onClick={() => setGoodsDetailView(null)}
            className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800 transition-colors"
          >
            ← Quay lại tổng quan
          </button>
          <Section title={detailTitles[goodsDetailView]} icon={Package}>
            {goodsDetailView === 'categories' ? (
              !goodsDetail || goodsDetail.categoryTree.length === 0 ? (
                <DetailEmptyState />
              ) : (
                <CategoryTreeView nodes={goodsDetail.categoryTree} onEdit={setEditingNode} />
              )
            ) : goodsDetailView === 'attributes' ? (
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
      </>
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
                goodsBarcodeManualMode ? 'bg-indigo-600' : 'bg-slate-300'
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
