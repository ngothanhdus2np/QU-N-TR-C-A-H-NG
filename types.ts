export type DiagnosisRange =
  | 'today'
  | 'yesterday'
  | 'last7'
  | 'thisMonth'
  | 'lastMonth'
  | 'thisYear'
  | 'custom'
  | 'all';

export interface DashboardFinancialInsights {
  periodRev: number;
  periodExp: number;
  periodProfit: number;
  periodGross: number;
  payrollTotal: number;
  nonPayrollExp: number;
  activeStaffCount: number;
  netProfitMargin: number;
  opExRatio: number;
  laborCostRatio: number;
  fixedCosts: number;
  variableCosts: number;
  depreciationCosts: number;
  interestCosts: number;
  totalCogs: number;
  ledgerCogs: number;
}

export interface DashboardPreviousInsights {
  rev: number;
  profit: number;
  gross: number;
  exp: number;
}

export interface DashboardBreakEvenAnalysis {
  dailyFixedCost: number;
  avgGrossMargin: number;
}

export interface DashboardTrendPoint {
  month?: string;
  date?: string;
  revenue: number;
  grossProfit: number;
  netProfit: number;
}

export interface DashboardWaterfallItem {
  name: string;
  value: [number, number];
  fill: string;
  label: string;
}

export interface DashboardExpenseSlice {
  name: string;
  value: number;
}

export interface DashboardDetailedExpense {
  id: string;
  date: string;
  category: string;
  description: string;
  amount: number;
}

export interface KnowledgeBaseArticle {
  id: string;
  category: 'Nhân sự' | 'Vận hành' | 'Bán hàng' | 'Tài chính' | 'Biểu mẫu' | 'Khác';
  title: string;
  content: string; // Hỗ trợ Markdown
  summary?: string;
  updatedAt: string;
  sourceFileName?: string;
  sourceFileData?: string; // Legacy base64 data of original file
  sourceFilePath?: string;
  sourceFileUrl?: string;
  sourcePreviewUrl?: string;
  sourcePageImages?: string[];
  sourceFileType?: string;
  sourceFileSize?: number;
}

export interface SalaryPolicy {
  id: string;
  name: string;
  salaryType: 'daily' | 'monthly';
  baseSalary: number;
  isProRated?: boolean;
  startThreshold: number;
  endThreshold: number;
  otRate: number;
  commissionRate: number;
  seniorityBonusPerYear: number;
  attendanceAllowance: number;
  cleaningAllowance: number;
  customerServiceAllowance: number;
  dinnerAllowance: number;
  housingAllowance: number;
  responsibilityAllowance: number;
}

export interface Holiday {
  id: string;
  date: string;
  name: string;
}

export interface ViolationType {
  id: string;
  name: string;
  fine1: string;
  fine2: string;
  fine3: string;
}

export interface ViolationOccurrence {
  id?: string;
  employeeId: string;
  violationTypeId: string;
  occurrence: 1 | 2 | 3;
  month: string;
}

export interface ResponsibilityApproval {
  employeeId: string;
  month: string;
}

export interface TetCampaign {
  id?: string;
  year?: number;
  // Giai đoạn Trước Tết
  commitmentDate?: string;
  carAllowance: number;
  beforeTetExtraDays: string[];
  beforeTetExtraBonus: number;

  // Cấu hình đặc thù 28, 29, 30
  date28Tet?: string;
  date29Tet?: string;
  date30Tet?: string;
  bonus29Tet?: number;
  bonus30Tet?: number;

  // Giai đoạn Sau Tết
  afterTetDate: string;
  lixiBonus: number;
  afterTetExtraDays: string[];
  afterTetExtraBonus: number;
}

