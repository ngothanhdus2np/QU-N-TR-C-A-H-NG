# CFO Brain 4.0 — Agent Developer Guide

> **Dành cho: Claude, ChatGPT, Gemini, Copilot — bất kỳ AI agent nào code trên dự án này.**
> Đọc toàn bộ file này trước khi viết bất kỳ dòng code nào. Không có ngoại lệ.

---

## 1. DỰ ÁN LÀ GÌ

**CFO Brain 4.0** — hệ thống quản lý doanh nghiệp cho cửa hàng bán lẻ (hiện tại: **Giày Dép Phúc Sang**).

**Các module chính:**
- **POS** — bán hàng, trả hàng, đổi hàng, tồn kho real-time, offline queue
- **Hàng hóa** — 12.739+ SKU, nhập hàng, kiểm kho, biến thể sản phẩm
- **Doanh thu** — P&L hàng ngày, COGS, lợi nhuận gộp, biểu đồ Recharts
- **Chi phí** — chi phí định kỳ, sổ cái, phân loại
- **Nhân sự & Lương** — chấm công, tính lương, vi phạm, trách nhiệm
- **Khách hàng** — điểm tích lũy, tier VIP, lịch sử mua
- **Nhà cung cấp** — công nợ (transaction model), lịch sử giao dịch
- **AI Agents** — CFO chat, cảnh báo tồn kho/nợ/doanh thu, EOD report 21:00 VN, marketing

**Stack:**

| Layer | Tech |
|-------|------|
| Frontend | React 19 + TypeScript + Vite + Tailwind CSS + Recharts + Framer Motion |
| Backend | Express.js + Node.js 24 — ESM (`"type":"module"`) |
| Database | Supabase (PostgreSQL, 26 bảng) |
| AI | Anthropic Claude API — chỉ từ `routes/ai.ts`, không bao giờ từ frontend |
| State | `useReducer` trong `hooks/useAppData.ts` |
| Offline | IndexedDB (`posOfflineQueue`) + localStorage fallback |
| Format/Lint | Prettier 3 + ESLint 10 flat config |
| Dev | `npm run dev` → port 3000 |

---

## 2. ĐỌC CÁC FILE NÀY TRƯỚC

| File | Khi nào | Nội dung |
|------|---------|----------|
| `HISTORY.md` | **Bắt buộc — đầu mỗi phiên** | TODO đang chờ + phiên trước làm gì + việc dang dở |
| `AGENTS.md` | **File này** | Rules + workflow + kỹ thuật — nguồn sự thật chung |
| `ROLE_REVIEWER.md` | Khi user giao review code | Quy trình review 7 danh mục, format báo cáo |
| `ROLE_QA.md` | Khi user giao test/QA | Quy trình QA, edge cases, nghiệp vụ |

**Đọc thêm khi cần context sâu hơn:**
- `DECISIONS.md` — lý do các quyết định kỹ thuật quan trọng
- `ROADMAP.md` — kế hoạch tính năng tương lai, đang làm gì

---

## 3. CẤU TRÚC TEAM — AI AGENTS

Dự án dùng **multi-agent workflow**. Mọi agent đều có thể implement code. Vai trò Review / QA được giao theo yêu cầu của user — không cố định.

| Agent | Platform | Vai trò mặc định |
|-------|----------|-----------------|
| **Claude** | Claude Code (VSCode / CLI) | Tech Lead — implement, quyết định kiến trúc, maintainer mặc định |
| **ChatGPT** | Codex | Developer #2 — code tiếp khi Claude hết context limit |
| **Gemini** | Antigravity | Developer #3 — code tiếp hoặc nhận vai QA |

**Nguyên tắc:**
- `AGENTS.md` + `HISTORY.md` là nguồn sự thật vận hành của dự án
- Claude là maintainer mặc định, nhưng agent đang làm task chịu trách nhiệm cập nhật `HISTORY.md` đầy đủ
- Khi agent khác implement, tuân thủ đúng workflow trong file này, không sáng tạo thêm pattern mới
- Khi xong task → **bắt buộc cập nhật HISTORY.md** để agent tiếp theo hiểu context

