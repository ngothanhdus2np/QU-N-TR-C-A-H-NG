import React, { useState, useEffect } from 'react';
import { X, Loader2, ChevronDown, ChevronRight, CheckCircle, AlertCircle, Download } from 'lucide-react';
import { supabase } from '../../services/supabase';
import { useToast } from '../ui/Toast';

interface Props {
  onClose: () => void;
  onDone: () => void;
}

interface SourceItem {
  id: string;
  sku: string;
  name: string;
  import_price: number;
  sale_price: number;
  status: string;
}

interface SkuGroup {
  parentCode: string;
  groupName: string;
  items: (SourceItem & { color: string | null; size: string | null })[];
}

interface ImportResult {
  groupsCreated: number;
  variantsCreated: number;
  skipped: number;
  errors: string[];
}

const SUPABASE_PAGE_SIZE = 1000;

// Supabase/PostgREST giới hạn mặc định 1000 dòng/query — bảng pos_products có 12,000+ SKU
// nên phải phân trang để lấy đủ, tránh nhầm SKU đã tồn tại thành SKU mới (lỗi duplicate key).
async function fetchAllPages<T>(table: string, columns: string): Promise<T[]> {
  const rows: T[] = [];
  let offset = 0;
  while (true) {
    const { data, error } = await supabase
      .from(table)
      .select(columns)
      .range(offset, offset + SUPABASE_PAGE_SIZE - 1);
    if (error) throw error;
    const page = (data ?? []) as T[];
    rows.push(...page);
    if (page.length < SUPABASE_PAGE_SIZE) break;
    offset += SUPABASE_PAGE_SIZE;
  }
  return rows;
}

function parseSku(sku: string) {
  const parts = sku.split('-');
  if (parts.length === 1) return { parentCode: sku, color: null, size: null };
  if (parts.length === 2) return { parentCode: parts[0], color: parts[1], size: null };
  return { parentCode: parts[0], color: parts[1], size: parts.slice(2).join('-') };
}

function groupByParent(items: SourceItem[]): SkuGroup[] {
  const map = new Map<string, SkuGroup>();
  for (const item of items) {
    const { parentCode, color, size } = parseSku(item.sku);
    if (!map.has(parentCode)) {
      map.set(parentCode, { parentCode, groupName: item.name, items: [] });
    }
    map.get(parentCode)!.items.push({ ...item, color, size });
  }
  return Array.from(map.values()).sort((a, b) => a.parentCode.localeCompare(b.parentCode));
}

