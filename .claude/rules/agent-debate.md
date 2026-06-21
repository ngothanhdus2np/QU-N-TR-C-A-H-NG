# Quy tắc tranh luận đa agent — CFO Brain 4.0

> Áp dụng khi nhiều AI agent (Claude, Codex, Gemini, ChatGPT...) cùng đánh giá một file kế hoạch.
> Mục tiêu là trọng tài — không phải bất kỳ agent nào. Đạt được mục tiêu tốt nhất thì dừng.

---

## 1. Mục tiêu là trọng tài

Mỗi file kế hoạch phải khai báo **MỤC TIÊU DUY NHẤT** ở đầu file, dạng:

```markdown
> **Mục tiêu tranh luận**: [1 câu mô tả kết quả cần đạt — cụ thể, đo được]
```

Ví dụ:
> **Mục tiêu tranh luận**: Xác định thiết kế kỹ thuật tối ưu để sinh nội dung sản phẩm đa nền tảng — ít rủi ro, triển khai được trong 1 tuần, không phá vỡ code hiện tại.

Khi mọi agent đồng ý rằng mục tiêu đã được đáp ứng tốt nhất có thể → tranh luận kết thúc.

---

## 2. Cấu trúc bắt buộc mỗi vòng

Mỗi agent tham gia phải ghi đúng cấu trúc này vào file, dưới section riêng:

```markdown
## VÒNG [số] — REVIEW: [Tên Agent]

> **Agent**: [Tên / vai trò]
> **Ngày**: YYYY-MM-DD
> **Vòng**: [1 / 2 / 3]

### Đồng ý
- [Điểm đồng ý 1 — giải thích ngắn tại sao]
- [Điểm đồng ý 2]

### Phản biện
- **[Tên điểm phản biện]**: [Mô tả vấn đề] → **Phương án thay thế**: [Đề xuất cụ thể]
- **[Tên điểm phản biện 2]**: ...

### Đánh giá mục tiêu
[Nhận định: Kế hoạch hiện tại có đạt mục tiêu không? Còn thiếu gì?]

### Điều kiện để tôi đồng ý dừng
[Ghi rõ: cần thay đổi gì thì agent này sẽ đồng ý rằng mục tiêu đã đạt]
```

---

## 3. Quy tắc từng vòng

### Vòng 1 — Đánh giá độc lập
- Mỗi agent đọc plan gốc và ghi nhận xét theo cấu trúc trên
- **Không đọc ý kiến của agent khác trước khi viết vòng 1**
- Mục đích: giữ quan điểm độc lập, tránh groupthink

### Vòng 2 — Phản hồi chéo
- Mỗi agent đọc toàn bộ nhận xét vòng 1 của các agent khác
- Ghi phản hồi: đồng ý / không đồng ý với từng phản biện, và lý do
- Có thể rút lại phản biện nếu agent khác giải thích hợp lý
- Phải ghi rõ: "Tôi rút phản biện X vì..." hoặc "Tôi giữ phản biện X vì..."

### Vòng 3 — Chốt và đồng thuận
- Chỉ ghi những điểm còn bất đồng thực sự (không lặp lại những gì đã đồng ý)
- Mỗi agent phải tuyên bố một trong hai:
  - `✅ ĐỒNG Ý DỪNG` — mục tiêu đã được đáp ứng tốt nhất
  - `⚠️ CÒN BẤT ĐỒNG` — ghi rõ điểm còn bất đồng và tại sao quan trọng
- Nếu sau vòng 3 vẫn còn bất đồng → ghi lại để người dùng quyết định thủ công

---

## 4. Điều kiện dừng

Tranh luận kết thúc khi **một trong hai điều kiện** xảy ra:

**Điều kiện A — Đồng thuận tự nhiên:**
Tất cả agent tuyên bố `✅ ĐỒNG Ý DỪNG` trong cùng một vòng.

**Điều kiện B — Hết vòng:**
Đã qua vòng 3. Dù còn bất đồng, tiến hành tổng hợp và đánh dấu rõ những điểm còn tranh cãi để người dùng phán quyết.

---

## 5. Bước tổng hợp — Kế hoạch Chốt Cuối Cùng

Sau khi dừng tranh luận, agent được chỉ định tổng hợp (thường là Claude) viết section sau vào cuối file:

```markdown
---

# KẾ HOẠCH CHỐT CUỐI CÙNG

> **Tổng hợp bởi**: [Tên agent]
> **Ngày chốt**: YYYY-MM-DD
> **Dựa trên**: [Số vòng] vòng tranh luận

## Những điểm được tất cả đồng ý
- [Điểm 1]
- [Điểm 2]

## Thay đổi so với plan gốc
| Điểm thay đổi | Plan gốc | Plan chốt | Lý do |
|---|---|---|---|
| [tên] | [cũ] | [mới] | [lý do được đa số chấp nhận] |

## Điểm còn bất đồng (nếu có) — Người dùng quyết định
- **[Vấn đề]**: Agent A đề xuất X, Agent B đề xuất Y → **Người dùng chọn**: ___

## Kế hoạch thực hiện (đã được đồng thuận)
[Viết lại toàn bộ kế hoạch sau khi tích hợp tất cả thay đổi đã đồng ý]

## Acceptance criteria
[Điều kiện để biết kế hoạch đã hoàn thành]
```

---

## 6. Quy tắc ghi chép bắt buộc

- **Ghi tên agent rõ ràng** — không được viết "reviewer" hay "AI" chung chung
- **Mỗi phản biện phải kèm phương án thay thế** — phản biện không có đề xuất = không hợp lệ
- **Không xóa ý kiến cũ** — chỉ thêm, không sửa những gì agent khác đã ghi
- **Timestamp mỗi vòng** — để biết thứ tự và ngữ cảnh

---

## 7. Template khai báo nhanh cho file plan mới

Dán vào đầu mỗi file plan cần tranh luận đa agent:

```markdown
> **Mục tiêu tranh luận**: [điền]
> **Số vòng tối đa**: 3
> **Agents tham gia**: [điền danh sách]
> **Agent tổng hợp**: Claude
> **Trạng thái**: Vòng ___ / 3
```