export interface Employee {
  id: string;
  name: string;
  position: string;
  joinDate: string;
  resignedDate?: string; // Ngày nghỉ việc (nếu có)
  assignedPolicyId?: string; // Trường mới: ID nhóm lương được gán cố định
  dob?: string;
  phone?: string;
  address?: string;
  bankAccountNumber?: string;
  bankName?: string;
  bankAccountHolder?: string;
  notes?: string;
  photoUrl?: string; // Trường ảnh chân dung mới
  bloodType?: string;
  email?: string;
  idNumber?: string;
  bankAccount?: string;
  emergencyContact?: string;
  carryForwardDebt?: number; // Nợ lương chuyển sang kỳ tiếp theo
}

export interface AttendanceRecord {
  id: string;
  employeeId: string;
  employeeName?: string;
  date: string;
  status: 'Present' | 'AuthorizedLeave' | 'UnauthorizedLeave' | 'Holiday' | 'Absent';
  hours: number;
}

export interface OvertimeRecord {
  id: string;
  employeeId: string;
  employeeName?: string;
  date: string;
  hours: number;
  multiplier?: number;
}

export interface SalesRecord {
  id: string;
  employeeId: string;
  employeeName?: string;
  date: string;
  salesAmount: number;
  commissionRate?: number;
  commissionEarned?: number;
  customerId?: string;
}

export interface ShortageRecord {
  id: string;
  employeeId: string;
  employeeName?: string;
  date: string;
  amount: number;
  reason?: string;
}

export interface AdvanceRecord {
  id: string;
  employeeId: string;
  employeeName?: string;
  date: string;
  amount: number;
  reason?: string;
}

export interface RevenueRecord {
  id: string;
  date: string; // Thời gian
  totalGrossRevenue: number; // Tổng tiền hàng
  discount: number; // Giảm giá
  revenueOther: number; // Doanh thu khác (Chỉ lấy nguồn nhập tay)
  returnsValue: number; // Giá trị trả
  netRevenue: number; // Doanh thu thuần
  totalCogs: number; // Tổng giá vốn
  grossProfit: number; // Lợi nhuận gộp
}

export interface ProductGroup {
  id: string;
  name: string;
  target?: number;
  peakMonths?: number[]; // [1, 2, 3...]
}

export interface ProductGroupRevenue {
  id: string;
  date: string;
  groupId: string;
  groupName: string;
  amount: number; // Tổng doanh thu gộp
  quantity?: number; // Số lượng bán
  returnsQuantity?: number; // Số lượng trả
  returnsValue?: number; // Giá trị trả
  netRevenue?: number; // Doanh thu thuần
  cogs?: number; // Tổng giá vốn
}

export interface ExpenseRecord {
  id: string;
  date: string;
  category: string;
  amount: number;
  description: string;
}

export interface RecurringExpense {
  id: string;
  name: string;
  category: string;
  amount: number;
  dayOfMonth: number; // 1-31
  description?: string;
  isActive: boolean;
  lastPostedMonth?: string; // YYYY-MM
}

export interface ExpenseCategory {
  id: string;
  name: string;
  parentId?: string;
}

export interface PayrollRecord {
  id: string;
  employeeId: string;
  employeeName: string;
  month: string;
  basicSalary: number;
  allowance: number;
  responsibilityPay: number;
  overtimePay: number;
  commissionPay: number;
  seniorityBonus: number;
  holidayBonus: number;
  tetBonus: number;
  tetBonusBefore?: number; // Phúc lợi trước tết
  tetBonusAfter?: number; // Phúc lợi sau tết
  advance: number;
  shortage: number;
  fine: number;
  netPay: number;
  seniorityDays: number;
  isOfficial: boolean;
  hasTetCommitment: boolean;
  calculationNote?: string;
  carryForwardDeduction?: number; // Khấu trừ nợ kỳ trước trong kỳ này
  carryForwardDebtOut?: number; // Nợ chuyển sang kỳ tiếp theo sau kỳ này
}

export type PayrollSubTab =
  | 'attendance'
  | 'overtime'
  | 'sales'
  | 'penalties'
  | 'summary'
  | 'ledger';

