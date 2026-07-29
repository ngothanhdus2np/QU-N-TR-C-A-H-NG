import { generateId } from '../src/lib';
import { normalizeVatText } from '../src/lib/vatCoverage';
import type {
  OpeningStockItem,
  POSProduct,
  SkuVatGroupMapping,
  SupplierAlias,
  TaxFilingPeriod,
  VatAllocation,
  VatDocument,
  VatDocumentItem,
  VatGroupKeyword,
} from '../types';
import { supabase } from './supabase';

const VAT_BUCKET = 'vat-documents';

type VatDocumentRow = {
  id: string;
  supplier_id?: string | null;
  supplier_name_on_invoice?: string | null;
  supplier_tax_code?: string | null;
  supplier_match_confidence?: number | null;
  supplier_match_status?: VatDocument['supplierMatchStatus'] | null;
  invoice_no: string;
  invoice_date: string;
  total_before_tax?: number | null;
  vat_amount?: number | null;
  total_amount?: number | null;
  file_pdf_url?: string | null;
  file_xml_url?: string | null;
  status: VatDocument['status'];
  note?: string | null;
  void_reason?: string | null;
  voided_at?: string | null;
  voided_by?: string | null;
  branch_id?: string | null;
  tenant_id?: string | null;
  created_at?: string | null;
  created_by?: string | null;
  updated_at?: string | null;
};

type VatDocumentItemRow = {
  id: string;
  vat_document_id: string;
  description_on_invoice: string;
  suggested_vat_group_id?: string | null;
  confirmed_vat_group_id?: string | null;
  quantity?: number | null;
  amount_before_tax?: number | null;
  vat_amount?: number | null;
  total_amount?: number | null;
  allocated_quantity?: number | null;
  allocated_amount?: number | null;
  remaining_quantity?: number | null;
  remaining_amount?: number | null;
  confidence_score?: number | null;
  mapping_status?: VatDocumentItem['mappingStatus'] | null;
  branch_id?: string | null;
  tenant_id?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
};

type SkuVatGroupMappingRow = {
  id: string;
  sku: string;
  product_id?: string | null;
  product_name?: string | null;
  vat_group_id: string;
  confidence_score?: number | null;
  source?: SkuVatGroupMapping['source'] | null;
  branch_id?: string | null;
  tenant_id?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
};

type SupplierAliasRow = {
  id: string;
  supplier_id: string;
  alias_name: string;
  tax_code?: string | null;
  branch_id?: string | null;
  tenant_id?: string | null;
  created_at?: string | null;
  created_by?: string | null;
};

type VatGroupKeywordRow = {
  id: string;
  vat_group_id: string;
  keyword: string;
  normalized_keyword: string;
  branch_id?: string | null;
  tenant_id?: string | null;
  created_at?: string | null;
  created_by?: string | null;
};

type VatAllocationRow = {
  id: string;
  vat_document_item_id: string;
  purchase_receipt_id?: string | null;
  purchase_receipt_item_id?: string | null;
  opening_stock_item_id?: string | null;
  filing_period_id?: string | null;
  target_type?: VatAllocation['targetType'] | null;
  vat_group_id: string;
  allocated_quantity?: number | null;
  allocated_amount?: number | null;
  created_at?: string | null;
  created_by?: string | null;
  allocation_method: VatAllocation['allocationMethod'];
  status?: VatAllocation['status'] | null;
  void_reason?: string | null;
  voided_at?: string | null;
  voided_by?: string | null;
  branch_id?: string | null;
  tenant_id?: string | null;
};

type TaxFilingPeriodRow = {
  id: string;
  name: string;
  start_date: string;
  status: TaxFilingPeriod['status'];
  locked_at?: string | null;
  locked_by?: string | null;
  note?: string | null;
  branch_id?: string | null;
  tenant_id?: string | null;
  created_at?: string | null;
  created_by?: string | null;
  updated_at?: string | null;
};

