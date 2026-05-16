# Quy trình Đánh giá Toàn bộ — CFO Brain 4.0

> Khi user nói **"đánh giá toàn bộ"** hoặc **"full audit"** → làm theo đúng file này.
> Đi qua **đủ 6 vai trò theo thứ tự**, không bỏ bước, không gộp.
> Cuối cùng xuất 1 báo cáo tổng hợp duy nhất.

---

## TRƯỚC KHI BẮT ĐẦU

Đọc 2 file này để có context:
- `docs/05-process/TODO.md` — biết vấn đề đã biết, tránh báo lại cái cũ
- `docs/05-process/HISTORY.md` — biết thay đổi gần nhất, tập trung vào chỗ vừa sửa

Hỏi user nếu chưa rõ **phạm vi đánh giá**:
- Toàn bộ app? Hay 1 module cụ thể (POS / lương / kho...)?
- Có code / file cụ thể nào cần focus không?

---

## THỨ TỰ ĐÁNH GIÁ — 6 VAI TRÒ

Thứ tự này có chủ đích: vấn đề nặng nhất kiểm tra trước.

```
1. LOGIC      → Số liệu đúng không? (quan trọng nhất)
2. SECURITY   → Có lỗ hổng bảo mật không?
3. REVIEWER   → Code có đúng chuẩn không?
4. PERFORMANCE → App có chậm / lag không?
5. QA         → Tính năng có hoạt động đúng không?
6. UX         → Người dùng có dùng được dễ không?
```

---

## BƯỚC 1 — LOGIC AUDIT

> Đọc `docs/06-evaluation/ROLE_LOGIC.md` và áp dụng toàn bộ.

Kiểm tra theo đúng quy trình trong file đó. Tập trung vào:
- Công thức doanh thu / lợi nhuận
- Công thức tồn kho
- Công thức lương
- Điểm tích lũy khách hàng
- Edge cases: giá trị âm, null, làm tròn

**Output bước này:** Bảng công thức đúng/sai + danh sách lỗi tính toán nếu có.

---

## BƯỚC 2 — SECURITY AUDIT

> Đọc `docs/06-evaluation/ROLE_SECURITY.md` và áp dụng toàn bộ.

Kiểm tra theo đúng 6 danh mục trong file đó. Tập trung vào:
- API key có lộ không
- Supabase RLS có bật không
- Auth có bị bypass không

**Output bước này:** Danh sách lỗ hổng theo mức độ Critical / High / Medium.

---

## BƯỚC 3 — CODE REVIEW

> Đọc `docs/06-evaluation/ROLE_REVIEWER.md` và áp dụng toàn bộ.

Kiểm tra theo đúng 7 danh mục A–G trong file đó.

**Output bước này:** Checklist 7 mục + danh sách vấn đề theo Critical / Medium / Low.

---

## BƯỚC 4 — PERFORMANCE AUDIT

> Đọc `docs/06-evaluation/ROLE_PERFORMANCE.md` và áp dụng toàn bộ.

Kiểm tra theo đúng 5 danh mục trong file đó. Ưu tiên:
- Re-render không cần thiết
- Query Supabase tốn kém
- Danh sách lớn không virtualize

**Output bước này:** Danh sách vấn đề hiệu năng + ước tính mức ảnh hưởng.

---

## BƯỚC 5 — QA

> Đọc `docs/06-evaluation/ROLE_QA.md` và áp dụng toàn bộ.

Kiểm tra theo đúng 5 bước trong file đó. Tập trung vào:
- Happy path chính (bán hàng, nhập kho, tính lương)
- Edge case người dùng thật hay gặp

**Output bước này:** Bảng test cases + risk matrix.

---

## BƯỚC 6 — UX AUDIT

> Đọc `docs/06-evaluation/ROLE_UX.md` và áp dụng toàn bộ.

Kiểm tra theo đúng 5 danh mục trong file đó. Tập trung vào:
- Luồng bán hàng POS (quan trọng nhất)
- Phản hồi khi lỗi
- Ngôn ngữ nhất quán

**Output bước này:** Danh sách friction points theo mức độ ảnh hưởng.

---

## BÁO CÁO TỔNG HỢP CUỐI CÙNG

Sau khi xong 6 bước, xuất báo cáo theo format này:

```
# Báo cáo Đánh giá Toàn bộ — CFO Brain 4.0
Ngày: [YYYY-MM-DD]
Phạm vi: [toàn bộ app / module X]
Người thực hiện: [tên agent]

---

## Tổng quan nhanh

| Vai trò | Trạng thái | Số vấn đề 🔴 | Số vấn đề 🟠 | Số vấn đề 🟡 |
|---------|-----------|-------------|-------------|-------------|
| Logic & Tính toán | ✅/⚠️/❌ | X | X | X |
| Security | ✅/⚠️/❌ | X | X | X |
| Code Review | ✅/⚠️/❌ | X | X | X |
| Performance | ✅/⚠️/❌ | X | X | X |
| QA | ✅/⚠️/❌ | X | X | X |
| UX | ✅/⚠️/❌ | X | X | X |

---

## 🔴 Phải fix ngay (Critical)

> Những vấn đề này ảnh hưởng trực tiếp đến tiền, bảo mật, hoặc dữ liệu.

1. **[Tiêu đề ngắn]** — [vai trò phát hiện]
   - Vấn đề: [mô tả cụ thể]
   - File: [đường dẫn + dòng]
   - Hậu quả: [nếu không fix]
   - Hướng fix: [gợi ý cụ thể]

2. ...

---

## 🟠 Nên fix sớm (High)

> Ảnh hưởng đến vận hành hoặc có thể trở thành critical nếu để lâu.

1. **[Tiêu đề]** — [vai trò]
   - Vấn đề: [...]
   - File: [...]
   - Hướng fix: [...]

---

## 🟡 Cải thiện (Medium / Low)

> Không urgent nhưng nên làm để app tốt hơn.

1. [...]

---

## Chi tiết từng vai trò

### 1. Logic & Tính toán
[Copy output từ Bước 1]

### 2. Security
[Copy output từ Bước 2]

### 3. Code Review
[Copy output từ Bước 3]

### 4. Performance
[Copy output từ Bước 4]

### 5. QA
[Copy output từ Bước 5]

### 6. UX
[Copy output từ Bước 6]

---

## Đề xuất thứ tự xử lý

Dựa trên kết quả trên, làm theo thứ tự này:

1. [ ] [vấn đề critical nhất] — ước tính [X phút/giờ]
2. [ ] [...]
3. [ ] [...]

---

## Điểm tốt cần giữ

- [những phần đang làm tốt, không nên đụng vào]
```

---

## LƯU Ý

- **Không gộp bước** — mỗi vai trò có checklist riêng, phải đi đủ mới sang bước tiếp
- **Không báo lại vấn đề đã có trong TODO.md** — ghi chú "đã biết, đang có kế hoạch" là đủ
- **Ưu tiên Logic và Security** — nếu thời gian hạn chế, 2 bước này không được bỏ
- **Kết thúc bằng thứ tự xử lý cụ thể** — user cần biết làm gì trước, không phải chỉ danh sách lỗi