---

## 4. HANDOFF — TIẾP NHẬN TỪ AGENT KHÁC

> Áp dụng khi user nói: "tiếp tục từ chỗ Claude dừng", "ChatGPT làm tiếp đi", hoặc tương tự.

**Bước 1 — Đọc ngay trước khi làm bất cứ thứ gì:**
1. `HISTORY.md` — phiên gần nhất: đã làm gì, dừng ở đâu, mục "Còn lại / Dang dở"
2. File đang dang dở được ghi trong HISTORY.md — đọc toàn bộ file đó

**Bước 2 — Báo trạng thái, hỏi nếu cần:**
```
Tôi đã đọc HISTORY.md. Agent trước đã làm:
- ✅ [việc đã xong]
- ✅ [việc đã xong]
Còn lại:
- [ ] [việc chưa xong — file + bước cụ thể]
Tôi sẽ tiếp tục từ: [file X, bước Y]
Bạn xác nhận không?
```

**Bước 3 — Tiếp tục đúng chỗ dừng, không làm lại từ đầu.**

---

## 5. QUY TRÌNH LÀM VIỆC — 8 BƯỚC + DIRTY WORKTREE

### Bước 1 — Đọc HISTORY.md

Đọc phần **TODO** và **phiên gần nhất**. Mục đích:
- Không làm trùng việc đã xong
- Không phá code người trước
- Hiểu trạng thái hiện tại

Nếu `HISTORY.md` có section **Current Active Task**, đọc section đó trước TODO để biết task đang làm dở và bước tiếp theo được khuyến nghị.

---

### Bước 1.5 — Kiểm tra dirty worktree

Trước khi sửa file, chạy:

```bash
git status --short
```

Quy tắc khi worktree đang dirty:
- Nếu file định sửa đã modified/untracked → đọc `git diff -- <file>` hoặc đọc toàn bộ file trước khi edit
- Không revert, checkout, reset thay đổi không phải của mình
- Không chạy `npm run format`, `npm run lint:fix` hoặc auto-fix toàn repo nếu user không yêu cầu
- Chỉ format file mình vừa chạm
- Nếu thay đổi có sẵn trong file ảnh hưởng trực tiếp task, làm việc tiếp trên trạng thái hiện tại thay vì cố đưa file về bản cũ

---

### Bước 2 — Hiểu yêu cầu

Tự hỏi trước khi lên kế hoạch:
- File nào bị ảnh hưởng?
- Có cần bảng/cột Supabase mới? → Phải viết SQL vào `supabase_setup.sql` trước
- Có ảnh hưởng `businessLogic.ts`? → Phải chạy `npm test` sau
- Route API mới? → POST/PUT/DELETE phải có `requireAuth`
- Liên quan tài chính/lương? → Phải gọi `auditLog()`
- Không rõ → **hỏi user trước, không tự đoán**
- Task có quá lớn không? Nếu có, chia thành checklist con trong `HISTORY.md` và làm từng bước nhỏ

---

### Bước 3 — Lên kế hoạch + xin xác nhận theo ranh giới task

Trình bày với user theo format:
```
Tôi sẽ:
1. Sửa [tên file] — [lý do cụ thể]
2. Thêm [tên file] — [lý do cụ thể]
3. Chạy [lệnh kiểm tra]

Bạn xác nhận không?
```

Mặc định chỉ xin xác nhận ở **ranh giới task lớn / module lớn / thư mục ngoài phạm vi đang làm**. Sau khi user đã đồng ý một task lớn, agent phải tự chia thành checklist con trong `HISTORY.md` và làm lần lượt cho đến khi task lớn hoàn tất hoặc gặp blocker thật sự.

Không hỏi lại user cho từng bước nhỏ nếu các bước đó vẫn nằm trong phạm vi task lớn đã được duyệt, ví dụ:
- Tách component con trong cùng module
- Dọn import/type liên quan trực tiếp
- Chuyển helper UI thuần sang file con
- Sửa lỗi phát sinh từ chính refactor vừa làm