type OpeningStockItemRow = {
  id: string;
  filing_period_id: string;
  sku: string;
  product_id?: string | null;
  product_name: string;
  product_group_name?: string | null;
  vat_group_id?: string | null;
  supplier_id?: string | null;
  supplier_name?: string | null;
  quantity?: number | null;
  unit_cost?: number | null;
  total_amount?: number | null;
  vat_status: OpeningStockItem['vatStatus'];
  note?: string | null;
  branch_id?: string | null;
  tenant_id?: string | null;
  created_at?: string | null;
  created_by?: string | null;
  updated_at?: string | null;
};

const toVatDocument = (row: VatDocumentRow): VatDocument => ({
  id: row.id,
  supplierId: row.supplier_id || undefined,
  supplierNameOnInvoice: row.supplier_name_on_invoice || undefined,
  supplierTaxCode: row.supplier_tax_code || undefined,
  supplierMatchConfidence: row.supplier_match_confidence || 0,
  supplierMatchStatus: row.supplier_match_status || 'needs_confirmation',
  invoiceNo: row.invoice_no,
  invoiceDate: row.invoice_date,
  totalBeforeTax: row.total_before_tax || 0,
  vatAmount: row.vat_amount || 0,
  totalAmount: row.total_amount || 0,
  filePdfUrl: row.file_pdf_url || undefined,
  fileXmlUrl: row.file_xml_url || undefined,
  status: row.status,
  note: row.note || undefined,
  voidReason: row.void_reason || undefined,
  voidedAt: row.voided_at || undefined,
  voidedBy: row.voided_by || undefined,
  branchId: row.branch_id || undefined,
  tenantId: row.tenant_id || undefined,
  createdAt: row.created_at || undefined,
  createdBy: row.created_by || undefined,
  updatedAt: row.updated_at || undefined,
});

const toVatDocumentItem = (row: VatDocumentItemRow): VatDocumentItem => ({
  id: row.id,
  vatDocumentId: row.vat_document_id,
  descriptionOnInvoice: row.description_on_invoice,
  suggestedVatGroupId: row.suggested_vat_group_id || undefined,
  confirmedVatGroupId: row.confirmed_vat_group_id || undefined,
  quantity: row.quantity || 0,
  amountBeforeTax: row.amount_before_tax || 0,
  vatAmount: row.vat_amount || 0,
  totalAmount: row.total_amount || 0,
  allocatedQuantity: row.allocated_quantity || 0,
  allocatedAmount: row.allocated_amount || 0,
  remainingQuantity: row.remaining_quantity || undefined,
  remainingAmount: row.remaining_amount || undefined,
  confidenceScore: row.confidence_score || 0,
  mappingStatus: row.mapping_status || 'needs_confirmation',
  branchId: row.branch_id || undefined,
  tenantId: row.tenant_id || undefined,
  createdAt: row.created_at || undefined,
  updatedAt: row.updated_at || undefined,
});

const toSkuVatGroupMapping = (row: SkuVatGroupMappingRow): SkuVatGroupMapping => ({
  id: row.id,
  sku: row.sku,
  productId: row.product_id || undefined,
  productName: row.product_name || undefined,
  vatGroupId: row.vat_group_id,
  confidenceScore: row.confidence_score || 0,
  source: row.source || 'manual',
  branchId: row.branch_id || undefined,
  tenantId: row.tenant_id || undefined,
  createdAt: row.created_at || undefined,
  updatedAt: row.updated_at || undefined,
});

const toSupplierAlias = (row: SupplierAliasRow): SupplierAlias => ({
  id: row.id,
  supplierId: row.supplier_id,
  aliasName: row.alias_name,
  taxCode: row.tax_code || undefined,
  branchId: row.branch_id || undefined,
  tenantId: row.tenant_id || undefined,
  createdAt: row.created_at || undefined,
  createdBy: row.created_by || undefined,
});

const toVatGroupKeyword = (row: VatGroupKeywordRow): VatGroupKeyword => ({
  id: row.id,
  vatGroupId: row.vat_group_id,
  keyword: row.keyword,
  normalizedKeyword: row.normalized_keyword,
  branchId: row.branch_id || undefined,
  tenantId: row.tenant_id || undefined,
  createdAt: row.created_at || undefined,
  createdBy: row.created_by || undefined,
});