export type RevenueSubTab =
  | 'diagnosis'
  | 'matrix'
  | 'ledger'
  | 'source'
  | 'costs'
  | 'inventory_in'
  | 'inventory_out'
  | 'report';

export type RevenueAuditColumnKey = 'totalGrossRevenue' | 'discount' | 'returnsValue' | 'totalCogs';

export interface RevenueAuditConflict {
  date: string;
  columnKey: RevenueAuditColumnKey;
  columnLabel: string;
  currentValue: number;
  newValue: number;
  resolution: 'keep' | 'update';
}

export interface StaffPerformanceRecord {
  id: string;
  employeeId: string;
  employeeName: string;
  month: string;
  totalSales: number;
  totalIncome: number;
  roi: number; // Doanh thu / (thực nhận + tạm ứng)
  rank?: number;
}

export interface CashFlowRecord {
  id: string;
  date: string;
  inflow: number;
  outflow: number;
  balance: number;
}

export interface GiftTier {
  id: string;
  minInvoiceValue: number;
  giftValue: number;
  giftName: string;
}

export interface PromotionPlan {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  type: 'Discount' | 'Buy1Get1' | 'Voucher' | 'Gift' | 'Other';
  budget: number;
  targetRevenue: number;
  description: string;
  status: 'Planned' | 'Active' | 'Completed' | 'Cancelled';
  giftTiers?: GiftTier[];
  // Actual performance metrics
  actualRevenue?: number;
  actualCost?: number;
  incrementalRevenue?: number;
  actualRoi?: number;
}

export interface AppData {
  employees: Employee[];
  revenue: RevenueRecord[];
  productGroups?: ProductGroup[];
  productGroupRevenue?: ProductGroupRevenue[];
  expenses: ExpenseRecord[];
  payroll: PayrollRecord[];
  staffPerformance?: StaffPerformanceRecord[];
  attendance: AttendanceRecord[];
  overtime: OvertimeRecord[];
  sales: SalesRecord[];
  shortages?: ShortageRecord[];
  advances?: AdvanceRecord[];
  cashflow: CashFlowRecord[];
  salaryPolicies: SalaryPolicy[];
  holidays: Holiday[];
  violationTypes?: ViolationType[];
  violationOccurrences?: ViolationOccurrence[];
  customDeductions?: string[];
  responsibilityApprovals?: ResponsibilityApproval[];
  tetCampaign?: TetCampaign;
  expenseCategories?: ExpenseCategory[];
  knowledgeBase?: KnowledgeBaseArticle[];
  promotions?: PromotionPlan[];
  brandProfile?: BrandProfile;
  shopeeRevenue: RevenueRecord[];
  shopeeProductGroupRevenue: ProductGroupRevenue[];
  shopeeSourceData: ShopeeSourceItem[];
  shopeeCosts: ShopeeCostConfig;
  shopeeInventoryIn: ShopeeInventoryInRecord[];
  shopeeInventoryOut: ShopeeInventoryOutRecord[];
  dailyAdsConfig: Record<string, number>;
  recurringExpenses: RecurringExpense[];
  dailyBreakEvenConfig?: DailyBreakEvenConfig;
  // POS System Fields
  posProducts: POSProduct[];
  posOrders: POSOrder[];
  posCustomers: POSCustomer[];
  customerDebtHistory: CustomerDebtRecord[];
  inventoryTransactions: InventoryTransaction[];
  posPaymentSettings?: POSPaymentSettings;
  posInventorySettings?: POSInventorySettings;
  posKeyboardSettings?: POSKeyboardSettings;
  // Nhà cung cấp
  suppliers: Supplier[];
  supplierDebts: SupplierDebtRecord[];
  // VAT Coverage
  vatGroups?: VatGroup[];
  skuVatGroupMappings?: SkuVatGroupMapping[];
  supplierAliases?: SupplierAlias[];
  vatGroupKeywords?: VatGroupKeyword[];
  vatDocuments?: VatDocument[];
  vatDocumentItems?: VatDocumentItem[];
  vatAllocations?: VatAllocation[];
  vatAllocationEvents?: VatAllocationEvent[];
  taxFilingPeriods?: TaxFilingPeriod[];
  openingStockItems?: OpeningStockItem[];
}

