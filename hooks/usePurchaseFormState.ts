import { useEffect, useState } from 'react';
import { PurchaseItem, PurchaseDiscountType } from '../components/pos/GoodsPurchaseForm';
import { InvoiceStatus } from '../services/invoiceService';

// Nháp phiếu nhập hàng/trả hàng nhập đang gõ dở — tự lưu vào localStorage để không mất
// khi người dùng chuyển sang trang khác (unmount PurchaseOrdersContainer) mà chưa bấm
// "Lưu tạm"/"Hoàn thành". Không lưu invoiceFile (File không serialize được qua JSON).
const PURCHASE_DRAFT_KEY = 'cfo_brain_purchase_draft_v1';
const RETURN_DRAFT_KEY = 'cfo_brain_purchase_return_draft_v1';

type PurchaseDraft = {
  purchaseItems: PurchaseItem[];
  editingTransactionId: string | null;
  editingTransactionStatus: string | null;
  purchaseSupplier: string;
  purchaseNote: string;
  purchaseDiscountValue: number;
  purchaseDiscountType: PurchaseDiscountType;
  purchaseReferenceId: string;
  invoiceStatus: InvoiceStatus;
};

type ReturnDraft = {
  returnItems: PurchaseItem[];
  returnSupplier: string;
  returnNote: string;
  returnDiscountValue: number;
  returnDiscountType: PurchaseDiscountType;
  returnReferenceId: string;
  returnSupplierPaidAmount: number;
  returnApplySupplierDebt: boolean;
};

function loadDraft<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

function saveDraft(key: string, data: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(data));
  } catch {
    // localStorage đầy/bị chặn — bỏ qua, không chặn luồng nhập liệu
  }
}

function clearDraft(key: string) {
  try {
    localStorage.removeItem(key);
  } catch {
    // ignore
  }
}