const toVatAllocation = (row: VatAllocationRow): VatAllocation => ({
  id: row.id,
  vatDocumentItemId: row.vat_document_item_id,
  purchaseReceiptId: row.purchase_receipt_id || undefined,
  purchaseReceiptItemId: row.purchase_receipt_item_id || undefined,
  openingStockItemId: row.opening_stock_item_id || undefined,
  filingPeriodId: row.filing_period_id || undefined,
  targetType: row.target_type || 'purchase_receipt',
  vatGroupId: row.vat_group_id,
  allocatedQuantity: row.allocated_quantity || 0,
  allocatedAmount: row.allocated_amount || 0,
  createdAt: row.created_at || undefined,
  createdBy: row.created_by || undefined,
  allocationMethod: row.allocation_method,
  status: row.status || 'active',
  voidReason: row.void_reason || undefined,
  voidedAt: row.voided_at || undefined,
  voidedBy: row.voided_by || undefined,
  branchId: row.branch_id || undefined,
  tenantId: row.tenant_id || undefined,
});

const toTaxFilingPeriod = (row: TaxFilingPeriodRow): TaxFilingPeriod => ({
  id: row.id,
  name: row.name,
  startDate: row.start_date,
  status: row.status,
  lockedAt: row.locked_at || undefined,
  lockedBy: row.locked_by || undefined,
  note: row.note || undefined,
  branchId: row.branch_id || undefined,
  tenantId: row.tenant_id || undefined,
  createdAt: row.created_at || undefined,
  createdBy: row.created_by || undefined,
  updatedAt: row.updated_at || undefined,
});

const toOpeningStockItem = (row: OpeningStockItemRow): OpeningStockItem => ({
  id: row.id,
  filingPeriodId: row.filing_period_id,
  sku: row.sku,
  productId: row.product_id || undefined,
  productName: row.product_name,
  productGroupName: row.product_group_name || undefined,
  vatGroupId: row.vat_group_id || undefined,
  supplierId: row.supplier_id || undefined,
  supplierName: row.supplier_name || undefined,
  quantity: row.quantity || 0,
  unitCost: row.unit_cost || 0,
  totalAmount: row.total_amount || 0,
  vatStatus: row.vat_status,
  note: row.note || undefined,
  branchId: row.branch_id || undefined,
  tenantId: row.tenant_id || undefined,
  createdAt: row.created_at || undefined,
  createdBy: row.created_by || undefined,
  updatedAt: row.updated_at || undefined,
});

export async function uploadVatFile(file: File, documentId: string) {
  const ext = file.name.split('.').pop()?.toLowerCase() || 'bin';
  const path = `${documentId}/${generateId()}.${ext}`;
  const { error } = await supabase.storage.from(VAT_BUCKET).upload(path, file, { upsert: false });
  if (error) throw error;
  return path;
}

export async function createVatDocumentFromPdf(file: File, createdBy?: string) {
  const documentId = generateId();
  const pdfPath = await uploadVatFile(file, documentId);
  const invoiceNo = file.name.replace(/\.pdf$/i, '').trim() || `VAT-${Date.now()}`;

  const documentPayload = {
    id: documentId,
    supplier_match_confidence: 0,
    supplier_match_status: 'needs_confirmation',
    invoice_no: invoiceNo,
    invoice_date: new Date().toLocaleDateString('en-CA'),
    total_before_tax: 0,
    vat_amount: 0,
    total_amount: 0,
    file_pdf_url: pdfPath,
    status: 'unallocated',
    note: 'Upload PDF VAT, cần bổ sung thông tin hóa đơn và dòng hàng trước khi phân bổ.',
    created_by: createdBy || null,
  };

  const { data: documentRows, error: documentError } = await supabase
    .from('vat_documents')
    .insert(documentPayload)
    .select('*');
  if (documentError) throw documentError;

  return toVatDocument(documentRows?.[0] as VatDocumentRow);
}

