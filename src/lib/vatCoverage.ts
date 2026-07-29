import type {
  InventoryTransaction,
  OpeningStockItem,
  POSProduct,
  SkuVatGroupMapping,
  Supplier,
  SupplierAlias,
  TaxFilingPeriod,
  VatAllocation,
  VatCoverageRow,
  VatDocument,
  VatDocumentItem,
  VatGroup,
  VatGroupKeyword,
  VatReconciliationRow,
  VatReconciliationStage,
  VatReconciliationSummary,
  VatRiskStatus,
} from '../../types';

const DAY_MS = 24 * 60 * 60 * 1000;

export const normalizeVatText = (value: string) =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'd')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const clampPercent = (value: number) => Math.max(0, Math.min(100, value));
const safeNumber = (value: unknown) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const safeText = (value: unknown) => (typeof value === 'string' && value.trim() ? value.trim() : '');

const getSourceProductGroupName = (
  item: InventoryTransaction['items'][number] | OpeningStockItem | VatDocumentItem,
  product?: POSProduct
) => {
  const itemRecord = item as Record<string, unknown>;
  const productRecord = (product || {}) as Record<string, unknown>;
  return (
    safeText(itemRecord.productGroupName) ||
    safeText(itemRecord.groupName) ||
    safeText(itemRecord.categoryName) ||
    safeText(itemRecord.categoryPath) ||
    safeText(itemRecord.categoryId) ||
    safeText(itemRecord.category) ||
    safeText(productRecord.categoryPath) ||
    safeText(productRecord.categoryId) ||
    safeText(productRecord.groupName) ||
    safeText(productRecord.categoryName) ||
    safeText(productRecord.category) ||
    safeText(itemRecord.productName) ||
    safeText(itemRecord.name) ||
    safeText(productRecord.name) ||
    'Chưa rõ nhóm hàng'
  );
};

const getUnmappedVatGroupId = (sourceGroupName: string) => `unmapped:${normalizeVatText(sourceGroupName) || 'unknown'}`;
const getSourceProductGroupId = (sourceGroupName: string) => `source:${normalizeVatText(sourceGroupName) || 'unknown'}`;

export const isUnmappedVatGroupId = (vatGroupId?: string | null) =>
  !vatGroupId || vatGroupId === 'unmapped' || vatGroupId.startsWith('unmapped:');

const getPurchaseItemKey = (receipt: InventoryTransaction, index: number, productId?: string, sku?: string) =>
  `${receipt.id}:${productId || sku || index}`;

const getReceiptAmount = (receipt: InventoryTransaction) =>
  safeNumber(receipt.totalAmount) ||
  receipt.items.reduce((sum, item) => {
    const price = safeNumber(item.price);
    const discount = safeNumber(item.discount);
    return sum + safeNumber(item.quantity) * Math.max(0, price - discount);
  }, 0);

export const getPurchaseItemAmount = (receipt: InventoryTransaction, item: InventoryTransaction['items'][number]) => {
  const price = safeNumber(item.price);
  const discount = safeNumber(item.discount);
  const quantity = safeNumber(item.quantity);
  if (price > 0 || discount > 0) return quantity * Math.max(0, price - discount);

  const receiptAmount = getReceiptAmount(receipt);
  const totalQuantity = receipt.items.reduce((sum, row) => sum + safeNumber(row.quantity), 0);
  return totalQuantity > 0 ? (receiptAmount * quantity) / totalQuantity : 0;
};

const getReceiptAgeDays = (receipt: InventoryTransaction, now = new Date()) => {
  const receiptDate = new Date(receipt.date);
  if (Number.isNaN(receiptDate.getTime())) return 0;
  return Math.floor((now.getTime() - receiptDate.getTime()) / DAY_MS);
};