Chỉ hỏi lại khi phát sinh thay đổi vượt phạm vi đã duyệt:
- Đụng sang module/thư mục lớn khác chưa được nhắc tới
- Cần đổi DB/schema/migration
- Đổi business rule, cách tính lương/tài chính, auth/security
- Xóa file hoặc bỏ behavior hiện có
- Không chắc nghiệp vụ và không thể xác minh bằng code/test

Nếu user mới hỏi ý kiến, đang brainstorm, hoặc yêu cầu chưa rõ, vẫn phải hỏi trước khi edit. Nếu user đã nói rõ "làm đi", "xử lý hết", "đồng ý", hoặc giao task cụ thể, agent thực hiện theo phân loại rủi ro bên dưới.

Phân loại theo rủi ro:
- **Được làm sau khi báo ngắn** nếu task đã rõ phạm vi và rủi ro thấp: sửa UI nhỏ, refactor hẹp, fix typo, dọn import, tách component không đổi behavior. Với task refactor đã được duyệt, tự làm các bước con đến khi xong, không hỏi từng bước.
- **Phải xin xác nhận rõ ràng** nếu task đụng DB/schema, lương, tài chính, auth/security, xóa file, migration, hoặc đổi business rule

---

### Bước 4 — Đọc file trước khi sửa

Với mỗi file sẽ sửa, đọc toàn bộ nội dung hiện tại trước. File đặc biệt cần đọc kỹ:

- `services/dataMapper.ts` — merge logic offline-first, **KHÔNG BAO GIỜ XÓA**
- `businessLogic.ts` — pure functions, thêm vào cuối, không refactor tùy tiện
- `types.ts` — thêm interface mới vào đây, không tạo local type trong component
- `hooks/useAppData.ts` — global state, sửa cẩn thận, dễ gây re-render toàn app

---

### Bước 5 — Thực hiện theo thứ tự logic

```
1. types.ts           (type mới trước)
2. businessLogic.ts   (logic thuần)
3. supabase_setup.sql (SQL trước khi dùng bảng mới)
4. services/          (service layer)
5. hooks/             (state hooks)
6. routes/            (API endpoints)
7. components/        (UI sau cùng)
```

Sau mỗi file quan trọng chạy ngay:
```bash
npx tsc --noEmit
```

Với task tách nhỏ/refactor nhiều bước, dùng vòng lặp bắt buộc:
1. Tách một phần nhỏ, behavior-preserving
2. Chạy kiểm tra tối thiểu cho phần vừa sửa: `npx tsc --noEmit` + scoped ESLint cho file vừa chạm
3. Nếu có lỗi do phần vừa sửa → sửa ngay, chạy lại đến khi sạch
4. Chỉ khi bước nhỏ sạch mới chuyển sang bước nhỏ tiếp theo

Không gom nhiều bước nhỏ rủi ro rồi mới test một lần ở cuối.

### Bước 5.5 — Scoped test bắt buộc sau mọi thay đổi

Áp dụng cho **mọi task có sửa code**, kể cả UI nhỏ trong thư mục lớn. User không cần nhắc lại yêu cầu này.

Sau khi sửa xong một phần nhỏ, agent phải tự xác định file vừa chạm và chạy tối thiểu:

```bash
npx tsc --noEmit
npx eslint <file-vừa-sửa-1> <file-vừa-sửa-2>
```

Quy tắc:
- Không báo xong nếu `npx tsc --noEmit` fail do thay đổi vừa làm
- Không báo xong nếu scoped ESLint của file vừa sửa còn **error**
- Nếu task chỉ sửa tài liệu như `HISTORY.md`/`AGENTS.md` thì không cần chạy TypeScript/test/lint, nhưng phải ghi rõ "không cần chạy" trong HISTORY
- Nếu sửa logic nghiệp vụ, service, hook state, route API, nhập/xuất kho, tài chính, lương, hoặc `businessLogic.ts` → chạy thêm `npm test`
- Nếu task là module lớn hoặc chạm nhiều file liên quan nhau → chạy full gate ở Bước 7
- Nếu full repo lint fail vì nợ cũ ngoài phạm vi, vẫn phải báo scoped ESLint file vừa sửa sạch hay không

---

### Bước 6 — Tự review trước khi báo xong

