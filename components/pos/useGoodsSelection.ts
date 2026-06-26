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
  currentProducts: POSProduct[];
  onUpdateProducts: (products: POSProduct[]) => void;
  onUpdateSurgical?: (updates: AppDataSurgicalUpdate[]) => Promise<void>;
  openConfirm: OpenConfirm;
  showToast: (message: string, type?: 'success' | 'error') => void;
}

export const useGoodsSelection = ({
  products,
  filteredProducts,
  currentProducts,
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

  // BUG-46: sync selectedIds khi filter thay đổi — giữ lại child IDs nếu parent còn trong filter
  React.useEffect(() => {
    const filteredRootIds = new Set(filteredProducts.map(p => p.id));
    const filteredChildIds = new Set(
      products.filter(p => p.parentId && filteredRootIds.has(p.parentId)).map(p => p.id)
    );
    setSelectedIds(prev => prev.filter(id => filteredRootIds.has(id) || filteredChildIds.has(id)));
  }, [filteredProducts, products]);

  const toggleSelectAll = () => {
    const currentRootIds = new Set(currentProducts.map(p => p.id));
    const childIds = products
      .filter(p => p.parentId && currentRootIds.has(p.parentId))
      .map(p => p.id);
    const allIds = [...currentProducts.map(p => p.id), ...childIds];
    // Bỏ chọn nếu đã chọn hết root trang hiện tại, ngược lại chọn tất cả (cha + con) trang này
    const allRootsSelected = currentProducts.every(p => selectedIds.includes(p.id));
    setSelectedIds(allRootsSelected ? [] : allIds);
  };

  const toggleSelectOne = React.useCallback((id: string) => {
    const childIds = products.filter(p => p.parentId === id).map(p => p.id);
    if (childIds.length > 0) {
      // Sản phẩm cha: toggle cả cha lẫn các con
      setSelectedIds(prev => {
        const isSelected = prev.includes(id);
        if (isSelected) {
          return prev.filter(item => item !== id && !childIds.includes(item));
        } else {
          const toAdd = [id, ...childIds].filter(item => !prev.includes(item));
          return [...prev, ...toAdd];
        }
      });
    } else {
      setSelectedIds(prev => prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]);
    }
  }, [products]);

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