export const matchSupplierForVatDocument = (
  invoiceSupplierName: string,
  invoiceTaxCode: string | undefined,
  suppliers: Supplier[],
  aliases: SupplierAlias[]
) => {
  const normalizedName = normalizeVatText(invoiceSupplierName);
  const taxCode = (invoiceTaxCode || '').replace(/\D/g, '');

  if (taxCode) {
    const supplierByTax = suppliers.find(supplier => (supplier.taxCode || '').replace(/\D/g, '') === taxCode);
    if (supplierByTax) {
      return { supplier: supplierByTax, confidence: 1, status: 'matched' as const, reason: 'tax_code' };
    }
    const aliasByTax = aliases.find(alias => (alias.taxCode || '').replace(/\D/g, '') === taxCode);
    const supplier = aliasByTax ? suppliers.find(item => item.id === aliasByTax.supplierId) : undefined;
    if (supplier) return { supplier, confidence: 0.95, status: 'matched' as const, reason: 'alias_tax_code' };
  }

  const alias = aliases.find(item => normalizeVatText(item.aliasName) === normalizedName);
  if (alias) {
    const supplier = suppliers.find(item => item.id === alias.supplierId);
    if (supplier) return { supplier, confidence: 0.9, status: 'matched' as const, reason: 'alias_name' };
  }

  const scored = suppliers
    .map(supplier => {
      const supplierText = normalizeVatText(`${supplier.name} ${supplier.companyName || ''} ${supplier.code || ''}`);
      const confidence =
        supplierText === normalizedName
          ? 0.86
          : supplierText.includes(normalizedName) || normalizedName.includes(supplierText)
            ? 0.72
            : normalizedName
                .split(' ')
                .filter(token => token.length > 2 && supplierText.includes(token)).length /
              Math.max(1, normalizedName.split(' ').filter(token => token.length > 2).length);
      return { supplier, confidence };
    })
    .sort((a, b) => b.confidence - a.confidence);

  const best = scored[0];
  if (!best || best.confidence < 0.45) {
    return { supplier: undefined, confidence: 0, status: 'unmatched' as const, reason: 'no_match' };
  }

  return {
    supplier: best.supplier,
    confidence: best.confidence,
    status: best.confidence >= 0.75 ? ('matched' as const) : ('needs_confirmation' as const),
    reason: 'fuzzy_name',
  };
};

export const matchVatGroupForInvoiceLine = (
  description: string,
  groups: VatGroup[],
  keywords: VatGroupKeyword[]
) => {
  const normalized = normalizeVatText(description);
  const matches = keywords
    .map(keyword => {
      const key = keyword.normalizedKeyword || normalizeVatText(keyword.keyword);
      if (!key) return null;
      const confidence = normalized === key ? 1 : normalized.includes(key) ? Math.min(0.95, key.length / Math.max(normalized.length, 1) + 0.45) : 0;
      return confidence > 0 ? { keyword, confidence } : null;
    })
    .filter(Boolean)
    .sort((a, b) => (b?.confidence || 0) - (a?.confidence || 0));

  const best = matches[0];
  if (!best) return { vatGroup: undefined, confidence: 0, status: 'needs_confirmation' as const };

  const vatGroup = groups.find(group => group.id === best.keyword.vatGroupId);
  return {
    vatGroup,
    confidence: best.confidence,
    status: best.confidence >= 0.75 ? ('suggested' as const) : ('needs_confirmation' as const),
  };
};

export const buildSkuVatGroupLookup = (products: POSProduct[], mappings: SkuVatGroupMapping[]) => {
  const lookup = new Map<string, SkuVatGroupMapping>();
  const mappingByProductId = new Map<string, SkuVatGroupMapping>();
  const mappingBySku = new Map<string, SkuVatGroupMapping>();
  const mappingByProductName = new Map<string, SkuVatGroupMapping>();

  mappings.forEach(mapping => {
    if (mapping.sku) {
      const normalizedSku = normalizeVatText(mapping.sku);
      lookup.set(normalizedSku, mapping);
      mappingBySku.set(normalizedSku, mapping);
    }
    if (mapping.productId) {
      lookup.set(mapping.productId, mapping);
      mappingByProductId.set(mapping.productId, mapping);
    }
    if (mapping.productName) {
      const normalizedName = normalizeVatText(mapping.productName);
      lookup.set(normalizedName, mapping);
      mappingByProductName.set(normalizedName, mapping);
    }
  });

  products.forEach(product => {
    const mapping =
      mappingByProductId.get(product.id) ||
      mappingBySku.get(normalizeVatText(product.sku || '')) ||
      mappingByProductName.get(normalizeVatText(product.name || ''));
    if (!mapping) return;
    lookup.set(product.id, mapping);
    lookup.set(normalizeVatText(product.sku || ''), mapping);
    lookup.set(normalizeVatText(product.name || ''), mapping);
  });
  return lookup;
};

