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
| **Mọi thay đổi code (frontend/backend)** | Kill tất cả server + restart (xem bên dưới) |
| **Thêm/sửa công thức tính toán** | Cập nhật `docs/business-knowledge/FORMULAS.md` (xem bên dưới) |
| **Thêm/sửa logic nghiệp vụ** | Verify thực tế trên browser (xem bên dưới) |

### Restart dev server sau MỌI thay đổi code

Bắt buộc thực hiện theo đúng thứ tự này sau khi implement xong (frontend, backend, hay bất kỳ file code nào):

```
1. preview_list  → lấy danh sách TẤT CẢ server đang chạy
2. preview_stop  → dừng TỪNG server (lặp cho mỗi serverId)
3. preview_start → khởi động server mới với code mới nhất
4. preview_logs  → kiểm tra không có lỗi build/runtime
```

**Quan trọng**: Phải dừng **tất cả** server cũ, không chỉ server cuối cùng. Nếu có nhiều server → stop hết rồi mới start lại.

**Lý do**: HMR của Vite đôi khi không push file mới đến browser — restart đảm bảo 100% code mới được load. User cần code mới nhất để test ngay.

Sau khi restart, báo user: **"Server đã restart — bạn hard refresh (`Cmd+Shift+R`) để load code mới."**

### Verify thực tế trên browser sau khi sửa logic nghiệp vụ

Khi thay đổi bất kỳ logic nào (import hàng, tính toán, đọc/ghi dữ liệu, API endpoint...), **bắt buộc** verify workflow thực tế trên browser — không chỉ kiểm tra code pass TypeScript hay unit test.

**Quy trình verify:**

```
1. preview_snapshot  → xác nhận UI element liên quan đang hiển thị đúng
2. preview_eval      → kích hoạt action (click nút, submit form...) bằng JS
3. preview_eval      → kiểm tra state ngay sau action (vd: btn.disabled === true)
4. preview_network   → xác nhận network request thực tế được gửi đến đúng endpoint
5. preview_eval      → xác nhận state sau khi hoàn thành (vd: btn.disabled === false)
6. preview_snapshot  → kiểm tra UI đã cập nhật đúng dữ liệu mới
```

**Những gì phải xác nhận tùy loại thay đổi:**

| Loại logic | Phải verify |
|---|---|
| Import / đồng bộ dữ liệu | Network request gửi đến đúng bảng Supabase, dữ liệu xuất hiện trên UI sau refresh |
| Nút / action có loading state | Nút disable khi đang chạy, re-enable sau khi xong |
| CRUD (tạo/sửa/xóa) | Row mới xuất hiện / biến mất trên bảng sau khi action |
| Tính toán hiển thị | Giá trị trên UI khớp với công thức đã ghi trong FORMULAS.md |
| API endpoint mới | Response 200 OK, payload đúng cấu trúc |

**Lý do**: Unit test và TypeScript chỉ kiểm tra code đúng cú pháp và logic tĩnh. Verify thực tế phát hiện lỗi kết nối, sai prop drilling, cache không xóa, state không update — những lỗi không xuất hiện trong test nhưng user thấy ngay khi dùng.

---

### Cập nhật công thức sau khi thêm/sửa logic tính toán

Khi thay đổi bất kỳ công thức nào (doanh thu, lợi nhuận, lương, nợ, tồn kho, KPI...), **bắt buộc** cập nhật `docs/business-knowledge/FORMULAS.md`:

1. Tìm section tương ứng trong file (hoặc tạo section mới nếu chưa có)
2. Ghi công thức dạng toán học dễ đọc (không paste code)
3. Ghi rõ **Source** (file + function name)
4. Ghi các quy tắc đặc biệt / edge case
5. Ghi nguồn dữ liệu đầu vào (cột nào, bảng nào, import từ đâu)

**Lý do**: File này là tài liệu duy nhất mô tả logic nghiệp vụ. Nếu không cập nhật, agent sau sẽ không biết công thức đúng và có thể implement sai.

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