export async function fetchVatCoverageData() {
  const [groups, mappings, aliases, keywords, documents, items, allocations, events, periods, openingStock] = await Promise.all([
    supabase.from('vat_groups').select('*').order('name', { ascending: true }),
    supabase.from('sku_vat_group_mapping').select('*').order('created_at', { ascending: false }),
    supabase.from('supplier_aliases').select('*').order('created_at', { ascending: false }),
    supabase.from('vat_group_keywords').select('*').order('created_at', { ascending: false }),
    supabase.from('vat_documents').select('*').order('invoice_date', { ascending: false }),
    supabase.from('vat_document_items').select('*').order('created_at', { ascending: false }),
    supabase.from('vat_allocations').select('*').order('created_at', { ascending: false }),
    supabase.from('vat_allocation_events').select('*').order('created_at', { ascending: false }),
    supabase.from('tax_filing_periods').select('*').order('start_date', { ascending: false }),
    supabase.from('opening_stock_items').select('*').order('created_at', { ascending: false }),
  ]);

  const requiredResults = [
    { name: 'vat_groups', result: groups },
    { name: 'sku_vat_group_mapping', result: mappings },
    { name: 'supplier_aliases', result: aliases },
    { name: 'vat_group_keywords', result: keywords },
    { name: 'vat_documents', result: documents },
    { name: 'vat_document_items', result: items },
    { name: 'vat_allocations', result: allocations },
    { name: 'vat_allocation_events', result: events },
  ];
  const requiredError = requiredResults.find(entry => entry.result.error);
  if (requiredError?.result.error) {
    throw new Error(`${requiredError.name}: ${requiredError.result.error.message}`);
  }

  const optionalError = [periods.error, openingStock.error].find(Boolean);
  const hasMissingFilingTables =
    optionalError?.code === 'PGRST205' ||
    optionalError?.message?.includes('tax_filing_periods') ||
    optionalError?.message?.includes('opening_stock_items');
  if (optionalError && !hasMissingFilingTables) throw optionalError;

  return {
    groups: groups.data || [],
    mappings: (mappings.data || []).map(row => toSkuVatGroupMapping(row as SkuVatGroupMappingRow)),
    aliases: (aliases.data || []).map(row => toSupplierAlias(row as SupplierAliasRow)),
    keywords: (keywords.data || []).map(row => toVatGroupKeyword(row as VatGroupKeywordRow)),
    documents: (documents.data || []).map(row => toVatDocument(row as VatDocumentRow)),
    items: (items.data || []).map(row => toVatDocumentItem(row as VatDocumentItemRow)),
    allocations: (allocations.data || []).map(row => toVatAllocation(row as VatAllocationRow)),
    events: events.data || [],
    periods: (periods.data || []).map(row => toTaxFilingPeriod(row as TaxFilingPeriodRow)),
    openingStockItems: (openingStock.data || []).map(row => toOpeningStockItem(row as OpeningStockItemRow)),
  };
}

export async function saveTaxFilingPeriod(input: {
  id?: string;
  startDate: string;
  status?: TaxFilingPeriod['status'];
  name?: string;
  note?: string;
  lockedBy?: string;
}) {
  const status = input.status || 'draft';
  const payload = {
    id: input.id || generateId(),
    name: input.name || 'Kỳ kê khai chính',
    start_date: input.startDate,
    status,
    note: input.note || null,
    locked_at: status === 'locked' ? new Date().toISOString() : null,
    locked_by: status === 'locked' ? input.lockedBy || null : null,
    updated_at: new Date().toISOString(),
  };
  const { data, error } = await supabase
    .from('tax_filing_periods')
    .upsert(payload)
    .select('*')
    .single();
  if (error) throw error;
  return toTaxFilingPeriod(data as TaxFilingPeriodRow);
}

export async function updateOpeningStockItem(input: {
  id: string;
  vatGroupId?: string | null;
  vatStatus?: OpeningStockItem['vatStatus'];
  supplierId?: string | null;
  supplierName?: string | null;
  note?: string | null;
}) {
  const patch: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };
  if ('vatGroupId' in input) patch.vat_group_id = input.vatGroupId || null;
  if ('vatStatus' in input && input.vatStatus) patch.vat_status = input.vatStatus;
  if ('supplierId' in input) patch.supplier_id = input.supplierId || null;
  if ('supplierName' in input) patch.supplier_name = input.supplierName || null;
  if ('note' in input) patch.note = input.note || null;

  const { data, error } = await supabase
    .from('opening_stock_items')
    .update(patch)
    .eq('id', input.id)
    .select('*')
    .single();
  if (error) throw error;
  return toOpeningStockItem(data as OpeningStockItemRow);
}