export const getReceiptVatGroupRows = (
  receipts: InventoryTransaction[],
  products: POSProduct[],
  mappings: SkuVatGroupMapping[],
  groups: VatGroup[]
) => {
  const lookup = buildSkuVatGroupLookup(products, mappings);
  const groupById = new Map(groups.map(group => [group.id, group]));
  const productById = new Map(products.map(product => [product.id, product]));

  return receipts
    .filter(receipt => receipt.type === 'Import' && receipt.status !== 'cancelled')
    .flatMap(receipt =>
      receipt.items.map((item, index) => {
        const product = productById.get(item.productId);
        const mapping =
          lookup.get(item.productId) ||
          lookup.get(normalizeVatText(item.sku || '')) ||
          lookup.get(normalizeVatText(item.productName || '')) ||
          lookup.get(normalizeVatText(item.name || '')) ||
          (product ? lookup.get(product.id) || lookup.get(normalizeVatText(product.sku || '')) || lookup.get(normalizeVatText(product.name || '')) : undefined);
        const vatGroup = mapping ? groupById.get(mapping.vatGroupId) : undefined;
        const sourceGroupName = getSourceProductGroupName(item, product);
        const sourceGroupId = getSourceProductGroupId(sourceGroupName);
        const quantity = safeNumber(item.quantity);
        return {
          receipt,
          item,
          itemIndex: index,
          purchaseReceiptItemId: getPurchaseItemKey(receipt, index, item.productId, item.sku),
          vatGroupId: vatGroup?.id || getUnmappedVatGroupId(sourceGroupName),
          vatGroupName: sourceGroupName,
          sourceGroupId,
          sourceGroupName,
          isVatMapped: Boolean(vatGroup),
          quantity,
          amount: getPurchaseItemAmount(receipt, item),
          supplierId: receipt.supplierId,
          supplierName: receipt.supplierName || 'Không rõ NCC',
        };
      })
    );
};