export type AppDataListKey = {
  [K in keyof AppData]: NonNullable<AppData[K]> extends { id: string }[] ? K : never;
}[keyof AppData];

export type AppDataItem<K extends keyof AppData> =
  NonNullable<AppData[K]> extends Array<infer Item> ? Item : NonNullable<AppData[K]>;

export type AppDataSurgicalUpdate = {
  [K in AppDataListKey]: { key: K; item: AppDataItem<K> | { id: string }; isDelete?: boolean };
}[AppDataListKey];

export type UpdateAppData = <K extends keyof AppData>(
  key: K,
  newList: AppData[K],
  idToRemove?: string
) => void;

export interface POSProductUnit {
  id: string;
  name: string;
  factor: number;
  price: number;
  isBase: boolean;
}

export interface POSProductAttribute {
  id?: string;
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
  discountPercent?: number;
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
  importPrice?: number;
  salespersonId?: string;
  salespersonName?: string;
  lineType?: 'sale' | 'return' | 'exchange';
  maxQuantity?: number;
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
  paymentMethod: 'Cash' | 'Bank' | 'Momo' | 'Other' | 'Card';
  staffId: string;
  staffName?: string;
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
  refundAmount?: number; // Tiền trả lại khách (> 0 = shop hoàn tiền, 0 = đổi hàng)
  returnFee?: number; // Phí trả hàng shop thu (ghi vào revenueOther)
  returnOtherRefund?: number; // Hoàn trả thu khác (cộng vào tiền hoàn cho khách)
  originalOrderId?: string; // ID đơn bán gốc — để reverse revenue đúng ngày (AUDIT-006)
  splitPayments?: { cash?: number; bank?: number; card?: number; momo?: number }; // Phân bổ từng PTTT khi chia nhiều
}

export type POSPaymentMethod = 'Cash' | 'Bank' | 'Momo' | 'Other' | 'Card';

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
  bankCode?: string;
  accountHolder: string;
  scope: string;
  note?: string;
  qrImage?: string;
  enabled: boolean;
}

export interface POSPaymentSettings {
  defaultMethod: POSPaymentMethod;
  allowSplitPayment: boolean;
  enabledMethods: POSPaymentMethod[];
  bank: POSPaymentChannelSettings;
  card: POSPaymentChannelSettings;
  wallet: POSPaymentChannelSettings;
  bankAccounts: POSPaymentAccount[];
  walletAccounts: POSPaymentAccount[];
  /** Số tiền tối thiểu để tích 1 điểm. Mặc định 10.000đ/điểm. */
  pointsRate?: number;
}

export interface POSInventorySettings {
  allowSellOutOfStock: boolean;
  maxQtyWarning?: number; // Ngưỡng cảnh báo số lượng lớn khi nhập POS (mặc định 10000)
  costMethod?: 'fixed' | 'average'; // Phương pháp tính giá vốn, đồng bộ qua Supabase
  showSalesAdvisor?: boolean; // Hiển thị box tư vấn bán hàng trong POS (mặc định true)
}

export type POSKeyboardAction =
  | 'addTab'
  | 'toggleAutoPrint'
  | 'focusSearch'
  | 'openConsultant'
  | 'focusCustomer'
  | 'checkout'
  | 'toggleFullscreen'
  | 'cartQtyUp'
  | 'cartQtyDown'
  | 'cartNextItem'
  | 'cartPrevItem'
  | 'cartSelectFirst';

export interface POSKeyboardShortcut {
  id: string;
  key: string;
  modifiers?: { shift?: boolean; ctrl?: boolean };
  label: string;
  action: POSKeyboardAction;
  enabled: boolean;
  isDefault: boolean;
}

