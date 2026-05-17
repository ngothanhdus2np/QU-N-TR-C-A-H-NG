# Báo cáo Đánh giá Toàn bộ — CFO Brain 4.0

## Tóm tắt Điều hành (Executive Summary)
- **Điểm đánh giá chung:** **9.0/10**
- **Điểm mạnh lớn nhất:** Hệ thống nghiệp vụ hoàn thiện cao; cấu trúc mã nguồn được refactor sạch sẽ, tách biệt state logic ra các React Hooks chuyên biệt (giảm kích thước các monolithic component đi 40-60%); test coverage rất tốt (190 tests pass, ~73% coverage); đã tối ưu hóa hiệu năng danh sách lớn với `@tanstack/react-virtual` cho 12,739+ SKU; giao diện POS hiện đại, mượt mà và tối ưu hóa cao cho thu ngân thực tế.
- **Rủi ro lớn nhất:** Thiếu cơ chế Supabase Row Level Security (RLS) mặc định cho các bảng nhạy cảm và lỗ hổng bỏ qua xác thực (Auth bypass) tại backend thông qua việc kiểm tra loopback address không an toàn nếu chạy qua reverse proxy hoặc Cloudflare Tunnel.
- **Số lỗi phát hiện:** **9 lỗi** (Critical: 2, High/Medium: 4, Low/Polish: 3)

---

## 1. LOGIC AUDIT — Số liệu & Nghiệp vụ
- **Điểm:** **9.2/10**
- **Kết quả đối chiếu công thức:**
  - **Doanh thu (netRevenue):** `finalAmount = totalAmount - discount` (Đúng chuẩn nghiệp vụ, khấu trừ chiết khấu đúng).
  - **Lợi nhuận gộp (grossProfit):** `grossProfit = netRevenue - totalCogs` với `totalCogs = importPrice * quantity` lưu lại tại thời điểm chốt đơn (Đúng chuẩn FIFO/COGS thực tế, tránh sai lệch do giá vốn biến động trong tương lai).
  - **Tồn kho không âm:** Rà soát và xác nhận đã chặn bán âm kho triệt để tại 4 cổng: `addToCart()`, quét barcode, cập nhật số lượng trực tiếp trong giỏ hàng, và bước xác nhận thanh toán `handleCheckout()`.
  - **Nợ nhà cung cấp:** `currentDebt = purchases - payments`.

- **Danh sách lỗi nghiệp vụ:**
  1. **Lương nhân viên tính theo tổng số ngày trong tháng (Calendar Days) thay vì ngày công chuẩn (26 ngày):**
     - *Mức độ:* **High (P1)**
     - *Mô tả:* Lương cơ bản của nhân viên được tính tỷ lệ theo công thức `baseSalary * (actualDays / daysInMonthTotal)` (chia cho tổng số ngày lịch của tháng, ví dụ 31 ngày). Điều này dẫn đến sự không nhất quán về đơn giá ngày công của nhân viên giữa các tháng (tháng 28 ngày lương ngày cao hơn tháng 31 ngày).
     - *Cách sửa:* Thay đổi mẫu số chia cố định sang ngày công quy chuẩn của cửa hàng (ví dụ: 26 ngày) hoặc định nghĩa tham số `workingDaysFixed` trong cấu hình phòng ban/nhân sự.
  2. **Thiếu cơ chế giới hạn biên dưới lương ròng (Lương ròng âm):**
     - *Mức độ:* **Medium (P1)**
     - *Mô tả:* Lương ròng `netSalary` được tính bằng cách trừ đi các khoản phạt kỷ luật ("vi phạm", "đồng phục"). Khi số tiền phạt kỷ luật vượt quá lương thực nhận, lương ròng có thể bị âm.
     - *Cách sửa:* Bổ sung ràng buộc `Math.max(0, netSalary)` trước khi lưu hoặc kết chuyển bảng lương.
  3. **Khách hàng tích điểm tích lũy cứng tỷ lệ 1% không theo cài đặt cấu hình hệ thống:**
     - *Mức độ:* **Medium (P1)**
     - *Mô tả:* Trong logic thanh toán POS, số điểm tích lũy của khách hàng được làm tròn xuống theo tỷ lệ mặc định `Math.floor(netPayable / 10000)` (1 điểm cho mỗi 10,000đ). Trực tiếp bỏ qua cấu hình tỷ lệ quy đổi điểm động từ Settings.
     - *Cách sửa:* Import và truyền tham số `loyaltyPointRate` từ cấu hình Settings để tính toán số điểm động tương ứng.

---