export async function createOpeningStockFromProducts({
  filingPeriodId,
  products,
  mappings,
  createdBy,
}: {
  filingPeriodId: string;
  products: POSProduct[];
  mappings: SkuVatGroupMapping[];
  createdBy?: string;
}) {
  const activeProducts = products.filter(product => product.status !== 'Inactive' && Number(product.stock || 0) > 0);
  if (activeProducts.length === 0) return [];

  const { count, error: countError } = await supabase
    .from('opening_stock_items')
    .select('id', { count: 'exact', head: true })
    .eq('filing_period_id', filingPeriodId);
  if (countError) throw countError;
  if ((count || 0) > 0) {
    throw new Error('Kỳ kê khai này đã có tồn đầu kỳ. Hãy reset bản nháp trước khi tạo lại.');
  }

  const mappingByProduct = new Map<string, SkuVatGroupMapping>();
  const mappingBySku = new Map<string, SkuVatGroupMapping>();
  mappings.forEach(mapping => {
    if (mapping.productId) mappingByProduct.set(mapping.productId, mapping);
    if (mapping.sku) mappingBySku.set(normalizeVatText(mapping.sku), mapping);
  });

  const payloads = activeProducts.map(product => {
    const mapping = mappingByProduct.get(product.id) || mappingBySku.get(normalizeVatText(product.sku || ''));
    const quantity = Number(product.stock || 0);
    const unitCost = Number(product.importPrice || 0);
    return {
      id: generateId(),
      filing_period_id: filingPeriodId,
      sku: product.sku || product.id,
      product_id: product.id,
      product_name: product.name,
      product_group_name: product.categoryPath || product.categoryId || null,
      vat_group_id: mapping?.vatGroupId || null,
      supplier_id: null,
      supplier_name: null,
      quantity,
      unit_cost: unitCost,
      total_amount: quantity * unitCost,
      vat_status: mapping?.vatGroupId ? 'waiting_vat' : 'unknown',
      note: 'Tạo từ tồn kho hiện tại khi chốt kỳ kê khai',
      created_by: createdBy || null,
    };
  });

  const { data, error } = await supabase
    .from('opening_stock_items')
    .insert(payloads)
    .select('*');
  if (error) throw error;
  return (data || []).map(row => toOpeningStockItem(row as OpeningStockItemRow));
}

export async function resetOpeningStockDraft(filingPeriodId: string) {
  const { data: period, error: periodError } = await supabase
    .from('tax_filing_periods')
    .select('status')
    .eq('id', filingPeriodId)
    .single();
  if (periodError) throw periodError;
  if (period?.status === 'locked') {
    throw new Error('Kỳ kê khai đã chốt, không thể reset tồn đầu kỳ.');
  }

  const { error } = await supabase
    .from('opening_stock_items')
    .delete()
    .eq('filing_period_id', filingPeriodId);
  if (error) throw error;
}

