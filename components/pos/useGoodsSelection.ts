import React from 'react';
import { AppDataSurgicalUpdate, POSProduct } from '../../types';

type OpenConfirm = (config: {
  title: string;
  message: string;
  variant?: 'danger' | 'warning' | 'info' | 'success';
  confirmLabel?: string;
  onConfirm: () => void;
}) => void;

interface UseGoodsSelectionArgs {
  products: POSProduct[];
  filteredProducts: POSProduct[];
  onUpdateProducts: (products: POSProduct[]) => void;
  onUpdateSurgical?: (updates: AppDataSurgicalUpdate[]) => Promise<void>;
  openConfirm: OpenConfirm;
  showToast: (message: string, type?: 'success' | 'error') => void;
}

export const useGoodsSelection = ({
  products,
  filteredProducts,
  onUpdateProducts,
  onUpdateSurgical,
  openConfirm,
  showToast
}: UseGoodsSelectionArgs) => {
  const [selectedIds, setSelectedIds] = React.useState<string[]>([]);
  const [favoriteIds, setFavoriteIds] = React.useState<string[]>([]);
  const [expandedParents, setExpandedParents] = React.useState<Set<string>>(new Set());

  const toggleSelectAll = () => {
    if (selectedIds.length === filteredProducts.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(filteredProducts.map(product => product.id));
    }
  };

  const toggleSelectOne = React.useCallback((id: string) => {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]);
  }, []);

  const toggleFavorite = (id: string) => {
    setFavoriteIds(prev => prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]);
  };

  const toggleExpandedParent = (id: string) => {
    setExpandedParents(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleBulkDelete = () => {
    if (selectedIds.length === 0) return;
    openConfirm({
      title: 'Xóa hàng hóa hàng loạt',
      message: `Bạn có chắc chắn muốn xóa ${selectedIds.length} mặt hàng đã chọn? Hành động này không thể hoàn tác.`,
      variant: 'danger',
      confirmLabel: 'Xóa tất cả',
      onConfirm: async () => {
        try {
          if (onUpdateSurgical) {
            const updates: AppDataSurgicalUpdate[] = selectedIds.map(id => ({ key: 'posProducts', item: { id }, isDelete: true }));
            await onUpdateSurgical(updates);
          } else {
            const updated = products.filter(product => !selectedIds.includes(product.id));
            onUpdateProducts(updated);
          }
          setSelectedIds([]);
          showToast(`Đã xóa ${selectedIds.length} mặt hàng.`, 'success');
        } catch (error: unknown) {
          const message = error instanceof Error ? error.message : String(error);
          showToast(`Lỗi khi xóa: ${message}`, 'error');
        }
      }
    });
  };

  return {
    selectedIds,
    setSelectedIds,
    favoriteIds,
    expandedParents,
    toggleSelectAll,
    toggleSelectOne,
    toggleFavorite,
    toggleExpandedParent,
    handleBulkDelete
  };
};