export function usePurchaseFormState() {
  const purchaseDraft = loadDraft<PurchaseDraft>(PURCHASE_DRAFT_KEY);
  const returnDraft = loadDraft<ReturnDraft>(RETURN_DRAFT_KEY);

  // Purchase form states — mặc định luôn hiện danh sách (false), kể cả khi có nháp cũ:
  // chỉ mở lại form khi người dùng chủ động bấm "+ Phiếu nhập hàng" và chọn "Tiếp tục"
  // (xem handleCreatePurchase trong PurchaseOrdersContainer.tsx).
  const [showPurchaseForm, setShowPurchaseForm] = useState(false);
  const [purchaseItems, setPurchaseItems] = useState<PurchaseItem[]>(purchaseDraft?.purchaseItems ?? []);
  const [editingTransactionId, setEditingTransactionId] = useState<string | null>(
    purchaseDraft?.editingTransactionId ?? null
  );
  const [editingTransactionStatus, setEditingTransactionStatus] = useState<string | null>(
    purchaseDraft?.editingTransactionStatus ?? null
  );
  const [purchaseSupplier, setPurchaseSupplier] = useState(purchaseDraft?.purchaseSupplier ?? '');
  const [purchaseNote, setPurchaseNote] = useState(purchaseDraft?.purchaseNote ?? '');
  const [purchaseDiscountValue, setPurchaseDiscountValue] = useState(purchaseDraft?.purchaseDiscountValue ?? 0);
  const [purchaseDiscountType, setPurchaseDiscountType] = useState<PurchaseDiscountType>(
    purchaseDraft?.purchaseDiscountType ?? 'fixed'
  );
  const [purchaseReferenceId, setPurchaseReferenceId] = useState(purchaseDraft?.purchaseReferenceId ?? '');
  const [invoiceStatus, setInvoiceStatus] = useState<InvoiceStatus>(purchaseDraft?.invoiceStatus ?? 'none');
  const [invoiceFile, setInvoiceFile] = useState<File | null>(null);

  // Purchase return form states
  // Tương tự showPurchaseForm — mặc định hiện danh sách, không tự mở form trả hàng nhập.
  const [showPurchaseReturnForm, setShowPurchaseReturnForm] = useState(false);
  const [returnItems, setReturnItems] = useState<PurchaseItem[]>(returnDraft?.returnItems ?? []);
  const [returnSupplier, setReturnSupplier] = useState(returnDraft?.returnSupplier ?? '');
  const [returnNote, setReturnNote] = useState(returnDraft?.returnNote ?? '');
  const [returnDiscountValue, setReturnDiscountValue] = useState(returnDraft?.returnDiscountValue ?? 0);
  const [returnDiscountType, setReturnDiscountType] = useState<PurchaseDiscountType>(
    returnDraft?.returnDiscountType ?? 'fixed'
  );
  const [returnReferenceId, setReturnReferenceId] = useState(returnDraft?.returnReferenceId ?? '');
  const [returnSupplierPaidAmount, setReturnSupplierPaidAmount] = useState(
    returnDraft?.returnSupplierPaidAmount ?? 0
  );
  const [returnApplySupplierDebt, setReturnApplySupplierDebt] = useState(
    returnDraft?.returnApplySupplierDebt ?? true
  );

  // Tự lưu nháp phiếu nhập hàng mỗi khi có thay đổi
  useEffect(() => {
    if (!showPurchaseForm) return;
    if (purchaseItems.length === 0 && !purchaseSupplier && !purchaseNote && !purchaseReferenceId) {
      clearDraft(PURCHASE_DRAFT_KEY);
      return;
    }
    saveDraft(PURCHASE_DRAFT_KEY, {
      purchaseItems,
      editingTransactionId,
      editingTransactionStatus,
      purchaseSupplier,
      purchaseNote,
      purchaseDiscountValue,
      purchaseDiscountType,
      purchaseReferenceId,
      invoiceStatus,
    } satisfies PurchaseDraft);
  }, [
    showPurchaseForm,
    purchaseItems,
    editingTransactionId,
    editingTransactionStatus,
    purchaseSupplier,
    purchaseNote,
    purchaseDiscountValue,
    purchaseDiscountType,
    purchaseReferenceId,
    invoiceStatus,
  ]);

  // Tự lưu nháp phiếu trả hàng nhập mỗi khi có thay đổi
  useEffect(() => {
    if (!showPurchaseReturnForm) return;
    if (returnItems.length === 0 && !returnSupplier && !returnNote && !returnReferenceId) {
      clearDraft(RETURN_DRAFT_KEY);
      return;
    }
    saveDraft(RETURN_DRAFT_KEY, {
      returnItems,
      returnSupplier,
      returnNote,
      returnDiscountValue,
      returnDiscountType,
      returnReferenceId,
      returnSupplierPaidAmount,
      returnApplySupplierDebt,
    } satisfies ReturnDraft);
  }, [
    showPurchaseReturnForm,
    returnItems,
    returnSupplier,
    returnNote,
    returnDiscountValue,
    returnDiscountType,
    returnReferenceId,
    returnSupplierPaidAmount,
    returnApplySupplierDebt,
  ]);

  // Helper functions
  const resetPurchaseForm = () => {
    setPurchaseItems([]);
    setPurchaseSupplier('');
    setPurchaseNote('');
    setPurchaseDiscountValue(0);
    setPurchaseDiscountType('fixed');
    setPurchaseReferenceId('');
    setInvoiceStatus('none');
    setInvoiceFile(null);
    setEditingTransactionId(null);
    setEditingTransactionStatus(null);
    clearDraft(PURCHASE_DRAFT_KEY);
  };

  const resetReturnForm = () => {
    setReturnItems([]);
    setReturnSupplier('');
    setReturnNote('');
    setReturnDiscountValue(0);
    setReturnDiscountType('fixed');
    setReturnReferenceId('');
    setReturnSupplierPaidAmount(0);
    setReturnApplySupplierDebt(true);
    clearDraft(RETURN_DRAFT_KEY);
  };

  const getPurchaseItemsNetTotal = () =>
    purchaseItems.reduce((sum, item) => sum + item.quantity * item.price - item.discount, 0);

  const getPurchaseBillDiscountAmount = () => {
    const netTotal = Math.max(0, getPurchaseItemsNetTotal());
    return purchaseDiscountType === 'percent'
      ? Math.min(netTotal, Math.round((netTotal * purchaseDiscountValue) / 100))
      : Math.min(netTotal, purchaseDiscountValue);
  };

  const getReturnItemsNetTotal = () =>
    returnItems.reduce((sum, item) => sum + item.quantity * item.price - item.discount, 0);

  const getReturnBillDiscountAmount = () => {
    const netTotal = Math.max(0, getReturnItemsNetTotal());
    return returnDiscountType === 'percent'
      ? Math.min(netTotal, Math.round((netTotal * returnDiscountValue) / 100))
      : Math.min(netTotal, returnDiscountValue);
  };

  const getReturnSupplierMustPay = () =>
    Math.max(0, getReturnItemsNetTotal() - getReturnBillDiscountAmount());

  return {
    // Purchase form
    showPurchaseForm,
    setShowPurchaseForm,
    purchaseItems,
    setPurchaseItems,
    editingTransactionId,
    setEditingTransactionId,
    editingTransactionStatus,
    setEditingTransactionStatus,
    purchaseSupplier,
    setPurchaseSupplier,
    purchaseNote,
    setPurchaseNote,
    purchaseDiscountValue,
    setPurchaseDiscountValue,
    purchaseDiscountType,
    setPurchaseDiscountType,
    resetPurchaseForm,
    getPurchaseItemsNetTotal,
    getPurchaseBillDiscountAmount,
    purchaseReferenceId,
    setPurchaseReferenceId,
    invoiceStatus,
    setInvoiceStatus,
    invoiceFile,
    setInvoiceFile,

    // Return form
    showPurchaseReturnForm,
    setShowPurchaseReturnForm,
    returnItems,
    setReturnItems,
    returnSupplier,
    setReturnSupplier,
    returnNote,
    setReturnNote,
    returnDiscountValue,
    setReturnDiscountValue,
    returnDiscountType,
    setReturnDiscountType,
    returnReferenceId,
    setReturnReferenceId,
    returnSupplierPaidAmount,
    setReturnSupplierPaidAmount,
    returnApplySupplierDebt,
    setReturnApplySupplierDebt,
    resetReturnForm,
    getReturnItemsNetTotal,
    getReturnBillDiscountAmount,
    getReturnSupplierMustPay,
  };
}
