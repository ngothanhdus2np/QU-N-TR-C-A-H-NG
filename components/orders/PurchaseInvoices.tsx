import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import * as XLSX from 'xlsx';
import * as pdfjsLib from 'pdfjs-dist';
import pdfjsWorkerSrc from 'pdfjs-dist/build/pdf.worker.mjs?url';
import {
  Search,
  Download,
  BarChart2,
  Layers3,
  Upload,
  RefreshCw,
  CalendarDays,
  Lock,
} from 'lucide-react';
import {
  AppData,
  TaxFilingPeriod,
  VatAllocation,
  VatDocument,
  VatDocumentItem,
  VatReconciliationRow,
} from '../../types';
import { supabase } from '../../services/supabase';
import {
  buildVatCoverageByGroup,
  buildVatFilingReconciliation,
  getReceiptVatGroupRows,
  isUnmappedVatGroupId,
  normalizeVatText,
} from '../../src/lib/vatCoverage';
import {
  allocateVatToPurchaseReceipt,
  allocateVatToOpeningStock,
  createOpeningStockFromProducts,
  createVatDocumentFromPdf,
  fetchVatCoverageData,
  resetOpeningStockDraft,
  saveTaxFilingPeriod,
  updateOpeningStockItem,
} from '../../services/vatCoverageService';
import VatInvoiceConfirmModal from './purchase-invoices/VatInvoiceConfirmModal';
import PurchaseInvoicesSidebar from './purchase-invoices/PurchaseInvoicesSidebar';
import PurchaseLegacyReport from './purchase-invoices/PurchaseLegacyReport';
import PurchaseInvoicesListView from './purchase-invoices/PurchaseInvoicesListView';
import VatCoverageReport from './purchase-invoices/VatCoverageReport';
import VatFilingReport from './purchase-invoices/VatFilingReport';
import type {
  FilingReceiptDetailRow,
  FilingTab,
  InvoiceAttachment,
  OpeningStockVatStatus,
  PurchaseInvoicesProps,
  PurchasePeriodScope,
  ReportMode,
  SupplierProductGroupOption,
  TabKey,
  VatCenterTab,
  VatCoverageData,
  VatDocumentForm,
  VatInvoiceMappingLineForm,
  VatInvoiceOcrResult,
} from './purchase-invoices/types';
import {
  BADGE_CONFIG,
  LIST_PAGE_SIZE,
  OPENING_VAT_STATUS_OPTIONS,
  PENDING_VAT_DOCUMENT_ID,
  VAT_RISK_CONFIG,
  getWorseReconciliationRisk,
} from './purchase-invoices/types';
import {
  extractVatItemsFromPdfText,
  fetchVatInvoiceOcr,
  formatPurchaseDateTime,
  formatVatDate,
  formatVatMoneyInput,
  getPurchaseCode,
  getSupplierInvoiceDefaults,
  getSupabaseErrorMessage,
  getVatDocumentDuplicateKey,
  isMissingFilingTableError,
  isMissingSupplierInvoiceColumnError,
  normalizeDuplicateInvoiceText,
  normalizeVatDateValue,
  parseVatMoneyInput,
} from './purchase-invoices/utils';
import { vatGroupMatchesSourceText } from './purchaseInvoicesVatHelpers';

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorkerSrc;

const shiftDate = (value: string, days: number) => {
  const normalized = normalizeVatDateValue(value);
  if (!normalized) return '';
  const date = new Date(`${normalized}T00:00:00`);
  if (Number.isNaN(date.getTime())) return '';
  date.setDate(date.getDate() + days);
  return date.toLocaleDateString('sv-SE');
};

// vatGroupMatchesSourceText đã tách ra ./purchaseInvoicesVatHelpers (GĐ5 audit — có test)

