import React from 'react';
import { Star, Edit2, Image as ImageIcon } from 'lucide-react';
import { POSProduct } from '../../types';

const lastGroup = (path: string) => path.split('>>').pop()?.trim() ?? path;

export const VariantRow = React.memo(({ variant, isSelected, isFavorite, onSelect, onToggleFavorite, onEdit, onView, visibleColumns, inGroup }: {
  variant: POSProduct;
  isSelected: boolean;
  isFavorite: boolean;
  onSelect: (id: string) => void;
  onToggleFavorite: (id: string) => void;
  onEdit: (p: POSProduct) => void;
  onView: (p: POSProduct) => void;
  visibleColumns: string[];
  inGroup?: boolean;
}) => (
  <tr className={`hover:bg-indigo-50/30 group transition-colors border-b border-slate-50 last:border-0 cursor-pointer ${inGroup ? 'bg-indigo-50/40' : 'bg-slate-50/30'}`} onClick={() => onView(variant)}>
    <td className={`px-3 py-2 w-10 ${inGroup ? 'border-l-2 border-indigo-400' : ''}`} onClick={(e) => e.stopPropagation()}>
      <input type="checkbox" className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500" checked={isSelected} onChange={() => onSelect(variant.id)} />
    </td>
    <td className="px-2 py-2 w-8" onClick={(e) => e.stopPropagation()}>
      <button onClick={() => onToggleFavorite(variant.id)} className="text-slate-300 hover:text-amber-400 transition-colors">
        <Star className={`h-3.5 w-3.5 ${isFavorite ? 'fill-amber-400 text-amber-400' : ''}`} />
      </button>
    </td>
    {visibleColumns.includes('image') && (
      <td className="px-2 py-2 w-20">
        <div className="w-8 h-8 bg-slate-100 rounded-lg overflow-hidden flex items-center justify-center shrink-0">
          {variant.images?.[0] ? <img src={variant.images[0]} className="w-full h-full object-cover" alt="" /> : <ImageIcon className="h-3.5 w-3.5 text-slate-300" />}
        </div>
      </td>
    )}
    <td className="px-3 py-2">
      <span className="text-[13px] text-slate-600 whitespace-nowrap">{variant.sku}</span>
    </td>
    <td className="px-3 py-2 text-slate-700 text-sm min-w-[150px]">
      <div className="flex items-center gap-2 pl-8"><span>{variant.name}</span></div>
    </td>
    {visibleColumns.includes('category') && <td className="px-3 py-2 text-xs text-slate-400 whitespace-nowrap">{(variant.categoryPath || variant.categoryId) ? lastGroup(variant.categoryPath || variant.categoryId || '') : <span className="text-slate-300">—</span>}</td>}
    {visibleColumns.includes('productType') && <td className="px-3 py-2 text-xs text-slate-400 whitespace-nowrap">{variant.productType || 'Hàng hóa'}</td>}
    {visibleColumns.includes('salePrice') && <td className="px-3 py-2 text-right text-slate-700 text-[13px] tabular-nums whitespace-nowrap">{(Number(variant.salePrice) || 0).toLocaleString()}đ</td>}
    {visibleColumns.includes('importPrice') && <td className="px-3 py-2 text-right font-normal text-slate-400 text-xs tabular-nums whitespace-nowrap">{(Number(variant.importPrice) || 0).toLocaleString()}đ</td>}
    {visibleColumns.includes('brand') && <td className="px-3 py-2 text-xs text-slate-500 font-normal whitespace-nowrap">{variant.brand || <span className="text-slate-300">—</span>}</td>}
    {visibleColumns.includes('location') && (
      <td className="px-3 py-2 whitespace-nowrap">
        {variant.location ? <span className="px-2 py-0.5 bg-slate-100 text-slate-600 rounded font-normal text-2xs uppercase tracking-tight">{variant.location}</span> : <span className="text-slate-300 text-xs">—</span>}
      </td>
    )}
    {visibleColumns.includes('stock') && (
      <td className="px-3 py-2 text-right whitespace-nowrap">
        <span className="text-sm tabular-nums">{variant.stock}</span>
      </td>
    )}
    {visibleColumns.includes('customerOrders') && <td className="px-3 py-2 text-right text-[13px] text-slate-500 tabular-nums">{variant.customerOrders ?? 0}</td>}
    {visibleColumns.includes('minStock') && <td className="px-3 py-2 text-right text-[13px] text-slate-500 tabular-nums">{variant.minStock ?? 0}</td>}
    {visibleColumns.includes('maxStock') && <td className="px-3 py-2 text-right text-[13px] text-slate-500 tabular-nums">{variant.maxStock === 999999 ? '∞' : (variant.maxStock ?? '—')}</td>}
    {visibleColumns.includes('weight') && <td className="px-3 py-2 text-right text-[13px] text-slate-500 tabular-nums">{variant.weight ? `${variant.weight}g` : <span className="text-slate-300">—</span>}</td>}
    {visibleColumns.includes('allowPoints') && <td className="px-3 py-2 text-center">{variant.allowPoints ? <span className="text-emerald-600 font-normal text-xs">✓</span> : <span className="text-slate-300">—</span>}</td>}
    {visibleColumns.includes('directSale') && <td className="px-3 py-2 text-center">{variant.directSale !== false ? <span className="text-emerald-600 font-normal text-xs">✓</span> : <span className="text-slate-300">—</span>}</td>}
    {visibleColumns.includes('status') && (
      <td className="px-3 py-2 text-center">
        <span className="text-2xs font-normal">{variant.status === 'Active' ? 'Đang KD' : 'Ngừng KD'}</span>
      </td>
    )}
    {visibleColumns.includes('warranty') && <td className="px-3 py-2 text-xs text-slate-500 whitespace-nowrap">{variant.warranty || <span className="text-slate-300">—</span>}</td>}
    {visibleColumns.includes('createdAt') && <td className="px-3 py-2 text-xs text-slate-400 whitespace-nowrap">{variant.createdAt ? new Date(variant.createdAt).toLocaleDateString('vi-VN') : <span className="text-slate-300">—</span>}</td>}
    <td className={`px-3 py-2 ${inGroup ? 'border-r-2 border-indigo-400' : ''}`} onClick={(e) => e.stopPropagation()}>
      <button onClick={() => onEdit(variant)} className="p-2 text-slate-300 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors opacity-0 group-hover:opacity-100">
        <Edit2 className="h-3.5 w-3.5" />
      </button>
    </td>
  </tr>
));