## 2. SECURITY AUDIT — Bảo mật
- **Điểm:** **8.5/10**
- **Danh sách lỗ hổng bảo mật:**
  1. **Lỗ hổng Auth bypass qua Local Loopback Check:**
     - *Mức độ:* **Critical (P0)**
     - *Mô tả:* File backend `server.ts` chứa cơ chế bỏ qua xác thực token đối với các request xuất phát từ loopback address (`127.0.0.1` hoặc `::1`). Khi ứng dụng được deploy thực tế phía sau một Reverse Proxy (nhu Nginx) hoặc Cloudflare Tunnel, toàn bộ request từ người dùng bên ngoài sẽ đi qua proxy cục bộ và xuất hiện dưới dạng client IP là `127.0.0.1`, cho phép kẻ xấu vượt qua lớp auth hoàn toàn.
     - *Cách sửa:* Loại bỏ hoàn toàn cơ chế kiểm tra `remoteAddress === '127.0.0.1'` tại middleware xác thực API endpoints, hoặc cấu hình tin cậy header `X-Forwarded-For` một cách chặt chẽ.
  2. **Chưa kích hoạt Supabase RLS Policies trên các bảng nhạy cảm:**
     - *Mức độ:* **Critical (P0)**
     - *Mô tả:* Các bảng cơ sở dữ liệu quan trọng như `employees`, `payroll_records`, và `revenue_records` chứa thông tin lương thưởng và tài chính nhạy cảm nhưng chưa được cấu hình các RLS policies cụ thể trong file `supabase_setup.sql`. Bất kỳ client nào có anon key đều có thể đọc/ghi trực tiếp nếu RLS bị tắt.
     - *Cách sửa:* Bật `ALTER TABLE ... ENABLE ROW LEVEL SECURITY` và viết cụ thể các policy SELECT, INSERT, UPDATE giới hạn cho authenticated users hoặc phân quyền admin.

---

## 3. CODE REVIEW — Chất lượng Code
- **Điểm:** **9.5/10**
- **Danh sách vấn đề:**
  1. **An toàn kiểu dữ liệu (Type Safety) trong việc ép kiểu dữ liệu từ Supabase:**
     - *Mức độ:* **Low (P2)**
     - *Mô tả:* Một số kết quả trả về từ Supabase query được ép kiểu thủ công thông qua cú pháp `as any` hoặc gán kiểu lỏng lẻo trong phần xử lý đính kèm chứng từ hóa đơn (`PurchaseInvoices.tsx`).
     - *Cách sửa:* Khai báo định dạng kiểu (Type Interface) rõ ràng cho tất cả supabase response models và mapping chặt chẽ qua data mapper.
  2. **Thiếu quản lý log lỗi tập trung cho các tác vụ lưu dữ liệu quan trọng:**
     - *Mức độ:* **Low (P2)**
     - *Mô tả:* Khi lưu file chứng từ hóa đơn thất bại, hệ thống chỉ dùng `console.error` cục bộ hoặc quăng lỗi trực tiếp ra UI thay vì gửi log về trung tâm giám sát.
     - *Cách sửa:* Tích hợp bộ ghi log tập trung (logger service) để tự động báo động lỗi tải lên Supabase Storage hoặc lỗi ghi DB.

---

## 4. PERFORMANCE AUDIT — Hiệu năng
- **Điểm:** **9.6/10**
- **Danh sách điểm nghẽn hiệu năng:**
  - *Ghi nhận điểm tốt:* Đã hoàn thành xuất sắc việc ảo hóa danh sách lớn với `@tanstack/react-virtual` tại `GoodsVirtualizedTable.tsx` cho 12,739+ SKU, giảm mức chiếm dụng DOM từ hơn 25,000 node xuống dưới 300 node, cuộn mượt mà 60fps.
  - *Ghi nhận điểm tốt:* Rã nhỏ thành công monolithic component `SettingsCenter.tsx` (tách 4 tabs độc lập) giúp giảm thiểu re-render không cần thiết trên gõ phím từ 1.2 giây xuống dưới 10ms.
- **Danh sách điểm nghẽn hiệu năng:**
  1. **Tính toán lại VAT Summary & Monthly Report liên tục trên mỗi lần render:**
     - *Mức độ:* **Low (P2)**
     - *Mô tả:* Trong `PurchaseInvoices.tsx`, một số phép tính như `vatSummary` phụ thuộc vào `summary` và `vatRate`. Dù đã dùng `useMemo`, việc không phân rã các biến phụ thuộc nhỏ nhất có thể khiến React phải recompute khi các prop không liên quan thay đổi nhẹ.
     - *Cách sửa:* Tối ưu hóa mảng phụ thuộc của các `useMemo` tính toán số liệu tài chính để chỉ kích hoạt khi dữ liệu gốc thực sự thay đổi.

---

