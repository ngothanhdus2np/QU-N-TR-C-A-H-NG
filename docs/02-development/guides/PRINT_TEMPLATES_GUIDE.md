# Hướng dẫn Sử dụng Mẫu In

## 📍 Vị trí

Truy cập: **Cài đặt** → **Mẫu in**

## 🎯 Các loại mẫu in

### ✅ Đã hoàn thành
1. **Hóa đơn** - Mẫu in hóa đơn bán hàng (có template editor)
2. **Đổi hàng** - Mẫu in phiếu đổi hàng (có template editor) ⭐ MỚI

### 🔜 Sắp ra mắt
- Đặt hàng
- Hóa đơn sửa chữa
- Giao hàng
- Trả hàng
- Nhập hàng
- Phiếu thu
- Phiếu chi

## 📝 Cách sử dụng Template Editor

### Mẫu in Hóa đơn

#### Bước 1: Chọn mẫu
- Click tab **"Hóa đơn"**
- Chọn loại mẫu từ dropdown (Mẫu in hóa đơn, 80mm, A5)

#### Bước 2: Chỉnh sửa
- Click nút **Pencil** (✏️) để bật chế độ sửa
- Chỉnh sửa nội dung trong textarea bên trái
- Sử dụng **tokens** để hiển thị dữ liệu động

#### Bước 3: Xem preview
- Preview bên phải cập nhật **realtime**
- Kiểm tra số dòng ở góc dưới

#### Bước 4: In thử
- Click nút **"In thử"** để xem kết quả in
- Cửa sổ mới sẽ mở với định dạng 80mm

### Mẫu in Phiếu đổi hàng

Tương tự như mẫu hóa đơn, nhưng với tokens riêng cho phiếu đổi hàng.

## 🏷️ Tokens có sẵn

### Tokens chung
```
{Ten_Cua_Hang}           - Tên cửa hàng
{Dia_Chi_Chi_Nhanh}      - Địa chỉ chi nhánh
{Dien_Thoai}             - Số điện thoại
{Ngay}                   - Ngày (số)
{Thang}                  - Tháng (số)
{Nam}                    - Năm (số)
{Khach_Hang}             - Tên khách hàng
{So_Dien_Thoai}          - SĐT khách hàng
{Thu_Ngan}               - Tên thu ngân
```

### Tokens Hóa đơn
```
{Ma_Don_Hang}            - Mã hóa đơn
{Ten_Hang_Hoa}           - Tên sản phẩm
{Don_Gia}                - Đơn giá
{Don_Gia_Chiet_Khau}     - Đơn giá sau chiết khấu
{So_Luong}               - Số lượng
{Thanh_Tien}             - Thành tiền
{Tong_Tien_Hang}         - Tổng tiền hàng
{Chiet_Khau_Hoa_Don}     - Chiết khấu hóa đơn
{Tong_Cong}              - Tổng cộng
{Tong_Cong_Bang_Chu}     - Tổng cộng bằng chữ
{Phuong_Thuc_Thanh_Toan} - Phương thức thanh toán
```

### Tokens Phiếu đổi hàng
```
{Ma_Phieu_Doi}           - Mã phiếu đổi
{Ma_Don_Goc}             - Mã hóa đơn gốc
{Ten_Hang_Tra}           - Tên hàng trả lại
{Don_Gia_Tra}            - Đơn giá hàng trả
{So_Luong_Tra}           - Số lượng trả
{Thanh_Tien_Tra}         - Thành tiền trả
{Ly_Do_Tra}              - Lý do trả hàng
{Tong_Tra_Lai}           - Tổng trả lại
{Ten_Hang_Moi}           - Tên hàng mới
{Don_Gia_Moi}            - Đơn giá hàng mới
{So_Luong_Moi}           - Số lượng mới
{Thanh_Tien_Moi}         - Thành tiền mới
{Tong_Hang_Moi}          - Tổng hàng mới
{Loai_Chenh_Lech}        - "Khách cần trả thêm" hoặc "Hoàn lại khách"
{Chenh_Lech}             - Số tiền chênh lệch
{Ghi_Chu}                - Ghi chú đổi hàng
```

## 📐 Ví dụ Template