export default function ImportFromSourceModal({ onClose, onDone }: Props) {
  const { showToast } = useToast();
  const [loading, setLoading] = useState(true);
  const [groups, setGroups] = useState<SkuGroup[]>([]);
  // allPosMap: mọi sku → id (bao gồm cả cha lẫn biến thể)
  const [allPosMap, setAllPosMap] = useState<Record<string, string>>({});
  // alreadyLinked: SKUs đã có trong shopee_product_variants
  const [alreadyLinked, setAlreadyLinked] = useState<Set<string>>(new Set());
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const [sourceRes, posRows, variantRows] = await Promise.all([
          supabase.from('shopee_source_data').select('id, sku, name, import_price, sale_price, status').order('sku'),
          fetchAllPages<{ id: string; sku: string | null }>('pos_products', 'id, sku, is_parent'),
          fetchAllPages<{ sku: string }>('shopee_product_variants', 'sku'),
        ]);

        const sourceItems = (sourceRes.data ?? []) as SourceItem[];
        setGroups(groupByParent(sourceItems));

        const aMap: Record<string, string> = {};
        for (const p of posRows) {
          if (p.sku) aMap[p.sku] = p.id;
        }
        setAllPosMap(aMap);

        const linked = new Set<string>();
        for (const v of variantRows) linked.add(v.sku);
        setAlreadyLinked(linked);
      } catch {
        showToast('Lỗi tải dữ liệu', 'error');
      } finally {
        setLoading(false);
      }
    })();
  }, [showToast]);

  const newGroupsCount = groups.filter(g =>
    g.items.some(item => !alreadyLinked.has(item.sku))
  ).length;
  const totalSkus = groups.reduce((acc, g) => acc + g.items.length, 0);
  const newSkusCount = groups.reduce((acc, g) =>
    acc + g.items.filter(item => !alreadyLinked.has(item.sku)).length, 0);
  const newVariantPosCount = groups.reduce((acc, g) =>
    acc + g.items.filter(item => !alreadyLinked.has(item.sku) && !allPosMap[item.sku]).length, 0);

  const toggleGroup = (code: string) => {
    setExpandedGroups(prev => {
      const next = new Set(prev);
      next.has(code) ? next.delete(code) : next.add(code);
      return next;
    });
  };

  const handleImport = async () => {
    setImporting(true);
    const res: ImportResult = { groupsCreated: 0, variantsCreated: 0, skipped: 0, errors: [] };

    try {
      const localPosMap = { ...allPosMap };

      for (const group of groups) {
        const unlinkedItems = group.items.filter(item => !alreadyLinked.has(item.sku));
        if (unlinkedItems.length === 0) {
          res.skipped += group.items.length;
          continue;
        }

        // ── Bước 1: Tạo hoặc lấy sản phẩm CHA trong pos_products ──
        let parentPosId = localPosMap[group.parentCode];
        if (!parentPosId) {
          const { data: parentData, error: parentErr } = await supabase
            .from('pos_products')
            .insert({
              sku: group.parentCode,
              name: group.groupName,
              is_parent: true,
              variant_count: 0,
              import_price: 0,
              sale_price: 0,
              stock: 0,
              status: 'Active',
              images: [],
            })
            .select('id')
            .single();

          if (parentErr) {
            if (parentErr.code === '23505') {
              // Đã tồn tại (từ lần chạy trước) → query lấy ID
              const { data: existing } = await supabase
                .from('pos_products')
                .select('id')
                .eq('sku', group.parentCode)
                .maybeSingle();
              if (existing) {
                localPosMap[group.parentCode] = existing.id;
                parentPosId = existing.id;
                await supabase.from('pos_products').update({ is_parent: true }).eq('id', existing.id);
              } else {
                res.errors.push(`Cha ${group.parentCode}: không tìm lại được record`);
                continue;
              }
            } else {
              res.errors.push(`Cha ${group.parentCode}: ${parentErr.message}`);
              continue;
            }
          } else {
            localPosMap[group.parentCode] = parentData.id;
            parentPosId = parentData.id;
          }
        }

        // ── Bước 2: Tạo container shopee_products ──
        const { data: spData, error: spErr } = await supabase
          .from('shopee_products')
          .insert({
            name: group.groupName,
            is_published: false,
            display_order: 0,
          })
          .select('id')
          .single();

        if (spErr) {
          res.errors.push(`Shopee container ${group.parentCode}: ${spErr.message}`);
          continue;
        }
        const shopeeProductId = spData.id;

        // ── Bước 3: Từng biến thể → pos_products + shopee_product_variants ──
        let variantOrder = 0;
        let variantsCreatedInGroup = 0;

        for (const item of unlinkedItems) {
          // Tạo hoặc lấy variant pos_product
          let variantPosId = localPosMap[item.sku];
          if (!variantPosId) {
            const variantAttrs: Record<string, string> = {};
            if (item.color) variantAttrs['MÀU'] = item.color;
            if (item.size) variantAttrs['SIZE'] = item.size;

            const { data: varData, error: varPosErr } = await supabase
              .from('pos_products')
              .insert({
                sku: item.sku,
                name: item.name,
                is_parent: false,
                parent_id: parentPosId,
                import_price: item.import_price,
                sale_price: item.sale_price,
                stock: 0,
                status: 'Active',
                images: [],
                variant_attributes: variantAttrs,
              })
              .select('id')
              .single();

            if (varPosErr) {
              res.errors.push(`Variant pos ${item.sku}: ${varPosErr.message}`);
              continue;
            }
            localPosMap[item.sku] = varData.id;
            variantPosId = varData.id;
          }

          // Tạo shopee_product_variants
          const { error: linkErr } = await supabase.from('shopee_product_variants').insert({
            shopee_product_id: shopeeProductId,
            pos_product_id: variantPosId,
            sku: item.sku,
            color_name: item.color ?? null,
            size: item.size ?? null,
            is_published: true,
            display_order: variantOrder++,
          });

          if (linkErr) {
            res.errors.push(`Link ${item.sku}: ${linkErr.message}`);
          } else {
            res.variantsCreated++;
            variantsCreatedInGroup++;
          }
        }

        // ── Bước 4: Cập nhật variant_count trên sản phẩm cha ──
        const totalVariantsForParent = group.items.length;
        await supabase
          .from('pos_products')
          .update({ variant_count: totalVariantsForParent })
          .eq('id', parentPosId);

        if (variantsCreatedInGroup > 0) res.groupsCreated++;
        res.skipped += group.items.length - unlinkedItems.length;
      }

      setResult(res);
      if (res.errors.length === 0) {
        showToast(`Đã nhập ${res.variantsCreated} biến thể vào ${res.groupsCreated} nhóm sản phẩm`, 'success');
      } else {
        showToast(`Nhập xong với ${res.errors.length} lỗi`, 'error');
      }
    } catch (err: unknown) {
      showToast('Lỗi: ' + (err instanceof Error ? err.message : String(err)), 'error');
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[85vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 shrink-0">
          <div>
            <h2 className="text-base font-semibold text-slate-800">Nhập từ Dữ liệu nguồn cũ</h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Tạo cấu trúc <span className="font-medium text-slate-600">cha → biến thể</span> trong Hàng hóa + liên kết kênh Shopee
            </p>
          </div>
          <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors">
            <X size={17} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-4">
          {loading ? (
            <div className="flex items-center justify-center h-32 gap-2 text-slate-400">
              <Loader2 size={18} className="animate-spin" /> Đang phân tích dữ liệu...
            </div>
          ) : result ? (
            /* Kết quả */
            <div className="space-y-4">
              <div className="flex items-center gap-3 text-green-700 bg-green-50 rounded-xl p-4">
                <CheckCircle size={20} className="shrink-0" />
                <div>
                  <p className="font-semibold">Nhập hoàn tất</p>
                  <p className="text-sm mt-0.5">
                    {result.groupsCreated} nhóm sản phẩm mới · {result.variantsCreated} biến thể đã nhập · {result.skipped} SKU bỏ qua (đã tồn tại)
                  </p>
                </div>
              </div>
              {result.errors.length > 0 && (
                <div className="bg-red-50 rounded-xl p-4">
                  <div className="flex items-center gap-2 text-red-700 mb-2">
                    <AlertCircle size={16} />
                    <span className="font-medium text-sm">{result.errors.length} lỗi</span>
                  </div>
                  <ul className="text-xs text-red-600 space-y-1 max-h-40 overflow-y-auto">
                    {result.errors.map((e, i) => <li key={i}>• {e}</li>)}
                  </ul>
                </div>
              )}
            </div>
          ) : (
            /* Preview */
            <div className="space-y-3">
              {/* Tóm tắt */}
              <div className="grid grid-cols-3 gap-3">
                <div className="bg-slate-50 rounded-xl p-3 text-center">
                  <p className="text-2xl font-bold text-slate-800">{groups.length}</p>
                  <p className="text-xs text-slate-500 mt-0.5">nhóm sản phẩm</p>
                </div>
                <div className="bg-slate-50 rounded-xl p-3 text-center">
                  <p className="text-2xl font-bold text-slate-800">{totalSkus}</p>
                  <p className="text-xs text-slate-500 mt-0.5">biến thể tổng</p>
                </div>
                <div className={`rounded-xl p-3 text-center ${newSkusCount > 0 ? 'bg-orange-50' : 'bg-green-50'}`}>
                  <p className={`text-2xl font-bold ${newSkusCount > 0 ? 'text-orange-600' : 'text-green-600'}`}>{newSkusCount}</p>
                  <p className={`text-xs mt-0.5 ${newSkusCount > 0 ? 'text-orange-500' : 'text-green-500'}`}>biến thể sẽ nhập mới</p>
                </div>
              </div>

              {newSkusCount === 0 ? (
                <div className="flex items-center gap-2 bg-green-50 text-green-700 rounded-xl p-4 text-sm">
                  <CheckCircle size={16} />
                  Tất cả biến thể đã được liên kết. Không cần nhập thêm.
                </div>
              ) : (
                <>
                  {newVariantPosCount > 0 && (
                    <div className="flex items-start gap-2 bg-amber-50 text-amber-700 rounded-xl p-3 text-xs">
                      <AlertCircle size={14} className="mt-0.5 shrink-0" />
                      <p>
                        Sẽ tạo <strong>{newGroupsCount} sản phẩm cha</strong> + <strong>{newVariantPosCount} biến thể</strong> mới trong Hàng hóa với tồn kho = 0.
                        Bạn có thể nhập tồn kho sau.
                      </p>
                    </div>
                  )}

                  {/* Danh sách nhóm */}
                  <div className="border border-slate-200 rounded-xl overflow-hidden divide-y divide-slate-100">
                    {groups.map(group => {
                      const isExpanded = expandedGroups.has(group.parentCode);
                      const unlinked = group.items.filter(i => !alreadyLinked.has(i.sku));
                      const allLinked = unlinked.length === 0;
                      const hasParentInPos = !!allPosMap[group.parentCode];

                      return (
                        <div key={group.parentCode}>
                          <button
                            onClick={() => toggleGroup(group.parentCode)}
                            className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-colors ${allLinked ? 'opacity-50 bg-slate-50' : 'hover:bg-slate-50'}`}
                          >
                            {isExpanded
                              ? <ChevronDown size={14} className="text-slate-400 shrink-0" />
                              : <ChevronRight size={14} className="text-slate-400 shrink-0" />
                            }
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="font-mono text-xs font-semibold text-slate-700">{group.parentCode}</span>
                                {hasParentInPos && (
                                  <span className="text-[9px] bg-blue-100 text-blue-600 px-1.5 py-0.5 rounded-full">Đã có cha</span>
                                )}
                                <span className="text-xs text-slate-500 truncate">{group.groupName}</span>
                              </div>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              {allLinked ? (
                                <span className="text-[10px] bg-green-100 text-green-600 px-2 py-0.5 rounded-full">Đã nhập</span>
                              ) : (
                                <span className="text-[10px] bg-orange-100 text-orange-600 px-2 py-0.5 rounded-full">{unlinked.length} mới</span>
                              )}
                              <span className="text-xs text-slate-400">{group.items.length} biến thể</span>
                            </div>
                          </button>

                          {isExpanded && (
                            <div className="border-t border-slate-100 bg-slate-50 divide-y divide-slate-100">
                              {group.items.map(item => {
                                const isLinked = alreadyLinked.has(item.sku);
                                const inPos = !!allPosMap[item.sku];
                                return (
                                  <div key={item.sku} className={`flex items-center gap-3 px-5 py-2 text-xs ${isLinked ? 'opacity-40' : ''}`}>
                                    <span className="font-mono text-slate-600 w-36 shrink-0">{item.sku}</span>
                                    <span className="text-slate-400 w-16 shrink-0">{item.color ?? '—'}</span>
                                    <span className="text-slate-400 w-10 shrink-0">size {item.size ?? '—'}</span>
                                    <span className="text-slate-400">{item.import_price > 0 ? `${item.import_price.toLocaleString('vi')}đ` : '—'}</span>
                                    <div className="ml-auto flex items-center gap-1.5">
                                      {isLinked ? (
                                        <span className="text-green-600 flex items-center gap-1"><CheckCircle size={11} /> Đã liên kết</span>
                                      ) : inPos ? (
                                        <span className="text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded">Có trong POS</span>
                                      ) : (
                                        <span className="text-orange-600 bg-orange-50 px-1.5 py-0.5 rounded">Tạo mới</span>
                                      )}
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="shrink-0 px-5 py-3.5 border-t border-slate-100 flex items-center justify-between">
          <p className="text-xs text-slate-400">
            {!result && !loading && newSkusCount > 0 &&
              `${newGroupsCount} nhóm cha · ${newVariantPosCount} biến thể mới vào Hàng hóa · ${newGroupsCount} container Shopee`
            }
          </p>
          <div className="flex items-center gap-2">
            {result ? (
              <button
                onClick={onDone}
                className="px-5 py-2 text-sm font-medium bg-slate-800 hover:bg-slate-900 text-white rounded-lg transition-colors"
              >
                Xong
              </button>
            ) : (
              <>
                <button onClick={onClose} className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg transition-colors">
                  Hủy
                </button>
                {!loading && newSkusCount > 0 && (
                  <button
                    onClick={handleImport}
                    disabled={importing}
                    className="flex items-center gap-1.5 px-5 py-2 text-sm font-medium bg-orange-500 hover:bg-orange-600 disabled:opacity-60 text-white rounded-lg transition-colors"
                  >
                    {importing ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
                    {importing ? 'Đang nhập...' : `Nhập ${newSkusCount} biến thể`}
                  </button>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
