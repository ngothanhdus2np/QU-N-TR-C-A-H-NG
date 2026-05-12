import {
  LayoutDashboard,
  ReceiptText,
  MessageSquareText,
  Landmark,
  UserPlus,
  Library,
  Fingerprint,
  Tag,
  Megaphone,
  ShoppingCart,
  Wallet,
  Package,
  FileText,
  Users,
  Truck,
  Shield,
  ClipboardList,
  PackageOpen,
  Trash2,
  Receipt,
  PackagePlus,
  Undo2,
  ShoppingBag,
  RotateCcw,
  Wrench,
  Bike,
  Activity,
  LayoutList,
  ListChecks,
  Clock,
  Gavel,
  Calculator,
  TrendingUp,
} from 'lucide-react';

export const SIDEBAR_SECTIONS = [
  {
    title: 'Tổng quan',
    items: [
      { id: 'dashboard', label: 'Bảng Điều Khiển', icon: LayoutDashboard },
      { id: 'chat', label: 'Hỏi CFO (AI)', icon: MessageSquareText },
    ],
  },
  {
    title: 'Hàng hóa',
    groups: [
      { header: 'Hàng hóa', itemIds: ['goods', 'goods-pricing', 'goods-warranty'] },
      { header: 'Kho hàng', itemIds: ['goods-audit', 'goods-internal-use', 'goods-disposal'] },
    ],
    items: [
      { id: 'goods', label: 'Danh sách hàng hóa', icon: Package },
      { id: 'goods-pricing', label: 'Thiết lập giá', icon: Tag },
      { id: 'goods-warranty', label: 'Bảo hành, bảo trì', icon: Shield },
      { id: 'goods-audit', label: 'Kiểm kho', icon: ClipboardList },
      { id: 'goods-internal-use', label: 'Xuất dùng nội bộ', icon: PackageOpen, badge: 'Mới' },
      { id: 'goods-disposal', label: 'Xuất hủy', icon: Trash2 },
    ],
  },
  {
    title: 'Mua hàng',
    groups: [
      { header: 'Nhà cung cấp', itemIds: ['suppliers', 'purchase-invoices'] },
      { header: 'Mua hàng', itemIds: ['goods-purchase', 'purchase-returns'] },
    ],
    items: [
      { id: 'suppliers', label: 'Nhà cung cấp', icon: Truck },
      { id: 'purchase-invoices', label: 'Hóa đơn đầu vào', icon: Receipt, badge: 'Mới' },
      { id: 'goods-purchase', label: 'Nhập hàng', icon: PackagePlus },
      { id: 'purchase-returns', label: 'Trả hàng nhập', icon: Undo2 },
    ],
  },
  {
    title: 'Đơn hàng',
    items: [
      { id: 'orders', label: 'Đặt hàng', icon: ShoppingBag },
      { id: 'order-invoices', label: 'Hóa đơn', icon: ReceiptText },
      { id: 'order-returns', label: 'Trả hàng', icon: RotateCcw },
      { id: 'order-repairs', label: 'Yêu cầu sửa chữa', icon: Wrench },
      { id: 'delivery-partners', label: 'Đối tác giao hàng', icon: Bike },
      { id: 'shipping-orders', label: 'Vận đơn', icon: FileText },
    ],
  },
  {
    title: 'Khách hàng',
    items: [{ id: 'customers', label: 'Khách Hàng', icon: Users }],
  },
  {
    title: 'Nhân sự',
    groups: [
      { header: 'Nhân sự', itemIds: ['staff', 'staff-performance', 'staff-ledger'] },
      {
        header: 'Lương & Thưởng',
        itemIds: [
          'payroll-attendance',
          'payroll-overtime',
          'payroll-sales',
          'payroll-penalties',
          'payroll-summary',
          'payroll-ledger',
        ],
      },
    ],
    items: [
      { id: 'staff', label: 'Danh sách nhân sự', icon: UserPlus },
      { id: 'staff-performance', label: 'Hiệu năng nhân sự', icon: Activity },
      { id: 'staff-ledger', label: 'Sổ cái hiệu năng', icon: LayoutList },
      { id: 'payroll-attendance', label: 'Chấm công', icon: ListChecks },
      { id: 'payroll-overtime', label: 'Tăng ca', icon: Clock },
      { id: 'payroll-sales', label: 'Doanh số', icon: TrendingUp },
      { id: 'payroll-penalties', label: 'Các khoản khấu trừ', icon: Gavel },
      { id: 'payroll-summary', label: 'Bảng lương', icon: Calculator },
      { id: 'payroll-ledger', label: 'Sổ cái lương', icon: Landmark },
    ],
  },
  {
    title: 'Phân tích',
    items: [
      { id: 'store-revenue', label: 'Doanh Thu Cửa Hàng', icon: ReceiptText },
      { id: 'shopee-revenue', label: 'Doanh Thu Shopee', icon: ShoppingCart },
      { id: 'expenses', label: 'Chi Phí', icon: Wallet },
    ],
  },
  {
    title: 'Marketing',
    items: [
      { id: 'promotions', label: 'Khuyến Mãi', icon: Tag },
      { id: 'marketing', label: 'Nội dung Fanpage', icon: Megaphone },
    ],
  },
  {
    title: 'Hệ thống',
    items: [
      { id: 'brand', label: 'Thương Hiệu', icon: Fingerprint },
      { id: 'sop', label: 'Chính Sách & Quy Trình', icon: Library },
    ],
  },
];
