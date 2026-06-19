import React from 'react';
import { GoodsSortDirection, GoodsSortKey } from './useGoodsFilters';

interface GoodsProductTableHeaderProps {
  visibleColumns: string[];
  isAllSelected: boolean;
  onToggleSelectAll: () => void;
  sortKey: GoodsSortKey;
  sortDirection: GoodsSortDirection;
  onSort: (key: GoodsSortKey) => void;
}

export const GoodsProductTableHeader: React.FC<GoodsProductTableHeaderProps> = ({
  visibleColumns,
  isAllSelected,
  onToggleSelectAll,
}) => (
  <thead className="bg-slate-50 border-b border-slate-200 sticky top-0 z-10">
    <tr>
      <th className="px-3 py-2 w-10">
        <input
          type="checkbox"
          className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
          checked={isAllSelected}
          onChange={onToggleSelectAll}
        />
      </th>
      <th className="px-2 py-3 w-8"></th>
      {visibleColumns.includes('image') && <th className="px-2 py-3 w-20"></th>}
      <th className="px-3 py-2 text-left font-medium text-[12px] text-slate-500 whitespace-nowrap">
        Mã hàng
      </th>
      <th className="px-3 py-2 text-left font-medium text-[12px] text-slate-500 whitespace-nowrap min-w-[200px]">
        Tên hàng
      </th>
      {visibleColumns.includes('category') && (
        <th className="px-3 py-2 text-left font-medium text-[12px] text-slate-500 whitespace-nowrap">
          Nhóm hàng
        </th>
      )}
      {visibleColumns.includes('productType') && (
        <th className="px-3 py-2 text-left font-medium text-[12px] text-slate-500 whitespace-nowrap">
          Loại hàng
        </th>
      )}
      {visibleColumns.includes('salePrice') && (
        <th className="px-3 py-2 text-right font-medium text-[12px] text-slate-500 whitespace-nowrap">
          Giá bán
        </th>
      )}
      {visibleColumns.includes('importPrice') && (
        <th className="px-3 py-2 text-right font-medium text-[12px] text-slate-500 whitespace-nowrap">
          Giá vốn
        </th>
      )}
      {visibleColumns.includes('brand') && (
        <th className="px-3 py-2 text-left font-medium text-[12px] text-slate-500 whitespace-nowrap w-[100px]">
          Thương hiệu
        </th>
      )}
      {visibleColumns.includes('location') && (
        <th className="px-3 py-2 text-left font-medium text-[12px] text-slate-500 whitespace-nowrap w-[80px]">
          Vị trí
        </th>
      )}
      {visibleColumns.includes('stock') && (
        <th className="px-3 py-2 text-right font-medium text-[12px] text-slate-500 whitespace-nowrap">
          Tồn kho
        </th>
      )}
      {visibleColumns.includes('customerOrders') && (
        <th className="px-3 py-2 text-right font-medium text-[12px] text-slate-500 whitespace-nowrap">
          KH đặt
        </th>
      )}
      {visibleColumns.includes('minStock') && (
        <th className="px-3 py-2 text-right font-medium text-[12px] text-slate-500 whitespace-nowrap">
          ĐM ít nhất
        </th>
      )}
      {visibleColumns.includes('maxStock') && (
        <th className="px-3 py-2 text-right font-medium text-[12px] text-slate-500 whitespace-nowrap">
          ĐM nhiều nhất
        </th>
      )}
      {visibleColumns.includes('weight') && (
        <th className="px-3 py-2 text-right font-medium text-[12px] text-slate-500 whitespace-nowrap">
          Trọng lượng
        </th>
      )}
      {visibleColumns.includes('allowPoints') && (
        <th className="px-3 py-2 text-center font-medium text-[12px] text-slate-500 whitespace-nowrap">
          Tích điểm
        </th>
      )}
      {visibleColumns.includes('directSale') && (
        <th className="px-3 py-2 text-center font-medium text-[12px] text-slate-500 whitespace-nowrap">
          Bán TT
        </th>
      )}
      {visibleColumns.includes('status') && (
        <th className="px-3 py-2 text-center font-medium text-[12px] text-slate-500 whitespace-nowrap">
          Trạng thái
        </th>
      )}
      {visibleColumns.includes('warranty') && (
        <th className="px-3 py-2 text-left font-medium text-[12px] text-slate-500 whitespace-nowrap">
          Bảo hành
        </th>
      )}
      {visibleColumns.includes('createdAt') && (
        <th className="px-3 py-2 text-left font-medium text-[12px] text-slate-500 whitespace-nowrap">
          Thời gian tạo
        </th>
      )}
      <th className="px-3 py-2 w-10"></th>
    </tr>
  </thead>
);
