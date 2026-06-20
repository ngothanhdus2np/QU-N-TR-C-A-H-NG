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
  'pos-intro': {
    id: 'pos-intro',
    categoryId: 'sales',
    title: 'Giới thiệu màn hình bán hàng',
    sections: [
      { id: 'overview', title: 'I. Tổng quan giao diện' },
      { id: 'search-bar', title: 'II. Thanh tìm kiếm hàng hóa' },
      { id: 'invoice-tabs', title: 'III. Tab hóa đơn' },
      { id: 'cart', title: 'IV. Giỏ hàng' },
      { id: 'menu', title: 'V. Menu tùy chọn' },
    ],
    content: `## I. Tổng quan giao diện

Màn hình **Bán hàng** được chia làm 3 vùng chính:

| Vùng | Vị trí | Chức năng |
|---|---|---|
| **Thanh công cụ** | Trên cùng | Tìm kiếm hàng, chọn tab hóa đơn |
| **Giỏ hàng** | Giữa / trái | Danh sách sản phẩm đang bán |
| **Thanh toán** | Phải | Chọn khách, chọn PTTT, xác nhận đơn |

Để vào màn hình bán hàng, click nút **BÁN HÀNG** màu đỏ ở góc trên phải thanh điều hướng.

---

## II. Thanh tìm kiếm hàng hóa

Ô tìm kiếm nằm ở **trên cùng bên trái**. Phím tắt nhanh: **F3** để focus vào ô tìm kiếm.

- Gõ tên hàng, mã SKU, hoặc mã vạch → kết quả xuất hiện ngay bên dưới
- Dùng ↑ ↓ để di chuyển trong danh sách kết quả
- Nhấn **Enter** để thêm sản phẩm vào giỏ
- Click vào **biểu tượng sắp xếp** (góc phải ô tìm kiếm) để đổi thứ tự kết quả: theo mã hàng hoặc theo giá

> **Lưu ý**: Khi đang ở chế độ Trả hàng, ô tìm kiếm sẽ bị khóa. Dùng ô tìm kiếm riêng trong panel trả hàng.

---

## III. Tab hóa đơn

Hệ thống hỗ trợ **nhiều hóa đơn song song** (đa tab). Mỗi tab là một đơn hàng độc lập.

- Click **+** để mở tab hóa đơn mới
- Click **×** trên tab để đóng (hàng trong giỏ sẽ mất)
- Tab hiện tại được tô đậm và có gạch dưới màu đỏ
- Mỗi tab có trạng thái riêng: **Đang bán** hoặc **Đang trả hàng**

---

## IV. Giỏ hàng

Danh sách sản phẩm đã thêm vào đơn. Mỗi dòng sản phẩm hiển thị:
- Tên hàng và mã SKU
- Số lượng (có thể sửa trực tiếp)
- Đơn giá
- Thành tiền

**Thao tác nhanh trong giỏ:**
- Click vào **số lượng** để sửa
- Click **biểu tượng %** cạnh dòng sản phẩm để thêm giảm giá theo mặt hàng
- Click **×** để xóa sản phẩm khỏi giỏ

---

## V. Menu tùy chọn

Click **biểu tượng ⋮** hoặc icon lưới ở thanh công cụ để mở menu:

- **Báo cáo cuối ngày** — tổng kết doanh thu, số đơn trong ca
- **Xử lý đơn đặt hàng** — quản lý đơn đặt trước chưa hoàn tất
- **Xử lý sửa chữa** — theo dõi đơn bảo hành / sửa chữa
- **Phím tắt** — xem toàn bộ phím tắt bàn phím
- **QR điện thoại** — mở màn hình bán hàng nhanh trên thiết bị di động`,
  },

  'pos-create-order': {
    id: 'pos-create-order',
    categoryId: 'sales',
    title: 'Tạo đơn và thanh toán',
    sections: [
      { id: 'add-product', title: 'I. Thêm sản phẩm vào đơn' },
      { id: 'select-customer', title: 'II. Chọn khách hàng' },
      { id: 'discount', title: 'III. Giảm giá' },
      { id: 'payment', title: 'IV. Thanh toán' },
      { id: 'receipt', title: 'V. In hóa đơn' },
      { id: 'return', title: 'VI. Trả hàng' },
    ],
    content: `## I. Thêm sản phẩm vào đơn

**Cách 1 — Tìm kiếm:** Gõ tên / mã SKU / mã vạch vào ô tìm kiếm (F3), chọn sản phẩm bằng Enter hoặc click.

**Cách 2 — Quét mã vạch:** Dùng máy quét mã vạch kết nối USB, quét vào ô tìm kiếm — sản phẩm tự động được thêm vào giỏ.

Sau khi thêm, bạn có thể:
- Đổi **số lượng** bằng cách click vào con số và gõ lại
- Xem **tồn kho hiện tại** hiển thị nhỏ bên cạnh mỗi sản phẩm

---

## II. Chọn khách hàng

Panel bên phải có ô **Tìm khách hàng**. Gõ tên hoặc số điện thoại để tìm.

- Nếu khách chưa có trong hệ thống: click **+ Thêm khách nhanh** để tạo mới ngay
- Khi chọn khách, hệ thống hiển thị **hạng thành viên** (Standard / Silver / Gold / Diamond) và tự động áp dụng chiết khấu tương ứng nếu có cấu hình
- Bỏ chọn khách: click **×** cạnh tên khách

---

## III. Giảm giá

**Giảm giá từng sản phẩm:**
- Click biểu tượng **%** cạnh dòng sản phẩm trong giỏ → nhập giá trị giảm (% hoặc số tiền cụ thể)

**Giảm giá cả hóa đơn:**
- Trong panel thanh toán bên phải, click **Chiết khấu hóa đơn** → nhập %

> Giảm giá sản phẩm và giảm giá hóa đơn có thể áp dụng đồng thời. Tổng cộng hiển thị ở phần **Tổng cộng**.

---

## IV. Thanh toán

Sau khi hoàn tất giỏ hàng, chọn **Phương thức thanh toán** ở panel phải:

| Phương thức | Ghi chú |
|---|---|
| **Tiền mặt** | Nhập số tiền khách đưa → hệ thống tính tiền thối |
| **Chuyển khoản** | Hiện QR VietQR động theo số tiền thực tế |
| **Momo** | Hiện mã QR ví điện tử |
| **Thẻ** | Ghi nhận thanh toán thẻ POS |

**Thanh toán kết hợp nhiều phương thức:** Bật chế độ "Chia thanh toán" → nhập từng phần cho mỗi phương thức.

Nhấn **Thanh toán** (hoặc **F12**) để xác nhận đơn.

---

## V. In hóa đơn

Sau khi thanh toán thành công, hộp thoại **In hóa đơn** xuất hiện tự động.

- Click **In** để in ngay
- Click **Bỏ qua** nếu không cần in
- Bật **In tự động** (icon máy in trên thanh công cụ) để in mà không cần xác nhận mỗi lần

---

## VI. Trả hàng

Để xử lý đơn trả hàng:

1. Click **Trả hàng** trên thanh công cụ (hoặc chọn từ menu ⋮ → "Tìm đơn trả hàng")
2. Tìm hóa đơn gốc theo số đơn hoặc tên khách
3. Chọn sản phẩm cần trả và số lượng
4. Xác nhận → tồn kho được cộng lại tự động`,
  },

  'goods-search': {
    id: 'goods-search',
    categoryId: 'inventory',
    title: 'Tra cứu sản phẩm',
    sections: [
      { id: 'intro', title: 'I. Vào trang Hàng hóa' },
      { id: 'search', title: 'II. Tìm kiếm' },
      { id: 'filter', title: 'III. Bộ lọc sidebar' },
      { id: 'view', title: 'IV. Chế độ xem' },
      { id: 'detail', title: 'V. Xem chi tiết sản phẩm' },
    ],
    content: `## I. Vào trang Hàng hóa

Click **HÀNG HÓA** trên thanh điều hướng. Trang gồm:
- **Sidebar trái**: bộ lọc nâng cao
- **Vùng giữa**: danh sách sản phẩm
- **Toolbar trên**: tìm kiếm + thao tác nhanh

---

## II. Tìm kiếm

Ô tìm kiếm ở toolbar trên: gõ **tên sản phẩm**, **mã SKU**, hoặc **mã vạch** để lọc tức thì.

Kết quả hiển thị số lượng phù hợp ở góc trái toolbar: **"X / Y sản phẩm"**.

---

## III. Bộ lọc sidebar

Sidebar bên trái có các nhóm lọc:

| Bộ lọc | Chức năng |
|---|---|
| **Nhóm hàng** | Lọc theo cây danh mục sản phẩm |
| **Tồn kho** | Còn hàng / Hết hàng / Sắp hết |
| **Thương hiệu** | Lọc theo brand |
| **Vị trí** | Lọc theo khu vực lưu kho |
| **Thuộc tính** | Màu sắc, kích cỡ, chất liệu... |
| **Nhà cung cấp** | Lọc theo NCC đã nhập hàng |

Có thể kết hợp nhiều bộ lọc cùng lúc. Nút **Xóa bộ lọc** ở cuối sidebar để reset toàn bộ.

> **Lưu ý**: Số trong ngoặc cạnh mỗi giá trị lọc là số sản phẩm thuộc nhóm đó.

---

## IV. Chế độ xem

Góc phải toolbar có 2 chế độ:

- **Dạng bảng** (mặc định) — xem nhiều thông tin: mã, tên, giá, tồn kho, nhóm hàng
- **Dạng lưới** — xem ảnh sản phẩm, phù hợp khi cần nhận diện bằng hình ảnh

Trong dạng bảng, click **biểu tượng cột** (góc phải) để ẩn/hiện các cột không cần thiết.

---

## V. Xem chi tiết sản phẩm

Click vào **tên sản phẩm** để mở panel chi tiết bên phải. Panel có các tab:

- **Thông tin** — tên, mã SKU, giá bán, giá vốn, nhóm hàng, thuộc tính
- **Mô tả** — mô tả chi tiết, hình ảnh
- **Đơn vị** — đơn vị tính và quy đổi
- **Bảo hành** — chính sách bảo hành sản phẩm
- **Kênh bán** — liên kết với website / Shopee`,
  },

  'goods-adjust': {
    id: 'goods-adjust',
    categoryId: 'inventory',
    title: 'Điều chỉnh tồn kho',
    sections: [
      { id: 'tabs', title: 'I. Các tab trong Hàng hóa' },
      { id: 'audit', title: 'II. Kiểm kê tồn kho' },
      { id: 'audit-history', title: 'III. Lịch sử kiểm kho' },
      { id: 'purchase', title: 'IV. Nhập hàng' },
      { id: 'labels', title: 'V. In tem mã hàng' },
    ],
    content: `## I. Các tab trong Hàng hóa

Trang Hàng hóa có thanh tab phụ ngay dưới toolbar chính:

| Tab | Chức năng |
|---|---|
| **Hàng hóa** | Danh sách sản phẩm, tìm kiếm, lọc |
| **Nhập hàng** | Tạo phiếu nhập từ nhà cung cấp |
| **Kiểm kho** | Kiểm kê và cân bằng tồn kho |
| **Bảng giá** | Thiết lập giá bán theo nhóm / kỳ |
| **Bảo hành** | Quản lý sản phẩm đang sửa chữa |

---

## II. Kiểm kê tồn kho

Vào tab **Kiểm kho** để đối chiếu tồn kho thực tế với số liệu trong hệ thống.

**Các bước thực hiện kiểm kê:**

1. Click **Tạo phiếu kiểm kho**
2. Lọc theo nhóm hàng nếu muốn kiểm một phần kho
3. Với mỗi sản phẩm, nhập **Tồn thực tế** vào cột bên phải
4. Hệ thống tự tính **Chênh lệch** = Tồn thực tế − Tồn hệ thống
5. Click **Hoàn thành kiểm kho** để lưu và cân bằng số liệu

> **Lưu ý**: Sau khi hoàn thành, tồn kho trong hệ thống sẽ được **cập nhật theo số thực tế**. Thao tác này không thể hoàn tác.

**Chế độ kiểm hàng hỏng:** Dùng khi cần ghi nhận hàng hư hỏng riêng mà không ảnh hưởng số liệu kiểm kê chính.

---

## III. Lịch sử kiểm kho

Bên dưới form kiểm kê có bảng **Lịch sử kiểm kho**. Mỗi phiếu hiển thị:
- Mã phiếu (click để xem chi tiết)
- Ngày kiểm
- Tổng chênh lệch (số lượng)
- Trạng thái: **Đã cân bằng**

---

## IV. Nhập hàng

Vào tab **Nhập hàng** để tạo phiếu nhập từ nhà cung cấp. Tồn kho được cộng tự động sau khi xác nhận phiếu nhập.

Xem hướng dẫn chi tiết tại bài: **Tạo đơn nhập hàng** (mục Mua hàng).

---

## V. In tem mã hàng

Trong danh sách sản phẩm (tab Hàng hóa):

1. Tích chọn một hoặc nhiều sản phẩm (checkbox đầu dòng)
2. Toolbar chuyển sang chế độ **Đã chọn X sản phẩm**
3. Click **In tem** → chọn số lượng tem mỗi sản phẩm
4. Trang in xuất hiện với tem 3 cột, định dạng A4

Mỗi tem in gồm: tên sản phẩm, mã vạch / mã SKU, giá bán.`,
  },

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