Đi qua checklist — xem **Phần 9 — Code Review Checklist** trong file này.

---

### Bước 7 — Kiểm tra cuối

Khi hoàn tất toàn bộ task lớn/module lớn, chạy full gate trước khi báo user:

```bash
npm run check   # TypeScript — không có lỗi
npm test        # 45/45 tests pass
npm run lint    # ESLint clean
```

Nếu repo đang có lint debt sẵn:
```bash
npx eslint <file-vừa-sửa-1> <file-vừa-sửa-2>
npm run lint
```

Yêu cầu tối thiểu trong trường hợp đó:
- File vừa sửa không có ESLint **error** mới
- Các lỗi TypeScript/test do phần vừa sửa phải được sửa đến khi sạch trước khi chuyển tiếp hoặc báo xong
- `npm run lint` vẫn phải chạy để báo tình trạng toàn repo
- Nếu full lint fail vì lỗi tồn đọng ngoài phạm vi task, báo rõ file/lý do và không tự sửa lan rộng

Nguyên tắc báo xong:
- Không báo hoàn tất task lớn khi check của phạm vi vừa sửa còn lỗi
- Nếu full lint fail do nợ cũ toàn repo nhưng scoped ESLint sạch và test pass, báo rõ là task đã sạch trong phạm vi sửa, full repo còn lint debt tồn đọng
- Nếu test/TypeScript fail do thay đổi của agent, tiếp tục sửa và chạy lại cho đến khi ổn

Báo kết quả rõ ràng:
```
TypeScript : ✅ clean
Tests      : ✅ 45/45 pass
ESLint     : ✅ clean
```

---

### Bước 8 — Cập nhật HISTORY.md (bắt buộc)

Thêm phiên mới lên đầu section lịch sử:

```markdown
### YYYY-MM-DD — [Tên model] — Phiên N

**Đã làm:**
- `đường/dẫn/file.ts`: thay đổi + lý do

**Kết quả kiểm tra:**
TypeScript ✅/❌ | Tests ✅/❌ | ESLint ✅/❌

**Còn lại / Dang dở:**
- [nếu hết limit giữa chừng: ghi rõ đang ở file nào, bước nào, logic nào chưa xong]
- [nếu xong hết: ghi "Hoàn thành"]
```

Cập nhật **TODO**:
- Việc xong → đổi `[ ]` thành `[x] ~~nội dung~~ *(xong YYYY-MM-DD)*`
- Việc mới phát sinh → thêm `[ ]` vào đúng mức ưu tiên
- Task lớn → thêm checklist con, ghi rõ bước đã xong và bước kế tiếp

Khi task đang làm dở hoặc là task nhiều bước, cập nhật thêm section đầu file:

```markdown
## Current Active Task
- Task: [tên task]
- Last completed: [bước vừa xong]
- Next recommended: [bước tiếp theo]
- Files touched: [danh sách file]
- Notes: [ràng buộc quan trọng nếu có]
```

---

## 6. KHI NGƯỜI DÙNG YÊU CẦU TESTING

> Áp dụng khi user nói: "test đi", "chạy test", "kiểm tra", "check lỗi", "có pass không"...

**Chạy theo thứ tự:**

```bash
# Bước 1 — TypeScript
npx tsc --noEmit

# Bước 2 — Unit tests
npm test

# Bước 3 — Lint
npm run lint
```

Quy trình này ổn và vẫn là chuẩn mặc định. Khi repo còn lint debt tồn đọng, bổ sung thêm kiểm tra scoped:

```bash
npx eslint <file-vừa-sửa>
```

Kết luận testing phải phân biệt:
- **TypeScript**: toàn repo clean hay fail
- **Tests**: số test pass/fail
- **ESLint scoped**: file vừa sửa có error mới không
- **ESLint full repo**: clean hay fail vì lỗi tồn đọng

**Báo kết quả từng bước:**

```
Kết quả kiểm tra:
─────────────────────────────
TypeScript  : ✅ clean
Tests       : ✅ 45/45 pass
ESLint      : ✅ clean
─────────────────────────────
→ Code sẵn sàng.
```