export async function allocateVatToOpeningStock({
  vatDocumentItemId,
  openingStockItemId,
  filingPeriodId,
  vatGroupId,
  allocatedQuantity,
  allocatedAmount,
  allocationMethod = 'manual',
  createdBy,
}: {
  vatDocumentItemId: string;
  openingStockItemId: string;
  filingPeriodId: string;
  vatGroupId: string;
  allocatedQuantity: number;
  allocatedAmount: number;
  allocationMethod?: VatAllocation['allocationMethod'];
  createdBy?: string;
}) {
  if (allocatedAmount <= 0 && allocatedQuantity <= 0) {
    throw new Error('Số tiền hoặc số lượng phân bổ phải lớn hơn 0.');
  }

  const allocationPayload = {
    id: generateId(),
    vat_document_item_id: vatDocumentItemId,
    purchase_receipt_id: null,
    purchase_receipt_item_id: null,
    opening_stock_item_id: openingStockItemId,
    filing_period_id: filingPeriodId,
    target_type: 'opening_stock',
    vat_group_id: vatGroupId,
    allocated_quantity: allocatedQuantity,
    allocated_amount: allocatedAmount,
    created_by: createdBy || null,
    allocation_method: allocationMethod,
    status: 'active',
  };

  const { data, error } = await supabase
    .from('vat_allocations')
    .insert(allocationPayload)
    .select('*')
    .single();
  if (error) throw error;

  const { data: itemData, error: itemFetchError } = await supabase
    .from('vat_document_items')
    .select('allocated_quantity, allocated_amount')
    .eq('id', vatDocumentItemId)
    .single();
  if (itemFetchError) throw itemFetchError;

  const { error: itemUpdateError } = await supabase
    .from('vat_document_items')
    .update({
      allocated_quantity: Number(itemData?.allocated_quantity || 0) + allocatedQuantity,
      allocated_amount: Number(itemData?.allocated_amount || 0) + allocatedAmount,
    })
    .eq('id', vatDocumentItemId);
  if (itemUpdateError) throw itemUpdateError;

  const { error: eventError } = await supabase.from('vat_allocation_events').insert({
    id: generateId(),
    allocation_id: data.id,
    action: 'created',
    snapshot: data,
    created_by: createdBy || null,
  });
  if (eventError) throw eventError;

  return toVatAllocation(data as VatAllocationRow);
}

export async function allocateVatToPurchaseReceipt({
  vatDocumentItemId,
  purchaseReceiptId,
  purchaseReceiptItemId,
  filingPeriodId,
  vatGroupId,
  allocatedQuantity,
  allocatedAmount,
  allocationMethod = 'manual',
  createdBy,
}: {
  vatDocumentItemId: string;
  purchaseReceiptId: string;
  purchaseReceiptItemId?: string;
  filingPeriodId?: string;
  vatGroupId: string;
  allocatedQuantity: number;
  allocatedAmount: number;
  allocationMethod?: VatAllocation['allocationMethod'];
  createdBy?: string;
}) {
  if (allocatedAmount <= 0 && allocatedQuantity <= 0) {
    throw new Error('Số tiền hoặc số lượng phân bổ phải lớn hơn 0.');
  }

  const allocationPayload = {
    id: generateId(),
    vat_document_item_id: vatDocumentItemId,
    purchase_receipt_id: purchaseReceiptId,
    purchase_receipt_item_id: purchaseReceiptItemId || null,
    opening_stock_item_id: null,
    filing_period_id: filingPeriodId || null,
    target_type: 'purchase_receipt',
    vat_group_id: vatGroupId,
    allocated_quantity: allocatedQuantity,
    allocated_amount: allocatedAmount,
    created_by: createdBy || null,
    allocation_method: allocationMethod,
    status: 'active',
  };

  const { data, error } = await supabase
    .from('vat_allocations')
    .insert(allocationPayload)
    .select('*')
    .single();
  if (error) throw error;

  const { data: itemData, error: itemFetchError } = await supabase
    .from('vat_document_items')
    .select('allocated_quantity, allocated_amount')
    .eq('id', vatDocumentItemId)
    .single();
  if (itemFetchError) throw itemFetchError;

  const { error: itemUpdateError } = await supabase
    .from('vat_document_items')
    .update({
      allocated_quantity: Number(itemData?.allocated_quantity || 0) + allocatedQuantity,
      allocated_amount: Number(itemData?.allocated_amount || 0) + allocatedAmount,
    })
    .eq('id', vatDocumentItemId);
  if (itemUpdateError) throw itemUpdateError;

  const { error: eventError } = await supabase.from('vat_allocation_events').insert({
    id: generateId(),
    allocation_id: data.id,
    action: 'created',
    snapshot: data,
    created_by: createdBy || null,
  });
  if (eventError) throw eventError;

  return toVatAllocation(data as VatAllocationRow);
}

