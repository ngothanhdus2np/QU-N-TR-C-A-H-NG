Start the CFO Brain development server (frontend + backend).

```bash
cd "/Users/apple/phucsang app/QU-N-TR-C-A-H-NG" && npm run dev
```

- Frontend (Vite): http://localhost:3000
- Backend (Express): bundled trong cùng process qua vite.config.ts

Yêu cầu: file `.env.local` phải tồn tại với SUPABASE_URL, SUPABASE_ANON_KEY, ANTHROPIC_API_KEY, SESSION_SECRET.
Nếu server không khởi động, kiểm tra `.env.local` và chạy `npm install` trước.
