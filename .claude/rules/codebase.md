# Quy tắc codebase CFO Brain 4.0

Các quy tắc này áp dụng cho mọi thay đổi trong project. Đây là phiên bản cô đọng từ CLAUDE.md section 8.

## Bất di bất dịch (KHÔNG được vi phạm)

- **KHÔNG xóa** merge logic trong `services/dataMapper.ts` — đây là offline-first fallback
- **KHÔNG hardcode** secrets — chỉ dùng `.env.local`, không commit file này
- **KHÔNG thêm** `updated_at`/`created_at` vào Supabase payload nếu bảng không có cột đó
- **KHÔNG bỏ qua** `requireAuth` middleware cho API routes mutate data
- **KHÔNG dùng** `dangerouslySetInnerHTML` mà không wrap bằng `DOMPurify.sanitize()`

## ID và dữ liệu

- Dùng `crypto.randomUUID()` hoặc `generateId()` cho mọi ID mới
- `SupplierDebtRecord`: transaction model (purchase/payment), không dùng snapshot
- Tài chính/lương thay đổi → phải ghi `auditLog()` vào bảng `audit_logs`

## Tests

- Sau mỗi thay đổi `businessLogic.ts` → chạy `npm test`, 43 tests phải pass
- Không sửa test để match behavior sai — sửa source code

## Supabase

- Bảng mới/cột mới: viết SQL vào `supabase_setup.sql`, chạy thủ công trên dashboard
- Limit query: tối đa 2000 rows, time-series tables order by `date desc`
- Dùng `fetchTablePage()` nếu cần load thêm

## AI / Claude API

- Mọi Claude API call phải đi qua backend route `routes/ai.ts` — không gọi từ frontend
- `ANTHROPIC_API_KEY` chỉ tồn tại server-side trong `.env.local`
- Model mapping: quick tasks → `claude-haiku-4-5`, analysis → `claude-sonnet-4-6`

## Env vars

- Frontend: prefix `VITE_` (vd: `VITE_SUPABASE_URL`)
- Backend: không prefix (vd: `SUPABASE_URL`, `ANTHROPIC_API_KEY`)