export interface POSKeyboardSettings {
  shortcuts: POSKeyboardShortcut[];
}

export const DEFAULT_POS_KEYBOARD_SHORTCUTS: POSKeyboardShortcut[] = [
  {
    id: 'addTab',
    key: 'F1',
    label: 'Thêm hóa đơn mới',
    action: 'addTab',
    enabled: true,
    isDefault: true,
  },
  {
    id: 'toggleAutoPrint',
    key: 'F2',
    label: 'Bật/tắt in tự động',
    action: 'toggleAutoPrint',
    enabled: true,
    isDefault: true,
  },
  {
    id: 'focusSearch',
    key: 'F3',
    label: 'Tìm hàng hóa',
    action: 'focusSearch',
    enabled: true,
    isDefault: true,
  },
  {
    id: 'openConsultant',
    key: 'F3',
    label: 'Mở tư vấn bán hàng',
    action: 'openConsultant',
    enabled: true,
    isDefault: true,
    modifiers: { shift: true },
  },
  {
    id: 'focusCustomer',
    key: 'F4',
    label: 'Tìm khách hàng',
    action: 'focusCustomer',
    enabled: true,
    isDefault: true,
  },
  {
    id: 'checkout',
    key: 'F9',
    label: 'Thanh toán',
    action: 'checkout',
    enabled: true,
    isDefault: true,
  },
  {
    id: 'toggleFullscreen',
    key: 'F11',
    label: 'Toàn màn hình',
    action: 'toggleFullscreen',
    enabled: true,
    isDefault: true,
  },
  {
    id: 'cartQtyUp',
    key: 'ArrowUp',
    label: 'Tăng số lượng item chọn',
    action: 'cartQtyUp',
    enabled: true,
    isDefault: true,
  },
  {
    id: 'cartQtyDown',
    key: 'ArrowDown',
    label: 'Giảm số lượng item chọn',
    action: 'cartQtyDown',
    enabled: true,
    isDefault: true,
  },
  {
    id: 'cartNextItem',
    key: 'Enter',
    label: 'Chọn item tiếp theo',
    action: 'cartNextItem',
    enabled: true,
    isDefault: true,
  },
  {
    id: 'cartPrevItem',
    key: 'Shift',
    label: 'Chọn item trước',
    action: 'cartPrevItem',
    enabled: true,
    isDefault: true,
  },
  {
    id: 'cartSelectFirst',
    key: 'Home',
    label: 'Chọn item đầu tiên',
    action: 'cartSelectFirst',
    enabled: true,
    isDefault: true,
  },
];

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
  isStarred?: boolean;
}

export interface CustomerDebtRecord {
  id: string;
  customerId: string;
  date: string;
  orderId?: string;
  type: 'debt' | 'repay';
  amount: number;
  note?: string;
}

export interface InventoryTransaction {
  id: string;
  date: string;
  type:
    | 'Import'
    | 'PurchaseReturn'
    | 'Export'
    | 'Check'
    | 'Sale'
    | 'Return'
    | 'internal_use'
    | 'disposal'
    | 'return';
  items: {
    productId: string;
    sku?: string;
    name?: string;
    productName?: string;
    quantity: number;
    previousStock?: number;
    newStock?: number;
    price?: number; // Import price for Import transactions
    discount?: number; // Discount for Import transactions
    costMethod?: 'fixed' | 'average'; // Cost method used when importing stock
    previousImportPrice?: number; // Import price before this transaction (for rollback on delete)
    nextImportPrice?: number; // Import price to persist after Import transaction
    note?: string; // For disposal reasons
  }[];
  note?: string;
  referenceId?: string; // OrderId or ImportId
  staffId?: string;
  supplierId?: string; // For Import transactions
  supplierName?: string; // For Import transactions
  totalAmount?: number; // Total amount for Import transactions
  status?: 'draft' | 'completed' | 'cancelled' | 'balanced'; // Status for Import/Check transactions
  allowNegativeStock?: boolean; // Cho phép phiếu bán làm tồn kho âm
  // Invoice tracking fields (for Import transactions)
  invoiceStatus?: 'full' | 'partial' | 'memo_only' | 'none';
  invoicedAmount?: number;
  invoiceChangedBy?: string;
  invoiceChangedAt?: string;
  // Audit/Check specific fields
  balancedDate?: string; // Date when audit was balanced
  totalActualQty?: number; // Total actual quantity counted
  totalDiff?: number; // Total difference (sum of all quantity differences)
  increaseCount?: number; // Number of items with stock increase
  decreaseCount?: number; // Number of items with stock decrease
}

