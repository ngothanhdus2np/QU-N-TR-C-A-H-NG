import React from 'react';
import { Star, Edit2, Image as ImageIcon } from 'lucide-react';
import { POSProduct } from '../../types';

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
    <td className={`px-4 py-3 w-10 ${inGroup ? 'border-l-2 border-indigo-200' : ''}`} onClick={(e) => e.stopPropagation()}>
      <input type="checkbox" className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500" checked={isSelected} onChange={() => onSelect(variant.id)} />
    </td>
    <td className="px-2 py-3 w-8" onClick={(e) => e.stopPropagation()}>
      <button onClick={() => onToggleFavorite(variant.id)} className="text-slate-300 hover:text-amber-400 transition-colors">
        <Star className={`h-3.5 w-3.5 ${isFavorite ? 'fill-amber-400 text-amber-400' : ''}`} />
      </button>
    </td>
    {visibleColumns.includes('image') && (
      <td className="px-2 py-3 w-20">
        <div className="w-8 h-8 bg-slate-100 rounded-lg overflow-hidden flex items-center justify-center shrink-0">
          {variant.images?.[0] ? <img src={variant.images[0]} className="w-full h-full object-cover" alt="" /> : <ImageIcon className="h-3.5 w-3.5 text-slate-300" />}
        </div>
      </td>
    )}
    <td className="px-4 py-3">
      <span className="px-2 py-1 bg-slate-100 text-slate-600 rounded-lg font-mono text-2xs border border-slate-200 tracking-tight whitespace-nowrap">{variant.sku}</span>
    </td>
    <td className="px-4 py-3 text-slate-700 text-sm min-w-[200px]">
      <div className="flex items-center gap-2 pl-8"><span>{variant.name}</span></div>
    </td>
    {visibleColumns.includes('category') && <td className="px-4 py-3 text-xs text-slate-400 whitespace-nowrap">{variant.categoryId || <span className="text-slate-300">—</span>}</td>}
    {visibleColumns.includes('productType') && <td className="px-4 py-3 text-xs text-slate-400 whitespace-nowrap">{variant.productType || 'Hàng hóa'}</td>}
    {visibleColumns.includes('salePrice') && <td className="px-4 py-3 text-right text-slate-700 text-sm tabular-nums whitespace-nowrap">{variant.salePrice.toLocaleString()}đ</td>}
    {visibleColumns.includes('importPrice') && <td className="px-4 py-3 text-right font-normal text-slate-400 text-xs tabular-nums whitespace-nowrap">{variant.importPrice.toLocaleString()}đ</td>}
    {visibleColumns.includes('brand') && <td className="px-4 py-3 text-xs text-slate-500 font-normal whitespace-nowrap">{variant.brand || <span className="text-slate-300">—</span>}</td>}
    {visibleColumns.includes('location') && (
      <td className="px-4 py-3 whitespace-nowrap">
        {variant.location ? <span className="px-2 py-0.5 bg-slate-100 text-slate-600 rounded font-normal text-2xs uppercase tracking-tight">{variant.location}</span> : <span className="text-slate-300 text-xs">—</span>}
      </td>
    )}
    {visibleColumns.includes('stock') && (
      <td className="px-4 py-3 text-right whitespace-nowrap">
        <span className={`text-sm tabular-nums ${variant.stock === 0 ? 'text-rose-600' : variant.stock <= (variant.minStock ?? 5) ? 'text-amber-600' : 'text-slate-700'}`}>{variant.stock}</span>
        {variant.stock === 0 && <span className="ml-1 text-[9px] px-1.5 py-0.5 bg-rose-100 text-rose-600 rounded font-normal">Hết</span>}
        {variant.stock > 0 && variant.stock <= (variant.minStock ?? 5) && <span className="ml-1 text-[9px] px-1.5 py-0.5 bg-amber-100 text-amber-600 rounded font-normal">Sắp hết</span>}
      </td>
    )}
    {visibleColumns.includes('customerOrders') && <td className="px-4 py-3 text-right text-sm text-slate-500 tabular-nums">{variant.customerOrders ?? 0}</td>}
    {visibleColumns.includes('minStock') && <td className="px-4 py-3 text-right text-sm text-slate-500 tabular-nums">{variant.minStock ?? 0}</td>}
    {visibleColumns.includes('maxStock') && <td className="px-4 py-3 text-right text-sm text-slate-500 tabular-nums">{variant.maxStock === 999999 ? '∞' : (variant.maxStock ?? '—')}</td>}
    {visibleColumns.includes('weight') && <td className="px-4 py-3 text-right text-sm text-slate-500 tabular-nums">{variant.weight ? `${variant.weight}g` : <span className="text-slate-300">—</span>}</td>}
    {visibleColumns.includes('allowPoints') && <td className="px-4 py-3 text-center">{variant.allowPoints ? <span className="text-emerald-600 font-normal text-xs">✓</span> : <span className="text-slate-300">—</span>}</td>}
    {visibleColumns.includes('directSale') && <td className="px-4 py-3 text-center">{variant.directSale !== false ? <span className="text-emerald-600 font-normal text-xs">✓</span> : <span className="text-slate-300">—</span>}</td>}
    {visibleColumns.includes('status') && (
      <td className="px-4 py-3 text-center">
        <span className={`px-2 py-0.5 rounded-full text-2xs font-normal ${variant.status === 'Active' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>{variant.status === 'Active' ? 'Đang KD' : 'Ngừng KD'}</span>
      </td>
    )}
    {visibleColumns.includes('warranty') && <td className="px-4 py-3 text-xs text-slate-500 whitespace-nowrap">{variant.warranty || <span className="text-slate-300">—</span>}</td>}
    {visibleColumns.includes('createdAt') && <td className="px-4 py-3 text-xs text-slate-400 whitespace-nowrap">{variant.createdAt ? new Date(variant.createdAt).toLocaleDateString('vi-VN') : <span className="text-slate-300">—</span>}</td>}
    <td className={`px-3 py-3 ${inGroup ? 'border-r-2 border-indigo-200' : ''}`} onClick={(e) => e.stopPropagation()}>
      <button onClick={() => onEdit(variant)} className="p-2 text-slate-300 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors opacity-0 group-hover:opacity-100">
        <Edit2 className="h-3.5 w-3.5" />
      </button>
    </td>
  </tr>
));

export const ProductRow = React.memo(({ product, isSelected, isFavorite, onSelect, onToggleFavorite, onEdit, onView, isExpanded, onToggleExpand, visibleColumns, variants }: {
  product: POSProduct;
  isSelected: boolean;
  isFavorite: boolean;
  onSelect: (id: string) => void;
  onToggleFavorite: (id: string) => void;
  onEdit: (p: POSProduct) => void;
  onView: (p: POSProduct) => void;
  isExpanded?: boolean;
  onToggleExpand?: (id: string) => void;
  visibleColumns: string[];
  variants?: POSProduct[];
}) => {
  const isParent = product.isParent && product.variantCount && product.variantCount > 0;

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
  return (
    <tr className={`hover:bg-slate-50/70 group transition-colors border-b border-slate-50 last:border-0 cursor-pointer ${isExpanded ? 'border-t-2 border-indigo-200 bg-indigo-50/60' : ''}`} onClick={handleRowClick}>
      <td className={`px-4 py-3 w-10 ${isExpanded ? 'border-l-2 border-indigo-200' : ''}`} onClick={(e) => e.stopPropagation()}>
        <input type="checkbox" className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500" checked={isSelected} onChange={() => onSelect(product.id)} />
      </td>
      <td className="px-2 py-3 w-8" onClick={(e) => e.stopPropagation()}>
        <button onClick={() => onToggleFavorite(product.id)} className="text-slate-300 hover:text-amber-400 transition-colors">
          <Star className={`h-3.5 w-3.5 ${isFavorite ? 'fill-amber-400 text-amber-400' : ''}`} />
        </button>
      </td>
      {visibleColumns.includes('image') && (
        <td className="px-2 py-3 w-20">
          <div className="w-16 h-16 bg-slate-100 rounded-lg overflow-hidden flex items-center justify-center shrink-0">
            {product.images?.[0] ? <img src={product.images[0]} className="w-full h-full object-cover" alt="" /> : <ImageIcon className="h-5 w-5 text-slate-300" />}
          </div>
        </td>
      )}
      <td className="px-4 py-3">
        {isParent
          ? (isExpanded
              ? null
              : skuRange
                ? <span className="text-xs text-slate-400 font-mono whitespace-nowrap">{skuRange}</span>
                : <span className="text-slate-300 text-sm">—</span>)
          : (product.sku
              ? <span className="text-sm text-slate-600 whitespace-nowrap">{product.sku}</span>
              : <span className="text-slate-300 text-sm">—</span>)
        }
      </td>
      <td className="px-4 py-3 text-slate-900 text-sm min-w-[200px]">
        <div className="flex items-center gap-2">
          <span>{product.name}</span>
          {isParent && <span className="px-2 py-0.5 bg-indigo-100 text-indigo-700 rounded-full text-2xs font-normal">({product.variantCount})</span>}
        </div>
      </td>
      {visibleColumns.includes('category') && <td className="px-4 py-3 text-sm text-slate-500 whitespace-nowrap">{product.categoryId || <span className="text-slate-300">—</span>}</td>}
      {visibleColumns.includes('productType') && <td className="px-4 py-3 text-sm text-slate-500 whitespace-nowrap">{product.productType || 'Hàng hóa'}</td>}
      {visibleColumns.includes('salePrice') && <td className="px-4 py-3 text-right text-slate-900 text-sm tabular-nums whitespace-nowrap">{product.salePrice.toLocaleString()}đ</td>}
      {visibleColumns.includes('importPrice') && <td className="px-4 py-3 text-right text-slate-400 text-sm tabular-nums whitespace-nowrap">{product.importPrice.toLocaleString()}đ</td>}
      {visibleColumns.includes('brand') && <td className="px-4 py-3 text-sm text-slate-500 w-[100px] max-w-[100px]"><span className="truncate block">{product.brand || <span className="text-slate-300">—</span>}</span></td>}
      {visibleColumns.includes('location') && (
        <td className="px-4 py-3 w-[80px] max-w-[80px]">
          {product.location ? <span className="text-sm text-slate-600 truncate block">{product.location}</span> : <span className="text-slate-300 text-sm">—</span>}
        </td>
      )}
      {visibleColumns.includes('stock') && (
        <td className="px-4 py-3 text-right whitespace-nowrap">
          <span className={`text-sm tabular-nums ${product.stock === 0 ? 'text-rose-600' : product.stock <= (product.minStock ?? 5) ? 'text-amber-600' : 'text-slate-800'}`}>{product.stock}</span>
          {product.stock === 0 && <span className="ml-1 text-[9px] px-1.5 py-0.5 bg-rose-100 text-rose-600 rounded font-normal">Hết</span>}
          {product.stock > 0 && product.stock <= (product.minStock ?? 5) && <span className="ml-1 text-[9px] px-1.5 py-0.5 bg-amber-100 text-amber-600 rounded font-normal">Sắp hết</span>}
        </td>
      )}
      {visibleColumns.includes('customerOrders') && <td className="px-4 py-3 text-right text-sm text-slate-500 tabular-nums">{product.customerOrders ?? 0}</td>}
      {visibleColumns.includes('minStock') && <td className="px-4 py-3 text-right text-sm text-slate-500 tabular-nums">{product.minStock ?? 0}</td>}
      {visibleColumns.includes('maxStock') && <td className="px-4 py-3 text-right text-sm text-slate-500 tabular-nums">{product.maxStock === 999999 ? '∞' : (product.maxStock ?? '—')}</td>}
      {visibleColumns.includes('weight') && <td className="px-4 py-3 text-right text-sm text-slate-500 tabular-nums">{product.weight ? `${product.weight}g` : <span className="text-slate-300">—</span>}</td>}
      {visibleColumns.includes('allowPoints') && <td className="px-4 py-3 text-center">{product.allowPoints ? <span className="text-emerald-600 font-normal text-xs">✓</span> : <span className="text-slate-300">—</span>}</td>}
      {visibleColumns.includes('directSale') && <td className="px-4 py-3 text-center">{product.directSale !== false ? <span className="text-emerald-600 font-normal text-xs">✓</span> : <span className="text-slate-300">—</span>}</td>}
      {visibleColumns.includes('status') && (
        <td className="px-4 py-3 text-center">
          <span className={`px-2 py-0.5 rounded-full text-2xs font-normal ${product.status === 'Active' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>{product.status === 'Active' ? 'Đang KD' : 'Ngừng KD'}</span>
        </td>
      )}
      {visibleColumns.includes('warranty') && <td className="px-4 py-3 text-sm text-slate-500 whitespace-nowrap">{product.warranty || <span className="text-slate-300">—</span>}</td>}
      {visibleColumns.includes('createdAt') && <td className="px-4 py-3 text-xs text-slate-400 whitespace-nowrap">{product.createdAt ? new Date(product.createdAt).toLocaleDateString('vi-VN') : <span className="text-slate-300">—</span>}</td>}
      <td className={`px-3 py-3 ${isExpanded ? 'border-r-2 border-indigo-200' : ''}`} onClick={(e) => e.stopPropagation()}>
        <button onClick={() => onEdit(product)} className="p-2 text-slate-300 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors opacity-0 group-hover:opacity-100">
          <Edit2 className="h-3.5 w-3.5" />
        </button>
      </td>
    </tr>
  );
});
