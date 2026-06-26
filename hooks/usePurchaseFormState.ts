import { useState } from 'react';
import { PurchaseItem, PurchaseDiscountType } from '../components/pos/GoodsPurchaseForm';
import { InvoiceStatus } from '../services/invoiceService';

export function usePurchaseFormState() {
  // Purchase form states
  const [showPurchaseForm, setShowPurchaseForm] = useState(false);
  const [purchaseItems, setPurchaseItems] = useState<PurchaseItem[]>([]);
  const [editingTransactionId, setEditingTransactionId] = useState<string | null>(null);
  const [editingTransactionStatus, setEditingTransactionStatus] = useState<string | null>(null);
  const [purchaseSupplier, setPurchaseSupplier] = useState('');
  const [purchaseNote, setPurchaseNote] = useState('');
  const [purchaseDiscountValue, setPurchaseDiscountValue] = useState(0);
  const [purchaseDiscountType, setPurchaseDiscountType] = useState<PurchaseDiscountType>('fixed');
  const [purchaseReferenceId, setPurchaseReferenceId] = useState('');
  const [invoiceStatus, setInvoiceStatus] = useState<InvoiceStatus>('none');
  const [invoiceFile, setInvoiceFile] = useState<File | null>(null);

  // Purchase return form states
  const [showPurchaseReturnForm, setShowPurchaseReturnForm] = useState(false);
  const [returnItems, setReturnItems] = useState<PurchaseItem[]>([]);
  const [returnSupplier, setReturnSupplier] = useState('');
  const [returnNote, setReturnNote] = useState('');
  const [returnDiscountValue, setReturnDiscountValue] = useState(0);
  const [returnDiscountType, setReturnDiscountType] = useState<PurchaseDiscountType>('fixed');
  const [returnReferenceId, setReturnReferenceId] = useState('');
  const [returnSupplierPaidAmount, setReturnSupplierPaidAmount] = useState(0);
  const [returnApplySupplierDebt, setReturnApplySupplierDebt] = useState(true);

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