Nếu có lỗi:
```
Tests : ❌ 2/45 fail
  - posOrderService > "đặt hàng khi hết stock phải throw"
    Lý do: mock chưa trả Promise.resolve()
  Đề xuất fix: [mô tả cụ thể]
```

---

## 7. XỬ LÝ TÌNH HUỐNG CỤ THỂ

### A — Thêm tính năng mới
1. Type mới → `types.ts`
2. Logic thuần → `businessLogic.ts` + viết test
3. Cần DB → SQL vào `supabase_setup.sql`, báo user chạy thủ công
4. API endpoint → `routes/` + `requireAuth` + `checkRateLimit(req, N)`
5. Service CRUD → `services/apiService.ts`
6. UI component → `components/` đúng thư mục
7. Kết nối state → `hooks/useAppData.ts` (cẩn thận — ảnh hưởng toàn app)

### B — Sửa bug
1. Đọc file lỗi + file test liên quan
2. Hiểu **root cause** trước khi sửa — không patch triệu chứng
3. Nếu bug trong `businessLogic.ts` → viết test case cho bug TRƯỚC khi sửa code
4. Sửa → `tsc` → `npm test` → confirm fix
5. Không thêm feature mới trong cùng một bug fix

### C — Refactor
1. Không refactor khi không được yêu cầu — "works" > "clean"
2. Nếu được yêu cầu: đảm bảo behavior không thay đổi (test coverage)
3. Giữ nguyên public API của module — chỉ sửa implementation bên trong
4. Extract component/hook trước, tối ưu sau — không trộn refactor với đổi business rule
5. Không đổi copy UI, công thức, data shape, API contract trong cùng một refactor nếu user không yêu cầu
6. Mỗi lượt refactor chỉ nên xử lý một ownership area rõ ràng; task lớn phải chia checklist con trong `HISTORY.md`

### D — Thêm bảng/cột Supabase mới
1. Viết SQL vào cuối `supabase_setup.sql`
2. **Báo user:** "Cần chạy SQL này thủ công trên Supabase SQL Editor trước khi test"
3. Thêm mapping vào `services/dataMapper.ts` (cloud → localStorage)
4. Thêm key vào `TABLE_MAP` trong `services/apiService.ts` nếu cần CRUD
5. Thêm field vào `AppData` interface trong `types.ts`

### E — Thêm AI endpoint mới
1. Chỉ thêm vào `routes/ai.ts` — không nơi nào khác
2. Bắt buộc: `checkRateLimit(req, N)` ở đầu handler
3. Model: `claude-haiku-4-5` cho quick task, `claude-sonnet-4-6` cho analysis nặng
4. Không bao giờ stream API key hay internal error ra client

### F — Sửa logic tính lương ⚠️ CỰC KỲ NHẠY CẢM
1. Đọc kỹ toàn bộ `calculateEmployeePayroll` trong `businessLogic.ts`
2. Viết test case cho scenario cần sửa TRƯỚC khi sửa code
3. Sửa code → `npm test` → phải pass tất cả
4. Ghi rõ thay đổi logic trong HISTORY.md để audit sau này
5. **Không thay đổi** cách tính `responsibilityPay` — chỉ tính khi có `responsibilityApprovals`

---

## 8. QUY TẮC BẤT DI BẤT DỊCH

**KHÔNG được:**
- Xóa merge logic trong `services/dataMapper.ts` — đây là offline-first fallback
- Hardcode secrets — chỉ dùng `.env.local`, không commit file này
- Thêm `updated_at` / `created_at` vào Supabase payload nếu bảng không có cột đó
- Bỏ qua `requireAuth` cho route POST/PUT/DELETE
- Dùng `dangerouslySetInnerHTML` mà không wrap `DOMPurify.sanitize()`
- Import `@anthropic-ai/sdk` trong bất kỳ file frontend nào
- Dùng `console.log` — chỉ `console.error` trong catch block
- Giữ dead files "để an toàn" — không có import → xóa (dùng git history)
- Dùng `var` — chỉ `const` hoặc `let`

