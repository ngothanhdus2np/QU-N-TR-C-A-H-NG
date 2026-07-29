interface HelpSection {
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
      { id: 'tong-quan-giao-dien', title: 'I. Tổng quan giao diện' },
      { id: 'tim-kiem-hang-hoa', title: 'II. Tìm kiếm hàng hóa' },
      { id: 'tab-hoa-don', title: 'III. Tab hóa đơn' },
      { id: 'gio-hang', title: 'IV. Giỏ hàng' },
      { id: 'menu-tuy-chon', title: 'V. Menu tùy chọn' },
    ],
    content: `## I. Tổng quan giao diện

Click nút **BÁN HÀNG** màu đỏ ở góc trên phải → màn hình bán hàng mở ra toàn bộ.

![Màn hình bán hàng POS khi mới vào — bên trái là tìm kiếm, giữa là giỏ hàng, phải là thanh toán](/help/images/pos-intro/01-overview.jpg)

Giao diện gồm 3 vùng chính:

| Vùng | Vị trí | Làm gì |
|---|---|---|
| **Tìm kiếm** | Trên cùng bên trái | Gõ tên/mã hàng, kết quả xuất hiện bên dưới |
| **Giỏ hàng** | Khu vực giữa | Danh sách hàng đã thêm, số lượng, giá |
| **Thanh toán** | Bên phải | Chọn khách, chọn phương thức, nhấn thanh toán |

---

## II. Tìm kiếm hàng hóa

**Bước 1** — Nhấp vào ô tìm kiếm ở phía trên bên trái, hoặc nhấn phím **F3** để focus nhanh.

![Ô tìm kiếm hàng hóa — nhấp vào đây hoặc nhấn F3](/help/images/pos-intro/02-searchbox.jpg)

**Bước 2** — Gõ tên sản phẩm, mã SKU, hoặc quét mã vạch. Danh sách kết quả hiện ra ngay bên dưới.

![Kết quả tìm kiếm hiện ra bên dưới ô nhập — dùng ↑↓ để di chuyển](/help/images/pos-intro/03-results.jpg)

**Bước 3** — Nhấn **Enter** hoặc click vào sản phẩm để thêm vào giỏ. Sản phẩm xuất hiện ngay trong giỏ hàng.

![Sản phẩm đã được thêm vào giỏ hàng](/help/images/pos-intro/04-cart.jpg)

> Khi đang ở chế độ Trả hàng, ô tìm kiếm chính bị khóa — dùng ô tìm kiếm riêng trong panel trả hàng.

---

## III. Tab hóa đơn

Hệ thống cho phép mở **nhiều hóa đơn cùng lúc**. Mỗi tab là một đơn hàng riêng biệt, không ảnh hưởng nhau.

![Thanh tab hóa đơn — tab đang chọn được tô đậm và gạch đỏ bên dưới](/help/images/pos-intro/05-tabs.jpg)

- Click **+** ở cuối thanh tab để mở hóa đơn mới
- Click **×** trên một tab để đóng hóa đơn đó (hàng trong giỏ sẽ bị xóa)
- Tab hiện tại có trạng thái: **Đang bán** hoặc **Đang trả hàng**

---

## IV. Giỏ hàng

Mỗi dòng trong giỏ hiển thị: tên hàng · mã SKU · số lượng · đơn giá · thành tiền.

**Chỉnh số lượng** — click trực tiếp vào con số, gõ số mới, nhấn Enter để xác nhận.

![Click vào số lượng để sửa trực tiếp không cần mở popup](/help/images/pos-intro/06-qty.jpg)

Các thao tác khác trên từng dòng:
- Click biểu tượng **%** → nhập giảm giá riêng cho sản phẩm đó (% hoặc tiền)
- Click **×** → xóa sản phẩm khỏi giỏ

---

## V. Menu tùy chọn

Click biểu tượng **lưới** hoặc **⋮** trên thanh toolbar để mở menu thêm.

![Menu tùy chọn mở ra — truy cập báo cáo cuối ngày, phím tắt, QR điện thoại](/help/images/pos-intro/07-menu.jpg)

- **Báo cáo cuối ngày** — tổng kết doanh thu, số đơn trong ca làm việc
- **Xử lý đơn đặt hàng** — quản lý đơn đặt trước chưa hoàn tất
- **Xử lý sửa chữa** — theo dõi sản phẩm đang bảo hành / sửa chữa
- **Phím tắt** — xem bảng phím tắt bàn phím đầy đủ
- **QR điện thoại** — mở màn hình bán hàng nhanh trên điện thoại`,
  },

  'pos-create-order': {
    id: 'pos-create-order',
    categoryId: 'sales',
    title: 'Tạo đơn và thanh toán',
    sections: [
      { id: 'them-san-pham', title: 'I. Thêm sản phẩm' },
      { id: 'chon-khach-hang', title: 'II. Chọn khách hàng' },
      { id: 'giam-gia', title: 'III. Giảm giá' },
      { id: 'thanh-toan', title: 'IV. Thanh toán' },
      { id: 'in-hoa-don', title: 'V. In hóa đơn' },
      { id: 'tra-hang', title: 'VI. Trả hàng' },
    ],
    content: `## I. Thêm sản phẩm

**Bước 1** — Nhấp vào ô tìm kiếm ở phía trên bên trái (hoặc nhấn **F3**).

![Nhấp vào ô tìm kiếm — viền đỏ chỉ đúng vị trí cần click](/help/images/pos-create-order/01-search-highlight.jpg)

**Bước 2** — Gõ tên, mã SKU, hoặc quét mã vạch. Danh sách khớp hiện ngay bên dưới.

![Danh sách kết quả — mỗi dòng hiện tên, giá và tồn kho hiện tại](/help/images/pos-create-order/02-results.jpg)

**Bước 3** — Nhấn **Enter** hoặc click vào sản phẩm muốn thêm. Lặp lại để thêm nhiều loại.

![Giỏ hàng sau khi thêm sản phẩm — số lượng, đơn giá, thành tiền hiện rõ từng dòng](/help/images/pos-create-order/03-cart.jpg)

> **Quét mã vạch:** Kết nối máy quét USB, đặt con trỏ vào ô tìm kiếm rồi quét — sản phẩm tự thêm vào giỏ, không cần nhấn thêm phím nào.

---

## II. Chọn khách hàng

Ô **Tìm khách hàng** nằm ở panel bên phải. Để trống nếu bán lẻ không cần ghi tên.

**Bước 1** — Nhấp vào ô tìm khách (hoặc nhấn **F4**).

![Ô tìm khách hàng ở panel bên phải — click vào đây](/help/images/pos-create-order/05-customer-highlight.jpg)

**Bước 2** — Gõ tên hoặc số điện thoại → danh sách gợi ý xuất hiện. Nhấp để chọn.

![Kết quả tìm kiếm khách — hiển thị tên, điện thoại, hạng thành viên](/help/images/pos-create-order/06-customer-results.jpg)

- Chưa có khách trong hệ thống → click **+ Thêm khách nhanh** ngay trong dropdown
- Đã chọn nhầm → click **×** cạnh tên khách để bỏ chọn
- Khi chọn khách có hạng thành viên, chiết khấu được áp tự động

---

## III. Giảm giá

**Giảm giá theo hóa đơn** — nhập % chiết khấu ở ô bên dưới tổng tiền.

![Ô chiết khấu hóa đơn ở panel thanh toán bên phải](/help/images/pos-create-order/07-discount.jpg)

**Giảm giá theo từng sản phẩm** — click biểu tượng **%** cạnh dòng sản phẩm trong giỏ → nhập giá trị giảm bằng % hoặc số tiền cụ thể.

> Hai loại giảm giá có thể áp dụng đồng thời. Số tiền tiết kiệm được tổng hợp ở phần **Tổng cộng**.

---

## IV. Thanh toán

**Bước 1** — Chọn phương thức thanh toán ở panel bên phải.

![Panel thanh toán — chọn Tiền mặt, Chuyển khoản, Momo hoặc Thẻ](/help/images/pos-create-order/08-payment.jpg)

| Phương thức | Hệ thống làm gì |
|---|---|
| **Tiền mặt** | Nhập tiền khách đưa → tự tính tiền thối |
| **Chuyển khoản** | Hiện mã QR VietQR theo đúng số tiền |
| **Momo / Thẻ** | Ghi nhận phương thức, không cần nhập thêm |

**Bước 2** — Nhấn nút **Thanh toán** (hoặc phím **F12**) để hoàn tất đơn.

![Nút Thanh toán — nhấn ở đây hoặc dùng phím F12](/help/images/pos-create-order/09-pay-btn.jpg)

**Thanh toán chuyển khoản** → mã QR VietQR xuất hiện ngay, khách quét bằng app ngân hàng bất kỳ.

![Mã QR VietQR hiện theo đúng số tiền cần thanh toán](/help/images/pos-create-order/10-bank-qr.jpg)

> **Thanh toán kết hợp:** Bật "Chia thanh toán" → nhập từng phần cho mỗi phương thức. Hệ thống cộng lại và báo còn thiếu bao nhiêu.

---

## V. In hóa đơn

Sau khi nhấn Thanh toán thành công, hộp thoại **In hóa đơn** tự mở ra.

- Click **In** để in ngay qua máy in nhiệt / A4
- Click **Bỏ qua** nếu không cần in lần này
- Bật **In tự động** (icon máy in trên toolbar) để bỏ qua hộp thoại xác nhận mỗi lần

---

## VI. Trả hàng

**Bước 1** — Click nút **Trả hàng** trên toolbar (hoặc vào menu ⋮ → "Tìm đơn trả hàng").

**Bước 2** — Tìm hóa đơn gốc bằng số đơn hoặc tên khách.

**Bước 3** — Tích chọn sản phẩm cần trả và nhập số lượng trả.

**Bước 4** — Xác nhận → tồn kho tự động được cộng lại, công nợ điều chỉnh nếu có.`,
  },

  'goods-search': {
    id: 'goods-search',
    categoryId: 'inventory',
    title: 'Tra cứu sản phẩm',
    sections: [
      { id: 'vao-trang', title: 'I. Vào trang Hàng hóa' },
      { id: 'tim-kiem', title: 'II. Tìm kiếm' },
      { id: 'bo-loc', title: 'III. Bộ lọc sidebar' },
      { id: 'che-do-xem', title: 'IV. Chế độ xem' },
      { id: 'chi-tiet', title: 'V. Xem chi tiết sản phẩm' },
    ],
    content: `## I. Vào trang Hàng hóa

Click **HÀNG HÓA** trên thanh điều hướng phía trên. Trang danh sách hàng hóa hiện ra với 3 khu vực:

![Toàn trang danh sách hàng hóa — sidebar lọc bên trái, danh sách ở giữa, toolbar bên trên](/help/images/goods-search/01-list.jpg)

- **Sidebar trái** — bộ lọc theo nhóm hàng, tồn kho, thương hiệu, nhà cung cấp
- **Vùng giữa** — bảng danh sách sản phẩm
- **Toolbar trên** — ô tìm kiếm, nút thêm mới, chuyển chế độ xem

---

## II. Tìm kiếm

**Bước 1** — Nhấp vào ô tìm kiếm trên toolbar.

![Ô tìm kiếm trên toolbar — gõ tên, mã SKU hoặc mã vạch để lọc](/help/images/goods-search/02-searchbox.jpg)

**Bước 2** — Gõ từ khóa (tên sản phẩm, mã SKU, hoặc mã vạch). Danh sách lọc ngay tức thì, không cần nhấn Enter.

![Kết quả sau khi gõ từ khóa — số lượng khớp hiển thị ở góc toolbar](/help/images/goods-search/03-filtered.jpg)

> Góc trái toolbar hiện **"X / Y sản phẩm"** — X là số đang hiện, Y là tổng kho.

---

## III. Bộ lọc sidebar

Sidebar bên trái cho phép lọc kết hợp nhiều tiêu chí cùng lúc.

![Sidebar bộ lọc — nhấp vào nhóm để mở rộng và tick chọn giá trị lọc](/help/images/goods-search/04-sidebar.jpg)

| Nhóm lọc | Dùng khi nào |
|---|---|
| **Nhóm hàng** | Xem hàng thuộc một danh mục cụ thể |
| **Tồn kho** | Tìm hàng sắp hết / đã hết để nhập thêm |
| **Thương hiệu** | Lọc theo brand |
| **Nhà cung cấp** | Xem hàng nhập từ NCC cụ thể |

Sau khi tick chọn một nhóm, danh sách tự thu hẹp lại ngay.

![Danh sách đã lọc theo nhóm hàng — số sản phẩm giảm xuống, dễ tìm hơn](/help/images/goods-search/05-filter-active.jpg)

Nhấn **Xóa bộ lọc** ở cuối sidebar để bỏ toàn bộ điều kiện lọc.

---

## IV. Chế độ xem

Góc phải toolbar có 2 nút chuyển chế độ xem.

**Dạng bảng** (mặc định) — hiện đầy đủ cột: mã hàng, tên, giá bán, giá vốn, tồn kho, nhóm hàng.

**Dạng lưới** — mỗi sản phẩm là một ô ảnh, phù hợp nhận diện bằng hình.

![Chế độ xem dạng lưới — nhìn ảnh sản phẩm dễ nhận biết hơn bảng chữ](/help/images/goods-search/06-grid.jpg)

> Trong dạng bảng: click biểu tượng cột ở góc phải bảng để ẩn/hiện các cột không cần.

---

## V. Xem chi tiết sản phẩm

**Bước 1** — Click vào bất kỳ dòng sản phẩm nào trong bảng.

**Bước 2** — Panel chi tiết trượt ra từ bên phải.

![Panel chi tiết sản phẩm — hiện đầy đủ thông tin, ảnh, đơn vị, bảo hành](/help/images/goods-search/07-detail.jpg)

Panel gồm các tab:
- **Thông tin** — tên, mã SKU, giá bán, giá vốn, nhóm hàng, thuộc tính
- **Mô tả** — nội dung mô tả sản phẩm, thư viện ảnh
- **Đơn vị** — đơn vị tính và quy đổi (hộp/cái, kg/g...)
- **Bảo hành** — chính sách và thời hạn bảo hành
- **Kênh bán** — liên kết đồng bộ với website / Shopee`,
  },

  'goods-adjust': {
    id: 'goods-adjust',
    categoryId: 'inventory',
    title: 'Điều chỉnh tồn kho',
    sections: [
      { id: 'cac-tab', title: 'I. Các tab trong Hàng hóa' },
      { id: 'kiem-ke', title: 'II. Kiểm kê tồn kho' },
      { id: 'lich-su-kiem-kho', title: 'III. Lịch sử kiểm kho' },
      { id: 'nhap-hang', title: 'IV. Nhập hàng' },
      { id: 'in-tem', title: 'V. In tem mã hàng' },
    ],
    content: `## I. Các tab trong Hàng hóa

Trang Hàng hóa có thanh tab phụ ngay dưới toolbar — mỗi tab là một chức năng riêng biệt.

![Trang hàng hóa với thanh tab phụ — Hàng hóa, Nhập hàng, Kiểm kho, Bảng giá, Bảo hành](/help/images/goods-adjust/01-overview.jpg)

| Tab | Dùng để làm gì |
|---|---|
| **Hàng hóa** | Xem danh sách, tìm kiếm, lọc sản phẩm |
| **Nhập hàng** | Tạo và quản lý phiếu nhập từ nhà cung cấp |
| **Kiểm kho** | Đối chiếu và cân bằng số lượng tồn kho |
| **Bảng giá** | Thiết lập giá bán theo nhóm khách hoặc theo kỳ |
| **Bảo hành** | Theo dõi sản phẩm đang gửi sửa chữa |

---

## II. Kiểm kê tồn kho

Kiểm kê dùng để đối chiếu **số lượng thực tế trong kho** với **số liệu hệ thống đang ghi nhận**.

**Bước 1** — Click vào tab **Kiểm kho** trên thanh tab phụ.

![Tab Kiểm kho được highlight — click vào đây để vào chức năng kiểm kê](/help/images/goods-adjust/02-audit-highlight.jpg)

**Bước 2** — Trang Kiểm kho hiện ra với danh sách sản phẩm và tồn kho hệ thống.

![Trang Kiểm kho — cột bên phải để nhập số lượng thực tế đếm được](/help/images/goods-adjust/03-audit.jpg)

**Bước 3** — Click **Tạo phiếu kiểm kho** để bắt đầu.

![Nút Tạo phiếu kiểm kho — click để mở form nhập số lượng thực tế](/help/images/goods-adjust/04-audit-create-btn.jpg)

**Bước 4** — Điền cột **Tồn thực tế** theo từng sản phẩm đếm được trong kho. Hệ thống tự tính chênh lệch.

**Bước 5** — Click **Hoàn thành kiểm kho** → tồn kho hệ thống được cập nhật theo số thực tế.

> **Quan trọng:** Sau khi hoàn thành không thể hoàn tác. Kiểm tra kỹ trước khi xác nhận.

---

## III. Lịch sử kiểm kho

Bên dưới form kiểm kê có bảng **Lịch sử kiểm kho** ghi lại toàn bộ lần kiểm trước đó.

Mỗi phiếu hiển thị: mã phiếu · ngày kiểm · tổng chênh lệch · trạng thái **Đã cân bằng**. Click vào mã phiếu để xem chi tiết từng sản phẩm trong lần kiểm đó.

---

## IV. Nhập hàng

**Bước 1** — Click vào tab **Nhập hàng**.

![Tab Nhập hàng được highlight — click vào đây để xem phiếu nhập](/help/images/goods-adjust/05-purchase-highlight.jpg)

**Bước 2** — Danh sách phiếu nhập hàng xuất hiện, lọc được theo ngày, nhà cung cấp, trạng thái.

![Trang nhập hàng — danh sách phiếu nhập, mỗi dòng là một lần nhập từ NCC](/help/images/goods-adjust/06-purchase.jpg)

Sau khi xác nhận phiếu nhập, tồn kho tự động được cộng thêm số lượng trong phiếu. Xem hướng dẫn tạo phiếu nhập chi tiết tại bài **Tạo đơn nhập hàng** (mục Mua hàng).

---

## V. In tem mã hàng

Dùng để in tem nhãn dán lên sản phẩm, kệ hàng, hoặc thùng kho.

**Bước 1** — Về tab **Hàng hóa**, tick chọn sản phẩm cần in tem bằng checkbox đầu dòng.

![Tích chọn sản phẩm — toolbar phía trên chuyển sang chế độ "Đã chọn X sản phẩm"](/help/images/goods-adjust/08-label-select.jpg)

**Bước 2** — Toolbar hiện nút **In tem** — click vào để mở cài đặt in.

![Nút In tem xuất hiện khi đã chọn ít nhất 1 sản phẩm](/help/images/goods-adjust/09-label-btn.jpg)

**Bước 3** — Chọn số lượng tem cho mỗi sản phẩm → nhấn **In** → trang in A4 xuất hiện với tem 3 cột.

Mỗi tem gồm: tên sản phẩm · mã vạch / mã SKU · giá bán hiện tại.`,
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
