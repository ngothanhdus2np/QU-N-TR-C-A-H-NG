import React from 'react';
import { POSProduct } from '../../types';

export type GoodsSortKey = 'sku' | 'salePrice' | 'importPrice' | 'stock';
export type GoodsSortDirection = 'desc' | 'asc';

interface UseGoodsFiltersParams {
  products: POSProduct[];
  debouncedSearchTerm: string;
  filterCategories: string[];
  filterBrand: string;
  filterStock: 'all' | 'in_stock' | 'out_of_stock' | 'low_stock';
  filterLocation: string;
  filterAttrs: string[];
  sortKey: GoodsSortKey;
  sortDirection: GoodsSortDirection;
  currentPage: number;
  itemsPerPage: number;
}

const getSkuNumber = (sku: string) => {
  const matches = sku.match(/\d+/g);
  if (!matches) return 0;
  return Number(matches.join('')) || 0;
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
  debouncedSearchTerm,
  filterCategories,
  filterBrand,
  filterStock,
  filterLocation,
  filterAttrs,
  sortKey,
  sortDirection,
  currentPage,
  itemsPerPage,
}: UseGoodsFiltersParams) => {
  const lowStockProducts = React.useMemo(
    () => products.filter(p => p.status !== 'Inactive' && p.stock <= (p.minStock ?? 5)),
    [products]
  );

  const uniqueCategories = React.useMemo(
    () => Array.from(new Set(products.map(p => p.categoryId || '').filter(Boolean))).sort(),
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
      if (p.categoryId) counts[p.categoryId] = (counts[p.categoryId] || 0) + 1;
    });
    return counts;
  }, [products]);

  const filteredProductCandidates = React.useMemo(() => {
    const lowerSearch = debouncedSearchTerm.toLowerCase();
    return products.filter(p => {
      const matchSearch =
        (p.name?.toLowerCase() || '').includes(lowerSearch) ||
        (p.sku?.toLowerCase() || '').includes(lowerSearch);
      const matchCategory =
        filterCategories.length === 0 || filterCategories.includes(p.categoryId);
      const matchBrand =
        !filterBrand || (p.brand || '').toLowerCase().includes(filterBrand.toLowerCase());
      const matchStock =
        filterStock === 'all'
          ? true
          : filterStock === 'in_stock'
            ? p.stock > 0
            : filterStock === 'out_of_stock'
              ? p.stock === 0
              : p.stock <= (p.minStock ?? 5);
      const matchLocation =
        !filterLocation || (p.location || '').toLowerCase().includes(filterLocation.toLowerCase());
      const matchAttr =
        filterAttrs.length === 0 ||
        filterAttrs.some(
          val =>
            Object.values(p.variantAttributes || {}).includes(val) ||
            (p.attributes || []).some(a => a.values.includes(val))
        );
      return matchSearch && matchCategory && matchBrand && matchStock && matchLocation && matchAttr;
    });
  }, [
    products,
    debouncedSearchTerm,
    filterCategories,
    filterBrand,
    filterStock,
    filterLocation,
    filterAttrs,
  ]);

  const filteredProducts = React.useMemo(
    () => {
      const parentSkuFallback = new Map<string, number>();
      products.forEach(product => {
        if (!product.parentId || !product.sku) return;
        const current = parentSkuFallback.get(product.parentId) ?? 0;
        parentSkuFallback.set(product.parentId, Math.max(current, getSkuNumber(product.sku)));
      });
      return sortProducts(
        filteredProductCandidates.filter(p => !p.parentId),
        sortKey,
        sortDirection,
        parentSkuFallback
      );
    },
    [filteredProductCandidates, products, sortKey, sortDirection]
  );

  const sellableSkuCount = React.useMemo(
    () => filteredProductCandidates.filter(p => !p.isParent).length,
    [filteredProductCandidates]
  );

  const totalPages = Math.ceil(filteredProducts.length / itemsPerPage);
  const currentProducts = React.useMemo(() => {
    return filteredProducts.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);
  }, [filteredProducts, currentPage, itemsPerPage]);

  const variantsByParentId = React.useMemo(() => {
    const map = new Map<string, POSProduct[]>();
    const parentSkuFallback = new Map<string, number>();
    for (const p of products) {
      if (p.parentId) {
        const arr = map.get(p.parentId);
        if (arr) arr.push(p);
        else map.set(p.parentId, [p]);
        if (p.sku) {
          const current = parentSkuFallback.get(p.parentId) ?? 0;
          parentSkuFallback.set(p.parentId, Math.max(current, getSkuNumber(p.sku)));
        }
      }
    }
    map.forEach((items, parentId) => {
      map.set(parentId, sortProducts(items, sortKey, sortDirection, parentSkuFallback));
    });
    return map;
  }, [products, sortKey, sortDirection]);

  return {
    lowStockProducts,
    uniqueCategories,
    uniqueBrands,
    uniqueLocations,
    attrValuesByName,
    categoryCounts,
    filteredProducts,
    sellableSkuCount,
    totalPages,
    currentProducts,
    variantsByParentId,
  };
};
