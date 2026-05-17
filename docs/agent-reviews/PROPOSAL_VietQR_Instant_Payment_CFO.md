# Đề xuất Phương án: Tích hợp thanh toán chuyển khoản VietQR tự động xác thực (Instant Payment)

* **Agent Đề xuất:** CFO Agent
* **Ngày khởi tạo:** 2026-05-17
* **Trạng thái:** Đang tranh luận ⏳

---

## 1. PHƯƠNG ÁN ĐỀ XUẤT
* **Mô tả:** Tích hợp hệ thống VietQR động vào màn hình thanh toán POS. Khi chọn phương thức "Chuyển khoản / Thẻ / Ví", hệ thống sinh mã QR động chứa sẵn số tài khoản, số tiền và mã đơn hàng định dạng chuẩn VietQR. 
* **Cơ chế xác thực:** Tích hợp dịch vụ lắng nghe Webhook ngân hàng (Casso/SePay). Khi có biến động số dư khớp với mã đơn hàng, webhook sẽ gửi request về endpoint `/api/payments/webhook-vietqr` của server để tự động cập nhật trạng thái đơn là "Đã thanh toán" và in hóa đơn tại POS.

---

## 2. ĐỐI THOẠI & TRANH LUẬN CHÉO (DEBATE LOG)

### 💬 CFO Agent (Góc nhìn tối ưu dòng tiền & Chi phí)
> "Tôi đề xuất tích hợp **SePay** hoặc **Casso** vì chi phí vận hành rất rẻ (khoảng 30,000đ - 50,000đ/tháng cho 1 cửa hàng), dòng tiền chuyển khoản đi trực tiếp vào tài khoản ngân hàng của chủ cửa hàng Phúc Sang mà không bị giữ lại bởi cổng thanh toán trung gian. Khách mua giày dép có xu hướng chuyển khoản quét mã rất cao (chiếm > 60% giao dịch hiện nay)."

### ⚡ Operations Agent (Góc nhìn vận hành POS & Thu ngân)
> "Tôi rất đồng ý về mặt tiện ích, nhưng lo ngại về **độ trễ (latency)**. Khi cửa hàng đông khách vào giờ cao điểm, nếu ngân hàng bị nghẽn mạng và webhook phản hồi chậm quá 10 giây, thu ngân không thể để khách đứng chờ. 
> 
> **Đề xuất bổ sung:** POS cần có một nút **'Xác nhận thủ công' (Manual Override)** để thu ngân chủ động duyệt thanh toán nếu khách đưa màn hình điện thoại đã chuyển tiền thành công, tránh làm nghẽn hàng đợi checkout."

### 🛡️ Security Agent (Góc nhìn bảo mật dữ liệu)
> "Nếu có nút 'Xác nhận thủ công', chúng ta cần ghi log bảo mật (Audit Log) rõ ràng: *Ai đã ấn xác nhận thủ công, vào lúc nào*.
> 
> Ngoài ra, endpoint `/api/payments/webhook-vietqr` nhận dữ liệu từ Casso/SePay cần được bảo vệ chặt chẽ bằng **API Key / Signature Verification** trong headers để tránh kẻ xấu giả mạo request ngân hàng chuyển khoản khống để lừa hệ thống tự động xuất hóa đơn."

### 💬 CFO Agent (Thống nhất & Phản hồi)
> "Ý kiến của Operations Agent và Security Agent cực kỳ chuẩn xác. Tôi xin tổng hợp giải pháp khắc phục:
> 1. Thêm nút 'Duyệt thủ công' trong UI thanh toán nhưng sẽ yêu cầu phân quyền Admin hoặc ghi đè mật khẩu quản lý, đồng thời tự động chèn 1 dòng log giao dịch dạng `manual_override_by` vào bảng `inventory_transactions`.
> 2. Endpoint webhook của chúng ta sẽ sử dụng cơ chế bảo mật `HMAC Signature` xác thực chữ ký số được gửi kèm từ Casso/SePay."

---

## 3. BẢNG SO SÁNH CÁC HƯỚNG ĐI (TRADE-OFFS MATRIX)

| Phương án | Ưu điểm | Nhược điểm | Chi phí & Thời gian |
| :--- | :--- | :--- | :--- |
| **Cách 1: Quét QR tĩnh (Hiện tại)** | - Không tốn tiền duy trì hàng tháng.<br>- Không cần code backend. | - Thu ngân mất thời gian đối chiếu điện thoại.<br>- Dễ sai sót nhập nhầm số tiền. | - **0đ**<br>- Đã có sẵn. |
| **Cách 2: VietQR động + Webhook tự động (Đề xuất)** | - Tự động 100%, in bill sau 2 giây.<br>- Không sai sót số tiền.<br>- Chống giả mạo bill chuyển khoản. | - Phí duy trì 30k-50k/tháng.<br>- Cần cài đặt bảo mật Webhook chặt chẽ. | - **~50k/tháng**<br>- Thời gian code: **1-2 ngày**. |

---

## 4. KẾT LUẬN CUỐI CÙNG (CONSENSUS)
*(Đang chờ chủ cửa hàng duyệt trước khi các Agent đạt đồng thuận hoàn toàn)*
- **Phương án lựa chọn:** Mong muốn triển khai **Cách 2** kèm các biện pháp bảo mật của Security Agent và nút dự phòng của Operations Agent.
- **Kế hoạch hành động chi tiết:**
  - [ ] Thiết kế bảng `payment_logs` lưu trữ dữ liệu webhook ngân hàng.
  - [ ] Viết API endpoint `/api/payments/webhook-vietqr` bảo mật bằng Token Signature.
  - [ ] Thiết kế giao diện Dynamic QR Modal trên POS và logic tự động in hóa đơn khi có sự kiện thanh toán thành công.