**LUÔN phải:**
- Dùng `generateId()` từ `../../businessLogic` — không khai báo local copy
- Đọc file trước khi sửa
- Viết SQL mới vào `supabase_setup.sql` trước khi dùng bảng/cột mới
- Ghi `auditLog()` cho mọi thay đổi tài chính/lương
- Hỏi và chờ xác nhận trước khi edit (trừ khi user đã nói "làm đi")

---

## 9. THÔNG TIN KỸ THUẬT

### Cấu trúc file

```
businessLogic.ts     ← Pure functions: lương, doanh thu, tồn kho, SKU — export generateId
types.ts             ← TẤT CẢ TypeScript interfaces — không tạo local type trong component
server.ts            ← Express bootstrap (~190 dòng)
routes/
  ai.ts              ← Claude API endpoints (/api/ai/*)
  facebook.ts        ← Facebook OAuth + auto-post scheduler
  notifications.ts   ← EOD report + alert scheduler (21:00 VN)
  import.ts          ← KiotViet sync
services/
  apiService.ts      ← Supabase CRUD (upsertItem, upsertMany, deleteItem)
  dataMapper.ts      ← Cloud ↔ localStorage merge — KHÔNG XÓA LOGIC NÀY
  posOrderService.ts ← Xử lý đơn hàng + trả hàng POS (async, có stock guard)
  agents/
    claudeClient.ts  ← Wrapper gọi Anthropic SDK
    cfoAgent.ts      ← CFO chat agent tools
    alertAgent.ts    ← Kiểm tra cảnh báo tồn kho, nợ, doanh thu
    eodAgent.ts      ← Báo cáo cuối ngày
hooks/
  useAppData.ts      ← Global state (useReducer + Supabase sync + offline)
  useOfflineSync.ts  ← IndexedDB drain queue khi online lại
components/
  pos/               ← POSComputer (824L), GoodsInventory (534L)...
  revenue/           ← 9 sub-components
  payroll/           ← PayrollManager
  expense/           ← ExpenseManager (561L)
  ui/                ← ConfirmDialog, ErrorBoundary, InputModal
```

### Design system

```
Background : #f8fafc (Slate 50)   → bg-slate-50
Accent     : #6366f1 (Indigo 600) → bg-indigo-600 / text-indigo-600
Lãi / OK   : text-emerald-600
Lỗ / Nguy  : text-rose-600
Cảnh báo   : text-amber-600
Radius     : rounded-xl (12px) — đồng nhất cho input, button, card
Shadow     : shadow-sm / shadow-md — không dùng shadow đậm hơn
Font       : Inter (sans-serif)
```

### Quy tắc code nhanh

```typescript
// ✅ ID
import { generateId } from '../../businessLogic';
const id = generateId();

// ✅ Console — chỉ trong catch
console.error('[Module] message', err);

// ❌ Tuyệt đối không
console.log('debug', data);

// ✅ Route có auth
router.post('/api/x', requireAuth, async (req, res) => { ... });

// ❌ Route POST không auth
router.post('/api/x', async (req, res) => { ... });

// ✅ AI endpoint
if (!checkRateLimit(req, 10)) return res.status(429).json({ error: 'Rate limit' });

// ❌ AI key trong frontend
import Anthropic from '@anthropic-ai/sdk'; // KHÔNG BAO GIỜ trong src/

// ✅ Interface mới
// → Thêm vào types.ts, không khai báo local trong component
```

### Naming conventions

| Loại | Quy tắc | Ví dụ |
|------|---------|-------|
| Component | PascalCase | `POSComputer`, `GoodsInventory` |
| Hook | `use` + PascalCase | `useGoodsFilters`, `useAppData` |
| Service / util | camelCase | `apiService`, `dataMapper` |
| Constant | UPPER_SNAKE_CASE | `TABLE_MAP`, `DEFAULT_POLICIES` |
| Interface / Type | PascalCase | `POSProduct`, `AppData` |
| DB column | snake_case | `employee_id`, `net_revenue` |
| TS field | camelCase | `employeeId`, `netRevenue` |

### Env vars