export const ProductRow = React.memo(({ product, isSelected, isFavorite, onSelect, onToggleFavorite, onEdit, onView, isExpanded, isViewing, onToggleExpand, visibleColumns, variants }: {
  product: POSProduct;
  isSelected: boolean;
  isFavorite: boolean;
  onSelect: (id: string) => void;
  onToggleFavorite: (id: string) => void;
  onEdit: (p: POSProduct) => void;
  onView: (p: POSProduct) => void;
  isExpanded?: boolean;
  isViewing?: boolean;
  onToggleExpand?: (id: string) => void;
  visibleColumns: string[];
  variants?: POSProduct[];
}) => {
  const isParent = product.isParent && product.variantCount && product.variantCount > 0;
  // BUG-36: tổng tồn kho từ variants (parent product.stock luôn = 0)
  const totalVariantStock = isParent && variants?.length
    ? variants.reduce((s, v) => s + (v.stock || 0), 0)
    : product.stock;
  // Giá vốn cha = trung bình giá vốn của các variant có importPrice > 0
  const avgImportPrice = (() => {
    if (!isParent || !variants?.length) return Number(product.importPrice) || 0;
    const priced = variants.filter(v => Number(v.importPrice) > 0);
    if (priced.length === 0) return 0;
    return Math.round(priced.reduce((s, v) => s + Number(v.importPrice), 0) / priced.length);
  })();
  // Ảnh đại diện: cha dùng ảnh đầu của variant đầu tiên có ảnh
  const thumbnailImg = isParent && variants?.length
    ? variants.find(v => v.images?.[0])?.images?.[0]
    : product.images?.[0];

  const skuRange = (() => {
    if (!isParent || !variants || variants.length === 0) return null;
    const skus = variants.map(v => v.sku).filter(Boolean) as string[];
    if (skus.length === 0) return null;
    if (skus.length === 1) return skus[0];
    return `${skus[0]} — ${skus[skus.length - 1]}`;
  })();
  const handleRowClick = () => {
    if (isParent && onToggleExpand) { onToggleExpand(product.id); } else { onView(product); }
  };
  const frameActive = isExpanded || isViewing;
  const top = frameActive ? 'border-t-2 border-indigo-400' : '';
  return (
    <tr className={`hover:bg-slate-50/70 group transition-colors border-b border-slate-50 last:border-0 cursor-pointer ${frameActive ? 'bg-indigo-50/60' : ''}`} onClick={handleRowClick}>
      <td className={`px-3 py-2 w-10 ${top} ${frameActive ? 'border-l-2 border-indigo-400' : ''}`} onClick={(e) => e.stopPropagation()}>
        <input type="checkbox" className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500" checked={isSelected} onChange={() => onSelect(product.id)} />
      </td>
      <td className={`px-2 py-2 w-8 ${top}`} onClick={(e) => e.stopPropagation()}>
        <button onClick={() => onToggleFavorite(product.id)} className="text-slate-300 hover:text-amber-400 transition-colors">
          <Star className={`h-3.5 w-3.5 ${isFavorite ? 'fill-amber-400 text-amber-400' : ''}`} />
        </button>
      </td>
      {visibleColumns.includes('image') && (
        <td className={`px-2 py-2 w-20 ${top}`}>
          <div className="w-8 h-8 bg-slate-100 rounded-lg overflow-hidden flex items-center justify-center shrink-0">
            {thumbnailImg ? <img src={thumbnailImg} className="w-full h-full object-cover" alt="" /> : <ImageIcon className="h-3.5 w-3.5 text-slate-300" />}
          </div>
        </td>
      )}
      <td className={`px-3 py-2 ${top}`}>
        {isParent
          ? (isExpanded
              ? null
              : skuRange
                ? <span className="text-[13px] text-slate-600 whitespace-nowrap">{skuRange}</span>
                : <span className="text-slate-300 text-[13px]">—</span>)
          : (product.sku
              ? <span className="text-[13px] text-slate-600 whitespace-nowrap">{product.sku}</span>
              : <span className="text-slate-300 text-[13px]">—</span>)
        }
      </td>
      <td className={`px-3 py-2 text-slate-900 text-sm min-w-[150px] ${top}`}>
        <div className="flex items-center gap-2">
          <span>{product.name}</span>
          {isParent && <span className="text-2xs font-normal">({product.variantCount})</span>}
        </div>
      </td>
      {visibleColumns.includes('category') && <td className={`px-3 py-2 text-[13px] text-slate-500 whitespace-nowrap ${top}`}>{(() => { const cat = product.categoryPath || product.categoryId || variants?.[0]?.categoryPath || variants?.[0]?.categoryId || ''; return cat ? lastGroup(cat) : <span className="text-slate-300">—</span>; })()}</td>}
      {visibleColumns.includes('productType') && <td className={`px-3 py-2 text-[13px] text-slate-500 whitespace-nowrap ${top}`}>{product.productType || 'Hàng hóa'}</td>}
      {visibleColumns.includes('salePrice') && <td className={`px-3 py-2 text-right text-slate-900 text-[13px] tabular-nums whitespace-nowrap ${top}`}>{(Number(product.salePrice) || 0).toLocaleString()}đ</td>}
      {visibleColumns.includes('importPrice') && <td className={`px-3 py-2 text-right text-slate-400 text-[13px] tabular-nums whitespace-nowrap ${top}`}>{avgImportPrice > 0 ? `${avgImportPrice.toLocaleString()}đ` : <span className="text-slate-300">—</span>}</td>}
      {visibleColumns.includes('brand') && <td className={`px-3 py-2 text-sm text-slate-500 w-[160px] ${top}`}>{(product.brand || variants?.find(v => v.brand)?.brand) || <span className="text-slate-300">—</span>}</td>}
      {visibleColumns.includes('location') && (
        <td className={`px-3 py-2 w-[80px] max-w-[80px] ${top}`}>
          {(() => { const loc = product.location || variants?.find(v => v.location)?.location; return loc ? <span className="text-[13px] text-slate-600 truncate block">{loc}</span> : <span className="text-slate-300 text-[13px]">—</span>; })()}
        </td>
      )}
      {visibleColumns.includes('stock') && (
        <td className={`px-3 py-2 text-right whitespace-nowrap ${top}`}>
          <span className="text-sm tabular-nums">{totalVariantStock}</span>
        </td>
      )}
      {visibleColumns.includes('customerOrders') && <td className={`px-3 py-2 text-right text-[13px] text-slate-500 tabular-nums ${top}`}>{product.customerOrders ?? 0}</td>}
      {visibleColumns.includes('minStock') && <td className={`px-3 py-2 text-right text-[13px] text-slate-500 tabular-nums ${top}`}>{product.minStock ?? 0}</td>}
      {visibleColumns.includes('maxStock') && <td className={`px-3 py-2 text-right text-[13px] text-slate-500 tabular-nums ${top}`}>{product.maxStock === 999999 ? '∞' : (product.maxStock ?? '—')}</td>}
      {visibleColumns.includes('weight') && <td className={`px-3 py-2 text-right text-[13px] text-slate-500 tabular-nums ${top}`}>{product.weight ? `${product.weight}g` : <span className="text-slate-300">—</span>}</td>}
      {visibleColumns.includes('allowPoints') && <td className={`px-3 py-2 text-center ${top}`}>{product.allowPoints ? <span className="text-emerald-600 font-normal text-xs">✓</span> : <span className="text-slate-300">—</span>}</td>}
      {visibleColumns.includes('directSale') && <td className={`px-3 py-2 text-center ${top}`}>{product.directSale !== false ? <span className="text-emerald-600 font-normal text-xs">✓</span> : <span className="text-slate-300">—</span>}</td>}
      {visibleColumns.includes('status') && (
        <td className={`px-3 py-2 text-center ${top}`}>
          <span className="text-2xs font-normal">{product.status === 'Active' ? 'Đang KD' : 'Ngừng KD'}</span>
        </td>
      )}
      {visibleColumns.includes('warranty') && <td className={`px-3 py-2 text-[13px] text-slate-500 whitespace-nowrap ${top}`}>{product.warranty || <span className="text-slate-300">—</span>}</td>}
      {visibleColumns.includes('createdAt') && <td className={`px-3 py-2 text-xs text-slate-400 whitespace-nowrap ${top}`}>{product.createdAt ? new Date(product.createdAt).toLocaleDateString('vi-VN') : <span className="text-slate-300">—</span>}</td>}
      <td className={`px-3 py-2 ${top} ${frameActive ? 'border-r-2 border-indigo-400' : ''}`} onClick={(e) => e.stopPropagation()}>
        <button onClick={() => onEdit(product)} className="p-2 text-slate-300 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors opacity-0 group-hover:opacity-100">
          <Edit2 className="h-3.5 w-3.5" />
        </button>
      </td>
    </tr>
  );
});