export const buildVatCoverageByGroup = (
  receipts: InventoryTransaction[],
  products: POSProduct[],
  groups: VatGroup[],
  mappings: SkuVatGroupMapping[],
  allocations: VatAllocation[],
  now = new Date()
): VatCoverageRow[] => {
  const purchaseRows = getReceiptVatGroupRows(receipts, products, mappings, groups);
  const purchaseRowByItemId = new Map(purchaseRows.map(row => [row.purchaseReceiptItemId, row]));
  const purchaseRowsByReceiptId = new Map<string, typeof purchaseRows>();
  purchaseRows.forEach(row => {
    const rows = purchaseRowsByReceiptId.get(row.receipt.id) || [];
    rows.push(row);
    purchaseRowsByReceiptId.set(row.receipt.id, rows);
  });

  const activeAllocations = allocations.filter(allocation => (allocation.status || 'active') === 'active');
  const allocationByGroup = new Map<string, { quantity: number; amount: number; receiptIds: Set<string> }>();
  activeAllocations.forEach(allocation => {
    const receiptRow =
      (allocation.purchaseReceiptItemId && purchaseRowByItemId.get(allocation.purchaseReceiptItemId)) ||
      (allocation.purchaseReceiptId
        ? purchaseRowsByReceiptId.get(allocation.purchaseReceiptId)?.find(row => row.vatGroupId === allocation.vatGroupId)
        : undefined);
    const coverageGroupId = receiptRow?.sourceGroupId;
    if (!coverageGroupId) return;
    const row = allocationByGroup.get(coverageGroupId) ?? { quantity: 0, amount: 0, receiptIds: new Set<string>() };
    row.quantity += safeNumber(allocation.allocatedQuantity);
    row.amount += safeNumber(allocation.allocatedAmount);
    row.receiptIds.add(allocation.purchaseReceiptId);
    allocationByGroup.set(coverageGroupId, row);
  });

  const byGroup = new Map<string, VatCoverageRow & { receiptIds: Set<string>; missingReceiptIds: Set<string>; supplierSet: Set<string>; maxAge: number; allVatMapped: boolean }>();

  purchaseRows.forEach(row => {
    const current = byGroup.get(row.sourceGroupId) ?? {
      vatGroupId: row.sourceGroupId,
      vatGroupName: row.sourceGroupName,
      totalPurchasedQuantity: 0,
      totalPurchasedAmount: 0,
      vatCoveredQuantity: 0,
      vatCoveredAmount: 0,
      missingQuantity: 0,
      missingAmount: 0,
      coveragePercent: 0,
      missingReceiptCount: 0,
      supplierNames: [],
      riskStatus: 'missing' as VatRiskStatus,
      receiptIds: new Set<string>(),
      missingReceiptIds: new Set<string>(),
      supplierSet: new Set<string>(),
      maxAge: 0,
      allVatMapped: true,
    };
    current.totalPurchasedQuantity += row.quantity;
    current.totalPurchasedAmount += row.amount;
    current.receiptIds.add(row.receipt.id);
    current.supplierSet.add(row.supplierName);
    current.maxAge = Math.max(current.maxAge, getReceiptAgeDays(row.receipt, now));
    current.allVatMapped = current.allVatMapped && row.isVatMapped;
    byGroup.set(row.sourceGroupId, current);
  });

  byGroup.forEach(row => {
    const allocated = allocationByGroup.get(row.vatGroupId);
    row.vatCoveredQuantity = Math.min(row.totalPurchasedQuantity, allocated?.quantity || 0);
    row.vatCoveredAmount = Math.min(row.totalPurchasedAmount, allocated?.amount || 0);
    row.missingQuantity = Math.max(0, row.totalPurchasedQuantity - row.vatCoveredQuantity);
    row.missingAmount = Math.max(0, row.totalPurchasedAmount - row.vatCoveredAmount);
    row.coveragePercent = row.totalPurchasedAmount > 0 ? clampPercent((row.vatCoveredAmount / row.totalPurchasedAmount) * 100) : 0;
    row.missingReceiptCount = row.missingAmount > 0 ? row.receiptIds.size : 0;
    row.supplierNames = Array.from(row.supplierSet).sort((a, b) => a.localeCompare(b, 'vi'));

    const overAllocated = (allocated?.amount || 0) > row.totalPurchasedAmount || (allocated?.quantity || 0) > row.totalPurchasedQuantity;
    if (overAllocated) row.riskStatus = 'over_allocated';
    else if (!row.allVatMapped) row.riskStatus = 'needs_mapping';
    else if (row.coveragePercent >= 100) row.riskStatus = 'covered';
    else if (row.maxAge > 30) row.riskStatus = 'overdue_30';
    else if (row.maxAge > 15) row.riskStatus = 'overdue_15';
    else row.riskStatus = row.coveragePercent > 0 ? 'partial' : 'missing';
  });

  return Array.from(byGroup.values())
    .map(({ receiptIds: _receiptIds, missingReceiptIds: _missingReceiptIds, supplierSet: _supplierSet, maxAge: _maxAge, allVatMapped: _allVatMapped, ...row }) => row)
    .sort((a, b) => b.missingAmount - a.missingAmount || a.vatGroupName.localeCompare(b.vatGroupName, 'vi'));
};

const getReconciliationStageLabel = (stage: VatReconciliationStage) =>
  stage === 'opening_stock' ? 'Tồn đầu kỳ' : 'Sau kê khai';

const getReconciliationKey = (stage: VatReconciliationStage, supplierId: string, vatGroupId: string) =>
  `${stage}:${supplierId || 'unknown'}:${vatGroupId || 'unmapped'}`;

