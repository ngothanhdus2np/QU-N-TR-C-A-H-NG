-- =============================================================================
-- 021 — Fix POS-SALES-01 (audit 2026-07-02)
-- =============================================================================
-- Triệu chứng: mọi đơn bán/trả POS ghi doanh số nhân viên THẤT BẠI âm thầm
-- (autoUpsertStaffSalesForDate) → console/UI hiện "LỖI ĐỒNG BỘ" sau mỗi đơn dù
-- đơn đã lưu OK → thu ngân dễ tưởng lỗi, bán lại → ĐƠN TRÙNG.
--
-- 2 nguyên nhân schema:
--   1. `sales_records.id` là UUID, nhưng code sinh id chuỗi tất định
--      `pos-sales-<date>-<employeeId>` (idempotent upsert theo ngày+NV) → 22P02.
--   2. FK `employee_id → employees(id)` chặn người bán KHÔNG nằm trong roster
--      nhân viên (vd chủ/admin đăng nhập bán hàng) → 23503. Trong khi
--      `pos_orders.staff_id` vốn là TEXT tự do KHÔNG ràng FK → schema lệch nhau.
--
-- Cách sửa (khớp lại với mô hình dữ liệu code + pos_orders): id → TEXT,
-- gỡ FK employee_id (giữ cột employee_id dạng text tự do, có index để lọc).
-- Dữ liệu cũ (150 dòng UUID) vẫn hợp lệ vì UUID là TEXT hợp lệ.
-- =============================================================================

-- 1) Gỡ FK cứng employee_id (cho phép người bán ngoài roster, đồng bộ pos_orders.staff_id)
ALTER TABLE sales_records DROP CONSTRAINT IF EXISTS sales_records_employee_id_fkey;

-- 2) Đổi kiểu id UUID → TEXT + bỏ default gen_random_uuid (code luôn tự cấp id)
ALTER TABLE sales_records ALTER COLUMN id DROP DEFAULT;
ALTER TABLE sales_records ALTER COLUMN id TYPE TEXT USING id::TEXT;

-- 3) Index tra cứu theo (employee_id, date) — dùng cho báo cáo doanh số/lương
CREATE INDEX IF NOT EXISTS idx_sales_records_emp_date ON sales_records (employee_id, date);
