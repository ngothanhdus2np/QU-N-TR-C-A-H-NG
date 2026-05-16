# FILE BẮT ĐẦU — CFO Brain 4.0
> Khi user nói "đọc file bắt đầu" → dùng tool đọc file để mở file này, làm theo đúng thứ tự các bước bên dưới. Không cần user paste gì cả.

---

## APP NÀY LÀ GÌ

**CFO Brain 4.0** — phần mềm quản lý bán hàng cho doanh nghiệp nhỏ Việt Nam.

Các module chính: POS bán hàng, quản lý kho, nhân sự & lương, thu chi, dashboard KPI, marketing.

Stack: **React + TypeScript + Supabase + Vite**. Không có backend riêng — frontend gọi Supabase trực tiếp. Claude API đi qua `routes/ai.ts`.

---

## BƯỚC 1 — ĐỌC CÁC FILE SAU (dùng tool đọc file của bạn)

Đọc theo đúng thứ tự này:

| Thứ tự | File | Mục đích |
|--------|------|----------|
| 1 | `docs/DOCUMENTATION_GUIDELINES.md` | **BẮT BUỘC ĐỌC ĐẦU TIÊN** — Quy định về nơi lưu báo cáo/tài liệu |
| 2 | `docs/05-process/TODO.md` | Danh sách task đang chờ, ưu tiên nào cần làm trước |
| 3 | `docs/05-process/HISTORY.md` | Phiên trước làm gì, còn việc gì dở (đọc 60 dòng đầu) |
| 4 | `.claude/rules/codebase.md` | Rules kỹ thuật không được vi phạm |

---

## BƯỚC 2 — BÁO CÁO LẠI CHO USER

Sau khi đọc xong 4 file trên, trả lời user theo format sau — **không làm gì khác trước bước này**:

```
Tôi đã nắm bắt được app. Đây là tình hình hiện tại:

**App:** CFO Brain 4.0 — [mô tả 1 dòng dựa trên những gì vừa đọc]

**Phiên trước:** [tóm tắt 1-2 dòng từ HISTORY.md]

**Việc cần làm hôm nay:**
- 🔴 P0: [liệt kê task P0 chưa xong từ TODO.md]
- 🟠 P1: [liệt kê task P1 nếu có]
- ⏸️ Blocked: [liệt kê nếu có]

**Quy định tài liệu:** Đã đọc DOCUMENTATION_GUIDELINES.md — biết nơi lưu báo cáo ✅

Bạn muốn bắt đầu với task nào?
```

Nếu TODO.md **không có task nào chưa xong** → hỏi: *"Hôm nay bạn muốn làm gì?"*

---

## BƯỚC 3 — QUY TRÌNH LÀM VIỆC (áp dụng cho mọi task)

Mỗi tác vụ bắt buộc đi qua 4 bước, không ngoại lệ:

```
1. CLARIFY   → Diễn giải lại: "Tôi hiểu bạn muốn X"
2. CONFIRM   → Đề xuất kỹ thuật: "Sẽ sửa file Y, làm Z" → CHỜ user nói OK
3. IMPLEMENT → Chỉ code sau khi user xác nhận
4. REPORT    → Báo cáo ngắn: đã thay đổi gì, file nào
```

**Không được code trước khi user xác nhận ở bước CONFIRM.**

---

## BƯỚC 4 — CUỐI CA (bắt buộc trước khi kết thúc)

1. Thêm phiên mới lên **đầu** `docs/05-process/HISTORY.md`:
   ```
   ### YYYY-MM-DD
   - [việc đã làm — 1 dòng mỗi việc]
   - Files: [danh sách file đã sửa]
   ```
2. Cập nhật `docs/05-process/TODO.md`: đánh `[x]` task đã xong + ghi ngày, thêm task mới nếu có

---

## QUY ĐỊNH VỀ TÀI LIỆU & BÁO CÁO — BẮT BUỘC

**⚠️ QUAN TRỌNG:** Trước khi tạo bất kỳ file .md mới nào, **BẮT BUỘC** phải đọc `docs/DOCUMENTATION_GUIDELINES.md`

### Quy tắc nhanh:

| Loại file | Lưu tại | Ví dụ |
|-----------|---------|-------|
| Báo cáo phân tích | `docs/02-development/` | `*_ANALYSIS.md`, `*_REPORT.md` |
| Báo cáo fix/hoàn thành | `docs/02-development/` | `*_FIXES.md`, `*_COMPLETION_REPORT.md` |
| Quy trình kiểm tra (Roles) | `docs/roles/` | `ROLE_*.md` |
| Hướng dẫn deployment | `docs/03-deployment/` | `*_GUIDE.md`, `*_SETUP.md` |
| Tài liệu mobile | `docs/04-mobile/` | `MOBILE_*.md` |

### ❌ KHÔNG ĐƯỢC:
- Tạo file .md ở root (trừ README.md)
- Tạo thư mục mới trong docs/ tùy ý
- Lưu file sai vị trí

### ✅ PHẢI LÀM:
- Đọc `docs/DOCUMENTATION_GUIDELINES.md` trước
- Lưu file đúng thư mục theo quy định
- Đặt tên file theo format chuẩn
- Cập nhật README.md của thư mục đó (nếu cần)

---

## RULES KỸ THUẬT — KHÔNG ĐƯỢC VI PHẠM

| Rule | Chi tiết |
|------|----------|
| **Tài liệu & Báo cáo** | **Đọc `docs/DOCUMENTATION_GUIDELINES.md` trước khi tạo file .md mới** |
| Không xóa merge logic | `services/dataMapper.ts` — offline-first fallback |
| Không hardcode secrets | Chỉ dùng `.env.local` |
| Không thêm `updated_at`/`created_at` | Vào Supabase payload nếu bảng không có cột đó |
| ID mới | Dùng `crypto.randomUUID()` hoặc `generateId()` |
| Tài chính/lương thay đổi | Phải gọi `auditLog()` vào bảng `audit_logs` |
| Sau sửa `businessLogic.ts` | Chạy `npm test` — 43 tests phải pass |
| Bảng/cột Supabase mới | Viết SQL vào `supabase_setup.sql` |
| Claude API | Chỉ qua `routes/ai.ts`, không gọi từ frontend |
| `dangerouslySetInnerHTML` | Phải wrap bằng `DOMPurify.sanitize()` |
