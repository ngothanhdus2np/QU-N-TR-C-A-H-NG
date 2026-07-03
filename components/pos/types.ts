import { POSCustomer, POSOrderItem } from '../../types';

export interface InvoiceTab {
  id: string;
  name: string;
  mode: 'sales' | 'return';
  cart: POSOrderItem[];
  returnCart: POSOrderItem[];
  selectedCustomer: POSCustomer | null;
  discountValue: number;
  discountType: 'fixed' | 'percent';
  paymentMethod: 'Cash' | 'Bank' | 'Momo' | 'Other' | 'Card';
  orderNote: string;
  otherFees: number;
  cashReceived: number;
  isDebtMode: boolean;
  // Return specific fields
  returnDiscount: number;
  returnFee: number;
  returnOtherRefund: number;
  originalOrderId?: string; // ID đơn gốc được chọn để trả (AUDIT-006)
  editingOrderId?: string; // ID đơn BÁN gốc đang sửa lại (mở từ trang Hóa đơn) — khác originalOrderId (trả hàng)
  // Split payment fields
  splitPayment?: {
    cash: number;
    bank: number;
    card: number;
    momo: number;
  };
}
