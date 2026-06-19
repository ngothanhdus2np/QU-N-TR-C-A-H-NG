import React from 'react';
import { AppDataSurgicalUpdate, POSProduct } from '../../types';

const GOODS_FAVORITES_STORAGE_KEY = 'goodsFavoriteIds';

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
  const [expandedParents, setExpandedParents] = React.useState<string | null>(null);

  React.useEffect(() => {
    try {
      const raw = localStorage.getItem(GOODS_FAVORITES_STORAGE_KEY);
      if (raw) setFavoriteIds(JSON.parse(raw));
    } catch {
      setFavoriteIds([]);
    }
  }, []);

  const persistFavoriteIds = React.useCallback((next: string[]) => {
    setFavoriteIds(next);
    localStorage.setItem(GOODS_FAVORITES_STORAGE_KEY, JSON.stringify(next));
  }, []);

  const selectedIdSet = React.useMemo(() => new Set(selectedIds), [selectedIds]);

  // BUG-46: sync selectedIds khi filter thay đổi
  React.useEffect(() => {
    const filteredIds = new Set(filteredProducts.map(p => p.id));
    setSelectedIds(prev => prev.filter(id => filteredIds.has(id)));
  }, [filteredProducts]);

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
    const next = favoriteIds.includes(id)
      ? favoriteIds.filter(item => item !== id)
      : [...favoriteIds, id];
    persistFavoriteIds(next);
  };

  const toggleExpandedParent = (id: string) => {
    setExpandedParents(prev => prev === id ? null : id);
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
          // Thu thập cả variant con của các parent bị xóa để tránh orphan
          const idsToDelete = new Set(selectedIds);
          for (const p of products) {
            if (p.parentId && idsToDelete.has(p.parentId)) idsToDelete.add(p.id);
          }
          if (onUpdateSurgical) {
            const updates: AppDataSurgicalUpdate[] = [...idsToDelete].map(id => ({ key: 'posProducts', item: { id }, isDelete: true }));
            await onUpdateSurgical(updates);
          } else {
            const updated = products.filter(product => !idsToDelete.has(product.id));
            onUpdateProducts(updated);
          }
          setSelectedIds([]);
          // BUG-41: dùng idsToDelete.size (bao gồm variants của cha) thay vì selectedIds.length
          showToast(`Đã xóa ${idsToDelete.size} mặt hàng.`, 'success');
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
    selectedIdSet,
    favoriteIds,
    expandedParents,
    toggleSelectAll,
    toggleSelectOne,
    toggleFavorite,
    toggleExpandedParent,
    handleBulkDelete
  };
};
