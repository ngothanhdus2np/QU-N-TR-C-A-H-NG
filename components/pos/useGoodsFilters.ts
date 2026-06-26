import React from 'react';
import { POSProduct, InventoryTransaction, Supplier } from '../../types';
import { useProductSearchIndex } from './useProductSearchIndex';
import { fuzzyMatch } from '../../src/lib/fuzzySearch';

export type GoodsSortKey = 'sku' | 'salePrice' | 'importPrice' | 'stock';
export type GoodsSortDirection = 'desc' | 'asc';

interface UseGoodsFiltersParams {
  products: POSProduct[];
  transactions: InventoryTransaction[];
  suppliers: Supplier[];
  debouncedSearchTerm: string;
  searchTags: string[];
  filterCategories: string[];
  filterBrand: string;
  filterStock: 'all' | 'in_stock' | 'out_of_stock' | 'low_stock';
  filterLocation: string;
  filterAttrs: string[];
  filterSupplier: string[];
  filterPlatforms: string[];
  platformProductIds: Map<string, Set<string>>;
  sortKey: GoodsSortKey;
  sortDirection: GoodsSortDirection;
  currentPage: number;
  itemsPerPage: number;
}

const getSkuNumber = (sku: string) => {
  const match = sku.match(/\d+/);
  return match ? Number(match[0]) : 0;
};

const getSortValue = (
  product: POSProduct,
  sortKey: GoodsSortKey,
  parentSkuFallback: Map<string, number>
) => {
  if (sortKey === 'sku') {
    return product.sku ? getSkuNumber(product.sku) : (parentSkuFallback.get(product.id) ?? 0);
  }
  return Number(product[sortKey] ?? 0);
};

const splitCategoryPath = (value?: string | null) =>
  String(value || '')
    .split(/\s*(?:>>|>|\/)\s*/g)
    .map(part => part.trim())
    .filter(Boolean);

const normalizeCategoryPath = (value?: string | null) => splitCategoryPath(value).join(' >> ');

const getProductCategoryPath = (product: POSProduct) =>
  normalizeCategoryPath(product.categoryPath || product.categoryId || '');

const categoryMatchesSelection = (productPath: string, selectedPath: string) => {
  const normalizedSelectedPath = normalizeCategoryPath(selectedPath);
  if (!productPath || !normalizedSelectedPath) return false;
  if (productPath === normalizedSelectedPath) return true;
  if (productPath.startsWith(normalizedSelectedPath + ' >> ')) return true;

  return false;
};

const sortProducts = (
  source: POSProduct[],
  sortKey: GoodsSortKey,
  sortDirection: GoodsSortDirection,
  parentSkuFallback: Map<string, number>
) => {
  const direction = sortDirection === 'desc' ? -1 : 1;
  return [...source].sort((a, b) => {
    const valueA = getSortValue(a, sortKey, parentSkuFallback);
    const valueB = getSortValue(b, sortKey, parentSkuFallback);
    if (valueA !== valueB) return (valueA - valueB) * direction;
    return (a.name || '').localeCompare(b.name || '', 'vi');
  });
};

