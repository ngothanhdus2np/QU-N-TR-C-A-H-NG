import React, { useState, useMemo, useRef } from 'react';
import { ShopeeSourceItem, ShopeeInventoryInRecord, ShopeeInventoryOutRecord } from '../../types';
import { ChevronDown, ChevronRight, ChevronsUpDown, ChevronUp, ImagePlus, Plus, Save, Star, X } from 'lucide-react';
import { uploadImage } from '../../services/marketingStorageService';
import SourceDetailPage from './SourceDetailPage';
import SourceAddModal from './SourceAddModal';
import { parseSku, BUCKET } from './helpers';

interface Props {
  shopeeSourceData: ShopeeSourceItem[];
  shopeeInventoryIn: ShopeeInventoryInRecord[];
  shopeeInventoryOut: ShopeeInventoryOutRecord[];
  formatNumber: (num: number) => string;
  onUpdate?: (newList: ShopeeSourceItem[]) => Promise<void>;
  shopFilter?: number | null;
  onShopFilterChange?: (shop: number) => void;
}

type SortKey = 'parentCode' | 'importPrice' | 'stock' | 'starred';
type SortDir = 'asc' | 'desc';

interface SkuGroup {
  parentCode: string;
  items: ShopeeSourceItem[];
  isSingle: boolean;
}

const PAGE_SIZE_OPTIONS = [20, 50, 100];
const DEFAULT_PAGE_SIZE = 20;


const groupBySku = (items: ShopeeSourceItem[]): SkuGroup[] => {
  const map = new Map<string, ShopeeSourceItem[]>();
  for (const item of items) {
    const { parentCode } = parseSku(item.sku);
    if (!map.has(parentCode)) map.set(parentCode, []);
    map.get(parentCode)!.push(item);
  }
  return Array.from(map.entries()).map(([parentCode, groupItems]) => ({
    parentCode,
    items: groupItems,
    isSingle: groupItems.length === 1 && parseSku(groupItems[0].sku).color === null,
  }));
};

const SortIcon = ({ col, sortKey, sortDir }: { col: SortKey; sortKey: SortKey; sortDir: SortDir }) => {
  if (col !== sortKey) return <ChevronsUpDown className="h-3 w-3 opacity-40" />;
  return sortDir === 'asc' ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />;
};