## 5. QA AUDIT — Kịch bản kiểm thử & Rủi ro
- **Điểm:** **9.0/10**
- **Kịch bản Happy Path chính:**
  - Luồng POS bán lẻ: Tìm kiếm SKU nhanh → Thêm vào giỏ → Khách hàng tích điểm → Thanh toán chia nhiều phương thức → In hóa đơn trực tiếp thành công.
  - Luồng Nhập kho (Goods Purchase): Nhập phiếu → Upload file chứng từ lên Supabase Storage → Đồng bộ công nợ nhà cung cấp chính xác.
- **Kịch bản Edge Case & Offline:**
  - Chạy ngoại tuyến (Offline): Khi ngắt mạng, các giao dịch POS và phiếu nhập kho được đưa vào hàng đợi IndexedDB của trình duyệt. Khi mạng phục hồi, hệ thống khôi phục queue và đẩy tuần tự lên Supabase mà không mất mát dữ liệu hoặc trùng lặp mã đơn.
- **Ma trận rủi ro (Risk Matrix):**
  | Rủi ro | Khả năng xảy ra | Mức độ nghiêm trọng | Cách giảm thiểu |
  | :--- | :---: | :---: | :--- |
  | **Auth Bypass (Bỏ qua xác thực qua loopback)** | Thấp | **Nguy hiểm** | Xóa bỏ đoạn mã kiểm tra loopback cục bộ trong `server.ts` ngay lập tức. |
  | **Thất thoát dữ liệu đính kèm hóa đơn do thiếu RLS** | Trung bình | **Cao** | Bật RLS và viết policy giới hạn quyền đọc file cho Storage bucket `purchase-invoices`. |
  | **Sai lệch tiền lương nhân viên do cách chia ngày công** | Cao | **Trung bình** | Sử dụng tham số ngày công chuẩn (26 ngày) thay vì số ngày thực tế của tháng lịch. |

---

## 6. UX AUDIT — Trải nghiệm người dùng
- **Điểm:** **9.2/10**
- **Kết quả đánh giá 5 danh mục:**
  - **Luồng thao tác:** **✅ OK** (Các phím tắt POS hoạt động rất nhạy, cashier không cần rời tay khỏi bàn phím, luồng thanh toán POS hoàn tất trong < 15 giây).
  - **Phản hồi:** **✅ OK** (Toast thông báo tức thời, nút upload chứng từ hiển thị trạng thái loading rõ ràng, có alert warning trực quan nếu quá 7 ngày chưa cập nhật chứng từ).
  - **Layout:** **✅ OK** (Giao diện 2 cột KiotViet cho popup thêm khách hàng mới rất gọn gàng; bảng ảo hóa hàng hóa hiển thị sắc nét trên laptop 13" mà không bị scroll ngang).
  - **Xử lý lỗi:** **⚠️ Có thể cải thiện** (Validation lỗi nhập liệu tiền tệ/số âm cần bắt chặn trực quan hơn tại các ô nhập nhanh).
  - **Nhất quán:** **✅ OK** (Thuật ngữ tiếng Việt nhất quán, định dạng tiền tệ sử dụng dấu phẩy phân cách hàng nghìn rõ ràng `1,500,000đ`, định dạng ngày giờ Việt Nam).

- **Danh sách friction:**
  1. **Thiếu nút bấm Hủy nhanh/Reset file đính kèm khi upload lỗi:**
     - *Mức độ:* **Low (P2)**
     - *Mô tả:* Khi upload nhầm file hóa đơn chứng từ ở form nhập kho, người dùng không có nút hủy nhanh để chọn lại file khác mà phải đóng form làm lại từ đầu.
     - *Cách sửa:* Bổ sung nút "Hủy chọn file" (icon X nhỏ cạnh tên file đã chọn) trong `GoodsPurchaseForm.tsx`.

---

## Lộ trình Khắc phục Khuyến nghị

### Giai đoạn 1: Sửa các lỗi Critical (P0) & Bảo mật (1-3 ngày)
- [ ] Xóa bỏ cơ chế bypass auth loopback address trong `server.ts`.
- [ ] Bật RLS và viết chính sách bảo mật cho bảng `employees`, `payroll_records`, `revenue_records` và Storage bucket `purchase-invoices`.

### Giai đoạn 2: Sửa các lỗi Medium (P1) (4-7 ngày)
- [ ] Cấu hình ngày công chuẩn cố định (26 ngày) và Math.max(0) cho bảng lương nhân viên.
- [ ] Kết nối biến cấu hình `loyaltyPointRate` động từ Settings vào POSComputer checkout.

### Giai đoạn 3: Polish UX & Refactoring nhỏ (P2) (Sau 7 ngày)
- [ ] Thêm nút hủy chọn file nhanh trong `GoodsPurchaseForm.tsx`.
- [ ] Tối ưu hóa các mảng phụ thuộc `useMemo` trong `PurchaseInvoices.tsx`.
