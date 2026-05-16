/**
 * Inventory & Supply Chain Types
 * Types related to inventory management, suppliers, and transactions
 */

export interface InventoryTransaction {
  id: string;
  date: string;
  type: 'Import' | 'PurchaseReturn' | 'Export' | 'Check' | 'Sale' | 'Return';
  items: {
    productId: string;
    sku: string;
    name: string;
    quantity: number;
    previousStock: number;
    newStock: number;
    price?: number; // Import price for Import transactions
    discount?: number; // Discount for Import transactions
  }[];
  note?: string;
  referenceId?: string; // OrderId or ImportId
  staffId: string;
  supplierId?: string; // For Import transactions
  supplierName?: string; // For Import transactions
  totalAmount?: number; // Total amount for Import transactions
  status?: 'draft' | 'completed' | 'cancelled' | 'balanced'; // Status for Import/Check transactions
  // Audit/Check specific fields
  balancedDate?: string; // Date when audit was balanced
  totalActualQty?: number; // Total actual quantity counted
  totalDiff?: number; // Total difference (sum of all quantity differences)
  increaseCount?: number; // Number of items with stock increase
  decreaseCount?: number; // Number of items with stock decrease
}

export interface Supplier {
  id: string;
  name: string;
  code?: string; // Mã nhà cung cấp (auto-generate hoặc nhập tay)
  phone?: string;
  email?: string;
  address?: string;
  group?: string; // Nhóm nhà cung cấp
  status?: 'active' | 'inactive'; // Trạng thái hoạt động
  notes?: string;
  // Computed fields (không lưu DB, tính runtime từ transactions và debts)
  totalPurchase?: number; // Tổng giá trị mua hàng
  currentDebt?: number; // Nợ hiện tại cần trả
}

export interface SupplierDebtRecord {
  id: string;
  supplierId: string;
  supplierName: string;
  date: string;
  type: 'purchase' | 'payment';
  amount: number;
  description: string;
}