export type VatDocumentStatus = 'unallocated' | 'partial' | 'completed' | 'over_allocated' | 'void';
export type VatMappingStatus = 'suggested' | 'confirmed' | 'needs_confirmation';
export type VatSupplierMatchStatus = 'matched' | 'needs_confirmation' | 'unmatched';
export type VatAllocationMethod = 'auto' | 'manual';
export type VatAllocationStatus = 'active' | 'void';
export type VatAllocationTargetType = 'purchase_receipt' | 'opening_stock';
export type TaxFilingPeriodStatus = 'draft' | 'locked' | 'archived';
export type OpeningStockVatStatus =
  | 'has_vat'
  | 'waiting_vat'
  | 'missing_vat'
  | 'no_vat'
  | 'unknown'
  | 'pending_supplement';
export type VatReconciliationStage = 'opening_stock' | 'post_filing';
export type VatRiskStatus =
  | 'covered'
  | 'partial'
  | 'missing'
  | 'overdue_15'
  | 'overdue_30'
  | 'over_allocated'
  | 'needs_mapping'
  | 'needs_allocation';

export interface VatGroup {
  id: string;
  name: string;
  description?: string;
  status?: 'active' | 'inactive';
  branchId?: string;
  tenantId?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface SkuVatGroupMapping {
  id: string;
  sku: string;
  productId?: string;
  productName?: string;
  vatGroupId: string;
  confidenceScore?: number;
  source?: 'manual' | 'keyword' | 'import' | 'auto';
  branchId?: string;
  tenantId?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface SupplierAlias {
  id: string;
  supplierId: string;
  aliasName: string;
  taxCode?: string;
  branchId?: string;
  tenantId?: string;
  createdAt?: string;
  createdBy?: string;
}

export interface VatGroupKeyword {
  id: string;
  vatGroupId: string;
  keyword: string;
  normalizedKeyword: string;
  branchId?: string;
  tenantId?: string;
  createdAt?: string;
  createdBy?: string;
}

export interface VatDocument {
  id: string;
  supplierId?: string;
  supplierNameOnInvoice?: string;
  supplierTaxCode?: string;
  supplierMatchConfidence?: number;
  supplierMatchStatus?: VatSupplierMatchStatus;
  invoiceNo: string;
  invoiceDate: string;
  totalBeforeTax: number;
  vatAmount: number;
  totalAmount: number;
  filePdfUrl?: string;
  fileXmlUrl?: string;
  status: VatDocumentStatus;
  note?: string;
  voidReason?: string;
  voidedAt?: string;
  voidedBy?: string;
  branchId?: string;
  tenantId?: string;
  createdAt?: string;
  createdBy?: string;
  updatedAt?: string;
}

export interface VatDocumentItem {
  id: string;
  vatDocumentId: string;
  descriptionOnInvoice: string;
  suggestedVatGroupId?: string;
  confirmedVatGroupId?: string;
  quantity: number;
  amountBeforeTax: number;
  vatAmount: number;
  totalAmount: number;
  allocatedQuantity: number;
  allocatedAmount: number;
  remainingQuantity?: number;
  remainingAmount?: number;
  confidenceScore?: number;
  mappingStatus?: VatMappingStatus;
  branchId?: string;
  tenantId?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface VatAllocation {
  id: string;
  vatDocumentItemId: string;
  purchaseReceiptId?: string;
  purchaseReceiptItemId?: string;
  openingStockItemId?: string;
  filingPeriodId?: string;
  targetType?: VatAllocationTargetType;
  vatGroupId: string;
  allocatedQuantity: number;
  allocatedAmount: number;
  createdAt?: string;
  createdBy?: string;
  allocationMethod: VatAllocationMethod;
  status?: VatAllocationStatus;
  voidReason?: string;
  voidedAt?: string;
  voidedBy?: string;
  branchId?: string;
  tenantId?: string;
}

export interface TaxFilingPeriod {
  id: string;
  name: string;
  startDate: string;
  status: TaxFilingPeriodStatus;
  lockedAt?: string;
  lockedBy?: string;
  note?: string;
  branchId?: string;
  tenantId?: string;
  createdAt?: string;
  createdBy?: string;
  updatedAt?: string;
}

export interface OpeningStockItem {
  id: string;
  filingPeriodId: string;
  sku: string;
  productId?: string;
  productName: string;
  productGroupName?: string;
  vatGroupId?: string;
  supplierId?: string;
  supplierName?: string;
  quantity: number;
  unitCost: number;
  totalAmount: number;
  vatStatus: OpeningStockVatStatus;
  note?: string;
  branchId?: string;
  tenantId?: string;
  createdAt?: string;
  createdBy?: string;
  updatedAt?: string;
}

export interface VatReconciliationRow {
  id: string;
  stage: VatReconciliationStage;
  stageLabel: string;
  supplierId?: string;
  supplierName: string;
  vatGroupId: string;
  vatGroupName: string;
  itemCount: number;
  invoiceCount: number;
  goodsQuantity: number;
  goodsAmount: number;
  validAllocatedAmount: number;
  overAllocatedAmount: number;
  missingAmount: number;
  coveragePercent: number;
  riskStatus: VatRiskStatus;
}

export interface VatReconciliationSummary {
  openingGoodsAmount: number;
  openingVatCoveredAmount: number;
  openingVatMissingAmount: number;
  postFilingGoodsAmount: number;
  postFilingVatCoveredAmount: number;
  postFilingVatMissingAmount: number;
  unallocatedDocumentAmount: number;
  suppliersNeedVatCount: number;
  overAllocatedAmount: number;
}

export interface VatAllocationEvent {
  id: string;
  allocationId?: string;
  vatDocumentId?: string;
  action: 'created' | 'voided' | 'confirmed_mapping' | 'updated_mapping' | 'document_voided';
  reason?: string;
  snapshot?: Record<string, unknown>;
  createdAt?: string;
  createdBy?: string;
  branchId?: string;
  tenantId?: string;
}

export interface VatCoverageRow {
  vatGroupId: string;
  vatGroupName: string;
  totalPurchasedQuantity: number;
  totalPurchasedAmount: number;
  vatCoveredQuantity: number;
  vatCoveredAmount: number;
  missingQuantity: number;
  missingAmount: number;
  coveragePercent: number;
  missingReceiptCount: number;
  supplierNames: string[];
  riskStatus: VatRiskStatus;
}

export interface VatAllocationProposal {
  id: string;
  vatDocumentItemId: string;
  purchaseReceiptId: string;
  purchaseReceiptItemId?: string;
  vatGroupId: string;
  allocatedQuantity: number;
  allocatedAmount: number;
  allocationMethod: VatAllocationMethod;
  warning?: 'over_allocated' | 'supplier_mismatch';
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
  isFavorite?: boolean; // Đánh dấu nhà cung cấp quan trọng
  notes?: string;
  companyName?: string; // Tên công ty xuất hóa đơn
  taxCode?: string; // Mã số thuế
  invoiceCompanyName?: string; // Tên đơn vị xuất hóa đơn đã xác nhận từ VAT
  invoiceTaxCode?: string; // MST xuất hóa đơn đã xác nhận từ VAT
  invoicePhone?: string; // SĐT đơn vị xuất hóa đơn
  invoiceAddress?: string; // Địa chỉ đơn vị xuất hóa đơn
  // Computed fields (không lưu DB, tính runtime từ transactions và debts)
  totalPurchase?: number; // Tổng giá trị mua hàng
  currentDebt?: number; // Nợ hiện tại cần trả
  productCategories?: string[]; // Nhóm hàng NCC cung cấp (tính từ phiếu nhập)
}

export interface SupplierDebtRecord {
  id: string;
  supplierId: string;
  supplierName: string;
  date: string;
  type: 'purchase' | 'payment' | 'adjustment' | 'discount';
  amount: number;
  description: string;
}

export interface DailyBreakEvenConfig {
  monthlyFixedCosts: number;
  grossMarginPercent: number; // e.g., 35 for 35%
}

export interface ShopeeSourceShop {
  name: string;
  link: string;
}

export interface ShopeeSourceItem {
  id: string;
  sku: string;
  name: string;
  importPrice: number;
  salePrice: number;
  status: string;
  starred?: boolean;
  imageUrl?: string;
  description?: string;
  groupId?: string;
  shops?: ShopeeSourceShop[];
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
  handlingFeePerOrder: number;
}

export interface ShopeeInventoryInRecord {
  id: string;
  date: string;
  sku: string;
  quantity: number;
  importPrice: number;
  note?: string;
  purchaseOrderId?: string;
  purchaseOrderCode?: string;
  supplierName?: string;
}

export interface ShopeeInventoryOutRecord {
  id: string;
  date: string;
  orderId: string;
  orderCode?: string;
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
  pishipFee: number;
  vatTax: number;
  adsCost: number;
  adsTax: number;
  personalIncomeTax: number;
  netProfit: number;
  address?: string;
  shippingUnit?: string;
  trackingNumber?: string;
  shipDate?: string;
  status: 'OK' | 'RETURN' | 'RETURNED' | 'CANCEL' | 'LOST' | 'SHIPPING' | 'PENDING';
  profitStatus?: string; // e.g., "LÃI 2", "LỖ 1"
  dailyOrderIndex?: number;
}

export interface ContentStrategy {
  id: string;
  name: string;
  percentage: number;
  description: string;
  color: string;
}

export interface ProductLine {
  id: string;
  name: string;
  target: string;
  highlights: string;
  isSelected?: boolean;
}

export interface BrandProfile {
  name?: string;
  story: string;
  voice: string;
  targetAudience: string;
  competitiveAdvantage: string;
  logo?: string;
  inventory: ProductLine[];
  phone?: string;
  address?: string;
  hashtags?: string;
}

export interface ContentPlanItem {
  date: string;
  topic: string;
  type: string;
  imageInstruction: string;
  caption: string;
  image?: string;
  isPosted?: boolean;
  scheduledTime?: string;
  status?: 'draft' | 'scheduled' | 'posted' | 'error';
  fbPostId?: string;
  errorLog?: string;
  isDraft?: boolean;
}

export interface StrategicAdvice {
  holidays: string[];
  marketInsight: string;
  suggestedDistribution: { strategyId: string; percentage: number }[];
}

export interface GenerationRequest {
  duration: 'week' | 'month';
  startDate: string;
}

export interface ChatMessage {
  role: 'user' | 'model';
  content: string;
  isTable?: boolean;
}

export interface AppAlert {
  id: string;
  type: 'low_stock' | 'overdue_debt' | 'revenue_drop';
  severity: 'warning' | 'critical';
  title: string;
  message: string;
  createdAt: string;
}

export interface AlertConfig {
  defaultMinStock: number; // Ngưỡng tồn kho tối thiểu mặc định (khi SP không set minStock)
  debtOverdueDays: number; // Số ngày nợ NCC chưa thanh toán bị cảnh báo
  revenueDropPct: number; // % doanh thu giảm so với trung bình 6 ngày (0-100)
}