export const buildVatFilingReconciliation = ({
  period,
  openingStockItems,
  receipts,
  products,
  groups,
  mappings,
  allocations,
  documents,
  documentItems,
}: {
  period?: TaxFilingPeriod;
  openingStockItems: OpeningStockItem[];
  receipts: InventoryTransaction[];
  products: POSProduct[];
  groups: VatGroup[];
  mappings: SkuVatGroupMapping[];
  allocations: VatAllocation[];
  documents: VatDocument[];
  documentItems: VatDocumentItem[];
}): { rows: VatReconciliationRow[]; summary: VatReconciliationSummary } => {
  const groupById = new Map(groups.map(group => [group.id, group]));
  const receiptRows = getReceiptVatGroupRows(
    period ? receipts.filter(receipt => receipt.date >= period.startDate) : receipts,
    products,
    mappings,
    groups
  );
  const openingById = new Map(openingStockItems.map(item => [item.id, item]));
  const receiptRowByItemId = new Map(receiptRows.map(row => [row.purchaseReceiptItemId, row]));
  const receiptRowsByReceipt = new Map<string, typeof receiptRows>();
  receiptRows.forEach(row => {
    const list = receiptRowsByReceipt.get(row.receipt.id) || [];
    list.push(row);
    receiptRowsByReceipt.set(row.receipt.id, list);
  });

  const byKey = new Map<string, VatReconciliationRow>();
  const ensureRow = ({
    stage,
    supplierId,
    supplierName,
    vatGroupId,
    vatGroupName,
  }: {
    stage: VatReconciliationStage;
    supplierId?: string;
    supplierName?: string;
    vatGroupId: string;
    vatGroupName: string;
  }) => {
    const key = getReconciliationKey(stage, supplierId || 'unknown', vatGroupId);
    const existing = byKey.get(key);
    if (existing) return existing;
    const row: VatReconciliationRow = {
      id: key,
      stage,
      stageLabel: getReconciliationStageLabel(stage),
      supplierId,
      supplierName: supplierName || 'Không rõ NCC',
      vatGroupId,
      vatGroupName,
      itemCount: 0,
      invoiceCount: 0,
      goodsQuantity: 0,
      goodsAmount: 0,
      validAllocatedAmount: 0,
      overAllocatedAmount: 0,
      missingAmount: 0,
      coveragePercent: 0,
      riskStatus: 'missing',
    };
    byKey.set(key, row);
    return row;
  };

  openingStockItems
    .filter(item => !period || item.filingPeriodId === period.id)
    .forEach(item => {
      const vatGroup = item.vatGroupId ? groupById.get(item.vatGroupId) : undefined;
      const sourceGroupName = getSourceProductGroupName(item);
      const row = ensureRow({
        stage: 'opening_stock',
        supplierId: item.supplierId,
        supplierName: item.supplierName,
        vatGroupId: vatGroup?.id || getUnmappedVatGroupId(sourceGroupName),
        vatGroupName: vatGroup?.name || sourceGroupName,
      });
      row.itemCount += 1;
      row.goodsQuantity += safeNumber(item.quantity);
      row.goodsAmount += safeNumber(item.totalAmount);
    });

  receiptRows.forEach(rowData => {
    const row = ensureRow({
      stage: 'post_filing',
      supplierId: rowData.supplierId,
      supplierName: rowData.supplierName,
      vatGroupId: rowData.vatGroupId,
      vatGroupName: rowData.vatGroupName,
    });
    row.itemCount += 1;
    row.goodsQuantity += rowData.quantity;
    row.goodsAmount += rowData.amount;
  });

  const itemById = new Map(documentItems.map(item => [item.id, item]));
  const documentById = new Map(documents.map(doc => [doc.id, doc]));
  const invoiceIdsByKey = new Map<string, Set<string>>();

  allocations
    .filter(allocation => (allocation.status || 'active') === 'active')
    .forEach(allocation => {
      let target:
        | {
            stage: VatReconciliationStage;
            supplierId?: string;
            supplierName?: string;
            vatGroupId: string;
            vatGroupName: string;
          }
        | undefined;

      if ((allocation.targetType || 'purchase_receipt') === 'opening_stock' || allocation.openingStockItemId) {
        const opening = allocation.openingStockItemId ? openingById.get(allocation.openingStockItemId) : undefined;
        const vatGroup = groupById.get(allocation.vatGroupId) || (opening?.vatGroupId ? groupById.get(opening.vatGroupId) : undefined);
        const sourceGroupName = opening ? getSourceProductGroupName(opening) : '';
        target = {
          stage: 'opening_stock',
          supplierId: opening?.supplierId,
          supplierName: opening?.supplierName,
          vatGroupId: vatGroup?.id || allocation.vatGroupId || getUnmappedVatGroupId(sourceGroupName),
          vatGroupName: vatGroup?.name || sourceGroupName || 'Chưa rõ nhóm hàng',
        };
      } else {
        const receiptRow =
          (allocation.purchaseReceiptItemId && receiptRowByItemId.get(allocation.purchaseReceiptItemId)) ||
          (allocation.purchaseReceiptId ? receiptRowsByReceipt.get(allocation.purchaseReceiptId)?.[0] : undefined);
        if (!receiptRow) return;
        const vatGroup = groupById.get(allocation.vatGroupId);
        target = {
          stage: 'post_filing',
          supplierId: receiptRow.supplierId,
          supplierName: receiptRow.supplierName,
          vatGroupId: vatGroup?.id || receiptRow.vatGroupId || allocation.vatGroupId || getUnmappedVatGroupId(receiptRow.vatGroupName || ''),
          vatGroupName: vatGroup?.name || receiptRow.vatGroupName || 'Chưa rõ nhóm hàng',
        };
      }

      const row = ensureRow(target);
      row.validAllocatedAmount += safeNumber(allocation.allocatedAmount);

      const invoiceItem = itemById.get(allocation.vatDocumentItemId);
      const invoice = invoiceItem ? documentById.get(invoiceItem.vatDocumentId) : undefined;
      if (invoice) {
        const key = getReconciliationKey(row.stage, row.supplierId || 'unknown', row.vatGroupId);
        const set = invoiceIdsByKey.get(key) || new Set<string>();
        set.add(invoice.id);
        invoiceIdsByKey.set(key, set);
      }
    });

  byKey.forEach(row => {
    const rawAllocated = row.validAllocatedAmount;
    row.validAllocatedAmount = Math.min(row.goodsAmount, rawAllocated);
    row.overAllocatedAmount = Math.max(0, rawAllocated - row.goodsAmount);
    row.missingAmount = Math.max(0, row.goodsAmount - row.validAllocatedAmount);
    row.coveragePercent = row.goodsAmount > 0 ? clampPercent((row.validAllocatedAmount / row.goodsAmount) * 100) : 0;
    row.invoiceCount = invoiceIdsByKey.get(getReconciliationKey(row.stage, row.supplierId || 'unknown', row.vatGroupId))?.size || 0;
    if (row.overAllocatedAmount > 0) row.riskStatus = 'over_allocated';
    else if (isUnmappedVatGroupId(row.vatGroupId)) row.riskStatus = 'needs_mapping';
    else if (row.coveragePercent >= 100) row.riskStatus = 'covered';
    else row.riskStatus = row.coveragePercent > 0 ? 'partial' : 'missing';
  });

  const rows = Array.from(byKey.values()).sort(
    (a, b) =>
      a.stage.localeCompare(b.stage) ||
      b.missingAmount - a.missingAmount ||
      a.vatGroupName.localeCompare(b.vatGroupName, 'vi') ||
      a.supplierName.localeCompare(b.supplierName, 'vi')
  );

  const openingRows = rows.filter(row => row.stage === 'opening_stock');
  const postRows = rows.filter(row => row.stage === 'post_filing');
  const summary: VatReconciliationSummary = {
    openingGoodsAmount: openingRows.reduce((sum, row) => sum + row.goodsAmount, 0),
    openingVatCoveredAmount: openingRows.reduce((sum, row) => sum + row.validAllocatedAmount, 0),
    openingVatMissingAmount: openingRows.reduce((sum, row) => sum + row.missingAmount, 0),
    postFilingGoodsAmount: postRows.reduce((sum, row) => sum + row.goodsAmount, 0),
    postFilingVatCoveredAmount: postRows.reduce((sum, row) => sum + row.validAllocatedAmount, 0),
    postFilingVatMissingAmount: postRows.reduce((sum, row) => sum + row.missingAmount, 0),
    unallocatedDocumentAmount: documentItems.reduce((sum, item) => sum + Math.max(0, safeNumber(item.amountBeforeTax) - safeNumber(item.allocatedAmount)), 0),
    suppliersNeedVatCount: new Set(rows.filter(row => row.missingAmount > 0).map(row => row.supplierId || row.supplierName)).size,
    overAllocatedAmount: rows.reduce((sum, row) => sum + row.overAllocatedAmount, 0),
  };

  return { rows, summary };
};
