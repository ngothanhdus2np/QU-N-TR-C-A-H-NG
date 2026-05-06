# CLAUDE.md — CFO Brain 4.0 Context

> Đọc file này trước khi bắt đầu làm việc. Đây là tóm tắt toàn bộ context, quyết định kỹ thuật và định hướng phát triển đã được thảo luận và thống nhất.
> Xem thêm `AGENTS.md` cho project charter (design system, business logic rules, DB schema).

---

## 1. Tổng quan app

**Tên**: CFO Brain 4.0 — Hệ thống MIS Doanh nghiệp
**Mục tiêu**: Thay thế KiotViet + xây dựng AI Agent theo từng phòng ban
**Đối tượng**: Doanh nghiệp bán lẻ Việt Nam (hiện tại: cửa hàng giày)

**Stack hiện tại**:
- Frontend: React 19 + TypeScript + Vite + Recharts + Framer Motion
- Backend: Express.js + Node.js (server.ts)
- Database: Supabase (PostgreSQL) — 26 bảng
- AI: Google Gemini API (`@google/genai`) — đang dùng, kế hoạch chuyển sang Claude
- Offline: LocalStorage fallback (`cfo_brain_local_data`)

**Chạy dev**: `npm run dev` (port 3000)

---

## 2. Cấu trúc chính

```
businessLogic.ts   — Tính toán nghiệp vụ core (lương, thâm niên, doanh thu) — 941 dòng
server.ts          — Express backend, Supabase, Facebook API, scheduled jobs — 544 dòng
types.ts           — TypeScript interfaces toàn app — 538 dòng
services/
  apiService.ts    — Supabase CRUD, table mapping
  dataMapper.ts    — Merge cloud ↔ localStorage (KHÔNG được xóa)
  supabase.ts      — Supabase client
hooks/
  useAppData.ts    — Main state (useReducer pattern)
  appReducer.ts    — State reducer
components/        — 15+ UI components theo module
```

---

## 3. Vấn đề bảo mật cần sửa (ưu tiên cao nhất)

| Mức độ | Vấn đề | File |
|---|---|---|
| CRITICAL | Supabase admin JWT key hardcode trong source code | `server.ts` dòng 69-70, `services/supabase.ts` |
| CRITICAL | Facebook App Secret ghi ra file disk (`fb_session_cache.json`) | `server.ts` |
| HIGH | 6 component dùng `dangerouslySetInnerHTML` không qua DOMPurify | `Dashboard.tsx`, `ChatInterface.tsx`, `KnowledgeManager.tsx`, `RevenueManager.tsx`, `ProductGroupManager.tsx`, `PromotionManager.tsx` |
| HIGH | API routes không có authentication | `server.ts`: `/api/fb/post`, `/api/fb/pages`, `/api/sync-kiotviet` |
| MEDIUM | CORS `origin: '*'` | `server.ts` dòng 214 |
| MEDIUM | Session secret hardcode `"fb-app-secret-key"` | `server.ts` dòng 229 |

**Nguyên tắc sửa**: Chuyển tất cả secrets sang `.env.local`, không commit key lên git.

---

## 4. Vấn đề chất lượng code

- **Không có tests**: `businessLogic.ts` (tính lương, thâm niên) hoàn toàn không có test coverage
- **Component quá lớn**: `RevenueManager.tsx` (~130KB), `PayrollManager.tsx` (~100KB)
- **Performance**: `fetchAllData()` load 26 bảng cùng lúc, không có pagination (limit 10000)
- **Scheduled jobs không bền**: Auto-post Facebook dùng `setInterval` + file state — mất khi server crash
- **Off-by-one**: `businessLogic.ts` dòng ~107: `+1` trong tính thâm niên — chưa rõ lý do

---

## 5. Định hướng kỹ thuật đã thống nhất

### 5.1 Migration Gemini → Claude API

**Quyết định**: Chuyển từ `@google/genai` sang Anthropic Claude API.

**Lý do**:
- Prompt Caching: giảm ~80% chi phí cho system prompt dài (context nghiệp vụ)
- Tool use đáng tin hơn cho multi-turn function calling (ChatInterface)
- Context window 200K token
- Không còn phụ thuộc Google ecosystem

