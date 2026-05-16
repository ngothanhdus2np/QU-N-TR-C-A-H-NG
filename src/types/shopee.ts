/**
 * Shopee Integration Types
 * Types related to Shopee marketplace integration
 */

export interface ShopeeSourceItem {
  id: string;
  sku: string;
  name: string;
  importPrice: number;
  salePrice: number;
  status: string;
}

export interface ShopeeCostItem {
  id: string;
  name: string;
  quantity: number;
  unitPrice: number;
}

export interface ShopeeCostConfig {
  fixedCosts: ShopeeCostItem[];
  variableCosts: ShopeeCostItem[];
  targetOrders: number;
  platformFeePercent: number;
  paymentFeePercent: number;
  freeshipExtraPercent: number;
  affiliateFeePercent: number;
  handlingFeePerOrder: number;
  taxPercent: number;
  adsTaxPercent: number;
}

export interface ShopeeInventoryInRecord {
  id: string;
  date: string;
  sku: string;
  quantity: number;
  importPrice: number;
  note?: string;
}

export interface ShopeeInventoryOutRecord {
  id: string;
  date: string;
  orderId: string;
  sku: string;
  productName?: string;
  platform?: string;
  quantity: number;
  salePrice: number;
  customerPaid: number;
  platformFee: number;
  paymentFee: number;
  freeshipExtra: number;
  affiliateFee: number;
  handlingFee: number;
  adsCost: number;
  adsTax: number;
  personalIncomeTax: number;
  netProfit: number;
  address?: string;
  shippingUnit?: string;
  trackingNumber?: string;
  shipDate?: string;
  status: 'OK' | 'RETURN' | 'CANCEL' | 'LOST' | 'SHIPPING' | 'PENDING';
  profitStatus?: string; // e.g., "LÃI 2", "LỖ 1"
  dailyOrderIndex?: number;
}
