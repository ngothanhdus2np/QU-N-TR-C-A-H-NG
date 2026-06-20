export interface HelpSection {
  id: string;
  title: string;
}

export interface HelpArticle {
  id: string;
  title: string;
  categoryId: string;
  sections: HelpSection[];
  content: string; // markdown-like content
}

export interface HelpCategory {
  id: string;
  label: string;
  icon: string;
  articles: { id: string; title: string }[];
}

export const HELP_CATEGORIES: HelpCategory[] = [
  {
    id: 'getting-started',
    label: 'Bắt đầu',
    icon: 'rocket',
    articles: [
      { id: 'overview-dashboard', title: 'Trang tổng quan' },
    ],
  },
  {
    id: 'sales',
    label: 'Bán hàng',
    icon: 'shopping-cart',
    articles: [
      { id: 'pos-intro', title: 'Giới thiệu màn hình bán hàng' },
      { id: 'pos-create-order', title: 'Tạo đơn và thanh toán' },
    ],
  },
  {
    id: 'inventory',
    label: 'Hàng hóa',
    icon: 'package',
    articles: [
      { id: 'goods-search', title: 'Tra cứu sản phẩm' },
      { id: 'goods-adjust', title: 'Điều chỉnh tồn kho' },
    ],
  },
  {
    id: 'purchase',
    label: 'Mua hàng',
    icon: 'truck',
    articles: [
      { id: 'purchase-order', title: 'Tạo đơn nhập hàng' },
    ],
  },
  {
    id: 'customers',
    label: 'Khách hàng & NCC',
    icon: 'users',
    articles: [
      { id: 'customer-list', title: 'Quản lý khách hàng' },
      { id: 'supplier-list', title: 'Quản lý nhà cung cấp' },
    ],
  },
  {
    id: 'hr',
    label: 'Nhân sự & Lương',
    icon: 'user-check',
    articles: [
      { id: 'staff-manage', title: 'Quản lý nhân viên' },
      { id: 'payroll-calc', title: 'Tính lương' },
    ],
  },
  {
    id: 'reports',
    label: 'Báo cáo & Phân tích',
    icon: 'bar-chart',
    articles: [
      { id: 'analysis-intro', title: 'Đọc báo cáo phân tích' },
    ],
  },
  {
    id: 'settings',
    label: 'Cài đặt hệ thống',
    icon: 'settings',
    articles: [
      { id: 'settings-general', title: 'Cài đặt chung' },
    ],
  },
];

export const HELP_ARTICLES: Record<string, HelpArticle> = {
  'overview-dashboard': {
    id: 'overview-dashboard',
    categoryId: 'getting-started',
    title: 'Trang tổng quan',
    sections: [
      { id: 'intro', title: 'I. Giới thiệu chung' },
      { id: 'kpi-cards', title: 'II. Thẻ chỉ số hôm nay' },
      { id: 'chart', title: 'III. Biểu đồ doanh thu' },
      { id: 'recent-activity', title: 'IV. Hoạt động gần đây' },
      { id: 'top10', title: 'V. Top hàng bán chạy & khách mua nhiều' },
    ],
    content: `## I. Giới thiệu chung

Trang **Tổng quan** là màn hình đầu tiên sau khi đăng nhập. Tại đây bạn xem nhanh tình hình kinh doanh trong ngày và tháng hiện tại mà không cần vào từng trang riêng lẻ.

Để vào trang Tổng quan, click **TỔNG QUAN** ở thanh điều hướng trên cùng.

---

## II. Thẻ chỉ số hôm nay

Hàng đầu trang hiển thị 4 thẻ chỉ số của **ngày hôm nay**:

| Thẻ | Ý nghĩa |
|---|---|
| **Doanh thu** | Tổng tiền thu từ đơn bán (chưa trừ trả hàng) |
| **Trả hàng** | Số đơn và giá trị hàng khách trả lại |
| **Doanh thu thuần** | Doanh thu sau khi trừ trả hàng và so sánh với tháng trước |
| **Lợi nhuận** | Doanh thu thuần trừ giá vốn hàng bán |

> **Lưu ý**: Lợi nhuận chỉ chính xác khi bạn đã nhập đúng giá vốn cho từng sản phẩm.

---

## III. Biểu đồ doanh thu

Biểu đồ hiển thị doanh thu thuần theo **Theo ngày / Theo giờ / Theo thứ**.

- **Cột đỏ**: doanh thu từng ngày
- **Đường vàng**: xu hướng (trung bình động)
- Góc trên phải có bộ chọn kỳ: **Tháng này / Tháng trước / 30 ngày qua...**

Nhấn vào từng tab để chuyển chế độ xem.

---

## IV. Hoạt động gần đây

Cột bên phải liệt kê các đơn hàng **gần nhất trong ngày** theo thứ tự thời gian giảm dần. Mỗi dòng gồm:
- Tên khách hàng (hoặc "Khách lẻ")
- Loại giao dịch: mua hàng hoặc trả hàng
- Giá trị đơn
- Thời gian thực hiện

---

## V. Top hàng bán chạy & khách mua nhiều

Hai bảng dưới cùng trang:

- **Top 10 hàng bán chạy**: xếp hạng theo số lượng hoặc doanh thu, có thể chọn kỳ
- **Top 10 khách mua nhiều nhất**: khách có tổng chi tiêu cao nhất trong kỳ

Dùng dropdown **"Theo số lượng / Theo doanh thu"** để đổi tiêu chí xếp hạng.`,
  },
};
