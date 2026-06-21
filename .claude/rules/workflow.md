# Quy trình làm việc — CFO Brain 4.0

> Áp dụng bắt buộc cho mọi agent: Claude, ChatGPT, Gemini, hay bất kỳ AI nào.
> Vi phạm quy trình này = làm sai, dù code đúng.

---

## ĐẦU CA — Bắt buộc đọc trước khi làm bất cứ thứ gì

Đọc theo đúng thứ tự này:

1. **`docs/05-process/TODO.md`** — Việc đang chờ, ưu tiên nào cần làm trước
2. **`docs/05-process/HISTORY.md`** — Phiên trước làm gì, context còn dở
3. **`.claude/rules/codebase.md`** — Quy tắc kỹ thuật không được vi phạm

Nếu user không nói rõ làm gì → hỏi, hoặc đề xuất task P0 từ TODO.md.

---

## TRONG CA — Quy trình cho mỗi tác vụ

Mọi tác vụ đều đi qua 4 bước, không ngoại lệ:

```
1. CLARIFY   → Diễn giải lại yêu cầu: "Tôi hiểu bạn muốn X"
2. CONFIRM   → Phân tích kỹ thuật + đề xuất: "Sẽ sửa file Y, làm Z" → CHỜ user OK
3. IMPLEMENT → Chỉ code sau khi user xác nhận ("đồng ý", "ok", "làm đi"...)
4. REPORT    → Báo cáo ngắn gọn: đã thay đổi gì, file nào
```

**Không được code trước bước CONFIRM.**

### Kiểm tra bắt buộc sau khi implement

| Thay đổi | Phải làm |
|---|---|
| Sửa `businessLogic.ts` | Chạy `npm test` — 43 tests phải pass |
| Thêm bảng / cột Supabase | Viết SQL vào `supabase_setup.sql` |
| Thay đổi tài chính / lương | Gọi `auditLog()` vào bảng `audit_logs` |
| **Mọi thay đổi UI / code frontend** | Restart dev server (xem bên dưới) |

### Restart dev server sau mỗi thay đổi frontend

Bắt buộc thực hiện theo đúng thứ tự này sau khi implement xong:

```
1. preview_stop  → dừng server cũ (serverId từ lần start trước)
2. preview_start → khởi động server mới với code mới nhất
3. preview_logs  → kiểm tra không có lỗi build/runtime
```

**Lý do**: HMR của Vite đôi khi không push file mới đến browser — restart đảm bảo 100% code mới được load.

Sau khi restart, báo user: **"Server đã restart — bạn hard refresh (`Cmd+Shift+R`) để load code mới."**

---

## CUỐI CA — Bắt buộc cập nhật trước khi kết thúc

### Bước 1 — Cập nhật `docs/05-process/HISTORY.md`

Thêm phiên mới lên **đầu file**, format:

```markdown
### YYYY-MM-DD
- [Mô tả ngắn gọn việc đã làm — 1 dòng mỗi việc]
- Files: [danh sách file đã thay đổi]
```

Chỉ ghi việc đã **hoàn thành**. Không ghi việc còn dở, không ghi kế hoạch.

### Bước 2 — Cập nhật `docs/05-process/TODO.md`

- Task vừa hoàn thành → đổi `[ ]` thành `[x]` và ghi ngày xong
- Task mới phát sinh trong ca → thêm vào đúng mức ưu tiên
- Task bị block → thêm lý do block

### Bước 3 — Chạy kiểm tra cuối ca (nếu có thay đổi code)

```bash
npx tsc --noEmit   # TypeScript check
npm test           # 43 tests phải pass
```

---

## VAI TRÒ CHUYÊN BIỆT

Khi user nói **"đánh giá toàn bộ"** hoặc **"full audit"** → đọc và làm theo:
- `docs/06-evaluation/EVALUATION_WORKFLOW.md`

Khi user yêu cầu 1 vai trò cụ thể → đọc file vai trò tương ứng:

- **QA Engineer** → `docs/06-evaluation/ROLE_QA.md`
- **Code Reviewer** → `docs/06-evaluation/ROLE_REVIEWER.md`
- **Security Auditor** → `docs/06-evaluation/ROLE_SECURITY.md`
- **Performance Auditor** → `docs/06-evaluation/ROLE_PERFORMANCE.md`
- **UX Auditor** → `docs/06-evaluation/ROLE_UX.md`
- **Logic & Calculation Auditor** → `docs/06-evaluation/ROLE_LOGIC.md`

---

## NGUYÊN TẮC KHÔNG ĐƯỢC VI PHẠM

- Không xóa merge logic trong `services/dataMapper.ts`
- Không hardcode secrets — chỉ dùng `.env.local`
- Mọi Claude API call phải đi qua `routes/ai.ts` — không gọi từ frontend
- Không dùng `dangerouslySetInnerHTML` mà không wrap `DOMPurify.sanitize()`
- Không bỏ qua `requireAuth` middleware cho API routes mutate data
