# 🛡️ PROJECT CHARTER & AGENT INSTRUCTIONS (HIẾN PHÁP DỰ ÁN)

File này là **Tôn chỉ tuyệt đối** cho mọi hoạt động bảo trì, sửa lỗi và nâng cấp ứng dụng **CFO Brain**. Mọi thay đổi mã nguồn phải tuân thủ nghiêm ngặt các quy định dưới đây.

---

## 🎨 1. DESIGN SYSTEM (BỘ NHẬN DIỆN THƯƠNG HIỆU)

### Màu sắc chủ đạo (Primary Palette)
- **Background chính:** `#f8fafc` (Slate 50).
- **Màu nhấn (Accent):** `#6366f1` (Indigo 500) cho các trạng thái Active, Focus.
- **Màu chữ/Nút chính:** `#0f172a` (Slate 950) - tạo cảm giác chuyên nghiệp, cứng cáp.
- **Bảng màu trạng thái:**
    - Lãi: `text-emerald-600`
    - Lỗ: `text-rose-600`
    - Cảnh báo: `text-amber-600`

### Typography & Layout
- **Font:** Inter (Sans-serif).
- **Layout:** Sidebar cố định bên trái, Header chứa các bộ lọc thông minh (Time Intelligence), Content cuộn độc lập.
- **Bo góc (Border Radius):** `0.75rem` (12px) thống nhất cho Input, Button, Card.
- **Shadow:** Sử dụng shadow nhẹ `shadow-sm` hoặc `shadow-md` cho Card, không dùng shadow quá đậm.

---

## ⚙️ 2. CORE LOGIC (LOGIC NGHIỆP VỤ CỐT LÕI)

### Đồng bộ hóa (Sync Strategy)
- **Cơ chế:** Optimistic Updates với LocalStorage fallback. Trình duyệt lưu dữ liệu tại `cfo_brain_local_data`.
- **Nghiêm cấm:** Không bao giờ được xóa cơ chế gộp dữ liệu (Merge logic) trong `dataMapper.ts`. 
- **Tôn chỉ:** Dữ liệu Cloud là "Sự thật cuối cùng", nhưng LocalData là "Bảo hiểm" để người dùng không mất việc khi mất mạng.

### Quản lý Doanh thu (Revenue Management)
- **Validation:** Bắt buộc sử dụng logic Audit để phát hiện xung đột dữ liệu khi tải Excel.
- **Surgical Update:** Sử dụng `onUpdateSurgical` để đẩy bù các thay đổi nhỏ, tránh tải toàn bộ database gây quá tải (đặc biệt cho Shopee Ledger).

### Quản lý Nhân sự & Lương (HR & Payroll)
- **Top-Down Range Matching:** Bậc lương được tính theo thâm niên tính đến ngày 15 hàng tháng.
- **Lương trách nhiệm:** Chỉ được tính khi có `responsibilityApprovals`. Không tự ý thay đổi logic Pro-rated lương theo ngày công.

---

## 🗄️ 3. DATABASE SCHEMA (CẤU TRÚC DỮ LIỆU)

### Quy định về Field
- **Nghiêm cấm:** Không tự ý chèn các trường `updated_at`, `created_at` vào payload gửi lên Supabase nếu bảng đó không được định nghĩa sẵn cột này (đã gây lỗi ngắt kết nối trước đây).
- **ID:** Luôn sử dụng UUID được tạo bởi `crypto.randomUUID()` hoặc helper `generateId()`.

---

## 🚀 4. QUY TRÌNH BAO TRÌ (MAINTENANCE PROCESS)

1. **Kiểm tra Schema:** Trước khi thêm cột mới vào UI, phải đối chiếu với `supabase_setup.sql`.
2. **Offline-First:** Đảm bảo App vẫn có thể mở và xem dữ liệu lịch sử ngay cả khi ngắt kết nối Supabase hoàn toàn.
3. **Hiệu năng:** Các bảng dữ liệu (Table) trong App phải hỗ trợ ảo hóa hoặc cuộn mượt (No-scrollbar) để xử lý hàng nghìn dòng bản ghi.

---
**Ghi chú:** Bản hiến pháp này cần được cập nhật ngay khi bổ sung tính năng lớn hoặc thay đổi cơ sở dữ liệu.
