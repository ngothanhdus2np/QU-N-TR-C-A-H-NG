
export type DiagnosisRange = 'today' | 'yesterday' | 'last7' | 'thisMonth' | 'lastMonth' | 'thisYear' | 'custom' | 'all';

export interface KnowledgeBaseArticle {
  id: string;
  category: 'Nhân sự' | 'Vận hành' | 'Bán hàng' | 'Tài chính' | 'Khác';
  title: string;
  content: string; // Hỗ trợ Markdown
  updatedAt: string;
  sourceFileName?: string;
  sourceFileData?: string; // Base64 data of original file
  sourceFileType?: string;
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
  // Giai đoạn Trước Tết
  commitmentDate: string;
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
  // Fix: Add raw snake_case property for database/KiotViet sync robustness as used in Staff and Payroll managers
  resigned_date?: string;
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
}

export interface AttendanceRecord {
  id: string;
  employeeId: string;
  employeeName: string;
  date: string;
  status: 'Present' | 'AuthorizedLeave' | 'UnauthorizedLeave' | 'Holiday';
  hours: number;
}

export interface OvertimeRecord {
  id: string;
  employeeId: string;
  employeeName: string;
  date: string;
  hours: number;
  multiplier: number;
}

export interface SalesRecord {
  id: string;
  employeeId: string;
  employeeName: string;
  date: string;
  salesAmount: number;
  commissionRate: number;
  commissionEarned: number;
}

export interface ShortageRecord {
  id: string;
  employeeId: string;
  employeeName: string;
  date: string;
  amount: number;
}

export interface AdvanceRecord {
  id: string;
  employeeId: string;
  employeeName: string;
  date: string;
  amount: number;
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
}

export interface StaffPerformanceRecord {
  id: string;
  employeeId: string;
  employeeName: string;
  month: string;
  totalSales: number;
  totalIncome: number;
  roi: number; // Doanh thu / Thu nhập
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
  inventoryTransactions: InventoryTransaction[];
  // Nhà cung cấp
  suppliers: Supplier[];
  supplierDebts: SupplierDebtRecord[];
}

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
  customerOrders?: number;  // KH đặt — số lượng khách đặt trước
  directSale?: boolean;     // Được bán trực tiếp
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
}

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
  notes?: string;
  pointsEarned: number;
  isReturn?: boolean;
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
}

export interface InventoryTransaction {
  id: string;
  date: string;
  type: 'Import' | 'Export' | 'Check' | 'Sale' | 'Return';
  items: {
    productId: string;
    sku: string;
    name: string;
    quantity: number;
    previousStock: number;
    newStock: number;
  }[];
  note?: string;
  referenceId?: string; // OrderId or ImportId
  staffId: string;
}

export interface Supplier {
  id: string;
  name: string;
  phone?: string;
  address?: string;
  notes?: string;
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

export interface DailyBreakEvenConfig {
  monthlyFixedCosts: number;
  grossMarginPercent: number; // e.g., 35 for 35%
}

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
  suggestedDistribution: { strategyId: string, percentage: number }[];
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
  defaultMinStock: number;   // Ngưỡng tồn kho tối thiểu mặc định (khi SP không set minStock)
  debtOverdueDays: number;   // Số ngày nợ NCC chưa thanh toán bị cảnh báo
  revenueDropPct: number;    // % doanh thu giảm so với trung bình 6 ngày (0-100)
}
