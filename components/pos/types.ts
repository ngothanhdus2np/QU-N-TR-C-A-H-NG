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
  // Split payment fields
  splitPayment?: {
    cash: number;
    bank: number;
    card: number;
    momo: number;
  };
}