```bash
# Frontend (prefix VITE_ — an toàn expose ra bundle)
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=

# Backend only — KHÔNG prefix VITE_
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=   # warning nếu thiếu, dùng anon key thay
ANTHROPIC_API_KEY=
SESSION_SECRET=              # BẮT BUỘC production — server crash nếu thiếu
INTERNAL_API_KEY=            # X-Api-Key header trong requireAuth
PORT=3000
APP_URL=                     # URL public (dùng cho CORS)
```

### Scripts

```bash
npm run dev          # Dev server (frontend + backend) port 3000
npm run check        # TypeScript check (không emit)
npm run lint         # ESLint + TypeScript
npm run lint:fix     # Auto-fix ESLint
npm run format       # Prettier toàn bộ file
npm test             # Vitest — 45 tests phải pass
```

---

## 10. CODE REVIEW CHECKLIST

> Dùng khi được giao review code hoặc tự review trước khi báo xong.
> Phải đi qua **đủ 7 danh mục** — không dừng sau 1 lỗi.
> Ghi: ✅ OK / ⚠️ Cần xem xét / ❌ Lỗi + mô tả

### A. Security

- [ ] Route POST/PUT/DELETE có `requireAuth`?
- [ ] Auth check dùng `req.socket.remoteAddress` (TCP) — không dùng `req.hostname` (spoofable)?
- [ ] Không có secret / API key hardcode trong source?
- [ ] Tất cả AI endpoints có `checkRateLimit`?
- [ ] `dangerouslySetInnerHTML` đã wrap `DOMPurify.sanitize()`?
- [ ] `@anthropic-ai/sdk` không import trong frontend?

### B. Data Integrity

- [ ] Stock update có atomic RPC hoặc ít nhất client-side guard?
- [ ] Thay đổi tài chính / lương có `auditLog()`?
- [ ] Stock guard (`stock < quantity → throw`) trước khi ghi đơn hàng?
- [ ] Supabase query có `.limit()` — không full table scan?
- [ ] `dataMapper.ts` merge logic còn nguyên?

### C. Error Handling

- [ ] Mọi `async` function có `try/catch`?
- [ ] `catch` chỉ dùng `console.error` — không `console.log`?
- [ ] Error trả về client không lộ stack trace?
- [ ] `fetch()` / Supabase call ở UI có xử lý khi fail?

### D. Performance

- [ ] Danh sách > 500 items có virtualization?
- [ ] `useEffect` dependencies array đúng và đủ?
- [ ] Supabase query có `select('specific,columns')` — không `select('*')` bảng lớn?
- [ ] Không có N+1 query (query trong loop)?

### E. Type Safety

- [ ] Không có `any` mới không có lý do?
- [ ] Null/undefined check trước khi access property?
- [ ] Interface / type mới đã vào `types.ts`?
- [ ] `as SomeType` cast không che giấu lỗi runtime?

### F. Business Logic

- [ ] Logic tính lương không bị thay đổi ngoài ý muốn?
- [ ] `responsibilityPay` chỉ tính khi có `responsibilityApprovals`?
- [ ] Revenue record cập nhật đúng ngày?
- [ ] Penalty matching dùng `normVN()` chuẩn hóa dấu tiếng Việt?

### G. Code Quality

- [ ] Không có `console.log` mới?
- [ ] Không có dead code, import thừa?
- [ ] ID dùng `generateId()` hoặc `crypto.randomUUID()` — không `Math.random()`?
- [ ] Không có `var`?

---

### Prompt mẫu — Dán vào ChatGPT / Gemini khi review

```
Bạn là Code Reviewer cho dự án CFO Brain 4.0 (React 19 + Express + Supabase).

Quy tắc bắt buộc:
1. Đi qua ĐỦ 7 danh mục: Security → Data Integrity → Error Handling →
   Performance → Type Safety → Business Logic → Code Quality
2. KHÔNG dừng sau khi tìm 1 lỗi — phải hoàn thành cả 7
3. Mỗi mục: ✅ OK / ⚠️ Cần xem xét / ❌ Lỗi [mô tả]
4. Cuối: tổng hợp 🔴 Critical → 🟠 Medium → 🟡 Low

Code cần review:
[dán code vào đây]
```
