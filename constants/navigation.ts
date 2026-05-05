
import { LayoutDashboard, ReceiptText, MessageSquareText, Landmark, UserPlus, Layers, Library, Fingerprint, Tag, Megaphone, ShoppingCart, Wallet, Monitor, Package, FileText, Users } from 'lucide-react';

export const SIDEBAR_SECTIONS = [
  {
    title: 'Tổng quan',
    items: [
      { id: 'dashboard', label: 'Bảng Điều Khiển', icon: LayoutDashboard },
      { id: 'chat', label: 'Hỏi CFO (AI)', icon: MessageSquareText }
    ]
  },
  {
    title: 'Bán hàng',
    items: [
      { id: 'pos', label: 'Máy Tính Tiền', icon: Monitor },
      { id: 'goods', label: 'Hàng Hóa', icon: Package },
      { id: 'orders', label: 'Đơn Hàng', icon: FileText },
      { id: 'customers', label: 'Khách Hàng', icon: Users }
    ]
  },
  {
    title: 'Kinh doanh',
    items: [
      { id: 'product-groups', label: 'Nhóm Hàng', icon: Layers },
      { id: 'store-revenue', label: 'Doanh Thu Cửa Hàng', icon: ReceiptText },
      { id: 'shopee-revenue', label: 'Doanh Thu Shopee', icon: ShoppingCart },
      { id: 'expenses', label: 'Chi Phí', icon: Wallet }
    ]
  },
  {
    title: 'Marketing',
    items: [
      { id: 'promotions', label: 'Khuyến Mãi', icon: Tag, isSubItem: true },
      { id: 'marketing', label: 'Nội dung Fanpage', icon: Megaphone, isSubItem: true }
    ]
  },
  {
    title: 'Nhân sự',
    items: [
      { id: 'staff', label: 'Nhân Sự', icon: UserPlus },
      { id: 'payroll', label: 'Lương & Thưởng', icon: Landmark }
    ]
  },
  {
    title: 'Hệ thống',
    items: [
      { id: 'brand', label: 'Thương Hiệu', icon: Fingerprint, isSubItem: true },
      { id: 'sop', label: 'Chính Sách & Quy Trình', icon: Library }
    ]
  }
];

// Re-importing Wallet is no longer needed as it's in the main import
