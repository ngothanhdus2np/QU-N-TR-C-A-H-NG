-- BUGFIX 2026-08-16: employees thiếu cột email (PGRST204) — types.ts khai báo field
-- email?: string và components/StaffManager.tsx (tạo mới + sửa hồ sơ) luôn gửi field này,
-- nhưng cột chưa từng được tạo trên Supabase thật, khiến MỌI lần tạo/sửa nhân sự bị chặn
-- 100% (PostgREST từ chối cả payload) — UI vẫn báo "thành công" (cache offline-first), dữ
-- liệu không hề vào DB, mất vĩnh viễn nếu xoá cache trình duyệt.
ALTER TABLE employees ADD COLUMN IF NOT EXISTS email TEXT;
