import { useMemo } from 'react';
import { POSProduct } from '../../types';
import { removeDiacritics, fuzzyMatch } from '../../src/lib/fuzzySearch';

export const useProductSearchIndex = (products: POSProduct[]) => {
  const searchIndex = useMemo(() => {
    const nameIndex = new Map<string, Set<string>>();
    const skuIndex = new Map<string, Set<string>>();
    const productMap = new Map<string, POSProduct>();

    products.forEach(product => {
      productMap.set(product.id, product);

      if (product.name) {
        // Index bằng key đã bỏ dấu để khớp khi user gõ không dấu
        const normName = removeDiacritics(product.name.toLowerCase());
        const nameKey2 = normName.substring(0, 2);
        const nameKey3 = normName.substring(0, 3);
        if (!nameIndex.has(nameKey2)) nameIndex.set(nameKey2, new Set());
        nameIndex.get(nameKey2)!.add(product.id);
        if (product.name.length >= 3) {
          if (!nameIndex.has(nameKey3)) nameIndex.set(nameKey3, new Set());
          nameIndex.get(nameKey3)!.add(product.id);
        }
      }

      if (product.sku) {
        const skuKey = product.sku.substring(0, 2).toLowerCase();
        if (!skuIndex.has(skuKey)) skuIndex.set(skuKey, new Set());
        skuIndex.get(skuKey)!.add(product.id);
        const fullSkuKey = product.sku.toLowerCase();
        if (!skuIndex.has(fullSkuKey)) skuIndex.set(fullSkuKey, new Set());
        skuIndex.get(fullSkuKey)!.add(product.id);
      }
    });

    return { nameIndex, skuIndex, productMap };
  }, [products]);

  const searchProducts = useMemo(() => {
    return (searchTerm: string): POSProduct[] => {
      if (!searchTerm || searchTerm.trim().length < 2) return products;

      // Dùng từ đầu tiên (đã bỏ dấu) để tra index
      const firstWord = removeDiacritics(searchTerm.toLowerCase()).split(/\s+/)[0] || '';
      const candidateIds = new Set<string>();

      if (firstWord.length >= 2) {
        const nameKey2 = firstWord.substring(0, 2);
        const nameKey3 = firstWord.substring(0, 3);
        const skuKey = firstWord.substring(0, 2);
        searchIndex.nameIndex.get(nameKey2)?.forEach(id => candidateIds.add(id));
        searchIndex.nameIndex.get(nameKey3)?.forEach(id => candidateIds.add(id));
        searchIndex.skuIndex.get(skuKey)?.forEach(id => candidateIds.add(id));
        searchIndex.skuIndex.get(searchTerm.toLowerCase())?.forEach(id => candidateIds.add(id));
      }

      // Không tìm thấy trong index → full scan với fuzzyMatch
      if (candidateIds.size === 0) {
        return products.filter(p =>
          fuzzyMatch(p.name || '', searchTerm) || fuzzyMatch(p.sku || '', searchTerm)
        );
      }

      // Lọc candidates bằng fuzzyMatch (hỗ trợ đảo thứ tự từ, không dấu)
      const results: POSProduct[] = [];
      candidateIds.forEach(id => {
        const product = searchIndex.productMap.get(id);
        if (product && (fuzzyMatch(product.name || '', searchTerm) || fuzzyMatch(product.sku || '', searchTerm))) {
          results.push(product);
        }
      });

      return results;
    };
  }, [products, searchIndex]);

  return { searchProducts, indexSize: searchIndex.productMap.size };
};