const SourceTab: React.FC<Props> = ({
  shopeeSourceData,
  shopeeInventoryIn,
  shopeeInventoryOut,
  formatNumber,
  onUpdate,
  shopFilter = null,
  onShopFilterChange,
}) => {
  const [search, setSearch] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('parentCode');
  const [sortDir, setSortDir] = useState<SortDir>('asc');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValues, setEditValues] = useState<Partial<ShopeeSourceItem>>({});
  const [isAdding, setIsAdding] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [detailId, setDetailId] = useState<string | null>(null);
  const [uploadingId, setUploadingId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const uploadTargetId = useRef<string | null>(null);

  // Tính tồn kho theo SKU
  const stockBySku = useMemo(() => {
    const map = new Map<string, number>();
    for (const r of shopeeInventoryIn) {
      map.set(r.sku, (map.get(r.sku) ?? 0) + r.quantity);
    }
    for (const r of shopeeInventoryOut) {
      if (r.status === 'OK' || r.status === 'SHIPPING') {
        map.set(r.sku, (map.get(r.sku) ?? 0) - r.quantity);
      }
    }
    return map;
  }, [shopeeInventoryIn, shopeeInventoryOut]);

  const getStock = (sku: string) => stockBySku.get(sku) ?? 0;

  const toggleGroup = (parentCode: string) => {
    setExpandedGroups(prev => {
      const next = new Set(prev);
      next.has(parentCode) ? next.delete(parentCode) : next.add(parentCode);
      return next;
    });
  };

  const handleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortKey(key); setSortDir('asc'); }
    setPage(1);
  };

  const filtered = useMemo(() => {
    let result = shopeeSourceData;
    const q = search.toLowerCase().trim();
    if (q) result = result.filter(item =>
      item.sku.toLowerCase().includes(q) || item.name.toLowerCase().includes(q)
    );
    if (shopFilter !== null) {
      result = result.filter(item => {
        const shop = item.shops?.[shopFilter];
        return shop?.name?.trim() || shop?.link?.trim();
      });
    }
    return result;
  }, [shopeeSourceData, search, shopFilter]);

  const groups = useMemo(() => {
    const g = groupBySku(filtered);
    return g.sort((a, b) => {
      let cmp = 0;
      if (sortKey === 'parentCode') cmp = a.parentCode.localeCompare(b.parentCode);
      else if (sortKey === 'starred') {
        const aS = a.items.some(i => i.starred) ? 1 : 0;
        const bS = b.items.some(i => i.starred) ? 1 : 0;
        cmp = bS - aS;
      } else if (sortKey === 'importPrice') {
        cmp = Math.min(...a.items.map(i => i.importPrice)) - Math.min(...b.items.map(i => i.importPrice));
      } else if (sortKey === 'stock') {
        const aStock = a.items.reduce((s, i) => s + getStock(i.sku), 0);
        const bStock = b.items.reduce((s, i) => s + getStock(i.sku), 0);
        cmp = aStock - bStock;
      }
      return sortDir === 'asc' ? cmp : -cmp;
    });
  }, [filtered, sortKey, sortDir, stockBySku]);

  const allVisibleIds = useMemo(() => filtered.map(i => i.id), [filtered]);
  const allSelected = allVisibleIds.length > 0 && allVisibleIds.every(id => selectedIds.has(id));

  const toggleSelectAll = () => {
    if (allSelected) setSelectedIds(new Set());
    else setSelectedIds(new Set(allVisibleIds));
  };

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const toggleStar = async (item: ShopeeSourceItem) => {
    if (!onUpdate) return;
    await onUpdate(shopeeSourceData.map(i =>
      i.id === item.id ? { ...i, starred: !i.starred } : i
    ));
  };

  const handleImageClick = (id: string) => {
    uploadTargetId.current = id;
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    const targetId = uploadTargetId.current;
    if (!file || !targetId || !onUpdate) return;
    setUploadingId(targetId);
    try {
      const url = await uploadImage(targetId, BUCKET, file.name, file);
      if (url) {
        await onUpdate(shopeeSourceData.map(i =>
          i.id === targetId ? { ...i, imageUrl: url } : i
        ));
      }
    } finally {
      setUploadingId(null);
      e.target.value = '';
    }
  };

  const saveEdit = async () => {
    if (!editingId || !onUpdate) return;
    await onUpdate(shopeeSourceData.map(item =>
      item.id === editingId ? { ...item, ...editValues } : item
    ));
    setEditingId(null);
  };

  const saveNewItem = async (item: ShopeeSourceItem) => {
    if (!onUpdate) return;
    await onUpdate([...shopeeSourceData, item]);
    const { parentCode } = parseSku(item.sku);
    setExpandedGroups(prev => new Set(prev).add(parentCode));
  };

  const totalPages = Math.max(1, Math.ceil(groups.length / pageSize));
  const paginatedGroups = groups.slice((page - 1) * pageSize, page * pageSize);

  const thClass = 'px-3 py-3 cursor-pointer select-none hover:bg-slate-100 transition-colors';

  return (
    <>
    {isAdding && (
      <SourceAddModal
        onClose={() => setIsAdding(false)}
        onSave={saveNewItem}
      />
    )}
    <section className="flex h-full min-w-0 flex-col overflow-hidden rounded-lg border border-slate-200 bg-white">
      <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileChange} />

      {/* Toolbar */}
      <div className="flex shrink-0 items-center justify-between gap-3 border-b border-slate-200 px-4 py-3">
        <div className="flex items-center gap-3 min-w-0">
          <div>
            <h3 className="text-sm font-semibold text-slate-900">Dữ liệu nguồn SKU</h3>
            <p className="text-xs text-slate-500">{groups.length} nhóm · {filtered.length} SKU</p>
          </div>
          <input
            type="text"
            placeholder="Tìm SKU hoặc tên sản phẩm..."
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1); }}
            className="h-9 w-56 rounded-lg border border-slate-200 bg-slate-50 px-3 text-xs text-slate-700 outline-none focus:border-slate-400 focus:bg-white"
          />
          {selectedIds.size > 0 && (
            <span className="text-xs text-indigo-600 font-semibold">Đã chọn {selectedIds.size}</span>
          )}
        </div>
        <button
          onClick={() => setIsAdding(true)}
          className="flex h-9 items-center gap-2 rounded-lg bg-emerald-600 px-3 text-sm font-semibold text-white transition-colors hover:bg-emerald-700 shrink-0"
        >
          <Plus className="h-4 w-4" /> Thêm SKU mới
        </button>
      </div>

      {/* Table */}
      <div className="min-h-0 flex-1 overflow-auto">
        <table className="w-full min-w-[600px] border-collapse text-left text-sm">
          <thead className="sticky top-0 z-10 bg-slate-50">
            <tr className="border-b border-slate-200 text-xs font-semibold uppercase text-slate-500">
              <th className="w-10 px-3 py-3 text-center">
                <input type="checkbox" checked={allSelected} onChange={toggleSelectAll} className="rounded" />
              </th>
              <th onClick={() => handleSort('starred')} className={`w-10 text-center ${thClass}`}>
                <div className="flex justify-center"><SortIcon col="starred" sortKey={sortKey} sortDir={sortDir} /></div>
              </th>
              <th className="w-36 px-3 py-3 text-center text-xs font-semibold uppercase text-slate-500">Ảnh</th>
              <th onClick={() => handleSort('parentCode')} className={`${thClass} text-center`}>
                <div className="flex items-center justify-center gap-1">Mã / Tên <SortIcon col="parentCode" sortKey={sortKey} sortDir={sortDir} /></div>
              </th>
              <th className="px-3 py-3 text-center text-xs font-semibold uppercase text-slate-500">Nhóm hàng</th>
              <th onClick={() => handleSort('importPrice')} className={`${thClass} text-right pr-28`}>
                <div className="flex items-center justify-end gap-1 pr-0">Giá nhập <SortIcon col="importPrice" sortKey={sortKey} sortDir={sortDir} /></div>
              </th>
              <th onClick={() => handleSort('stock')} className={`${thClass} text-center`}>
                <div className="flex items-center justify-center gap-1">Tồn kho <SortIcon col="stock" sortKey={sortKey} sortDir={sortDir} /></div>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">

            {paginatedGroups.length > 0 ? paginatedGroups.map(group => {
              const isExpanded = expandedGroups.has(group.parentCode);
              const groupStock = group.items.reduce((s, i) => s + getStock(i.sku), 0);
              const groupStarred = group.items.some(i => i.starred);
              const groupHasDetail = group.items.some(i => i.id === detailId);
              const framed = isExpanded;
              const frameBg = framed ? 'bg-slate-100' : '';
              const frameLeft = framed ? 'border-l-2 border-indigo-400' : '';
              const frameRight = framed ? 'border-r-2 border-indigo-400' : '';

              return (
                <React.Fragment key={group.parentCode}>
                  {/* Hàng cha */}
                  {!group.isSingle && (
                    <tr className={`cursor-pointer hover:bg-slate-50 ${frameBg} ${framed ? 'border-t-2 border-indigo-400' : ''}`} onClick={() => toggleGroup(group.parentCode)}>
                      <td className={`px-3 py-2 text-center ${frameLeft}`} onClick={e => e.stopPropagation()}>
                        <input type="checkbox"
                          checked={group.items.every(i => selectedIds.has(i.id))}
                          onChange={() => {
                            const allIn = group.items.every(i => selectedIds.has(i.id));
                            setSelectedIds(prev => {
                              const next = new Set(prev);
                              group.items.forEach(i => allIn ? next.delete(i.id) : next.add(i.id));
                              return next;
                            });
                          }}
                          className="rounded"
                        />
                      </td>
                      <td className="px-3 py-2 text-center">
                        {groupStarred && <Star className="h-4 w-4 fill-amber-400 text-amber-400 mx-auto" />}
                      </td>
                      <td className="px-3 py-2">
                        <div className="h-20 w-20 rounded-md border border-slate-100 bg-slate-50" />
                      </td>
                      <td className="px-3 py-2">
                        <div className="flex items-center gap-2">
                          {isExpanded ? <ChevronDown className="h-4 w-4 text-slate-400 shrink-0" /> : <ChevronRight className="h-4 w-4 text-slate-400 shrink-0" />}
                          <span className="font-semibold text-slate-800">{group.parentCode}</span>
                          <span className="text-xs text-slate-400">{group.items.length} biến thể</span>
                        </div>
                      </td>
                      <td className="px-3 py-2 text-center text-xs text-slate-500 font-medium">
                        {group.items[0]?.groupId || '—'}
                      </td>
                      <td className="px-3 py-2 text-right pr-28 tabular-nums text-xs text-slate-400">
                        {(() => {
                          const min = Math.min(...group.items.map(i => i.importPrice));
                          const max = Math.max(...group.items.map(i => i.importPrice));
                          return min === max ? `${formatNumber(min)}đ` : `${formatNumber(min)}–${formatNumber(max)}đ`;
                        })()}
                      </td>
                      <td className={`px-3 py-2 text-center tabular-nums text-xs font-semibold ${groupStock <= 0 ? 'text-rose-500' : 'text-slate-700'} ${frameRight}`}>
                        {groupStock}
                      </td>
                    </tr>
                  )}

                  {/* Hàng con / đơn */}
                  {(group.isSingle || isExpanded) && group.items.map((item, itemIdx) => {
                    const stock = getStock(item.sku);
                    const isEditing = editingId === item.id;
                    const isLastItem = itemIdx === group.items.length - 1;
                    const frameBottom = framed && isLastItem && !groupHasDetail ? 'border-b-2 border-indigo-400' : '';
                    return (
                      <React.Fragment key={item.id}>
                      <tr className={`group hover:bg-slate-50 ${frameBg}`}>
                        {/* Checkbox */}
                        <td className={`px-3 py-2 text-center ${frameLeft} ${frameBottom}`}>
                          <input type="checkbox" checked={selectedIds.has(item.id)} onChange={() => toggleSelect(item.id)} className="rounded" />
                        </td>
                        {/* Star */}
                        <td className={`px-3 py-2 text-center ${frameBottom}`}>
                          <button onClick={() => toggleStar(item)} className="mx-auto flex items-center justify-center">
                            <Star className={`h-4 w-4 transition-colors ${item.starred ? 'fill-amber-400 text-amber-400' : 'text-slate-200 hover:text-amber-300'}`} />
                          </button>
                        </td>
                        {/* Ảnh */}
                        <td className={`px-3 py-2 ${frameBottom}`}>
                          <button
                            onClick={() => handleImageClick(item.id)}
                            className="relative ml-10 flex h-10 w-10 items-center justify-center overflow-hidden rounded-md border border-slate-200 bg-slate-50 hover:border-indigo-300 transition-colors"
                            title="Đổi ảnh"
                          >
                            {uploadingId === item.id ? (
                              <span className="text-[9px] text-slate-400">...</span>
                            ) : item.imageUrl ? (
                              <img src={item.imageUrl} alt={item.name} className="h-full w-full object-cover" />
                            ) : (
                              <ImagePlus className="h-4 w-4 text-slate-300" />
                            )}
                          </button>
                        </td>
                        {/* Mã / Tên */}
                        <td className={`px-3 py-2 text-center ${!group.isSingle ? 'pl-9' : ''} ${frameBottom}`}>
                            <div
                            className="font-semibold text-slate-800 text-xs cursor-pointer hover:text-indigo-600"
                            onClick={() => setDetailId(detailId === item.id ? null : item.id)}
                          >{item.sku}</div>
                        </td>
                        {/* Nhóm hàng */}
                        <td className={`px-3 py-2 text-center text-xs text-slate-400 italic ${frameBottom}`}>
                          {item.groupId || '—'}
                        </td>
                        {/* Giá nhập */}
                        <td className={`px-3 py-2 text-right pr-28 tabular-nums text-rose-600 text-xs ${frameBottom}`}>
                          {isEditing ? (
                            <input type="number" value={editValues.importPrice ?? item.importPrice}
                              onChange={e => setEditValues(v => ({ ...v, importPrice: Number(e.target.value) }))}
                              onKeyDown={e => e.key === 'Enter' && saveEdit()}
                              className="w-full rounded border border-slate-300 px-2 py-1 text-xs text-right outline-none focus:border-indigo-400"
                            />
                          ) : (
                            <span className="cursor-pointer" onDoubleClick={() => { setEditingId(item.id); setEditValues({ name: item.name, importPrice: item.importPrice }); }}>
                              {formatNumber(item.importPrice)}đ
                            </span>
                          )}
                          {isEditing && (
                            <div className="mt-1 flex justify-end gap-1">
                              <button onClick={saveEdit} className="inline-flex h-6 w-6 items-center justify-center rounded bg-indigo-600 text-white hover:bg-indigo-700"><Save className="h-3 w-3" /></button>
                              <button onClick={() => setEditingId(null)} className="inline-flex h-6 w-6 items-center justify-center rounded text-slate-400 hover:bg-slate-100"><X className="h-3 w-3" /></button>
                            </div>
                          )}
                        </td>
                        {/* Tồn kho */}
                        <td className={`px-3 py-2 text-center tabular-nums text-xs font-semibold ${stock <= 0 ? 'text-rose-500' : 'text-slate-700'} ${frameRight} ${frameBottom}`}>
                          {stock}
                        </td>
                      </tr>
                      {detailId === item.id && (
                        <tr key={`${item.id}-detail`}>
                          <td colSpan={7} className={`p-0 border-b-2 border-indigo-400 ${frameLeft} ${frameRight}`}>
                            <div className="bg-slate-50">
                              <SourceDetailPage
                                item={item}
                                shopeeInventoryIn={shopeeInventoryIn}
                                shopeeInventoryOut={shopeeInventoryOut}
                                formatNumber={formatNumber}
                                defaultShop={shopFilter ?? undefined}
                                onShopChange={onShopFilterChange}
                                onBack={() => setDetailId(null)}
                                onUpdate={async (updated) => {
                                  if (!onUpdate) return;
                                  await onUpdate(shopeeSourceData.map(i => i.id === updated.id ? updated : i));
                                }}
                                onDelete={async () => {
                                  if (!onUpdate) return;
                                  await onUpdate(shopeeSourceData.filter(i => i.id !== item.id));
                                  setDetailId(null);
                                }}
                              />
                            </div>
                          </td>
                        </tr>
                      )}
                      </React.Fragment>
                    );
                  })}
                </React.Fragment>
              );
            }) : (
              <tr>
                <td colSpan={7} className="px-6 py-16 text-center text-sm text-slate-400">
                  {search ? 'Không tìm thấy SKU phù hợp' : 'Chưa có dữ liệu nguồn'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {groups.length > DEFAULT_PAGE_SIZE && (
        <div className="flex shrink-0 items-center justify-between border-t border-slate-100 px-4 py-2 text-xs text-slate-500">
          <div className="flex items-center gap-2">
            <span>Hiển thị</span>
            <select value={pageSize} onChange={e => { setPageSize(Number(e.target.value)); setPage(1); }} className="rounded border border-slate-200 bg-white px-2 py-1 text-xs outline-none">
              {PAGE_SIZE_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
            <span>nhóm / trang</span>
          </div>
          <div className="flex items-center gap-1">
            <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="rounded px-2 py-1 hover:bg-slate-100 disabled:opacity-40">‹</button>
            <span>{page} / {totalPages}</span>
            <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages} className="rounded px-2 py-1 hover:bg-slate-100 disabled:opacity-40">›</button>
          </div>
        </div>
      )}
    </section>
    </>
  );
};

export default SourceTab;
