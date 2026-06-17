/**
 * POS (Point of Sale) Types
 * Types related to POS system, products, orders, and customers
 */

export interface POSProductUnit {
  id: string;
  name: string;
  factor: number;
  price: number;
  isBase: boolean;
}

export interface POSProductAttribute {
  id: string;
  name: string;
  values: string[];
}

export interface POSProduct {
  id: string;
  sku: string;
  name: string;
  categoryId: string;
  categoryPath?: string;
  importPrice: number;
  salePrice: number;
  stock: number;
  expectedOutOfStock?: string;
  minStock: number;
  maxStock?: number;
  unit: string;
  baseUnitCode?: string;
  conversionValue?: number;
  units?: POSProductUnit[];
  attributes?: POSProductAttribute[];
  attributesText?: string;
  brand?: string;
  barcode?: string;
  description?: string;
  noteTemplate?: string;
  components?: string;
  warranty?: string;
  periodicMaintenance?: string;
  allowPoints?: boolean;
  weight?: number;
  weightUnit?: string;
  location?: string;
  relatedSku?: string;
  createdAt?: string;
  images?: string[];
  status: 'Active' | 'Inactive';
  // Variant support
  parentId?: string; // ID của sản phẩm cha (nếu là biến thể)
  isParent?: boolean; // true nếu là sản phẩm cha có biến thể
  variantAttributes?: Record<string, string>; // { "Màu sắc": "Đỏ", "Size": "M" }
  variantCount?: number; // Số lượng biến thể (chỉ cho sản phẩm cha)
  // KiotViet extended fields
  customerOrders?: number; // KH đặt — số lượng khách đặt trước
  directSale?: boolean; // Được bán trực tiếp
  productType?: 'Hàng hóa' | 'Dịch vụ'; // Loại hàng
}

export interface POSOrderItem {
  productId: string;
  sku: string;
  name: string;
  quantity: number;
  price: number;
  discount: number;
  total: number;
  salespersonId?: string;
  salespersonName?: string;
  lineType?: 'sale' | 'return' | 'exchange';
}

export type POSOrderChannel = 'direct' | 'online' | 'marketplace' | 'other';
export type POSOrderStatus = 'completed' | 'pending' | 'cancelled' | 'draft';

export interface POSOrder {
  id: string;
  orderCode: string;
  date: string;
  customerId?: string;
  customerName?: string;
  items: POSOrderItem[];
  totalAmount: number;
  discount: number;
  finalAmount: number;
  paymentMethod: 'Cash' | 'Bank' | 'Momo' | 'Other';
  staffId: string;
  createdBy?: string;
  channel?: POSOrderChannel;
  channelName?: string;
  priceBookId?: string;
  priceBookName?: string;
  status?: POSOrderStatus;
  notes?: string;
  pointsEarned: number;
  isReturn?: boolean;
  cashReceived?: number;
  refundAmount?: number;
  splitPayments?: {
    cash?: number;
    bank?: number;
    card?: number;
    momo?: number;
  };
  staffName?: string;
}

export type POSPaymentMethod = 'Cash' | 'Bank' | 'Momo' | 'Other';

export interface POSPaymentChannelSettings {
  enabled: boolean;
  displayName: string;
  accountLabel: string;
  actionLabel: string;
  helperText: string;
  qrImage?: string;
  notes?: string;
}

export type POSPaymentAccountType = 'bank' | 'wallet';

export interface POSPaymentAccount {
  id: string;
  type: POSPaymentAccountType;
  accountNumber: string;
  provider: string;
  accountHolder: string;
  scope: string;
  note?: string;
  qrImage?: string;
  enabled: boolean;
}

export interface POSPaymentSettings {
  defaultMethod: POSPaymentMethod;
  allowSplitPayment: boolean;
  bank: POSPaymentChannelSettings;
  card: POSPaymentChannelSettings;
  wallet: POSPaymentChannelSettings;
  bankAccounts: POSPaymentAccount[];
  walletAccounts: POSPaymentAccount[];
}

export interface POSCustomer {
  id: string;
  name: string;
  phone: string;
  email?: string;
  address?: string;
  notes?: string;
  points: number;
  totalSpent: number;
  lastVisit?: string;
  tier: 'Standard' | 'Silver' | 'Gold' | 'Diamond';
  debtAmount?: number;
  status?: 'active' | 'inactive';
  customerType?: 'individual' | 'company';
  gender?: 'male' | 'female';
  birthday?: string;
  createdAt?: string;
  createdBy?: string;
  taxCode?: string;
  companyName?: string;
  facebook?: string;
}