### Template Hóa đơn cơ bản
```
{Ten_Cua_Hang}
Địa chỉ: {Dia_Chi_Chi_Nhanh}
Điện thoại: {Dien_Thoai}

HÓA ĐƠN BÁN HÀNG
Số HĐ: {Ma_Don_Hang}
Ngày {Ngay} tháng {Thang} năm {Nam}

Khách hàng: {Khach_Hang}
SĐT: {So_Dien_Thoai}

Đơn giá                         SL       T.Tiền
{Ten_Hang_Hoa}
{Don_Gia_Chiet_Khau}           {So_Luong}       {Thanh_Tien}

Tổng tiền hàng: {Tong_Tien_Hang}
Chiết khấu: {Chiet_Khau_Hoa_Don}
Tổng thanh toán: {Tong_Cong}
{Tong_Cong_Bang_Chu}

Cảm ơn và hẹn gặp lại!
```

### Template Phiếu đổi hàng cơ bản
```
{Ten_Cua_Hang}
Địa chỉ: {Dia_Chi_Chi_Nhanh}
Điện thoại: {Dien_Thoai}

PHIẾU ĐỔI HÀNG
Số phiếu: {Ma_Phieu_Doi}
Ngày {Ngay} tháng {Thang} năm {Nam}

Khách hàng: {Khach_Hang}
Hóa đơn gốc: {Ma_Don_Goc}
Thu ngân: {Thu_Ngan}

--- HÀNG TRẢ LẠI ---
{Ten_Hang_Tra}
{Don_Gia_Tra}                  {So_Luong_Tra}       {Thanh_Tien_Tra}
Lý do: {Ly_Do_Tra}

Tổng trả lại: {Tong_Tra_Lai}

--- HÀNG MỚI ---
{Ten_Hang_Moi}
{Don_Gia_Moi}                  {So_Luong_Moi}       {Thanh_Tien_Moi}

Tổng hàng mới: {Tong_Hang_Moi}

{Loai_Chenh_Lech}: {Chenh_Lech}
Phương thức: {Phuong_Thuc_Thanh_Toan}

Ghi chú: {Ghi_Chu}

Cảm ơn và hẹn gặp lại!
```

## 🎨 Thiết kế

### Màu sắc preview
- **Hóa đơn:** Nền xanh dương nhạt (blue-50)
- **Phiếu đổi hàng:** Nền vàng nhạt (amber-50)

### Typography
- **Font:** Monospace (ui-monospace)
- **Size:** 12px
- **Line height:** 1.5

## 💡 Tips

1. **Căn chỉnh cột** - Sử dụng khoảng trắng để căn chỉnh
2. **Dòng trống** - Thêm dòng trống để tạo khoảng cách
3. **Tiêu đề** - Viết HOA để làm nổi bật
4. **Preview realtime** - Bật chế độ sửa để xem thay đổi ngay lập tức
5. **In thử trước** - Luôn in thử trước khi áp dụng

## 🖨️ In ấn

### Kích thước giấy
- **Mặc định:** 80mm (máy in nhiệt)
- **Tùy chọn:** A5, A4

### Cài đặt in
```css
@page { 
  size: 80mm auto; 
  margin: 0; 
}
```

## ❓ FAQ

**Q: Làm sao để thêm nhiều sản phẩm?**
A: Sử dụng tokens với suffix `_2` (ví dụ: `{Ten_Hang_Hoa_2}`)

**Q: Token không hiển thị đúng?**
A: Kiểm tra chính tả token, phải viết đúng như danh sách

**Q: Làm sao để thay đổi thông tin công ty?**
A: Vào Cài đặt → Cửa hàng → Cập nhật thông tin

**Q: Preview khác với kết quả in?**
A: Preview chỉ mang tính tham khảo, luôn in thử để kiểm tra

**Q: Có thể xuất PDF không?**
A: Tính năng này đang trong roadmap

## 🚀 Roadmap

- [ ] Phiếu trả hàng (chỉ trả, không đổi)
- [ ] Phiếu thu tiền
- [ ] Phiếu chi tiền
- [ ] Export PDF
- [ ] Email phiếu tự động
- [ ] QR code tracking
- [ ] Tùy chỉnh font và size
- [ ] Template marketplace