**Mapping model**:
| Gemini hiện tại | Claude tương đương |
|---|---|
| `gemini-3-flash-preview` | `claude-haiku-4-5` |
| `gemini-3.1-pro-preview` | `claude-sonnet-4-6` |
| `gemini-2.0-flash-exp` (test) | `claude-haiku-4-5` |

**Điểm cần chú ý khi migrate**:
- Gemini có `responseMimeType: "application/json"` + `responseSchema` → Claude cần dùng system prompt hoặc tool trick để enforce JSON output
- `KnowledgeManager.tsx`: document OCR (PDF, ảnh) → dùng Claude document blocks
- `ChatInterface.tsx`: multi-turn function calling loop 5 lần → đổi sang Claude tool use format

**Thứ tự migrate** (từ dễ đến khó):
1. `Dashboard.tsx` — Executive Briefing (single call, không tool)
2. `PromotionManager.tsx`, `ProductGroupManager.tsx`, `RevenueManager.tsx` — single calls
3. `services/marketingGeminiService.ts` — JSON schema output
4. `KnowledgeManager.tsx` — document OCR
5. `ChatInterface.tsx` — multi-turn function calling (phức tạp nhất)

### 5.2 Kiến trúc AI Agent (mục tiêu dài hạn)

Thay vì 1 AI tổng hợp, chuyển sang **6 Specialized Agents + 1 Orchestrator**:

```
User → Orchestrator Agent → route đến đúng agent
                         ↓
  CFO Agent        — Dashboard, P&L, break-even
  HR Agent         — Lương, thâm niên, chấm công (PayrollManager, StaffManager)
  Sales Agent      — Doanh thu store + Shopee (RevenueManager)
  Inventory Agent  — Kho hàng, nhà cung cấp, POS
  Marketing Agent  — Khuyến mãi, content, ROI (PromotionManager, MarketingManager)
  Operations Agent — Ca làm việc, báo cáo ngày (POS sessions)
                         ↓
              MCP / Tools Layer
         (Supabase queries per domain)
```

**Lợi thế cạnh tranh**: KiotViet không có AI agents — đây là điểm khác biệt chính.

---

## 6. Roadmap 4 giai đoạn

### Giai đoạn 0 — Nền móng (1-2 tháng) ← ĐANG LÀM
- [ ] Chuyển secrets sang `.env.local`
- [ ] Thêm DOMPurify cho `dangerouslySetInnerHTML`
- [ ] Authentication middleware cho API routes
- [ ] Audit trail cho thay đổi tài chính/lương
- [ ] Unit tests cho `businessLogic.ts`

### Giai đoạn 1 — Hoàn thiện POS & Vận hành (2-4 tháng)
- [ ] Barcode scanner (camera/USB)
- [ ] In hóa đơn nhiệt (thermal printer)
- [ ] Quản lý nhà cung cấp + công nợ
- [ ] Kiểm kho định kỳ + cảnh báo tồn kho thấp
- [ ] Quản lý ca làm việc (mở/đóng ca, kiểm quỹ)
- [ ] CRM khách hàng nâng cao (lịch sử, phân nhóm)

### Giai đoạn 2 — AI Agent Layer (3-4 tháng)
- [ ] Migration Gemini → Claude API
- [ ] Implement 6 Specialized Agents
- [ ] Orchestrator tự route câu hỏi
- [ ] Báo cáo tự động cuối ngày (Zalo/Messenger)
- [ ] Cảnh báo thông minh theo ngưỡng

### Giai đoạn 3 — Scale (4-6 tháng)
- [ ] Đa chi nhánh (multi-branch)
- [ ] Multi-tenant SaaS
- [ ] Tích hợp TikTok Shop, Lazada, GHN/GHTK

---

## 7. Quy tắc làm việc với codebase này

- **KHÔNG xóa** merge logic trong `services/dataMapper.ts` — đây là cơ chế offline-first
- **KHÔNG thêm** `updated_at`, `created_at` vào payload Supabase nếu bảng không có cột đó
- **LUÔN dùng** `crypto.randomUUID()` hoặc `generateId()` cho ID mới
- **Kiểm tra** `supabase_setup.sql` trước khi thêm cột mới vào UI
- Lương trách nhiệm chỉ tính khi có `responsibilityApprovals` — không tự ý thay đổi