export const useGoodsFilters = ({
  products,
  transactions,
  suppliers,
  debouncedSearchTerm,
  searchTags,
  filterCategories,
  filterBrand,
  filterStock,
  filterLocation,
  filterAttrs,
  filterSupplier,
  filterPlatforms,
  platformProductIds,
  sortKey,
  sortDirection,
  currentPage,
  itemsPerPage,
}: UseGoodsFiltersParams) => {
  // Use search index for fast lookups
  const { searchProducts } = useProductSearchIndex(products);

  const supplierIdToName = React.useMemo(() => {
    const map = new Map<string, string>();
    for (const s of suppliers) map.set(s.id, s.name);
    return map;
  }, [suppliers]);

  // Normalize SKU for consistent comparison
  const normalizeSku = (sku?: string | null) => String(sku || '').trim().toLowerCase();

  // Map normalized SKU -> current product ID (for resolving old transaction items with stale productId)
  const skuToProductIdMap = React.useMemo(() => {
    const map = new Map<string, string>();
    for (const p of products) {
      const sku = normalizeSku(p.sku);
      if (sku) map.set(sku, p.id);
    }
    return map;
  }, [products]);

  // Resolve supplier name: prefer current DB name (via supplierId) over stored supplierName
  const resolveSupplierName = React.useCallback(
    (tx: { supplierId?: string; supplierName?: string }) =>
      (tx.supplierId ? supplierIdToName.get(tx.supplierId) : undefined) || tx.supplierName,
    [supplierIdToName]
  );

  // Map productId -> Set<supplierName> from Import transactions
  // Also maps by current product ID via SKU fallback (handles deleted+recreated products)
  const productSupplierMap = React.useMemo(() => {
    const map = new Map<string, Set<string>>();
    const addEntry = (productId: string, name: string) => {
      if (!map.has(productId)) map.set(productId, new Set());
      map.get(productId)!.add(name);
    };
    for (const tx of transactions) {
      if (tx.type !== 'Import') continue;
      const name = resolveSupplierName(tx);
      if (!name) continue;
      for (const item of tx.items) {
        addEntry(item.productId, name);
        // SKU fallback: product may have been recreated with a new ID but same SKU
        if (item.sku) {
          const currentProductId = skuToProductIdMap.get(normalizeSku(item.sku));
          if (currentProductId && currentProductId !== item.productId) {
            addEntry(currentProductId, name);
          }
        }
      }
    }
    return map;
  }, [transactions, resolveSupplierName, skuToProductIdMap]);

  // Map parentId → Set<supplierName> từ variants — tránh O(n²) khi filter supplier
  const parentProductSupplierMap = React.useMemo(() => {
    const map = new Map<string, Set<string>>();
    for (const p of products) {
      if (!p.parentId) continue;
      const sups = productSupplierMap.get(p.id);
      if (!sups || sups.size === 0) continue;
      if (!map.has(p.parentId)) map.set(p.parentId, new Set());
      const parentSet = map.get(p.parentId)!;
      for (const s of sups) parentSet.add(s);
    }
    return map;
  }, [products, productSupplierMap]);

  const uniqueSuppliers = React.useMemo(() => {
    const names = new Set<string>();
    for (const s of suppliers) {
      if (s.status !== 'inactive') names.add(s.name);
    }
    // Also include supplier names from import transactions (using current DB name when possible)
    for (const tx of transactions) {
      if (tx.type !== 'Import') continue;
      const name = resolveSupplierName(tx);
      if (name) names.add(name);
    }
    return Array.from(names).sort();
  }, [suppliers, transactions, resolveSupplierName]);

  const lowStockProducts = React.useMemo(
    () => products.filter(p => p.status !== 'Inactive' && p.stock > 0 && p.stock <= (p.minStock ?? 5)),
    [products]
  );

  const uniqueCategories = React.useMemo(
    () =>
      Array.from(new Set(products.map(getProductCategoryPath).filter(Boolean))).sort((a, b) =>
        a.localeCompare(b, 'vi', { numeric: true })
      ),
    [products]
  );

  const uniqueBrands = React.useMemo(
    () => Array.from(new Set(products.map(p => p.brand || '').filter(Boolean))).sort(),
    [products]
  );

  const uniqueLocations = React.useMemo(
    () => Array.from(new Set(products.map(p => p.location || '').filter(Boolean))).sort(),
    [products]
  );

  const attrValuesByName = React.useMemo(() => {
    const map = new Map<string, Map<string, number>>();
    for (const p of products) {
      if (p.variantAttributes) {
        for (const [attrName, attrValue] of Object.entries(p.variantAttributes)) {
          if (!map.has(attrName)) map.set(attrName, new Map());
          const vals = map.get(attrName)!;
          vals.set(attrValue, (vals.get(attrValue) || 0) + 1);
        }
      }
      if (p.attributes) {
        for (const attr of p.attributes) {
          if (!map.has(attr.name)) map.set(attr.name, new Map());
          const vals = map.get(attr.name)!;
          for (const v of attr.values) {
            if (!vals.has(v)) vals.set(v, 0);
          }
        }
      }
    }
    const result: Record<string, { values: string[]; counts: Record<string, number> }> = {};
    for (const [attrName, valMap] of map.entries()) {
      const values = Array.from(valMap.keys()).sort();
      const counts: Record<string, number> = {};
      for (const [v, c] of valMap.entries()) counts[v] = c;
      result[attrName] = { values, counts };
    }
    return result;
  }, [products]);

  const categoryCounts = React.useMemo(() => {
    const counts: Record<string, number> = {};
    products.forEach(p => {
      if (p.isParent) return;
      const parts = splitCategoryPath(p.categoryPath || p.categoryId || '');
      let currentPath = '';
      parts.forEach(part => {
        currentPath = currentPath ? `${currentPath} >> ${part}` : part;
        counts[currentPath] = (counts[currentPath] || 0) + 1;
      });
    });
    return counts;
  }, [products]);

  // BUG-32: tổng tồn kho từ variants cho từng sản phẩm cha
  const parentTotalStock = React.useMemo(() => {
    const map = new Map<string, number>();
    for (const p of products) {
      if (p.parentId) {
        map.set(p.parentId, (map.get(p.parentId) ?? 0) + (p.stock || 0));
      }
    }
    return map;
  }, [products]);

  // Map parentId → Set<childId> — dùng để filter platform khi platform set chứa variant IDs
  const parentToChildIds = React.useMemo(() => {
    const map = new Map<string, Set<string>>();
    for (const p of products) {
      if (p.parentId) {
        if (!map.has(p.parentId)) map.set(p.parentId, new Set());
        map.get(p.parentId)!.add(p.id);
      }
    }
    return map;
  }, [products]);

  // Map id → product cho tra cứu nhanh parent
  const productById = React.useMemo(() => {
    const map = new Map<string, POSProduct>();
    for (const p of products) map.set(p.id, p);
    return map;
  }, [products]);

  const filteredProductCandidates = React.useMemo(() => {
    // Hàm tìm kiếm theo 1 term, trả về resultSet
    const runSearch = (term: string): Map<string, POSProduct> => {
      const raw = searchProducts(term);
      const resultSet = new Map<string, POSProduct>();
      for (const p of raw) resultSet.set(p.id, p);
      for (const p of raw) {
        if (p.parentId) {
          const parent = productById.get(p.parentId);
          if (parent) resultSet.set(parent.id, parent);
        }
      }
      for (const p of products) {
        if (!fuzzyMatch(p.sku || '', term)) continue;
        if (p.parentId) {
          const parent = productById.get(p.parentId);
          if (parent) resultSet.set(parent.id, parent);
        } else {
          resultSet.set(p.id, p);
        }
      }
      return resultSet;
    };

    let searchResults: POSProduct[];
    const allTerms = [...searchTags, ...(debouncedSearchTerm ? [debouncedSearchTerm] : [])];
    if (allTerms.length > 0) {
      // Union kết quả của tất cả các term
      const unionSet = new Map<string, POSProduct>();
      for (const term of allTerms) {
        for (const [id, p] of runSearch(term)) unionSet.set(id, p);
      }
      searchResults = Array.from(unionSet.values());
    } else {
      searchResults = products;
    }

    // Apply other filters on search results (much smaller set)
    return searchResults.filter(p => {
      const productCategoryPath = getProductCategoryPath(p);
      const matchCategory =
        filterCategories.length === 0 ||
        filterCategories.some(fc => categoryMatchesSelection(productCategoryPath, fc));
      const matchBrand =
        !filterBrand || (p.brand || '').toLowerCase().includes(filterBrand.toLowerCase());
      // BUG-32: dùng tổng stock của variants cho sản phẩm cha
      const effectiveStock = p.isParent ? (parentTotalStock.get(p.id) ?? 0) : p.stock;
      const matchStock =
        filterStock === 'all'
          ? true
          : filterStock === 'in_stock'
            ? effectiveStock > 0
            : filterStock === 'out_of_stock'
              ? effectiveStock <= 0
              : effectiveStock > 0 && effectiveStock <= (p.minStock ?? 5);
      const matchLocation =
        !filterLocation || (p.location || '').toLowerCase().includes(filterLocation.toLowerCase());
      const matchAttr =
        filterAttrs.length === 0 ||
        filterAttrs.some(
          val =>
            Object.values(p.variantAttributes || {}).includes(val) ||
            (p.attributes || []).some(a => a.values.includes(val))
        );
      const matchSupplier =
        filterSupplier.length === 0 ||
        filterSupplier.some(sel => {
          if (productSupplierMap.get(p.id)?.has(sel)) return true;
          if (!p.parentId) return parentProductSupplierMap.get(p.id)?.has(sel) ?? false;
          // Variant chưa có phiếu nhập riêng → kiểm tra qua parent
          return productSupplierMap.get(p.parentId)?.has(sel) ?? parentProductSupplierMap.get(p.parentId)?.has(sel) ?? false;
        });
      const matchPlatform =
        filterPlatforms.length === 0 ||
        filterPlatforms.some(key => {
          const idSet = platformProductIds.get(key);
          if (!idSet) return false;
          // Self match (standalone product or variant linked directly)
          if (idSet.has(p.id)) return true;
          // Variant product: check parent
          if (p.parentId && idSet.has(p.parentId)) return true;
          // Parent product: check if any child variant is linked (platform sets contain variant IDs)
          const children = parentToChildIds.get(p.id);
          if (children) {
            for (const childId of children) {
              if (idSet.has(childId)) return true;
            }
          }
          return false;
        });
      return matchCategory && matchBrand && matchStock && matchLocation && matchAttr && matchSupplier && matchPlatform;
    });
  }, [
    searchProducts,
    debouncedSearchTerm,
    searchTags,
    products,
    productById,
    filterCategories,
    filterBrand,
    filterStock,
    filterLocation,
    filterAttrs,
    filterSupplier,
    productSupplierMap,
    parentProductSupplierMap,
    parentTotalStock,
    filterPlatforms,
    platformProductIds,
    parentToChildIds,
  ]);


  // Tách riêng để filteredProducts không cần products trong deps (tránh re-sort khi products thay đổi mà filteredProductCandidates không đổi)
  const parentSkuFallback = React.useMemo(() => {
    const map = new Map<string, number>();
    for (const p of products) {
      if (!p.parentId || !p.sku) continue;
      const current = map.get(p.parentId) ?? 0;
      map.set(p.parentId, Math.max(current, getSkuNumber(p.sku)));
    }
    return map;
  }, [products]);

  const filteredProducts = React.useMemo(
    () => sortProducts(
      filteredProductCandidates.filter(p => !p.parentId),
      sortKey,
      sortDirection,
      parentSkuFallback
    ),
    [filteredProductCandidates, sortKey, sortDirection, parentSkuFallback]
  );

  // BUG-38: thống nhất với filteredProducts (lọc !p.parentId = rows bảng)
  const sellableSkuCount = React.useMemo(
    () => filteredProductCandidates.filter(p => !p.parentId).length,
    [filteredProductCandidates]
  );

  const totalPages = Math.ceil(filteredProducts.length / itemsPerPage);
  const currentProducts = React.useMemo(() => {
    return filteredProducts.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);
  }, [filteredProducts, currentPage, itemsPerPage]);

  const variantsByParentId = React.useMemo(() => {
    const map = new Map<string, POSProduct[]>();
    // BUG-44: đổi tên tránh shadowing biến parentSkuFallback ở outer scope
    const variantParentSkuFallback = new Map<string, number>();
    for (const p of products) {
      if (p.parentId) {
        const arr = map.get(p.parentId);
        if (arr) arr.push(p);
        else map.set(p.parentId, [p]);
        if (p.sku) {
          const current = variantParentSkuFallback.get(p.parentId) ?? 0;
          variantParentSkuFallback.set(p.parentId, Math.max(current, getSkuNumber(p.sku)));
        }
      }
    }
    map.forEach((items, parentId) => {
      map.set(parentId, sortProducts(items, sortKey, sortDirection, variantParentSkuFallback));
    });
    return map;
  }, [products, sortKey, sortDirection]);

  return {
    lowStockProducts,
    uniqueCategories,
    uniqueBrands,
    uniqueLocations,
    uniqueSuppliers,
    attrValuesByName,
    categoryCounts,
    filteredProducts,
    sellableSkuCount,
    totalPages,
    currentProducts,
    variantsByParentId,
  };
};
