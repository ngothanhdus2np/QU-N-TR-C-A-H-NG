# CFO Brain 4.0 — Hệ thống MIS Doanh nghiệp

Hệ thống quản lý thông tin doanh nghiệp tích hợp AI, thiết kế cho cửa hàng bán lẻ Việt Nam. Thay thế KiotViet với AI Agents chuyên biệt theo từng phòng ban.

## Stack

- **Frontend**: React 19 + TypeScript + Vite + Recharts + Framer Motion
- **Backend**: Express.js + Node.js
- **Database**: Supabase (PostgreSQL)
- **AI**: Anthropic Claude API (backend-only)

## Backend routes

- `server.ts` — bootstrap Express, middleware, Supabase, mount routes, start schedulers
- `routes/ai.ts` — AI endpoints `/api/ai/*`
- `routes/facebook.ts` — Facebook OAuth, posting, auto-post config/logs
- `routes/notifications.ts` — EOD report, notifications, alerts
- `routes/import.ts` — KiotViet import/sync

## Chạy local

**Yêu cầu**: Node.js 18+

```bash
npm install
```

Tạo file `.env.local` từ template:
```bash
cp .env.example .env.local
# Điền SUPABASE_URL, SUPABASE_ANON_KEY, ANTHROPIC_API_KEY
```

```bash
npm run dev
# App chạy tại http://localhost:3000
```

## Tài liệu

- `docs/` — Toàn bộ tài liệu dự án (xem `docs/README.md` để tra cứu)
- `docs/01-architecture/CLAUDE.md` — Stack, rules, trạng thái hiện tại (đọc trước khi làm việc)
- `docs/01-architecture/DECISIONS.md` — Lý do đằng sau các quyết định kỹ thuật
- `docs/05-process/ROADMAP.md` — Lịch sử roadmap và technical debt backlog
- `docs/05-process/TODO.md` — Danh sách việc cần làm hiện tại
- `supabase_setup.sql` — SQL schema, chạy thủ công trên Supabase dashboard
