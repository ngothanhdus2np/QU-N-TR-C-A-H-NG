-- 2026-08-20: Mã nhân viên hiển thị dạng NV001, NV002... tự tăng (khác id UUID nội bộ).
-- types.ts khai báo field employeeCode?: string, apiService.ts luôn gửi employee_code trong
-- payload tạo/sửa nhân sự — thiếu cột này sẽ khiến PostgREST chặn toàn bộ payload (như
-- bugfix cột email ở 037_employees_email_column.sql), nên phải chạy trước khi deploy code.
ALTER TABLE employees ADD COLUMN IF NOT EXISTS employee_code TEXT;
