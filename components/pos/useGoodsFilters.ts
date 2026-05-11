import React from 'react';
import { POSProduct } from '../../types';

interface UseGoodsFiltersParams {
  products: POSProduct[];
  debouncedSearchTerm: string;
  filterCategories: string[];
  filterBrand: string;
  filterStock: 'all' | 'in_stock' | 'out_of_stock' | 'low_stock';
  filterLocation: string;
  filterAttrs: string[];
  currentPage: number;
  itemsPerPage: number;
}

export const useGoodsFilters = ({
  products,
  debouncedSearchTerm,
  filterCategories,
  filterBrand,
  filterStock,
  filterLocation,
  filterAttrs,
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

  const uniqueAttrTypes = React.useMemo(
    () => Array.from(new Set(products.flatMap(p => Object.keys(p.variantAttributes || {})))).sort(),
    [products]
  );

  const categoryCounts = React.useMemo(() => {
    const counts: Record<string, number> = {};
    products.forEach(p => {
      if (p.categoryId) counts[p.categoryId] = (counts[p.categoryId] || 0) + 1;
    });
    return counts;
  }, [products]);

  const filteredProducts = React.useMemo(() => {
    const lowerSearch = debouncedSearchTerm.toLowerCase();
    const filtered = products.filter(p => {
      const matchSearch = (p.name?.toLowerCase() || '').includes(lowerSearch) || (p.sku?.toLowerCase() || '').includes(lowerSearch);
      const matchCategory = filterCategories.length === 0 || filterCategories.includes(p.categoryId);
      const matchBrand = !filterBrand || (p.brand || '').toLowerCase().includes(filterBrand.toLowerCase());
      const matchStock =
        filterStock === 'all' ? true :
        filterStock === 'in_stock' ? p.stock > 0 :
        filterStock === 'out_of_stock' ? p.stock === 0 :
        p.stock <= (p.minStock ?? 5);
      const matchLocation = !filterLocation || (p.location || '').toLowerCase().includes(filterLocation.toLowerCase());
      const matchAttr = filterAttrs.length === 0 || filterAttrs.some(a => Object.keys(p.variantAttributes || {}).includes(a));
      return matchSearch && matchCategory && matchBrand && matchStock && matchLocation && matchAttr;
    });

    return filtered.filter(p => !p.parentId);
  }, [products, debouncedSearchTerm, filterCategories, filterBrand, filterStock, filterLocation, filterAttrs]);

  const totalPages = Math.ceil(filteredProducts.length / itemsPerPage);
  const currentProducts = React.useMemo(() => {
    return filteredProducts.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);
  }, [filteredProducts, currentPage, itemsPerPage]);

  return {
    lowStockProducts,
    uniqueCategories,
    uniqueBrands,
    uniqueLocations,
    uniqueAttrTypes,
    categoryCounts,
    filteredProducts,
    totalPages,
    currentProducts,
  };
};