export default function PurchaseInvoices({ transactions, suppliers, products }: PurchaseInvoicesProps) {
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [activeTab, setActiveTab] = useState<TabKey>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [dateRange, setDateRange] = useState({ start: '', end: '' });
  const [supplierFilter, setSupplierFilter] = useState('all');
  const [statusFilterOpen, setStatusFilterOpen] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [expandedReportMonth, setExpandedReportMonth] = useState<string | null>(null);
  const [attachments, setAttachments] = useState<Record<string, InvoiceAttachment[]>>({});
  const [loadingAttachments, setLoadingAttachments] = useState(false);
  const [signedUrls, setSignedUrls] = useState<Record<string, string>>({});
  const [loadingUrl, setLoadingUrl] = useState<string | null>(null);
  const [showReport, setShowReport] = useState(true);
  const [reportMode, setReportMode] = useState<ReportMode>('coverage');
  const [purchasePeriodScope, setPurchasePeriodScope] = useState<PurchasePeriodScope>('post');
  const [vatCenterTab, setVatCenterTab] = useState<VatCenterTab>('warehouse');
  const [filingTab, setFilingTab] = useState<FilingTab>('group_supplier');
  const [vatData, setVatData] = useState<VatCoverageData | null>(null);
  const [vatDataError, setVatDataError] = useState<string | null>(null);
  const [vatUploadNotice, setVatUploadNotice] = useState<string | null>(null);
  const [filingPeriodNotice, setFilingPeriodNotice] = useState<string | null>(null);
  const [localFilingPeriod, setLocalFilingPeriod] = useState<TaxFilingPeriod | null>(null);
  const [localVatDocuments, setLocalVatDocuments] = useState<VatDocument[]>([]);
  const [editingVatDocumentId, setEditingVatDocumentId] = useState<string | null>(null);
  const [savingVatDocument, setSavingVatDocument] = useState(false);
  const [vatOcrLoading, setVatOcrLoading] = useState(false);
  const [vatOcrResult, setVatOcrResult] = useState<VatInvoiceOcrResult | null>(null);
  const [vatPreviewUrl, setVatPreviewUrl] = useState<string | null>(null);
  const [vatDocumentForm, setVatDocumentForm] = useState<VatDocumentForm>({
    supplierId: '',
    issuerName: '',
    issuerTaxCode: '',
    issuerPhone: '',
    issuerAddress: '',
    invoiceNo: '',
    invoiceDate: '',
    totalBeforeTax: '',
    vatAmount: '',
    totalAmount: '',
  });
  const [vatDataLoading, setVatDataLoading] = useState(false);
  const [vatLastLoadedAt, setVatLastLoadedAt] = useState<string | null>(null);
  const [vatLastAttemptAt, setVatLastAttemptAt] = useState<string | null>(null);
  const [vatHasAttemptedInitialLoad, setVatHasAttemptedInitialLoad] = useState(false);
  const [vatUploading, setVatUploading] = useState(false);
  const [savingPeriod, setSavingPeriod] = useState(false);
  const [creatingOpeningStock, setCreatingOpeningStock] = useState(false);
  const [resettingOpeningStock, setResettingOpeningStock] = useState(false);
  const [allocatingOpeningVat, setAllocatingOpeningVat] = useState(false);
  const [allocatingPurchaseVat, setAllocatingPurchaseVat] = useState(false);
  const [savingOpeningItemId, setSavingOpeningItemId] = useState<string | null>(null);
  const [filingStartDate, setFilingStartDate] = useState('2026-05-11');
  const [openingAllocation, setOpeningAllocation] = useState({
    openingStockItemId: '',
    vatDocumentItemId: '',
    amount: '',
    quantity: '',
  });
  const [purchaseAllocation, setPurchaseAllocation] = useState({
    receiptItemKey: '',
    vatDocumentItemId: '',
    amount: '',
    quantity: '',
  });
  const [supplierSearch, setSupplierSearch] = useState('');
  const [visibleListLimit, setVisibleListLimit] = useState(LIST_PAGE_SIZE);
  const [expandedFilingSupplierKey, setExpandedFilingSupplierKey] = useState<string | null>(null);
  const [expandedFilingGroupKey, setExpandedFilingGroupKey] = useState<string | null>(null);
  const [selectedVatDocumentIds, setSelectedVatDocumentIds] = useState<string[]>([]);
  const vatFileInputRef = useRef<HTMLInputElement | null>(null);
  const vatUploadRunRef = useRef(0);
  const isVatReportActive = showReport && (reportMode === 'coverage' || reportMode === 'filing');
  const isCoverageReportActive = showReport && reportMode === 'coverage';
  const shouldBuildVatCoverageRows =
    isCoverageReportActive && (vatCenterTab === 'groups' || vatCenterTab === 'receipts' || vatCenterTab === 'tasks');
  const shouldBuildVatSupplierRows = isCoverageReportActive && vatCenterTab === 'suppliers';
  const isFilingReportActive = showReport && reportMode === 'filing';
  const activeFilingPeriod = useMemo<TaxFilingPeriod | undefined>(() => {
    if (!isVatReportActive) return undefined;
    return localFilingPeriod || vatData?.periods?.find(period => period.status === 'locked') || vatData?.periods?.[0] || undefined;
  }, [isVatReportActive, localFilingPeriod, vatData]);
  const effectiveFilingStartDate = normalizeVatDateValue(activeFilingPeriod?.startDate || filingStartDate);
  const needsFilingDateSetup =
    isVatReportActive && vatHasAttemptedInitialLoad && !vatDataLoading && !activeFilingPeriod;

  const today = new Date().toISOString().split('T')[0];
  const sevenDaysAgo = useMemo(() => new Date(nowMs - 7 * 24 * 60 * 60 * 1000).toISOString(), [nowMs]);
  const getEffectiveDateRange = useCallback((range: { start: string; end: string }) => {
    const selectedStart = normalizeVatDateValue(range.start);
    const selectedEnd = normalizeVatDateValue(range.end);
    const filingStart = normalizeVatDateValue(effectiveFilingStartDate);
    if (!filingStart || purchasePeriodScope === 'all') {
      return { start: selectedStart, end: selectedEnd };
    }
    if (purchasePeriodScope === 'pre') {
      const cutoffEnd = shiftDate(filingStart, -1);
      return {
        start: selectedStart,
        end: selectedEnd && selectedEnd < cutoffEnd ? selectedEnd : cutoffEnd,
      };
    }
    return {
      start: selectedStart && selectedStart > filingStart ? selectedStart : filingStart,
      end: selectedEnd,
    };
  }, [effectiveFilingStartDate, purchasePeriodScope]);
  const effectiveDateRange = useMemo(
    () => getEffectiveDateRange(dateRange),
    [dateRange, getEffectiveDateRange]
  );

  useEffect(() => {
    const timer = window.setInterval(() => setNowMs(Date.now()), 60000);
    return () => window.clearInterval(timer);
  }, []);

  const handlePeriodScopeChange = useCallback((scope: PurchasePeriodScope) => {
    setPurchasePeriodScope(scope);
  }, []);

  useEffect(() => {
    const importIds = transactions.filter(t => t.type === 'Import').map(t => t.id);
    if (importIds.length === 0) return;
    setLoadingAttachments(true);
    supabase
      .from('invoice_attachments')
      .select('*')
      .in('purchase_record_id', importIds)
      .then(({ data }) => {
        if (!data) return;
        const grouped: Record<string, InvoiceAttachment[]> = {};
        data.forEach((a: InvoiceAttachment) => {
          if (!grouped[a.purchase_record_id]) grouped[a.purchase_record_id] = [];
          grouped[a.purchase_record_id].push(a);
        });
        setAttachments(grouped);
      })
      .then(
        () => setLoadingAttachments(false),
        () => setLoadingAttachments(false)
      );
  }, [transactions]);

  const loadVatCoverageData = useCallback(async () => {
    setVatDataLoading(true);
    setVatLastAttemptAt(new Date().toISOString());
    setVatDataError(null);
    try {
      const data = await fetchVatCoverageData();
      setVatData(data);
      if (data.periods.length > 0) setLocalFilingPeriod(null);
      setVatLastLoadedAt(new Date().toISOString());
      setVatHasAttemptedInitialLoad(true);
    } catch (error) {
      setVatHasAttemptedInitialLoad(true);
      setVatDataError(
        error instanceof Error
          ? error.message
          : 'Chưa tải được dữ liệu VAT Coverage. Kiểm tra migration VAT trên Supabase.'
      );
    } finally {
      setVatDataLoading(false);
    }
  }, []);

  useEffect(() => {
    if (
      showReport &&
      (reportMode === 'coverage' || reportMode === 'filing') &&
      !vatData &&
      !vatDataLoading &&
      !vatHasAttemptedInitialLoad
    ) {
      loadVatCoverageData();
    }
  }, [loadVatCoverageData, reportMode, showReport, vatData, vatDataLoading, vatHasAttemptedInitialLoad]);

  useEffect(() => {
    if (!showReport || (reportMode !== 'coverage' && reportMode !== 'filing')) return;
    const timer = window.setInterval(() => {
      if (editingVatDocumentId || vatUploading || savingVatDocument || savingPeriod) return;
      if (!document.hidden) loadVatCoverageData();
    }, 120000);
    return () => window.clearInterval(timer);
  }, [editingVatDocumentId, loadVatCoverageData, reportMode, savingPeriod, savingVatDocument, showReport, vatUploading]);

  useEffect(() => {
    const currentPeriod = vatData?.periods?.find(period => period.status === 'locked') || vatData?.periods?.[0];
    if (currentPeriod?.startDate && !localFilingPeriod) setFilingStartDate(currentPeriod.startDate);
  }, [localFilingPeriod, vatData]);

  useEffect(() => {
    return () => {
      if (vatPreviewUrl) URL.revokeObjectURL(vatPreviewUrl);
    };
  }, [vatPreviewUrl]);

  const handleSaveFilingPeriod = useCallback(
    async (status: TaxFilingPeriod['status']) => {
      setSavingPeriod(true);
      setVatDataError(null);
      setFilingPeriodNotice(null);
      try {
        const currentPeriod = vatData?.periods?.[0];
        await saveTaxFilingPeriod({
          id: currentPeriod?.id,
          startDate: filingStartDate,
          status,
          name: currentPeriod?.name || 'Kỳ kê khai chính',
        });
        setLocalFilingPeriod(null);
        await loadVatCoverageData();
        handlePeriodScopeChange('post');
        setFilingPeriodNotice(
          status === 'locked'
            ? 'Đã chốt kỳ kê khai vào báo cáo.'
            : 'Đã lưu nháp kỳ kê khai. Bạn có thể tiếp tục làm việc bình thường.'
        );
      } catch (error) {
        if (status === 'draft' && isMissingFilingTableError(error)) {
          setLocalFilingPeriod({
            id: 'local-draft-period',
            name: 'Kỳ kê khai nháp',
            startDate: filingStartDate,
            status: 'draft',
            updatedAt: new Date().toISOString(),
          });
          handlePeriodScopeChange('post');
          setFilingPeriodNotice(
            'Đã lưu nháp trên phiên làm việc hiện tại vì Supabase chưa có bảng tax_filing_periods. Bạn vẫn có thể làm việc bình thường; muốn chốt kỳ vào báo cáo cần chạy migration 010.'
          );
        } else {
          setVatDataError(
            isMissingFilingTableError(error)
              ? 'Chưa chốt được kỳ vào báo cáo vì Supabase thiếu bảng tax_filing_periods/opening_stock_items. Cần chạy migration 010_tax_filing_vat_reconciliation.sql.'
              : error instanceof Error
                ? error.message
                : 'Không thể lưu kỳ kê khai.'
          );
        }
      } finally {
        setSavingPeriod(false);
      }
    },
    [filingStartDate, handlePeriodScopeChange, loadVatCoverageData, vatData]
  );

  const handleCreateOpeningStockFromProducts = useCallback(async () => {
    setCreatingOpeningStock(true);
    setVatDataError(null);
    try {
      let period = vatData?.periods?.[0];
      if (!period) {
        period = await saveTaxFilingPeriod({
          startDate: filingStartDate,
          status: 'draft',
          name: 'Kỳ kê khai chính',
        });
      }
      await createOpeningStockFromProducts({
        filingPeriodId: period.id,
        products: products || [],
        mappings: vatData?.mappings || [],
      });
      await loadVatCoverageData();
    } catch (error) {
      setVatDataError(error instanceof Error ? error.message : 'Không thể tạo tồn đầu kỳ từ sản phẩm hiện tại.');
    } finally {
      setCreatingOpeningStock(false);
    }
  }, [filingStartDate, loadVatCoverageData, products, vatData]);

  const handleResetOpeningStockDraft = useCallback(async () => {
    const period = vatData?.periods?.[0];
    if (!period) return;
    setResettingOpeningStock(true);
    setVatDataError(null);
    try {
      await resetOpeningStockDraft(period.id);
      await loadVatCoverageData();
    } catch (error) {
      setVatDataError(error instanceof Error ? error.message : 'Không thể reset tồn đầu kỳ.');
    } finally {
      setResettingOpeningStock(false);
    }
  }, [loadVatCoverageData, vatData]);

  const mergedVatDocuments = useMemo(() => {
    const byId = new Map<string, VatDocument>();
    localVatDocuments.forEach(document => byId.set(document.id, document));
    (vatData?.documents || []).forEach(document => {
      if (!byId.has(document.id)) byId.set(document.id, document);
    });
    return Array.from(byId.values()).sort((a, b) => {
      const dateCompare = (b.createdAt || b.invoiceDate || '').localeCompare(a.createdAt || a.invoiceDate || '');
      return dateCompare || b.invoiceNo.localeCompare(a.invoiceNo, 'vi');
    });
  }, [localVatDocuments, vatData?.documents]);

  const findDuplicateVatDocument = useCallback(
    (input: {
      invoiceNo?: string | null;
      invoiceDate?: string | null;
      supplierId?: string | null;
      supplierTaxCode?: string | null;
      supplierName?: string | null;
      totalAmount?: number | string | null;
      excludeId?: string | null;
    }) => {
      const key = getVatDocumentDuplicateKey(input);
      if (!key) return undefined;
      return mergedVatDocuments.find(document => {
        if (document.id === input.excludeId || document.status === 'void') return false;
        return (
          getVatDocumentDuplicateKey({
            invoiceNo: document.invoiceNo,
            invoiceDate: document.invoiceDate,
            supplierId: document.supplierId,
            supplierTaxCode: document.supplierTaxCode,
            supplierName: document.supplierNameOnInvoice,
            totalAmount: document.totalAmount,
          }) === key
        );
      });
    },
    [mergedVatDocuments]
  );

  const handleVatPdfUpload = useCallback(
    async (file: File) => {
      const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
      if (!isPdf) {
        setVatDataError('Chỉ hỗ trợ upload file PDF cho hóa đơn VAT.');
        if (vatFileInputRef.current) vatFileInputRef.current.value = '';
        return;
      }

      setVatUploading(true);
      setVatOcrLoading(true);
      const uploadRun = ++vatUploadRunRef.current;
      setVatDataError(null);
      setVatUploadNotice(null);
      setVatOcrResult(null);
      setVatPreviewUrl(prev => {
        if (prev) URL.revokeObjectURL(prev);
        return URL.createObjectURL(file);
      });
      setEditingVatDocumentId(PENDING_VAT_DOCUMENT_ID);
      setVatDocumentForm({
        supplierId: '',
        issuerName: '',
        issuerTaxCode: '',
        issuerPhone: '',
        issuerAddress: '',
        invoiceNo: file.name.replace(/\.pdf$/i, ''),
        invoiceDate: new Date().toLocaleDateString('en-CA'),
        totalBeforeTax: '',
        vatAmount: '',
        totalAmount: '',
      });
      try {
        const pdfTextItems = await extractVatItemsFromPdfText(file).catch(() => []);
        const ocrResult = await fetchVatInvoiceOcr(file);
        if (uploadRun !== vatUploadRunRef.current) return;
        const preferredItems = pdfTextItems.length >= ocrResult.items.length && pdfTextItems.length > 0
          ? pdfTextItems
          : ocrResult.items;
        const mergedOcrResult = {
          ...ocrResult,
          items: preferredItems,
          confidence: {
            ...ocrResult.confidence,
            items: preferredItems === pdfTextItems && pdfTextItems.length ? 0.85 : ocrResult.confidence?.items,
          },
        };

        const duplicate = findDuplicateVatDocument({
          invoiceNo: mergedOcrResult.invoiceNo || file.name.replace(/\.pdf$/i, ''),
          invoiceDate: mergedOcrResult.invoiceDate,
          supplierTaxCode: mergedOcrResult.issuerTaxCode,
          supplierName: mergedOcrResult.issuerName,
          totalAmount: mergedOcrResult.totalAmount,
        });
        if (duplicate) {
          setEditingVatDocumentId(null);
          setVatOcrResult(null);
          setVatPreviewUrl(prev => {
            if (prev) URL.revokeObjectURL(prev);
            return null;
          });
          setVatDataError(
            `Hóa đơn VAT bị trùng với hóa đơn đã có: ${duplicate.invoiceNo} ngày ${formatVatDate(duplicate.invoiceDate)}. App không tải lên file này.`
          );
          return;
        }

        const document = await createVatDocumentFromPdf(file);
        if (uploadRun !== vatUploadRunRef.current) return;
        setLocalVatDocuments(prev =>
          prev.some(item => item.id === document.id) ? prev : [document, ...prev]
        );
        setEditingVatDocumentId(document.id);
        setVatOcrResult(mergedOcrResult);
        setVatDocumentForm(prev => ({
          ...prev,
          issuerName: mergedOcrResult.issuerName || '',
          issuerTaxCode: mergedOcrResult.issuerTaxCode || '',
          issuerPhone: mergedOcrResult.issuerPhone || '',
          issuerAddress: mergedOcrResult.issuerAddress || '',
          invoiceNo: mergedOcrResult.invoiceNo || document.invoiceNo,
          invoiceDate: normalizeVatDateValue(mergedOcrResult.invoiceDate || document.invoiceDate) || new Date().toLocaleDateString('en-CA'),
          totalBeforeTax: formatVatMoneyInput(mergedOcrResult.totalBeforeTax),
          vatAmount: formatVatMoneyInput(mergedOcrResult.vatAmount),
          totalAmount: formatVatMoneyInput(mergedOcrResult.totalAmount),
        }));
        setVatUploadNotice(`Đã đọc PDF VAT: ${mergedOcrResult.invoiceNo || document.invoiceNo}`);
      } catch (error) {
        if (uploadRun !== vatUploadRunRef.current) return;
        setVatUploadNotice(null);
        setVatDataError(
          error instanceof Error && error.name === 'AbortError'
            ? 'AI đọc hóa đơn quá lâu nên chưa kiểm tra được trùng. App chưa tải file này lên, vui lòng thử lại hoặc dùng file rõ hơn.'
            : error instanceof Error
              ? error.message
              : 'Không thể đọc file PDF hóa đơn VAT.'
        );
        setEditingVatDocumentId(null);
        setVatOcrResult(null);
        setVatPreviewUrl(prev => {
          if (prev) URL.revokeObjectURL(prev);
          return null;
        });
      } finally {
        if (uploadRun === vatUploadRunRef.current) {
          setVatUploading(false);
          setVatOcrLoading(false);
        }
        if (vatFileInputRef.current) vatFileInputRef.current.value = '';
      }
    },
    [findDuplicateVatDocument]
  );

  const openVatDocumentForm = useCallback(async (document: VatDocument) => {
    const documentTaxCode = normalizeDuplicateInvoiceText(document.supplierTaxCode);
    const documentSupplierName = normalizeDuplicateInvoiceText(document.supplierNameOnInvoice);
    const supplier = (
      document.supplierId ? suppliers.find(item => item.id === document.supplierId) : undefined
    ) || suppliers.find(item => {
      const supplierTaxCode = normalizeDuplicateInvoiceText(item.invoiceTaxCode || item.taxCode);
      const supplierName = normalizeDuplicateInvoiceText(item.invoiceCompanyName || item.companyName || item.name);
      return (
        (documentTaxCode && supplierTaxCode === documentTaxCode) ||
        (documentSupplierName && supplierName === documentSupplierName)
      );
    });
    const supplierDefaults = getSupplierInvoiceDefaults(supplier);
    setEditingVatDocumentId(document.id);
    setVatOcrResult(null);
    setVatDataError(null);
    setVatDocumentForm({
      supplierId: supplier?.id || document.supplierId || '',
      issuerName: supplierDefaults.issuerName || document.supplierNameOnInvoice || '',
      issuerTaxCode: supplierDefaults.issuerTaxCode || document.supplierTaxCode || '',
      issuerPhone: supplierDefaults.issuerPhone,
      issuerAddress: supplierDefaults.issuerAddress,
      invoiceNo: document.invoiceNo || '',
      invoiceDate: normalizeVatDateValue(document.invoiceDate) || new Date().toLocaleDateString('en-CA'),
      totalBeforeTax: formatVatMoneyInput(document.totalBeforeTax),
      vatAmount: formatVatMoneyInput(document.vatAmount),
      totalAmount: formatVatMoneyInput(document.totalAmount),
    });
    setVatPreviewUrl(prev => {
      if (prev) URL.revokeObjectURL(prev);
      return null;
    });
    if (document.filePdfUrl) {
      const cacheKey = `vat:${document.id}`;
      setLoadingUrl(cacheKey);
      try {
        const signedUrl = signedUrls[cacheKey] || '';
        const resolvedSignedUrl = signedUrl || (await supabase.storage
          .from('vat-documents')
          .createSignedUrl(document.filePdfUrl, 3600)).data?.signedUrl || '';
        if (!resolvedSignedUrl) {
          setVatDataError('Không thể hiển thị PDF hóa đơn VAT trong popup. Vui lòng kiểm tra quyền storage vat-documents.');
          return;
        }
        if (!signedUrl) setSignedUrls(prev => ({ ...prev, [cacheKey]: resolvedSignedUrl }));
        const response = await fetch(resolvedSignedUrl);
        if (!response.ok) throw new Error(`Không thể tải PDF hóa đơn VAT (${response.status}).`);
        const blob = await response.blob();
        setVatPreviewUrl(prev => {
          if (prev) URL.revokeObjectURL(prev);
          return URL.createObjectURL(new Blob([blob], { type: 'application/pdf' }));
        });
        setVatOcrLoading(true);
        const extractedItems = await extractVatItemsFromPdfText(new File([blob], `${document.invoiceNo || document.id}.pdf`, { type: 'application/pdf' })).catch(() => []);
        if (extractedItems.length) {
          setVatOcrResult({
            issuerName: document.supplierNameOnInvoice || supplierDefaults.issuerName || '',
            issuerTaxCode: document.supplierTaxCode || supplierDefaults.issuerTaxCode || '',
            issuerPhone: supplierDefaults.issuerPhone,
            issuerAddress: supplierDefaults.issuerAddress,
            invoiceNo: document.invoiceNo || '',
            invoiceDate: normalizeVatDateValue(document.invoiceDate),
            totalBeforeTax: document.totalBeforeTax || 0,
            vatAmount: document.vatAmount || 0,
            totalAmount: document.totalAmount || 0,
            items: extractedItems,
            confidence: { items: 0.85 },
          });
        }
      } catch (error) {
        setVatDataError(getSupabaseErrorMessage(error) || 'Không thể hiển thị PDF hóa đơn VAT trong popup.');
      } finally {
        setLoadingUrl(null);
        setVatOcrLoading(false);
      }
    }
  }, [signedUrls, suppliers]);

  const closeVatDocumentForm = useCallback(() => {
    vatUploadRunRef.current += 1;
    setEditingVatDocumentId(null);
    setVatOcrResult(null);
    setVatOcrLoading(false);
    setVatUploading(false);
    setVatPreviewUrl(prev => {
      if (prev) URL.revokeObjectURL(prev);
      return null;
    });
  }, []);

  const handleSaveVatDocumentInfo = useCallback(async (
    formOverride?: VatDocumentForm,
    mappingLineOverrides?: VatInvoiceMappingLineForm[]
  ) => {
    if (!editingVatDocumentId) return;
    if (editingVatDocumentId === PENDING_VAT_DOCUMENT_ID) {
      setVatDataError('File vẫn đang được upload. Vui lòng đợi thêm vài giây rồi xác nhận.');
      return;
    }
    const form = formOverride || vatDocumentForm;
    const supplier = suppliers.find(item => item.id === form.supplierId);
    const totalBeforeTax = parseVatMoneyInput(form.totalBeforeTax);
    const vatAmount = parseVatMoneyInput(form.vatAmount);
    const totalAmount = parseVatMoneyInput(form.totalAmount) || totalBeforeTax + vatAmount;
    if (!supplier || !form.invoiceNo || !form.invoiceDate || totalAmount <= 0) {
      setVatDataError('Vui lòng nhập đủ NCC, số hóa đơn, ngày hóa đơn và số tiền.');
      return;
    }

    setSavingVatDocument(true);
    setVatDataError(null);
    try {
      const duplicate = findDuplicateVatDocument({
        invoiceNo: form.invoiceNo,
        invoiceDate: form.invoiceDate,
        supplierId: supplier.id,
        supplierTaxCode: form.issuerTaxCode || supplier.invoiceTaxCode || supplier.taxCode,
        supplierName: form.issuerName || supplier.invoiceCompanyName || supplier.companyName || supplier.name,
        totalAmount,
        excludeId: editingVatDocumentId,
      });
      if (duplicate) {
        await supabase.from('vat_document_items').delete().eq('vat_document_id', editingVatDocumentId);
        await supabase.from('vat_documents').delete().eq('id', editingVatDocumentId);
        setLocalVatDocuments(prev => prev.filter(item => item.id !== editingVatDocumentId));
        setVatData(prev =>
          prev
            ? {
                ...prev,
                documents: prev.documents.filter(item => item.id !== editingVatDocumentId),
                items: prev.items.filter(item => item.vatDocumentId !== editingVatDocumentId),
              }
            : prev
        );
        setEditingVatDocumentId(null);
        setVatOcrResult(null);
        setVatPreviewUrl(prev => {
          if (prev) URL.revokeObjectURL(prev);
          return null;
        });
        setVatDataError(
          `Hóa đơn VAT bị trùng với hóa đơn đã có: ${duplicate.invoiceNo} ngày ${formatVatDate(duplicate.invoiceDate)}. App đã hủy bản upload trùng này.`
        );
        return;
      }

      const patch = {
        supplier_id: supplier.id,
        supplier_name_on_invoice: form.issuerName || supplier.invoiceCompanyName || supplier.companyName || supplier.name,
        supplier_tax_code: form.issuerTaxCode || supplier.invoiceTaxCode || supplier.taxCode || null,
        supplier_match_confidence: 1,
        supplier_match_status: 'matched',
        invoice_no: form.invoiceNo,
        invoice_date: normalizeVatDateValue(form.invoiceDate),
        total_before_tax: totalBeforeTax || Math.max(0, totalAmount - vatAmount),
        vat_amount: vatAmount,
        total_amount: totalAmount,
        note: 'Đã xác nhận thông tin hóa đơn VAT từ PDF upload.',
      };
      const { data, error } = await supabase
        .from('vat_documents')
        .update(patch)
        .eq('id', editingVatDocumentId)
        .select('*')
        .single();
      if (error) throw error;

      const saveWarnings: string[] = [];
      const supplierUpdate = await supabase
        .from('suppliers')
        .update({
          invoice_company_name: form.issuerName || null,
          invoice_tax_code: form.issuerTaxCode || null,
          invoice_phone: form.issuerPhone || null,
          invoice_address: form.issuerAddress || null,
        })
        .eq('id', supplier.id);
      if (supplierUpdate.error) {
        if (isMissingSupplierInvoiceColumnError(supplierUpdate.error)) {
          saveWarnings.push('Database chưa có 4 cột invoice_* trong bảng suppliers, nên chưa lưu được tab Thông tin xuất hóa đơn của nhà cung cấp.');
        } else {
          saveWarnings.push(`Chưa cập nhật được thông tin xuất hóa đơn vào nhà cung cấp: ${getSupabaseErrorMessage(supplierUpdate.error)}`);
        }
      }

      const vatGroupByNormalizedName = new Map(
        (vatData?.groups || []).map(group => [normalizeVatText(group.name), group.id])
      );
      const vatGroupNameById = new Map((vatData?.groups || []).map(group => [group.id, group.name]));
      const pendingVatGroupByNormalizedName = new Map<string, Promise<string>>();
      const ensureVatGroupId = async (groupName: string, existingVatGroupId?: string) => {
        if (existingVatGroupId) return existingVatGroupId;
        const normalizedName = normalizeVatText(groupName);
        if (!normalizedName) return '';
        const cachedId = vatGroupByNormalizedName.get(normalizedName);
        if (cachedId) return cachedId;
        const pending = pendingVatGroupByNormalizedName.get(normalizedName);
        if (pending) return pending;

        const resolveGroup = (async () => {
          const findExisting = async () => {
            const { data, error } = await supabase
              .from('vat_groups')
              .select('id,name')
              .ilike('name', groupName)
              .limit(1)
              .maybeSingle();
            if (error) throw error;
            return data?.id || '';
          };

          const existingId = await findExisting();
          if (existingId) {
            vatGroupByNormalizedName.set(normalizedName, existingId);
            return existingId;
          }

          const { data: inserted, error: insertError } = await supabase
            .from('vat_groups')
            .insert({
              name: groupName,
              description: 'Tạo tự động từ nhóm hàng cửa hàng khi mapping hóa đơn VAT.',
              status: 'active',
            })
            .select('id')
            .single();
          if (insertError) {
            if (getSupabaseErrorMessage(insertError).includes('23505')) {
              const duplicateId = await findExisting();
              if (duplicateId) {
                vatGroupByNormalizedName.set(normalizedName, duplicateId);
                return duplicateId;
              }
            }
            throw insertError;
          }
          vatGroupByNormalizedName.set(normalizedName, inserted.id);
          return inserted.id;
        })();

        pendingVatGroupByNormalizedName.set(normalizedName, resolveGroup);
        return resolveGroup;
      };

      const editableMappingLines = (mappingLineOverrides || [])
        .map(line => ({
          ...line,
          name: line.name.trim(),
          productGroupName: String(line.productGroupName || '').trim(),
          amountValue: parseVatMoneyInput(line.amount),
          quantityValue: Number(String(line.quantity || '').replace(/,/g, '.')) || 0,
        }))
        .filter(line => line.name || line.amountValue > 0 || line.productGroupName || line.vatGroupId);
      const resolvedEditableMappingLines = await Promise.all(
        editableMappingLines.map(async line => ({
          ...line,
          vatGroupId: line.productGroupName
            ? await ensureVatGroupId(line.productGroupName, line.vatGroupId)
            : line.vatGroupId,
        }))
      );
      const fallbackOcrLines = !editableMappingLines.length
        ? (vatOcrResult?.items || [])
            .filter(item => item.name)
            .map(item => ({
              name: item.name,
              amountValue: Number(item.totalAmount || item.amountBeforeTax || 0),
              quantityValue: Number(item.quantity || 0),
              vatGroupId: '',
              productGroupName: '',
              vatAmountValue: Number(item.vatAmount || 0),
              amountBeforeTaxValue: Number(item.amountBeforeTax || 0),
              confidenceScore: vatOcrResult?.confidence?.items || 0,
            }))
        : [];
      const itemPayloads = [
        ...resolvedEditableMappingLines.map(line => ({
            vat_document_id: editingVatDocumentId,
            description_on_invoice: line.name || 'Dòng hàng chưa có tên',
            suggested_vat_group_id: line.vatGroupId || null,
            confirmed_vat_group_id: line.vatGroupId || null,
            quantity: line.quantityValue,
            amount_before_tax: line.amountValue,
            vat_amount: 0,
            total_amount: line.amountValue,
            allocated_quantity: 0,
            allocated_amount: 0,
            confidence_score: line.vatGroupId ? 1 : 0,
            mapping_status: line.vatGroupId ? 'confirmed' : 'needs_confirmation',
          })),
        ...fallbackOcrLines.map(line => ({
          vat_document_id: editingVatDocumentId,
          description_on_invoice: line.name,
          quantity: line.quantityValue,
          amount_before_tax: line.amountBeforeTaxValue,
          vat_amount: line.vatAmountValue,
          total_amount: line.amountValue,
          allocated_quantity: 0,
          allocated_amount: 0,
          confidence_score: line.confidenceScore,
          mapping_status: 'needs_confirmation',
        })),
      ];
      let savedDocumentItems: VatDocumentItem[] = [];
      let runAutoAllocationInBackground: (() => Promise<void>) | null = null;
      const replacedItemIds = new Set<string>();
      if (itemPayloads.length) {
        const existingItemsResult = await supabase.from('vat_document_items').select('id').eq('vat_document_id', editingVatDocumentId);
        if (existingItemsResult.error) {
          throw existingItemsResult.error;
        } else {
          (existingItemsResult.data || []).forEach(item => replacedItemIds.add(item.id));
        }
        if (replacedItemIds.size > 0) {
          const { error: deleteAllocationError } = await supabase
            .from('vat_allocations')
            .delete()
            .in('vat_document_item_id', Array.from(replacedItemIds));
          if (deleteAllocationError) {
            throw deleteAllocationError;
          }
        }
        const { error: deleteItemError } = await supabase.from('vat_document_items').delete().eq('vat_document_id', editingVatDocumentId);
        if (deleteItemError) {
          throw deleteItemError;
        }
        const { data: insertedItems, error: itemError } = await supabase.from('vat_document_items').insert(itemPayloads).select('*');
        if (itemError) {
          throw itemError;
        } else {
          savedDocumentItems = (insertedItems || []).map(item => ({
            id: item.id,
            vatDocumentId: item.vat_document_id,
            descriptionOnInvoice: item.description_on_invoice,
            suggestedVatGroupId: item.suggested_vat_group_id || undefined,
            confirmedVatGroupId: item.confirmed_vat_group_id || undefined,
            quantity: item.quantity || 0,
            amountBeforeTax: item.amount_before_tax || 0,
            vatAmount: item.vat_amount || 0,
            totalAmount: item.total_amount || 0,
            allocatedQuantity: item.allocated_quantity || 0,
            allocatedAmount: item.allocated_amount || 0,
            confidenceScore: item.confidence_score || 0,
            mappingStatus: item.mapping_status || 'needs_confirmation',
            createdAt: item.created_at || undefined,
            updatedAt: item.updated_at || undefined,
          }));
          runAutoAllocationInBackground = async () => {
            let autoAllocatedAmount = 0;
            const autoAllocationWarnings: string[] = [];
            const autoAllocatedAmountByItemId = new Map<string, number>();
            const autoAllocations: VatAllocation[] = [];
            const invoiceDate = normalizeVatDateValue(form.invoiceDate);
            const isPreFilingInvoice = !!activeFilingPeriod?.startDate && invoiceDate < activeFilingPeriod.startDate;
            const allocationRows = getReceiptVatGroupRows(
              transactions,
              products || [],
              vatData?.mappings || [],
              vatData?.groups || []
            )
              .filter(row => row.supplierId === supplier.id)
              .filter(row => {
                if (!activeFilingPeriod?.startDate) return true;
                const d = normalizeVatDateValue(row.receipt.date);
                return isPreFilingInvoice ? d < activeFilingPeriod.startDate : d >= activeFilingPeriod.startDate;
              })
              .filter(row => normalizeVatDateValue(row.receipt.date) <= invoiceDate)
              .sort((a, b) => normalizeVatDateValue(b.receipt.date).localeCompare(normalizeVatDateValue(a.receipt.date)));
            const allocatedByReceiptItemId = new Map<string, number>();
            const allocatedByReceiptId = new Map<string, number>();
            const allocatedByOpeningStockItemId = new Map<string, number>();
            (vatData?.allocations || [])
              .filter(allocation => (allocation.status || 'active') === 'active' && !replacedItemIds.has(allocation.vatDocumentItemId))
              .forEach(allocation => {
                const amount = Number(allocation.allocatedAmount || 0);
                if (allocation.openingStockItemId) {
                  allocatedByOpeningStockItemId.set(
                    allocation.openingStockItemId,
                    (allocatedByOpeningStockItemId.get(allocation.openingStockItemId) || 0) + amount
                  );
                } else if (allocation.purchaseReceiptItemId) {
                  allocatedByReceiptItemId.set(
                    allocation.purchaseReceiptItemId,
                    (allocatedByReceiptItemId.get(allocation.purchaseReceiptItemId) || 0) + amount
                  );
                } else if (allocation.purchaseReceiptId) {
                  allocatedByReceiptId.set(
                    allocation.purchaseReceiptId,
                    (allocatedByReceiptId.get(allocation.purchaseReceiptId) || 0) + amount
                  );
                }
              });
            const openingRows = (vatData?.openingStockItems || [])
              .filter(item => !activeFilingPeriod?.id || item.filingPeriodId === activeFilingPeriod.id)
              .filter(item => item.supplierId === supplier.id)
              .sort((a, b) => String(a.productName || '').localeCompare(String(b.productName || ''), 'vi'));
            const insertedEditableItems = (insertedItems || []).slice(0, resolvedEditableMappingLines.length);
            for (let index = 0; index < insertedEditableItems.length; index += 1) {
              const insertedItem = insertedEditableItems[index];
              const mappedLine = resolvedEditableMappingLines[index];
              const vatGroupId = insertedItem.confirmed_vat_group_id || insertedItem.suggested_vat_group_id || mappedLine?.vatGroupId;
              const productGroupKey = normalizeVatText(mappedLine?.productGroupName || '');
              let remainingAmount = Number(insertedItem.amount_before_tax || insertedItem.total_amount || mappedLine?.amountValue || 0);
              if (!vatGroupId || remainingAmount <= 0) continue;

              const matchingRows = allocationRows.filter(row => {
                const sameVatGroup = row.vatGroupId === vatGroupId;
                const sameProductGroup = productGroupKey && normalizeVatText(row.sourceGroupName || row.vatGroupName || '') === productGroupKey;
                const sameGroupBranch = vatGroupMatchesSourceText(
                  vatGroupNameById.get(vatGroupId) || mappedLine?.productGroupName || '',
                  row.sourceGroupName || row.vatGroupName || row.item?.name || row.item?.productName || ''
                );
                return sameVatGroup || sameProductGroup || sameGroupBranch;
              });
              const matchingOpeningRows = openingRows.filter(row => row.vatGroupId === vatGroupId);
              const purchaseTargets = matchingRows.map(row => ({
                targetType: 'purchase_receipt' as const,
                row,
              }));
              const openingTargets = matchingOpeningRows.map(row => ({
                targetType: 'opening_stock' as const,
                row,
              }));
              const allocationTargets = [...purchaseTargets, ...openingTargets];

              for (const target of allocationTargets) {
                if (remainingAmount <= 0) break;
                const alreadyAllocated =
                  target.targetType === 'purchase_receipt'
                    ? (
                        allocatedByReceiptItemId.get(target.row.purchaseReceiptItemId) ||
                        allocatedByReceiptId.get(target.row.receipt.id) ||
                        0
                      )
                    : allocatedByOpeningStockItemId.get(target.row.id) || 0;
                const targetAmount =
                  target.targetType === 'purchase_receipt'
                    ? Number(target.row.amount || 0)
                    : Number(target.row.totalAmount || 0);
                const missingAmount = Math.max(0, targetAmount - alreadyAllocated);
                if (missingAmount <= 0) continue;
                const allocatedAmount = Math.min(remainingAmount, missingAmount);
                const allocation =
                  target.targetType === 'purchase_receipt'
                    ? await allocateVatToPurchaseReceipt({
                        vatDocumentItemId: insertedItem.id,
                        purchaseReceiptId: target.row.receipt.id,
                        purchaseReceiptItemId: target.row.purchaseReceiptItemId,
                        filingPeriodId: activeFilingPeriod?.id,
                        vatGroupId,
                        allocatedAmount,
                        allocatedQuantity: 0,
                        allocationMethod: 'auto',
                      })
                    : await allocateVatToOpeningStock({
                        vatDocumentItemId: insertedItem.id,
                        openingStockItemId: target.row.id,
                        filingPeriodId: activeFilingPeriod?.id || target.row.filingPeriodId,
                        vatGroupId,
                        allocatedAmount,
                        allocatedQuantity: 0,
                        allocationMethod: 'auto',
                      });
                autoAllocatedAmount += allocatedAmount;
                autoAllocations.push(allocation);
                autoAllocatedAmountByItemId.set(
                  insertedItem.id,
                  (autoAllocatedAmountByItemId.get(insertedItem.id) || 0) + allocatedAmount
                );
                remainingAmount -= allocatedAmount;
                if (target.targetType === 'purchase_receipt') {
                  allocatedByReceiptItemId.set(target.row.purchaseReceiptItemId, alreadyAllocated + allocatedAmount);
                } else {
                  allocatedByOpeningStockItemId.set(target.row.id, alreadyAllocated + allocatedAmount);
                }
              }

              if (remainingAmount > 0) {
                autoAllocationWarnings.push(`${mappedLine.name || insertedItem.description_on_invoice} còn ${Math.round(remainingAmount).toLocaleString('vi-VN')}đ chưa phân bổ.`);
              }
            }

            setVatData(prev =>
              prev
                ? {
                    ...prev,
                    items: prev.items.map(item =>
                      autoAllocatedAmountByItemId.has(item.id)
                        ? {
                            ...item,
                            allocatedAmount: autoAllocatedAmountByItemId.get(item.id) || item.allocatedAmount,
                          }
                        : item
                    ),
                    allocations: autoAllocations.length
                      ? [
                          ...autoAllocations,
                          ...prev.allocations.filter(allocation => !replacedItemIds.has(allocation.vatDocumentItemId)),
                        ]
                      : prev.allocations,
                  }
                : prev
            );

            const autoAllocationNotice = `${
              autoAllocatedAmount > 0 ? `Đã tự phân bổ ${Math.round(autoAllocatedAmount).toLocaleString('vi-VN')}đ.` : 'Không có dòng phù hợp để tự phân bổ.'
            }${autoAllocationWarnings.length ? ` ${autoAllocationWarnings.join(' ')}` : ''}`;
            setVatUploadNotice(`Phân bổ nền cho hóa đơn ${form.invoiceNo || data.invoice_no} hoàn tất. ${autoAllocationNotice}`);
          };
        }
      }

      const updatedDocument: VatDocument = {
        id: data.id,
        supplierId: data.supplier_id || undefined,
        supplierNameOnInvoice: data.supplier_name_on_invoice || undefined,
        supplierTaxCode: data.supplier_tax_code || undefined,
        supplierMatchConfidence: data.supplier_match_confidence || 0,
        supplierMatchStatus: data.supplier_match_status || 'matched',
        invoiceNo: data.invoice_no,
        invoiceDate: data.invoice_date,
        totalBeforeTax: data.total_before_tax || 0,
        vatAmount: data.vat_amount || 0,
        totalAmount: data.total_amount || 0,
        filePdfUrl: data.file_pdf_url || undefined,
        fileXmlUrl: data.file_xml_url || undefined,
        status: data.status || 'unallocated',
        note: data.note || undefined,
        createdAt: data.created_at || undefined,
        updatedAt: data.updated_at || undefined,
      };

      setLocalVatDocuments(prev => [updatedDocument, ...prev.filter(item => item.id !== updatedDocument.id)]);
      setVatData(prev =>
        prev
          ? {
              ...prev,
              documents: prev.documents.map(item => (item.id === updatedDocument.id ? updatedDocument : item)),
              items: savedDocumentItems.length
                ? [
                    ...savedDocumentItems,
                    ...prev.items.filter(item => item.vatDocumentId !== updatedDocument.id),
                  ]
                : prev.items,
              allocations: replacedItemIds.size
                ? [
                    ...prev.allocations.filter(allocation => !replacedItemIds.has(allocation.vatDocumentItemId)),
                  ]
                : prev.allocations,
            }
          : prev
      );
      setEditingVatDocumentId(null);
      setVatOcrResult(null);
      setVatPreviewUrl(prev => {
        if (prev) URL.revokeObjectURL(prev);
        return null;
      });
      const backgroundAutoAllocation = runAutoAllocationInBackground;
      const autoAllocationNotice = runAutoAllocationInBackground ? '. Đang tự phân bổ dưới nền' : '';
      setVatUploadNotice(
        saveWarnings.length
          ? `Đã lưu hóa đơn VAT: ${updatedDocument.invoiceNo}. ${saveWarnings.join(' ')}${autoAllocationNotice}`
          : `Đã xác nhận hóa đơn VAT: ${updatedDocument.invoiceNo}${autoAllocationNotice}`
      );
      if (backgroundAutoAllocation) {
        window.setTimeout(() => {
          void backgroundAutoAllocation().catch(error => {
            setVatDataError(getSupabaseErrorMessage(error) || 'Không thể tự phân bổ VAT dưới nền.');
          });
        }, 0);
      }
    } catch (error) {
      setVatDataError(getSupabaseErrorMessage(error) || 'Không thể lưu thông tin hóa đơn VAT.');
    } finally {
      setSavingVatDocument(false);
    }
  }, [activeFilingPeriod, editingVatDocumentId, findDuplicateVatDocument, products, suppliers, transactions, vatData, vatDocumentForm, vatOcrResult]);

  const handleDeleteVatDocument = useCallback(
    async (document: VatDocument) => {
      setVatDataError(null);
      setVatUploadNotice(null);
      try {
        const itemsResult = await supabase.from('vat_document_items').select('id').eq('vat_document_id', document.id);
        if (itemsResult.error) throw itemsResult.error;
        const itemIds = (itemsResult.data || []).map(item => item.id);
        if (itemIds.length > 0) {
          const allocationsResult = await supabase.from('vat_allocations').select('id').in('vat_document_item_id', itemIds).limit(1);
          if (allocationsResult.error) throw allocationsResult.error;
          if ((allocationsResult.data || []).length > 0) {
            setVatDataError('Không thể xóa hóa đơn VAT đã được phân bổ. Vui lòng hủy phân bổ trước khi xóa.');
            return;
          }
          const deleteItemsResult = await supabase.from('vat_document_items').delete().eq('vat_document_id', document.id);
          if (deleteItemsResult.error) throw deleteItemsResult.error;
        }

        const deleteDocumentResult = await supabase.from('vat_documents').delete().eq('id', document.id);
        if (deleteDocumentResult.error) throw deleteDocumentResult.error;

        const paths = [document.filePdfUrl, document.fileXmlUrl].filter(Boolean) as string[];
        if (paths.length > 0) {
          const storageResult = await supabase.storage.from('vat-documents').remove(paths);
          if (storageResult.error) {
            setVatUploadNotice(`Đã xóa hóa đơn VAT ${document.invoiceNo}, nhưng chưa xóa được file trong storage: ${storageResult.error.message}`);
          } else {
            setVatUploadNotice(`Đã xóa hóa đơn VAT ${document.invoiceNo}.`);
          }
        } else {
          setVatUploadNotice(`Đã xóa hóa đơn VAT ${document.invoiceNo}.`);
        }

        setLocalVatDocuments(prev => prev.filter(item => item.id !== document.id));
        setSelectedVatDocumentIds(prev => prev.filter(id => id !== document.id));
        setVatData(prev =>
          prev
            ? {
                ...prev,
                documents: prev.documents.filter(item => item.id !== document.id),
                items: prev.items.filter(item => item.vatDocumentId !== document.id),
              }
            : prev
        );
      } catch (error) {
        setVatDataError(getSupabaseErrorMessage(error) || 'Không thể xóa hóa đơn VAT.');
      }
    },
    []
  );

  const confirmDeleteVatDocument = useCallback(
    async (document: VatDocument) => {
      const confirmed = window.confirm(`Xóa hóa đơn VAT ${document.invoiceNo}? Thao tác này sẽ xóa file PDF và các dòng hàng hóa OCR liên quan.`);
      if (!confirmed) return;
      await handleDeleteVatDocument(document);
    },
    [handleDeleteVatDocument]
  );

  const handleViewFile = useCallback(
    async (attachmentId: string, filePath: string) => {
      if (signedUrls[attachmentId]) {
        window.open(signedUrls[attachmentId], '_blank');
        return;
      }
      setLoadingUrl(attachmentId);
      const { data, error } = await supabase.storage
        .from('purchase-invoices')
        .createSignedUrl(filePath, 3600);
      setLoadingUrl(null);
      if (error || !data?.signedUrl) {
        alert('Không thể mở file. Vui lòng thử lại.');
        return;
      }
      setSignedUrls(prev => ({ ...prev, [attachmentId]: data.signedUrl }));
      window.open(data.signedUrl, '_blank');
    },
    [signedUrls]
  );

  const allImports = useMemo(
    () =>
      transactions.filter(t => t.type === 'Import').sort((a, b) => b.date.localeCompare(a.date)),
    [transactions]
  );

  const supplierById = useMemo(() => new Map(suppliers.map(supplier => [supplier.id, supplier])), [suppliers]);
  const getVatDocumentSupplierName = useCallback(
    (document: VatDocument) => {
      const supplier = document.supplierId ? supplierById.get(document.supplierId) : undefined;
      return supplier?.name || document.supplierNameOnInvoice || 'Cần bổ sung';
    },
    [supplierById]
  );

  const baseFilteredImports = useMemo(() => {
    return allImports.filter(t => {
      if (searchTerm) {
        const q = searchTerm.toLowerCase();
        if (
          !t.note?.toLowerCase().includes(q) &&
          !t.supplierName?.toLowerCase().includes(q) &&
          !t.referenceId?.toLowerCase().includes(q) &&
          !t.id.toLowerCase().includes(q)
        )
          return false;
      }
      const transactionDate = normalizeVatDateValue(t.date);
      if (effectiveDateRange.start && transactionDate < effectiveDateRange.start) return false;
      if (effectiveDateRange.end && transactionDate > effectiveDateRange.end) return false;
      if (supplierFilter !== 'all' && t.supplierId !== supplierFilter) return false;
      return true;
    });
  }, [allImports, effectiveDateRange.end, effectiveDateRange.start, searchTerm, supplierFilter]);

  const vatAllocationByReceiptId = useMemo(() => {
    const byReceiptId = new Map<string, { goodsAmount: number; vatAmount: number }>();
    const documentItemById = new Map((vatData?.items || []).map(item => [item.id, item]));
    const receiptRows = getReceiptVatGroupRows(
      baseFilteredImports,
      products || [],
      vatData?.mappings || [],
      vatData?.groups || []
    );
    const receiptRowByItemId = new Map(receiptRows.map(row => [row.purchaseReceiptItemId, row]));
    const receiptRowsByReceiptId = new Map<string, typeof receiptRows>();
    receiptRows.forEach(row => {
      const rows = receiptRowsByReceiptId.get(row.receipt.id) || [];
      rows.push(row);
      receiptRowsByReceiptId.set(row.receipt.id, rows);
    });

    (vatData?.allocations || [])
      .filter(allocation => (allocation.status || 'active') === 'active')
      .forEach(allocation => {
        const item = documentItemById.get(allocation.vatDocumentItemId);
        if (!item) return;
        const receiptRow =
          (allocation.purchaseReceiptItemId && receiptRowByItemId.get(allocation.purchaseReceiptItemId)) ||
          (allocation.purchaseReceiptId
            ? receiptRowsByReceiptId.get(allocation.purchaseReceiptId)?.find(row => row.vatGroupId === allocation.vatGroupId)
            : undefined);
        const receiptId = receiptRow?.receipt.id || allocation.purchaseReceiptId;
        if (!receiptId) return;
        const taxableBase = Number(item.amountBeforeTax || item.totalAmount || 0);
        if (taxableBase <= 0) return;
        const allocatedGoodsAmount = Math.max(0, Number(allocation.allocatedAmount || 0));
        const allocationRatio = Math.min(1, Math.max(0, allocatedGoodsAmount / taxableBase));
        const vatAmount = Number(item.vatAmount || 0) > 0 ? Math.round(Number(item.vatAmount || 0) * allocationRatio) : 0;
        const current = byReceiptId.get(receiptId) || { goodsAmount: 0, vatAmount: 0 };
        current.goodsAmount += allocatedGoodsAmount;
        current.vatAmount += vatAmount;
        byReceiptId.set(receiptId, current);
      });
    return byReceiptId;
  }, [baseFilteredImports, products, vatData]);

  const allocatedGoodsByReceiptId = useMemo(
    () => new Map(Array.from(vatAllocationByReceiptId.entries()).map(([receiptId, value]) => [receiptId, value.goodsAmount])),
    [vatAllocationByReceiptId]
  );

  const allocatedVatByReceiptId = useMemo(
    () => new Map(Array.from(vatAllocationByReceiptId.entries()).map(([receiptId, value]) => [receiptId, value.vatAmount])),
    [vatAllocationByReceiptId]
  );

  const getEffectiveInvoiceStatus = useCallback(
    (transaction: AppData['inventoryTransactions'][number]): Exclude<TabKey, 'all'> => {
      const totalAmount = Number(transaction.totalAmount || 0);
      const allocatedAmount = Number(allocatedGoodsByReceiptId.get(transaction.id) || 0);
      if (allocatedAmount > 0 && totalAmount > 0) {
        return allocatedAmount >= totalAmount - 1 ? 'full' : 'partial';
      }
      if (allocatedAmount > 0) return 'partial';
      if (transaction.invoiceStatus === 'full') return 'full';
      if (transaction.invoiceStatus === 'partial' || transaction.invoiceStatus === 'memo_only') return 'partial';
      return 'none';
    },
    [allocatedGoodsByReceiptId]
  );

  const effectiveInvoiceStatusByReceiptId = useMemo(() => {
    const byReceiptId = new Map<string, Exclude<TabKey, 'all'>>();
    baseFilteredImports.forEach(transaction => {
      byReceiptId.set(transaction.id, getEffectiveInvoiceStatus(transaction));
    });
    return byReceiptId;
  }, [baseFilteredImports, getEffectiveInvoiceStatus]);

  const tabCounts = useMemo(() => {
    const counts: Record<TabKey, number> = { all: 0, full: 0, partial: 0, none: 0 };
    baseFilteredImports.forEach(t => {
      counts.all++;
      counts[getEffectiveInvoiceStatus(t)]++;
    });
    return counts;
  }, [baseFilteredImports, getEffectiveInvoiceStatus]);

  const filtered = useMemo(() => {
    return baseFilteredImports.filter(t => {
      if (activeTab !== 'all') {
        const s = getEffectiveInvoiceStatus(t);
        if (s !== activeTab) return false;
      }
      return true;
    });
  }, [activeTab, baseFilteredImports, getEffectiveInvoiceStatus]);

  useEffect(() => {
    setVisibleListLimit(LIST_PAGE_SIZE);
  }, [activeTab, dateRange.end, dateRange.start, purchasePeriodScope, searchTerm, supplierFilter]);

  const visibleFiltered = useMemo(
    () => filtered.slice(0, visibleListLimit),
    [filtered, visibleListLimit]
  );

  const filteredImportCount = filtered.length;

  const summary = useMemo(() => {
    const totalAmount = filtered.reduce((s, t) => s + (t.totalAmount || 0), 0);
    const hasInvoiceAmount = filtered.reduce(
      (sum, t) => sum + Math.min(Number(t.totalAmount || 0), allocatedGoodsByReceiptId.get(t.id) || 0),
      0
    );
    const missingHD = Math.max(0, totalAmount - hasInvoiceAmount);
    return {
      totalAmount,
      hasFullHD: hasInvoiceAmount,
      hasPartialHD: 0,
      missingHD,
    };
  }, [allocatedGoodsByReceiptId, filtered]);

  const monthlyReport = useMemo(() => {
    if (!showReport || reportMode !== 'legacy') return [];
    const byMonth: Record<
      string,
      { total: number; hasHD: number; missing: number; count: number; vatDeductible: number }
    > = {};
    filtered.forEach(t => {
      const month = t.date.substring(0, 7);
      if (!byMonth[month]) byMonth[month] = { total: 0, hasHD: 0, missing: 0, count: 0, vatDeductible: 0 };
      const amount = t.totalAmount || 0;
      byMonth[month].total += amount;
      byMonth[month].count += 1;
      byMonth[month].vatDeductible += allocatedVatByReceiptId.get(t.id) || 0;
      const allocatedGoodsAmount = Math.min(amount, allocatedGoodsByReceiptId.get(t.id) || 0);
      byMonth[month].hasHD += allocatedGoodsAmount;
      byMonth[month].missing += Math.max(0, amount - allocatedGoodsAmount);
    });
    return Object.entries(byMonth)
      .sort(([a], [b]) => b.localeCompare(a))
      .map(([month, d]) => ({
        month,
        ...d,
        coverage: d.total > 0 ? Math.round((d.hasHD / d.total) * 100) : 0,
      }));
  }, [allocatedGoodsByReceiptId, allocatedVatByReceiptId, filtered, reportMode, showReport]);

  const importsByReportMonth = useMemo(() => {
    const byMonth = new Map<string, AppData['inventoryTransactions']>();
    filtered.forEach(transaction => {
      const month = transaction.date.substring(0, 7);
      const current = byMonth.get(month) || [];
      current.push(transaction);
      byMonth.set(month, current);
    });
    return byMonth;
  }, [filtered]);

  const vatSummary = useMemo(() => {
    const invoicedTotal = summary.hasFullHD + summary.hasPartialHD;
    const vatDeductible = Array.from(allocatedVatByReceiptId.values()).reduce((sum, value) => sum + value, 0);
    return { invoicedTotal, vatDeductible };
  }, [allocatedVatByReceiptId, summary]);

  const vatCoverageRows = useMemo(
    () => {
      if (!shouldBuildVatCoverageRows) return [];
      return buildVatCoverageByGroup(
        filtered,
        products || [],
        vatData?.groups || [],
        vatData?.mappings || [],
        vatData?.allocations || []
      );
    },
    [filtered, products, shouldBuildVatCoverageRows, vatData]
  );

  const vatCoverageSummary = useMemo(() => {
    const totalPurchased = vatCoverageRows.reduce((sum, row) => sum + row.totalPurchasedAmount, 0);
    const covered = vatCoverageRows.reduce((sum, row) => sum + row.vatCoveredAmount, 0);
    const missing = vatCoverageRows.reduce((sum, row) => sum + row.missingAmount, 0);
    const missingSuppliers = new Set(
      vatCoverageRows.flatMap(row => (row.missingAmount > 0 ? row.supplierNames : []))
    ).size;
    const overdueGroups = vatCoverageRows.filter(row => row.riskStatus === 'overdue_30').length;
    const highestRisk = vatCoverageRows.find(row => row.missingAmount > 0)?.vatGroupName || 'Không có';
    return {
      totalPurchased,
      covered,
      missing,
      coveragePercent: totalPurchased > 0 ? Math.round((covered / totalPurchased) * 100) : 0,
      missingSuppliers,
      overdueGroups,
      highestRisk,
    };
  }, [vatCoverageRows]);

  const vatSupplierRows = useMemo(() => {
    if (!shouldBuildVatSupplierRows) return [];
    const bySupplier = new Map<string, { supplierName: string; total: number; covered: number; missing: number; groups: Set<string> }>();
    const allocatedByItem = new Map<string, number>();
    const allocatedByReceipt = new Map<string, number>();

    (vatData?.allocations || [])
      .filter(allocation => (allocation.status || 'active') === 'active')
      .forEach(allocation => {
        const amount = Number(allocation.allocatedAmount || 0);
        if (allocation.purchaseReceiptItemId) {
          allocatedByItem.set(
            allocation.purchaseReceiptItemId,
            (allocatedByItem.get(allocation.purchaseReceiptItemId) || 0) + amount
          );
        } else if (allocation.purchaseReceiptId) {
          allocatedByReceipt.set(
            allocation.purchaseReceiptId,
            (allocatedByReceipt.get(allocation.purchaseReceiptId) || 0) + amount
          );
        }
      });

    getReceiptVatGroupRows(
      filtered,
      products || [],
      vatData?.mappings || [],
      vatData?.groups || []
    ).forEach(row => {
      const key = row.supplierId || row.supplierName;
      const current = bySupplier.get(key) ?? {
        supplierName: row.supplierName,
        total: 0,
        covered: 0,
        missing: 0,
        groups: new Set<string>(),
      };
      const coveredByItem = allocatedByItem.get(row.purchaseReceiptItemId) || 0;
      const coveredByReceipt = allocatedByReceipt.get(row.receipt.id) || 0;
      const covered = Math.min(row.amount, coveredByItem || coveredByReceipt);
      current.total += row.amount;
      current.covered += covered;
      current.missing += Math.max(0, row.amount - covered);
      current.groups.add(row.vatGroupName);
      bySupplier.set(key, current);
    });
    return Array.from(bySupplier.values()).sort((a, b) => b.missing - a.missing);
  }, [filtered, products, shouldBuildVatSupplierRows, vatData]);

  const scopedVatDocuments = useMemo(
    () =>
      mergedVatDocuments.filter(document => {
        if (document.status === 'void') return false;
        const invoiceDate = normalizeVatDateValue(document.invoiceDate);
        if (effectiveDateRange.start && invoiceDate < effectiveDateRange.start) return false;
        if (effectiveDateRange.end && invoiceDate > effectiveDateRange.end) return false;
        if (supplierFilter !== 'all' && document.supplierId !== supplierFilter) return false;
        if (searchTerm) {
          const q = searchTerm.toLowerCase();
          const supplierName = getVatDocumentSupplierName(document).toLowerCase();
          if (
            !String(document.invoiceNo || '').toLowerCase().includes(q) &&
            !String(document.supplierNameOnInvoice || '').toLowerCase().includes(q) &&
            !String(document.supplierTaxCode || '').toLowerCase().includes(q) &&
            !supplierName.includes(q)
          ) {
            return false;
          }
        }
        return true;
      }),
    [
      effectiveDateRange.end,
      effectiveDateRange.start,
      getVatDocumentSupplierName,
      mergedVatDocuments,
      searchTerm,
      supplierFilter,
    ]
  );

  const scopedVatDocumentIds = useMemo(
    () => new Set(scopedVatDocuments.map(document => document.id)),
    [scopedVatDocuments]
  );

  const scopedVatDocumentItems = useMemo(
    () => (vatData?.items || []).filter(item => scopedVatDocumentIds.has(item.vatDocumentId)),
    [scopedVatDocumentIds, vatData?.items]
  );

  const vatDocumentItemSummaryByDoc = useMemo(() => {
    const byDoc = new Map<string, { total: number; mapped: number; unmapped: number }>();
    scopedVatDocumentItems.forEach(item => {
      const current = byDoc.get(item.vatDocumentId) || { total: 0, mapped: 0, unmapped: 0 };
      current.total += 1;
      if (item.confirmedVatGroupId || item.suggestedVatGroupId || item.mappingStatus === 'confirmed' || item.mappingStatus === 'suggested') {
        current.mapped += 1;
      } else {
        current.unmapped += 1;
      }
      byDoc.set(item.vatDocumentId, current);
    });
    return byDoc;
  }, [scopedVatDocumentItems]);

  const vatDocumentAllocationStatusByDoc = useMemo(() => {
    const byDoc = new Map<string, 'unallocated' | 'partial' | 'completed' | 'over_allocated'>();
    const totalsByDoc = new Map<string, { amount: number; allocated: number }>();
    scopedVatDocumentItems.forEach(item => {
      const current = totalsByDoc.get(item.vatDocumentId) || { amount: 0, allocated: 0 };
      current.amount += Number(item.amountBeforeTax || item.totalAmount || 0);
      current.allocated += Number(item.allocatedAmount || 0);
      totalsByDoc.set(item.vatDocumentId, current);
    });
    scopedVatDocuments.forEach(document => {
      const totals = totalsByDoc.get(document.id);
      if (!totals || totals.amount <= 0) {
        byDoc.set(document.id, 'unallocated');
        return;
      }
      if (totals.allocated > totals.amount + 1) byDoc.set(document.id, 'over_allocated');
      else if (totals.allocated >= totals.amount - 1) byDoc.set(document.id, 'completed');
      else if (totals.allocated > 0) byDoc.set(document.id, 'partial');
      else byDoc.set(document.id, 'unallocated');
    });
    return byDoc;
  }, [scopedVatDocumentItems, scopedVatDocuments]);

  const editingVatDocumentItems = useMemo(
    () =>
      editingVatDocumentId && editingVatDocumentId !== PENDING_VAT_DOCUMENT_ID
        ? (vatData?.items || []).filter(item => item.vatDocumentId === editingVatDocumentId)
        : [],
    [editingVatDocumentId, vatData?.items]
  );

  const visibleVatDocuments = useMemo(
    () => scopedVatDocuments.slice(0, LIST_PAGE_SIZE),
    [scopedVatDocuments]
  );

  const visibleVatDocumentIds = useMemo(
    () => visibleVatDocuments.map(document => document.id),
    [visibleVatDocuments]
  );
  const allVisibleVatDocumentsSelected =
    visibleVatDocumentIds.length > 0 && visibleVatDocumentIds.every(id => selectedVatDocumentIds.includes(id));

  const handleToggleAllVisibleVatDocuments = useCallback(() => {
    setSelectedVatDocumentIds(prev => {
      const visibleSet = new Set(visibleVatDocumentIds);
      if (visibleVatDocumentIds.length > 0 && visibleVatDocumentIds.every(id => prev.includes(id))) {
        return prev.filter(id => !visibleSet.has(id));
      }
      return Array.from(new Set([...prev, ...visibleVatDocumentIds]));
    });
  }, [visibleVatDocumentIds]);

  const handleDeleteSelectedVatDocuments = useCallback(async () => {
    const selectedDocuments = visibleVatDocuments.filter(document => selectedVatDocumentIds.includes(document.id));
    if (selectedDocuments.length === 0) return;
    const confirmed = window.confirm(`Xóa ${selectedDocuments.length} hóa đơn VAT đã chọn? Hóa đơn đã phân bổ sẽ được giữ lại.`);
    if (!confirmed) return;

    for (const document of selectedDocuments) {
      await handleDeleteVatDocument(document);
    }
  }, [handleDeleteVatDocument, selectedVatDocumentIds, visibleVatDocuments]);

  const vatDocumentsByStatus = useMemo(() => {
    const docs = scopedVatDocuments;
    const totalBeforeTax = docs.reduce((sum, doc) => sum + Number(doc.totalBeforeTax || doc.totalAmount || 0), 0);
    const vatAmount = docs.reduce((sum, doc) => sum + Number(doc.vatAmount || 0), 0);
    const totalAmount = docs.reduce((sum, doc) => sum + Number(doc.totalAmount || 0), 0);
    const mapped = docs.filter(doc => {
      const summary = vatDocumentItemSummaryByDoc.get(doc.id);
      return summary ? summary.total > 0 && summary.unmapped === 0 : false;
    }).length;
    return {
      total: docs.length,
      unallocated: docs.filter(doc => vatDocumentAllocationStatusByDoc.get(doc.id) === 'unallocated').length,
      partial: docs.filter(doc => vatDocumentAllocationStatusByDoc.get(doc.id) === 'partial').length,
      completed: docs.filter(doc => vatDocumentAllocationStatusByDoc.get(doc.id) === 'completed').length,
      overAllocated: docs.filter(doc => vatDocumentAllocationStatusByDoc.get(doc.id) === 'over_allocated').length,
      totalBeforeTax,
      vatAmount,
      totalAmount,
      mapped,
      unmapped: Math.max(0, docs.length - mapped),
    };
  }, [scopedVatDocuments, vatDocumentAllocationStatusByDoc, vatDocumentItemSummaryByDoc]);

  const supplierProductGroupsBySupplierId = useMemo(() => {
    const bySupplierId = new Map<string, Map<string, SupplierProductGroupOption>>();
    const vatGroupIdByName = new Map<string, string>();
    (vatData?.groups || []).forEach(group => {
      const names = [
        group.name,
        ...String(group.name || '')
          .split(/\s*(?:>{1,2}|\/)\s*/)
          .map(part => part.trim())
          .filter(Boolean),
      ];
      names.forEach(name => {
        const key = normalizeVatText(name);
        if (key && !vatGroupIdByName.has(key)) vatGroupIdByName.set(key, group.id);
      });
    });

    const receiptRows = getReceiptVatGroupRows(
      transactions,
      products || [],
      vatData?.mappings || [],
      vatData?.groups || []
    );

    receiptRows.forEach(row => {
      if (!row.supplierId) return;
      const name = row.sourceGroupName || row.vatGroupName;
      const normalizedName = normalizeVatText(name);
      if (!normalizedName) return;
      const vatGroupId = !isUnmappedVatGroupId(row.vatGroupId)
        ? row.vatGroupId
        : vatGroupIdByName.get(normalizedName);
      const groups = bySupplierId.get(row.supplierId) || new Map<string, SupplierProductGroupOption>();
      groups.set(normalizedName, { name, vatGroupId });
      bySupplierId.set(row.supplierId, groups);
    });

    return new Map(
      Array.from(bySupplierId.entries()).map(([supplierId, groups]) => [
        supplierId,
        Array.from(groups.values()).sort((a, b) => a.name.localeCompare(b.name, 'vi')),
      ])
    );
  }, [products, transactions, vatData]);

  const filingReconciliation = useMemo(
    () => {
      if (!isFilingReportActive) {
        return {
          rows: [],
          summary: {
            openingGoodsAmount: 0,
            openingVatCoveredAmount: 0,
            openingVatMissingAmount: 0,
            postFilingGoodsAmount: 0,
            postFilingVatCoveredAmount: 0,
            postFilingVatMissingAmount: 0,
            unallocatedDocumentAmount: 0,
            suppliersNeedVatCount: 0,
            overAllocatedAmount: 0,
          },
        };
      }
      return buildVatFilingReconciliation({
        period: activeFilingPeriod,
        openingStockItems: vatData?.openingStockItems || [],
        receipts: filtered,
        products: products || [],
        groups: vatData?.groups || [],
        mappings: vatData?.mappings || [],
        allocations: vatData?.allocations || [],
        documents: scopedVatDocuments,
        documentItems: scopedVatDocumentItems,
      });
    },
    [activeFilingPeriod, filtered, isFilingReportActive, products, scopedVatDocumentItems, scopedVatDocuments, vatData]
  );

  const preReceiptFilingRows = useMemo<VatReconciliationRow[]>(() => {
    if (!isFilingReportActive || purchasePeriodScope === 'post') return [];

    const allocatedByItem = new Map<string, number>();
    const allocatedByReceipt = new Map<string, number>();
    (vatData?.allocations || [])
      .filter(allocation => (allocation.status || 'active') === 'active')
      .forEach(allocation => {
        const amount = Number(allocation.allocatedAmount || 0);
        if (allocation.purchaseReceiptItemId) {
          allocatedByItem.set(
            allocation.purchaseReceiptItemId,
            (allocatedByItem.get(allocation.purchaseReceiptItemId) || 0) + amount
          );
        } else if (allocation.purchaseReceiptId) {
          allocatedByReceipt.set(
            allocation.purchaseReceiptId,
            (allocatedByReceipt.get(allocation.purchaseReceiptId) || 0) + amount
          );
        }
      });

    const byKey = new Map<string, VatReconciliationRow>();
    getReceiptVatGroupRows(
      filtered.filter(receipt =>
        purchasePeriodScope === 'all'
          ? normalizeVatDateValue(receipt.date) < effectiveFilingStartDate
          : true
      ),
      products || [],
      vatData?.mappings || [],
      vatData?.groups || []
    ).forEach(row => {
      const key = `pre_receipt:${row.supplierId || row.supplierName || 'unknown'}:${row.vatGroupId}`;
      const rawAllocated =
        allocatedByItem.get(row.purchaseReceiptItemId) ||
        allocatedByReceipt.get(row.receipt.id) ||
        0;
      const validAllocated = Math.min(row.amount, rawAllocated);
      const overAllocated = Math.max(0, rawAllocated - row.amount);
      const current = byKey.get(key) || {
        id: key,
        stage: 'opening_stock' as const,
        stageLabel: 'Trước ngày chốt',
        supplierId: row.supplierId,
        supplierName: row.supplierName,
        vatGroupId: row.vatGroupId,
        vatGroupName: row.vatGroupName,
        itemCount: 0,
        invoiceCount: 0,
        goodsQuantity: 0,
        goodsAmount: 0,
        validAllocatedAmount: 0,
        overAllocatedAmount: 0,
        missingAmount: 0,
        coveragePercent: 0,
        riskStatus: 'missing' as const,
      };
      current.itemCount += 1;
      current.invoiceCount += rawAllocated > 0 ? 1 : 0;
      current.goodsQuantity += row.quantity;
      current.goodsAmount += row.amount;
      current.validAllocatedAmount += validAllocated;
      current.overAllocatedAmount += overAllocated;
      byKey.set(key, current);
    });

    return Array.from(byKey.values()).map(row => {
      const missingAmount = Math.max(0, row.goodsAmount - row.validAllocatedAmount);
      const coveragePercent = row.goodsAmount > 0 ? Math.round((row.validAllocatedAmount / row.goodsAmount) * 100) : 0;
      return {
        ...row,
        missingAmount,
        coveragePercent,
        riskStatus: isUnmappedVatGroupId(row.vatGroupId)
          ? 'needs_mapping'
          : row.overAllocatedAmount > 0
            ? 'over_allocated'
            : missingAmount <= 0
              ? 'covered'
              : row.validAllocatedAmount > 0
                ? 'partial'
                : 'missing',
      };
    });
  }, [effectiveFilingStartDate, filtered, isFilingReportActive, products, purchasePeriodScope, vatData]);

  const scopedFilingRows = useMemo(
    () => {
      const postRows = filingReconciliation.rows.filter(row => row.stage === 'post_filing');
      if (purchasePeriodScope === 'pre') return preReceiptFilingRows;
      if (purchasePeriodScope === 'all') return [...preReceiptFilingRows, ...postRows];
      return postRows;
    },
    [filingReconciliation.rows, preReceiptFilingRows, purchasePeriodScope]
  );

  const filingReceiptDetailRows = useMemo<FilingReceiptDetailRow[]>(() => {
    if (!isFilingReportActive) return [];

    const allocatedByItem = new Map<string, number>();
    const allocatedByReceipt = new Map<string, number>();
    (vatData?.allocations || [])
      .filter(allocation => (allocation.status || 'active') === 'active')
      .forEach(allocation => {
        const amount = Number(allocation.allocatedAmount || 0);
        if (allocation.purchaseReceiptItemId) {
          allocatedByItem.set(
            allocation.purchaseReceiptItemId,
            (allocatedByItem.get(allocation.purchaseReceiptItemId) || 0) + amount
          );
        } else if (allocation.purchaseReceiptId) {
          allocatedByReceipt.set(
            allocation.purchaseReceiptId,
            (allocatedByReceipt.get(allocation.purchaseReceiptId) || 0) + amount
          );
        }
      });

    return getReceiptVatGroupRows(
      filtered,
      products || [],
      vatData?.mappings || [],
      vatData?.groups || []
    ).map(row => {
      const rawAllocated =
        allocatedByItem.get(row.purchaseReceiptItemId) ||
        allocatedByReceipt.get(row.receipt.id) ||
        0;
      const validAllocated = Math.min(row.amount, rawAllocated);
      const overAllocated = Math.max(0, rawAllocated - row.amount);
      const missing = Math.max(0, row.amount - validAllocated);
      const coverage = row.amount > 0 ? Math.max(0, Math.min(100, Math.round((validAllocated / row.amount) * 100))) : 0;
      const riskStatus: VatReconciliationRow['riskStatus'] = isUnmappedVatGroupId(row.vatGroupId)
        ? 'needs_mapping'
        : overAllocated > 0
          ? 'over_allocated'
          : missing <= 0
            ? 'covered'
            : validAllocated > 0
              ? 'partial'
              : 'missing';

      const detailStage =
        purchasePeriodScope === 'pre' ||
        (purchasePeriodScope === 'all' && normalizeVatDateValue(row.receipt.date) < effectiveFilingStartDate)
          ? 'pre_receipt'
          : 'post_filing';

      return {
        id: row.purchaseReceiptItemId,
        supplierKey: row.supplierId || row.supplierName || 'unknown',
        groupKey: `${detailStage}:${row.supplierId || row.supplierName || 'unknown'}:${row.vatGroupId}`,
        receiptCode: getPurchaseCode(row.receipt),
        receiptDate: row.receipt.date,
        itemName: row.item.name || row.item.productName || row.item.sku || row.item.productId,
        goodsAmount: row.amount,
        validAllocatedAmount: validAllocated,
        overAllocatedAmount: overAllocated,
        missingAmount: missing,
        coveragePercent: coverage,
        invoiceCount: rawAllocated > 0 ? 1 : 0,
        riskStatus,
      };
    });
  }, [effectiveFilingStartDate, filtered, isFilingReportActive, products, purchasePeriodScope, vatData]);

  const filingSupplierTreeRows = useMemo(() => {
    const receiptDetailsByGroup = new Map<string, FilingReceiptDetailRow[]>();
    filingReceiptDetailRows.forEach(detail => {
      const rows = receiptDetailsByGroup.get(detail.groupKey) || [];
      rows.push(detail);
      receiptDetailsByGroup.set(detail.groupKey, rows);
    });

    const bySupplier = new Map<
      string,
      {
        key: string;
        supplierId?: string;
        supplierName: string;
        itemCount: number;
        invoiceCount: number;
        goodsAmount: number;
        validAllocatedAmount: number;
        overAllocatedAmount: number;
        missingAmount: number;
        coveragePercent: number;
        riskStatus: VatReconciliationRow['riskStatus'];
        children: (VatReconciliationRow & { detailRows: FilingReceiptDetailRow[] })[];
      }
    >();

    scopedFilingRows.forEach(row => {
      const key = row.supplierId || row.supplierName || 'unknown';
      const current =
        bySupplier.get(key) ||
        {
          key,
          supplierId: row.supplierId,
          supplierName: row.supplierName || 'Không rõ NCC',
          itemCount: 0,
          invoiceCount: 0,
          goodsAmount: 0,
          validAllocatedAmount: 0,
          overAllocatedAmount: 0,
          missingAmount: 0,
          coveragePercent: 0,
          riskStatus: 'covered' as VatReconciliationRow['riskStatus'],
          children: [],
        };

      current.itemCount += row.itemCount;
      current.invoiceCount += row.invoiceCount;
      current.goodsAmount += row.goodsAmount;
      current.validAllocatedAmount += row.validAllocatedAmount;
      current.overAllocatedAmount += row.overAllocatedAmount;
      current.missingAmount += row.missingAmount;
      current.riskStatus = getWorseReconciliationRisk(current.riskStatus, row.riskStatus);
      current.children.push({
        ...row,
        detailRows: receiptDetailsByGroup.get(row.id) || [],
      });
      bySupplier.set(key, current);
    });

    return Array.from(bySupplier.values())
      .map(row => ({
        ...row,
        coveragePercent:
          row.goodsAmount > 0 ? Math.max(0, Math.min(100, Math.round((row.validAllocatedAmount / row.goodsAmount) * 100))) : 0,
        children: row.children.sort(
          (a, b) =>
            b.missingAmount - a.missingAmount ||
            b.goodsAmount - a.goodsAmount ||
            a.vatGroupName.localeCompare(b.vatGroupName, 'vi')
        ),
      }))
      .sort((a, b) => b.missingAmount - a.missingAmount || b.goodsAmount - a.goodsAmount || a.supplierName.localeCompare(b.supplierName, 'vi'));
  }, [filingReceiptDetailRows, scopedFilingRows]);
  const showFilingGroupColumn = Boolean(expandedFilingSupplierKey);

  const scopedFilingSummary = useMemo(() => {
    const goodsAmount = scopedFilingRows.reduce((sum, row) => sum + row.goodsAmount, 0);
    const coveredAmount = scopedFilingRows.reduce((sum, row) => sum + row.validAllocatedAmount, 0);
    const missingAmount = scopedFilingRows.reduce((sum, row) => sum + row.missingAmount, 0);
    return {
      goodsAmount,
      coveredAmount,
      missingAmount,
      suppliersNeedVatCount: new Set(scopedFilingRows.filter(row => row.missingAmount > 0).map(row => row.supplierId || row.supplierName)).size,
      overAllocatedAmount: scopedFilingRows.reduce((sum, row) => sum + row.overAllocatedAmount, 0),
      unallocatedDocumentAmount: scopedVatDocumentItems.reduce(
        (sum, item) => sum + Math.max(0, Number(item.amountBeforeTax || 0) - Number(item.allocatedAmount || 0)),
        0
      ),
    };
  }, [scopedFilingRows, scopedVatDocumentItems]);

  const supplierNeedRows = useMemo(() => {
    const rows = scopedFilingRows.filter(row => row.missingAmount > 0);
    const bySupplier = new Map<string, { supplierName: string; missingAmount: number; goodsAmount: number; groups: Set<string>; stages: Set<string> }>();
    rows.forEach(row => {
      const key = row.supplierId || row.supplierName;
      const current = bySupplier.get(key) || {
        supplierName: row.supplierName,
        missingAmount: 0,
        goodsAmount: 0,
        groups: new Set<string>(),
        stages: new Set<string>(),
      };
      current.missingAmount += row.missingAmount;
      current.goodsAmount += row.goodsAmount;
      current.groups.add(row.vatGroupName);
      current.stages.add(row.stageLabel);
      bySupplier.set(key, current);
    });
    return Array.from(bySupplier.values()).sort((a, b) => b.missingAmount - a.missingAmount);
  }, [scopedFilingRows]);

  const openingStockPreview = useMemo(() => {
    if (!isFilingReportActive) return { count: 0, totalQuantity: 0, totalAmount: 0 };
    const activeProducts = (products || []).filter(product => product.status !== 'Inactive' && Number(product.stock || 0) > 0);
    const totalQuantity = activeProducts.reduce((sum, product) => sum + Number(product.stock || 0), 0);
    const totalAmount = activeProducts.reduce(
      (sum, product) => sum + Number(product.stock || 0) * Number(product.importPrice || 0),
      0
    );
    return { count: activeProducts.length, totalQuantity, totalAmount };
  }, [isFilingReportActive, products]);

  const currentOpeningStockItems = useMemo(() => {
    const periodId = activeFilingPeriod?.id;
    const items = vatData?.openingStockItems || [];
    return periodId ? items.filter(item => item.filingPeriodId === periodId) : items;
  }, [activeFilingPeriod, vatData]);

  const canResetOpeningStock =
    !!activeFilingPeriod &&
    activeFilingPeriod.status !== 'locked' &&
    currentOpeningStockItems.length > 0;

  const availableVatDocumentItems = useMemo(() => {
    if (!isVatReportActive) return [];
    const documentById = new Map(scopedVatDocuments.map(doc => [doc.id, doc]));
    return scopedVatDocumentItems
      .map(item => {
        const document = documentById.get(item.vatDocumentId);
        const remainingAmount =
          typeof item.remainingAmount === 'number'
            ? item.remainingAmount
            : Math.max(0, Number(item.amountBeforeTax || 0) - Number(item.allocatedAmount || 0));
        const remainingQuantity =
          typeof item.remainingQuantity === 'number'
            ? item.remainingQuantity
            : Math.max(0, Number(item.quantity || 0) - Number(item.allocatedQuantity || 0));
        return { item, document, remainingAmount, remainingQuantity };
      })
      .filter(row => !!row.document)
      .filter(row => row.remainingAmount > 0 || row.remainingQuantity > 0);
  }, [isVatReportActive, scopedVatDocumentItems, scopedVatDocuments]);

  const postFilingReceiptRows = useMemo(() => {
    if (!isFilingReportActive) return [];
    const rows = getReceiptVatGroupRows(
      filtered,
      products || [],
      vatData?.mappings || [],
      vatData?.groups || []
    );
    return rows.sort((a, b) => a.receipt.date.localeCompare(b.receipt.date));
  }, [filtered, isFilingReportActive, products, vatData]);

  const selectedOpeningStockItem = useMemo(
    () => currentOpeningStockItems.find(item => item.id === openingAllocation.openingStockItemId),
    [currentOpeningStockItems, openingAllocation.openingStockItemId]
  );

  const suggestedOpeningVatItems = useMemo(() => {
    const filingDate = activeFilingPeriod?.startDate || filingStartDate;
    return availableVatDocumentItems
      .map(row => {
        const itemGroupId = row.item.confirmedVatGroupId || row.item.suggestedVatGroupId;
        const sameGroup = !!selectedOpeningStockItem?.vatGroupId && itemGroupId === selectedOpeningStockItem.vatGroupId;
        const beforeFiling = row.document?.invoiceDate ? row.document.invoiceDate < filingDate : false;
        const score = (sameGroup ? 2 : 0) + (beforeFiling ? 1 : 0);
        const warning =
          selectedOpeningStockItem && itemGroupId && selectedOpeningStockItem.vatGroupId && itemGroupId !== selectedOpeningStockItem.vatGroupId
            ? 'Khác nhóm VAT'
            : row.document?.invoiceDate && row.document.invoiceDate >= filingDate
              ? 'Sau ngày kê khai'
              : '';
        return { ...row, sameGroup, beforeFiling, score, warning };
      })
      .sort((a, b) => b.score - a.score || b.remainingAmount - a.remainingAmount);
  }, [activeFilingPeriod, availableVatDocumentItems, filingStartDate, selectedOpeningStockItem]);

  const selectedOpeningVatSuggestion = useMemo(
    () => suggestedOpeningVatItems.find(row => row.item.id === openingAllocation.vatDocumentItemId),
    [openingAllocation.vatDocumentItemId, suggestedOpeningVatItems]
  );

  const selectedPurchaseReceiptRow = useMemo(
    () => postFilingReceiptRows.find(row => row.purchaseReceiptItemId === purchaseAllocation.receiptItemKey),
    [postFilingReceiptRows, purchaseAllocation.receiptItemKey]
  );

  const suggestedPurchaseVatItems = useMemo(() => {
    return availableVatDocumentItems
      .map(row => {
        const itemGroupId = row.item.confirmedVatGroupId || row.item.suggestedVatGroupId;
        const sameGroup = !!selectedPurchaseReceiptRow?.vatGroupId && itemGroupId === selectedPurchaseReceiptRow.vatGroupId;
        const sameSupplier =
          !!selectedPurchaseReceiptRow?.supplierId &&
          !!row.document?.supplierId &&
          row.document.supplierId === selectedPurchaseReceiptRow.supplierId;
        const afterFiling = activeFilingPeriod?.startDate
          ? !!row.document?.invoiceDate && row.document.invoiceDate >= activeFilingPeriod.startDate
          : true;
        const score = (sameGroup ? 2 : 0) + (sameSupplier ? 2 : 0) + (afterFiling ? 1 : 0);
        const warning =
          selectedPurchaseReceiptRow && itemGroupId && selectedPurchaseReceiptRow.vatGroupId && itemGroupId !== selectedPurchaseReceiptRow.vatGroupId
            ? 'Khác nhóm VAT'
            : activeFilingPeriod?.startDate && row.document?.invoiceDate && row.document.invoiceDate < activeFilingPeriod.startDate
              ? 'Trước ngày kê khai'
              : selectedPurchaseReceiptRow?.supplierId && row.document?.supplierId && row.document.supplierId !== selectedPurchaseReceiptRow.supplierId
                ? 'Khác nhà cung cấp'
                : '';
        return { ...row, sameGroup, sameSupplier, afterFiling, score, warning };
      })
      .sort((a, b) => b.score - a.score || b.remainingAmount - a.remainingAmount);
  }, [activeFilingPeriod, availableVatDocumentItems, selectedPurchaseReceiptRow]);

  const selectedPurchaseVatSuggestion = useMemo(
    () => suggestedPurchaseVatItems.find(row => row.item.id === purchaseAllocation.vatDocumentItemId),
    [purchaseAllocation.vatDocumentItemId, suggestedPurchaseVatItems]
  );

  const handleAllocateOpeningVat = useCallback(async () => {
    const openingItem = currentOpeningStockItems.find(item => item.id === openingAllocation.openingStockItemId);
    const vatItem = vatData?.items?.find(item => item.id === openingAllocation.vatDocumentItemId);
    if (!activeFilingPeriod || !openingItem || !vatItem) {
      setVatDataError('Vui lòng chọn tồn đầu kỳ và dòng hóa đơn VAT.');
      return;
    }
    const vatGroupId = openingItem.vatGroupId || vatItem.confirmedVatGroupId || vatItem.suggestedVatGroupId;
    if (!vatGroupId) {
      setVatDataError('Dòng tồn đầu kỳ hoặc hóa đơn chưa có nhóm VAT.');
      return;
    }
    const amount = Number(openingAllocation.amount || 0);
    const quantity = Number(openingAllocation.quantity || 0);
    setAllocatingOpeningVat(true);
    setVatDataError(null);
    try {
      await allocateVatToOpeningStock({
        vatDocumentItemId: vatItem.id,
        openingStockItemId: openingItem.id,
        filingPeriodId: activeFilingPeriod.id,
        vatGroupId,
        allocatedAmount: amount,
        allocatedQuantity: quantity,
      });
      setOpeningAllocation({ openingStockItemId: '', vatDocumentItemId: '', amount: '', quantity: '' });
      await loadVatCoverageData();
    } catch (error) {
      setVatDataError(error instanceof Error ? error.message : 'Không thể phân bổ VAT vào tồn đầu kỳ.');
    } finally {
      setAllocatingOpeningVat(false);
    }
  }, [activeFilingPeriod, currentOpeningStockItems, loadVatCoverageData, openingAllocation, vatData]);

  const handleUpdateOpeningStockVat = useCallback(
    async (
      id: string,
      patch: {
        vatGroupId?: string | null;
        vatStatus?: OpeningStockVatStatus;
        supplierId?: string | null;
        supplierName?: string | null;
      }
    ) => {
      setSavingOpeningItemId(id);
      setVatDataError(null);
      try {
        await updateOpeningStockItem({ id, ...patch });
        await loadVatCoverageData();
      } catch (error) {
        setVatDataError(error instanceof Error ? error.message : 'Không thể cập nhật tồn đầu kỳ.');
      } finally {
        setSavingOpeningItemId(null);
      }
    },
    [loadVatCoverageData]
  );

  const handleAllocatePurchaseVat = useCallback(async () => {
    const receiptRow = selectedPurchaseReceiptRow;
    const vatItem = vatData?.items?.find(item => item.id === purchaseAllocation.vatDocumentItemId);
    if (!receiptRow || !vatItem) {
      setVatDataError('Vui lòng chọn dòng phiếu nhập và dòng hóa đơn VAT.');
      return;
    }
    const vatGroupId = receiptRow.vatGroupId || vatItem.confirmedVatGroupId || vatItem.suggestedVatGroupId;
    if (isUnmappedVatGroupId(vatGroupId)) {
      setVatDataError('Dòng phiếu nhập hoặc hóa đơn chưa có nhóm VAT.');
      return;
    }
    setAllocatingPurchaseVat(true);
    setVatDataError(null);
    try {
      await allocateVatToPurchaseReceipt({
        vatDocumentItemId: vatItem.id,
        purchaseReceiptId: receiptRow.receipt.id,
        purchaseReceiptItemId: receiptRow.purchaseReceiptItemId,
        filingPeriodId: activeFilingPeriod?.id,
        vatGroupId,
        allocatedAmount: Number(purchaseAllocation.amount || 0),
        allocatedQuantity: Number(purchaseAllocation.quantity || 0),
      });
      setPurchaseAllocation({ receiptItemKey: '', vatDocumentItemId: '', amount: '', quantity: '' });
      await loadVatCoverageData();
    } catch (error) {
      setVatDataError(error instanceof Error ? error.message : 'Không thể phân bổ VAT vào phiếu nhập.');
    } finally {
      setAllocatingPurchaseVat(false);
    }
  }, [activeFilingPeriod, loadVatCoverageData, purchaseAllocation, selectedPurchaseReceiptRow, vatData]);

  const handleExportExcel = () => {
    const wb = XLSX.utils.book_new();
    if (reportMode === 'filing') {
      const summaryData = [
        ['Chỉ tiêu', 'Giá trị'],
        ['Ngày bắt đầu kê khai', activeFilingPeriod?.startDate || filingStartDate],
        ['Trạng thái kỳ', activeFilingPeriod?.status === 'locked' ? 'Đã chốt' : 'Nháp'],
        ['Tồn đầu kỳ', filingReconciliation.summary.openingGoodsAmount],
        ['Tồn đầu kỳ có VAT', filingReconciliation.summary.openingVatCoveredAmount],
        ['Tồn đầu kỳ thiếu VAT', filingReconciliation.summary.openingVatMissingAmount],
        ['Nhập sau kê khai', filingReconciliation.summary.postFilingGoodsAmount],
        ['Sau kê khai có VAT', filingReconciliation.summary.postFilingVatCoveredAmount],
        ['Sau kê khai thiếu VAT', filingReconciliation.summary.postFilingVatMissingAmount],
        ['Hóa đơn chưa phân bổ', filingReconciliation.summary.unallocatedDocumentAmount],
        ['VAT dư', filingReconciliation.summary.overAllocatedAmount],
        ['NCC cần hóa đơn', filingReconciliation.summary.suppliersNeedVatCount],
      ];
      XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(summaryData), 'Tong quan ke khai');

      const reconciliationData = [
        ['Giai đoạn', 'Nhóm VAT', 'Nhà cung cấp', 'Giá trị hàng', 'VAT hợp lệ', '% phủ', 'Còn thiếu', 'VAT dư', 'Số hóa đơn', 'Trạng thái'],
        ...filingReconciliation.rows.map(row => [
          row.stageLabel,
          row.vatGroupName,
          row.supplierName,
          row.goodsAmount,
          row.validAllocatedAmount,
          row.coveragePercent,
          row.missingAmount,
          row.overAllocatedAmount,
          row.invoiceCount,
          VAT_RISK_CONFIG[row.riskStatus]?.label || row.riskStatus,
        ]),
      ];
      XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(reconciliationData), 'Doi soat NCC nhom');

      const supplierNeedData = [
        ['Nhà cung cấp', 'Giá trị hàng', 'Cần xin thêm hóa đơn', 'Nhóm hàng thiếu', 'Giai đoạn'],
        ...supplierNeedRows.map(row => [
          row.supplierName,
          row.goodsAmount,
          row.missingAmount,
          Array.from(row.groups).join(', '),
          Array.from(row.stages).join(', '),
        ]),
      ];
      XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(supplierNeedData), 'NCC can hoa don');

      const openingData = [
        ['SKU', 'Tên hàng', 'Nhóm hàng gốc', 'Nhóm VAT', 'Nhà cung cấp', 'SL', 'Giá vốn', 'Giá trị tồn', 'Trạng thái VAT', 'Ghi chú'],
        ...currentOpeningStockItems.map(item => {
          const vatGroup = vatData?.groups?.find(group => group.id === item.vatGroupId);
          return [
            item.sku,
            item.productName,
            item.productGroupName || '',
            vatGroup?.name || 'Chưa mapping VAT',
            item.supplierName || '',
            item.quantity,
            item.unitCost,
            item.totalAmount,
            OPENING_VAT_STATUS_OPTIONS.find(option => option.value === item.vatStatus)?.label || item.vatStatus,
            item.note || '',
          ];
        }),
      ];
      XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(openingData), 'Ton dau ky');

      XLSX.writeFile(wb, `doi-soat-vat-ke-khai-${today}.xlsx`);
      return;
    }

    const sheet1Data = [
      [
        'Ngày',
        'Mã phiếu',
        'Nhà cung cấp',
        'Số SP',
        'Tổng tiền',
        'Chứng từ',
        'File đính kèm',
        'Ghi chú',
      ],
      ...allImports.map(t => [
        formatPurchaseDateTime(t.date),
        getPurchaseCode(t),
        t.supplierName || 'N/A',
        t.items?.length || 0,
        t.totalAmount || 0,
        BADGE_CONFIG[(t.invoiceStatus as keyof typeof BADGE_CONFIG) || 'none']?.label || 'Thiếu CT',
        attachments[t.id]?.length || 0,
        t.note || '',
      ]),
    ];
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(sheet1Data), 'Danh sách phiếu');

    const sheet2Data = [
      [
        'Tháng',
        'Số phiếu',
        'Tổng nhập',
        'Có HĐ',
        'Thiếu HĐ',
        'Tỷ lệ phủ (%)',
        'VAT KT được',
      ],
      ...monthlyReport.map(r => [r.month, r.count, r.total, r.hasHD, r.missing, r.coverage, r.vatDeductible]),
      [],
      [
        'TỔNG CỘNG',
        allImports.length,
        summary.totalAmount,
        summary.hasFullHD + summary.hasPartialHD,
        summary.missingHD,
        summary.totalAmount > 0
          ? Math.round(((summary.hasFullHD + summary.hasPartialHD) / summary.totalAmount) * 100)
          : 0,
        vatSummary.vatDeductible,
      ],
    ];
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(sheet2Data), 'Tổng kết tháng');
    XLSX.writeFile(wb, `bao-cao-hoa-don-dau-vao-${today}.xlsx`);
  };

  if (needsFilingDateSetup) {
    return (
      <div className="flex h-full items-center justify-center bg-white p-4">
        <div className="w-full max-w-xl overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-lg shadow-slate-100">
          <div className="space-y-5 p-8 text-center">
            <label className="block">
              <span className="mb-2 block text-2xs font-normal uppercase tracking-wide text-slate-500">
                Ngày bắt đầu kê khai
              </span>
              <div className="mx-auto flex max-w-xs items-center justify-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 focus-within:border-indigo-400 focus-within:bg-white">
                <CalendarDays className="h-4 w-4 text-indigo-500" />
                <input
                  type="date"
                  value={filingStartDate}
                  onChange={event => setFilingStartDate(event.target.value)}
                  className="w-full bg-transparent text-center text-xs font-normal text-slate-700 outline-none"
                />
              </div>
            </label>
            <div className="flex flex-wrap items-center justify-center gap-2">
              <button
                onClick={() => handleSaveFilingPeriod('draft')}
                disabled={savingPeriod}
                className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-2xs font-normal uppercase tracking-wide text-slate-600 hover:bg-slate-50 disabled:opacity-60"
              >
                Lưu kỳ
              </button>
              <button
                onClick={() => handleSaveFilingPeriod('locked')}
                disabled={savingPeriod}
                className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-4 py-2 text-2xs font-normal uppercase tracking-wide text-white shadow-md shadow-indigo-100 disabled:opacity-60"
              >
                <Lock className="h-3.5 w-3.5" />
                Chốt kỳ
              </button>
            </div>
            <p className="mx-auto max-w-md rounded-xl bg-slate-50 px-4 py-3 text-center text-xs font-normal leading-relaxed text-slate-500">
              Sau khi chốt ngày, mặc định app chỉ hiển thị hóa đơn và phiếu nhập từ ngày chốt trở đi. Dữ liệu trước ngày chốt được xử lý riêng bằng nút Trước ngày chốt.
            </p>
            {filingPeriodNotice && (
              <p className="mx-auto max-w-md rounded-xl border border-green-100 bg-green-50 px-4 py-3 text-center text-xs font-normal leading-relaxed text-green-700">
                {filingPeriodNotice}
              </p>
            )}
            {vatDataError && (
              <p className="mx-auto max-w-md rounded-xl border border-amber-100 bg-amber-50 px-4 py-3 text-center text-xs font-normal leading-relaxed text-amber-700">
                {vatDataError}
              </p>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex flex-1 min-h-0 gap-4 p-4">
        <PurchaseInvoicesSidebar
          purchasePeriodScope={purchasePeriodScope}
          onPeriodScopeChange={handlePeriodScopeChange}
          activeTab={activeTab}
          onActiveTabChange={setActiveTab}
          statusFilterOpen={statusFilterOpen}
          onStatusFilterOpenChange={setStatusFilterOpen}
          tabCounts={tabCounts}
          dateRange={dateRange}
          displayDateRange={effectiveDateRange}
          transformDateRange={getEffectiveDateRange}
          onDateRangeChange={setDateRange}
          supplierSearch={supplierSearch}
          onSupplierSearchChange={setSupplierSearch}
          supplierFilter={supplierFilter}
          onSupplierFilterChange={setSupplierFilter}
          suppliers={suppliers}
        />

        {/* ===== RIGHT MAIN PANEL ===== */}
        <div className="flex-1 flex flex-col min-h-0 bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
          {/* Toolbar */}
          <div className="px-4 min-h-[52px] border-b border-slate-100 flex items-center gap-3 shrink-0">
            <div className="flex-1 relative max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
              <input
                type="text"
                placeholder="Tìm NCC, ghi chú, mã phiếu..."
                className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-normal outline-none focus:border-indigo-400 focus:bg-white transition-all placeholder:text-slate-300"
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
              />
            </div>
            <div className="flex items-center gap-2 ml-auto">
              <input
                ref={vatFileInputRef}
                type="file"
                accept=".pdf,application/pdf"
                className="hidden"
                onChange={event => {
                  const file = event.target.files?.[0];
                  if (file) handleVatPdfUpload(file);
                }}
              />
              {!showReport && (
                <button
                  onClick={() => setShowReport(true)}
                  className="flex items-center gap-1.5 rounded-xl bg-slate-100 px-4 py-2 text-2xs font-normal uppercase tracking-wide text-slate-600 transition-all hover:bg-slate-200"
                >
                  <BarChart2 className="h-3.5 w-3.5" />
                  Báo cáo
                </button>
              )}
              {showReport && reportMode === 'coverage' && (
                <button
                  onClick={() => vatFileInputRef.current?.click()}
                  disabled={vatUploading}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-4 py-2 text-2xs font-normal uppercase tracking-wide text-white shadow-md shadow-indigo-100 disabled:opacity-60"
                >
                  <Upload className="h-3.5 w-3.5" />
                  {vatUploading ? 'Đang upload' : 'Upload VAT'}
                </button>
              )}
              <button
                onClick={handleExportExcel}
                className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 text-white rounded-xl font-normal text-2xs uppercase tracking-wide shadow-md shadow-indigo-200 hover:bg-indigo-700 transition-all"
              >
                <Download className="h-3.5 w-3.5" />
                Xuất Excel
              </button>
              {showReport && (reportMode === 'coverage' || reportMode === 'filing') && (
                <button
                  onClick={loadVatCoverageData}
                  disabled={vatDataLoading || vatUploading || savingPeriod}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-4 py-2 text-2xs font-normal uppercase tracking-wide text-slate-600 hover:bg-slate-50 disabled:opacity-60"
                >
                  <RefreshCw className={`h-3.5 w-3.5 ${vatDataLoading ? 'animate-spin' : ''}`} />
                  {vatDataLoading ? 'Đang tải' : 'Tải lại'}
                </button>
              )}
            </div>
          </div>

          {/* Sub-toolbar */}
          <div className="px-4 py-2 bg-slate-50/60 border-b border-slate-100 flex items-center gap-3 shrink-0">
            <span className="text-2xs font-normal text-slate-500">
              Hiển thị <span className="font-normal text-slate-800">{filteredImportCount}</span> phiếu nhập theo bộ lọc
            </span>
            {loadingAttachments && (
              <span className="flex items-center gap-1 text-2xs font-normal text-blue-500">
                <span className="inline-block w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" />
                Đang tải file đính kèm...
              </span>
            )}
          </div>

          {/* ===== CONTENT AREA ===== */}
          <div className="flex-1 min-h-0 overflow-auto overscroll-contain">
            {showReport ? (
              /* ---- REPORT VIEW ---- */
              <div className="p-4 space-y-4">
                {!needsFilingDateSetup && (
                  <div className="relative flex min-h-[40px] flex-wrap items-center justify-center gap-2">
                    <div className="flex flex-wrap items-center justify-center gap-8">
                      {[
                        { key: 'coverage' as ReportMode, label: 'Kho VAT', Icon: Layers3 },
                        { key: 'filing' as ReportMode, label: 'Đối soát và phân bổ', Icon: CalendarDays },
                        { key: 'legacy' as ReportMode, label: 'Báo cáo', Icon: BarChart2 },
                      ].map(({ key, label, Icon }) => (
                        <button
                          key={key}
                          onClick={() => setReportMode(key)}
                          className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-2xs font-normal uppercase tracking-wide transition-all ${
                            reportMode === key
                              ? 'bg-indigo-600 text-white shadow-md shadow-indigo-100'
                              : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                          }`}
                        >
                          <Icon className="h-3.5 w-3.5" />
                          {label}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {reportMode === 'filing' ? (
                  <VatFilingReport
                    purchasePeriodScope={purchasePeriodScope}
                    vatDataError={vatDataError}
                    activeFilingPeriodStatus={activeFilingPeriod?.status}
                    scopedFilingSummary={scopedFilingSummary}
                    filingTab={filingTab}
                    onFilingTabChange={setFilingTab}
                    showFilingGroupColumn={showFilingGroupColumn}
                    filingSupplierTreeRows={filingSupplierTreeRows}
                    expandedFilingSupplierKey={expandedFilingSupplierKey}
                    onExpandedFilingSupplierKeyChange={setExpandedFilingSupplierKey}
                    expandedFilingGroupKey={expandedFilingGroupKey}
                    onExpandedFilingGroupKeyChange={setExpandedFilingGroupKey}
                    supplierNeedRows={supplierNeedRows}
                    openingStockPreview={openingStockPreview}
                    currentOpeningStockItems={currentOpeningStockItems}
                    canResetOpeningStock={canResetOpeningStock}
                    creatingOpeningStock={creatingOpeningStock}
                    resettingOpeningStock={resettingOpeningStock}
                    savingOpeningItemId={savingOpeningItemId}
                    vatGroups={vatData?.groups || []}
                    suppliers={suppliers}
                    onCreateOpeningStockFromProducts={handleCreateOpeningStockFromProducts}
                    onResetOpeningStockDraft={handleResetOpeningStockDraft}
                    onUpdateOpeningStockVat={handleUpdateOpeningStockVat}
                    vatDocumentsByStatus={vatDocumentsByStatus}
                  />
                ) : reportMode === 'coverage' ? (
                  <VatCoverageReport
                    vatDataError={vatDataError}
                    purchasePeriodScope={purchasePeriodScope}
                    vatCenterTab={vatCenterTab}
                    vatCoverageRows={vatCoverageRows}
                    vatSupplierRows={vatSupplierRows}
                    vatUploadNotice={vatUploadNotice}
                    vatDocumentsByStatus={vatDocumentsByStatus}
                    scopedVatDocuments={scopedVatDocuments}
                    visibleVatDocuments={visibleVatDocuments}
                    vatDocumentItemSummaryByDoc={vatDocumentItemSummaryByDoc}
                    vatDocumentAllocationStatusByDoc={vatDocumentAllocationStatusByDoc}
                    selectedVatDocumentIds={selectedVatDocumentIds}
                    onSelectedVatDocumentIdsChange={setSelectedVatDocumentIds}
                    allVisibleVatDocumentsSelected={allVisibleVatDocumentsSelected}
                    onToggleAllVisibleVatDocuments={handleToggleAllVisibleVatDocuments}
                    onDeleteSelectedVatDocuments={handleDeleteSelectedVatDocuments}
                    onOpenVatDocumentFormAndFilingTab={async document => {
                      await openVatDocumentForm(document);
                      setReportMode('filing');
                      setFilingTab('supplier_need');
                    }}
                    onConfirmDeleteVatDocument={confirmDeleteVatDocument}
                    getVatDocumentSupplierName={getVatDocumentSupplierName}
                  />
                ) : (
                  <PurchaseLegacyReport
                    purchasePeriodScope={purchasePeriodScope}
                    summary={summary}
                    vatSummary={vatSummary}
                    monthlyReport={monthlyReport}
                    importsByReportMonth={importsByReportMonth}
                    expandedReportMonth={expandedReportMonth}
                    onExpandedReportMonthChange={setExpandedReportMonth}
                    expandedId={expandedId}
                    onExpandedIdChange={setExpandedId}
                    attachments={attachments}
                    sevenDaysAgo={sevenDaysAgo}
                    supplierById={supplierById}
                    allocatedGoodsByReceiptId={allocatedGoodsByReceiptId}
                    allocatedVatByReceiptId={allocatedVatByReceiptId}
                    loadingUrl={loadingUrl}
                    onViewFile={handleViewFile}
                  />
                )}
              </div>
            ) : (
              <PurchaseInvoicesListView
                filtered={filtered}
                visibleFiltered={visibleFiltered}
                expandedId={expandedId}
                onExpandedIdChange={setExpandedId}
                attachments={attachments}
                effectiveInvoiceStatusByReceiptId={effectiveInvoiceStatusByReceiptId}
                sevenDaysAgo={sevenDaysAgo}
                loadingUrl={loadingUrl}
                onViewFile={handleViewFile}
                onLoadMore={() => setVisibleListLimit(limit => limit + LIST_PAGE_SIZE)}
              />
            )}
          </div>
        </div>

        {editingVatDocumentId && (
          <VatInvoiceConfirmModal
            initialForm={vatDocumentForm}
            suppliers={suppliers}
            supplierProductGroupsBySupplierId={supplierProductGroupsBySupplierId}
            vatDocumentItems={editingVatDocumentItems}
            vatPreviewUrl={vatPreviewUrl}
            vatOcrLoading={vatOcrLoading}
            vatOcrResult={vatOcrResult}
            savingVatDocument={savingVatDocument}
            isPendingUpload={editingVatDocumentId === PENDING_VAT_DOCUMENT_ID}
            onClose={closeVatDocumentForm}
            onConfirm={handleSaveVatDocumentInfo}
          />
        )}
      </div>
    </div>
  );
}
