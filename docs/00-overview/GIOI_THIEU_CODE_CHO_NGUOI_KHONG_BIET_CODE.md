# 🏪 Giới thiệu App CFO Brain 4.0 - Dành cho người không biết code

> Tài liệu này giải thích cách hoạt động của app bằng ngôn ngữ đời thường, không cần kiến thức lập trình.

---

## 🎯 App này làm gì?

**CFO Brain 4.0** là một hệ thống quản lý cửa hàng bán lẻ thông minh, giống như một "trợ lý ảo" giúp chủ cửa hàng:

- 🛒 **Bán hàng** tại quầy (như máy tính tiền)
- 📦 **Quản lý kho** (nhập hàng, xuất hàng, kiểm kê)
- 💰 **Theo dõi doanh thu** và lợi nhuận
- 👥 **Tính lương** nhân viên tự động
- 📊 **Phân tích kinh doanh** bằng AI (trí tuệ nhân tạo)
- 📱 **Đăng bài Facebook** tự động để quảng cáo

---

## 🏗️ App được xây dựng như thế nào?

Hãy tưởng tượng app như một **ngôi nhà 3 tầng**:

### 🏠 Tầng 1: Giao diện (Frontend) - Cái bạn nhìn thấy

Đây là phần mà người dùng nhìn thấy và tương tác:
- **Màn hình bán hàng** với nút bấm, ô nhập số
- **Bảng biểu, biểu đồ** hiển thị doanh thu
- **Form nhập liệu** để thêm sản phẩm, nhân viên

**Công nghệ sử dụng:**
- **React** - Giống như bộ lego để xây dựng giao diện
- **TypeScript** - Ngôn ngữ lập trình có "kiểm tra lỗi tự động"
- **Vite** - Công cụ giúp app chạy nhanh hơn

### 🏢 Tầng 2: Máy chủ (Backend) - Bộ não xử lý

Đây là phần "ẩn" xử lý logic phức tạp:
- **Tính toán** (ví dụ: tổng tiền, thuế, lương)
- **Kết nối với ngân hàng dữ liệu** để lưu/lấy thông tin
- **Gọi AI** để phân tích và tư vấn
- **Gửi email** thông báo cuối ngày

**Công nghệ sử dụng:**
- **Express.js** - Giống như "tổng đài viên" nhận yêu cầu và trả lời
- **Node.js** - Môi trường để chạy code JavaScript trên máy chủ

### 🗄️ Tầng 3: Cơ sở dữ liệu (Database) - Kho lưu trữ

Nơi lưu trữ tất cả thông tin:
- Danh sách sản phẩm (12,739 sản phẩm!)
- Lịch sử bán hàng
- Thông tin nhân viên
- Doanh thu từng ngày

**Công nghệ sử dụng:**
- **Supabase** - Dịch vụ lưu trữ dữ liệu trên đám mây (cloud)
- **PostgreSQL** - Loại cơ sở dữ liệu chuyên nghiệp

---

## 📂 Cấu trúc thư mục - Giống như tủ hồ sơ

Hãy tưởng tượng code được sắp xếp trong các ngăn tủ:

### 📁 `components/` - Các bộ phận giao diện

Giống như **các mảnh ghép lego**, mỗi file là một phần của giao diện:

- **`pos/`** (40 file) - Màn hình bán hàng
  - `POSComputer.tsx` - Màn hình chính của quầy thu ngân
  - `POSCart.tsx` - Giỏ hàng hiển thị sản phẩm đã chọn
  - `POSCheckout.tsx` - Màn hình thanh toán
  
- **`revenue/`** - Màn hình quản lý doanh thu
- **`payroll/`** - Màn hình tính lương
- **`expense/`** - Màn hình quản lý chi phí
- **`dashboard/`** - Trang tổng quan (dashboard)

**Ví dụ dễ hiểu:**
- `POSCart.tsx` giống như "tờ giấy ghi đơn hàng" ở quầy thu ngân
- `Dashboard.tsx` giống như "bảng tổng kết" treo tường văn phòng

### 📁 `services/` - Các dịch vụ hỗ trợ

Giống như **các nhân viên chuyên môn**, mỗi file làm một việc cụ thể:

- **`apiService.ts`** - Nhân viên "giao dịch với ngân hàng dữ liệu"
  - Lưu sản phẩm mới
  - Lấy danh sách đơn hàng
  - Cập nhật thông tin nhân viên

- **`emailService.ts`** - Nhân viên "gửi email"
  - Gửi báo cáo cuối ngày cho chủ cửa hàng

- **`marketingClaudeService.ts`** - Nhân viên "marketing AI"
  - Viết caption Facebook tự động
  - Phân tích xu hướng bán hàng

**Ví dụ dễ hiểu:**
- `apiService.ts` giống như "thủ quỹ" - quản lý tiền vào/ra két
- `emailService.ts` giống như "bưu tá" - gửi thư cho khách hàng

### 📁 `hooks/` - Các "móc" logic tái sử dụng

Giống như **các công thức nấu ăn** có thể dùng lại nhiều lần:

- **`useAppData.ts`** - Công thức "quản lý dữ liệu toàn app"
  - Lưu trạng thái hiện tại (đang ở trang nào, giỏ hàng có gì)
  - Đồng bộ dữ liệu với server

- **`useOfflineSync.ts`** - Công thức "làm việc khi mất mạng"
  - Lưu dữ liệu tạm trên máy
  - Tự động đồng bộ khi có mạng trở lại

**Ví dụ dễ hiểu:**
- `useAppData.ts` giống như "sổ tay ghi chép" của cửa hàng
- `useOfflineSync.ts` giống như "két dự phòng" khi ngân hàng đóng cửa

### 📁 `routes/` - Các "đường đi" của yêu cầu

Giống như **bảng chỉ dẫn đường**, mỗi file xử lý một loại yêu cầu:

- **`ai.ts`** - Đường đi đến AI (Claude)
  - `/api/ai/chat` - Trò chuyện với AI
  - `/api/ai/analyze` - Phân tích dữ liệu

- **`facebook.ts`** - Đường đi đến Facebook
  - Đăng nhập Facebook
  - Đăng bài tự động

- **`notifications.ts`** - Đường đi đến thông báo
  - Gửi báo cáo cuối ngày
  - Cảnh báo hết hàng

**Ví dụ dễ hiểu:**
- `ai.ts` giống như "đường đến văn phòng tư vấn"
- `facebook.ts` giống như "đường đến phòng marketing"

### 📁 `src/lib/` - Thư viện tính toán

Giống như **máy tính chuyên dụng**, chứa các công thức tính toán:

- **`businessLogic.payroll.ts`** - Công thức tính lương
  ```
  Lương = Lương cơ bản + Thưởng - Phạt - Bảo hiểm
  ```

- **`businessLogic.revenue.ts`** - Công thức tính doanh thu
  ```
  Lợi nhuận = Doanh thu - Giá vốn - Chi phí
  ```

- **`businessLogic.inventory.ts`** - Công thức quản lý kho
  ```
  Tồn kho = Tồn đầu + Nhập - Xuất
  ```

**Ví dụ dễ hiểu:**
- `businessLogic.payroll.ts` giống như "bảng tính Excel lương"
- `businessLogic.revenue.ts` giống như "sổ sách kế toán"

### 📁 `types.ts` - Bản thiết kế dữ liệu

Giống như **bản vẽ kiến trúc**, định nghĩa cấu trúc dữ liệu:

```typescript
// Ví dụ: Định nghĩa "Sản phẩm" phải có những thông tin gì
Product = {
  id: "SP001",           // Mã sản phẩm
  name: "Áo thun",       // Tên
  price: 150000,         // Giá bán
  cost: 80000,           // Giá vốn
  stock: 50              // Số lượng tồn
}
```

**Ví dụ dễ hiểu:**
- `types.ts` giống như "mẫu đơn" - quy định phải điền đủ thông tin gì

---

## 🔄 Luồng hoạt động - Từ khi bấm nút đến khi có kết quả

### Ví dụ: Bán 1 sản phẩm

**Bước 1: Người dùng bấm nút "Thêm vào giỏ"**
- File `POSComputer.tsx` nhận sự kiện click
- Gọi hàm `addToCart()` trong `useAppData.ts`

**Bước 2: Cập nhật giỏ hàng**
- `useAppData.ts` tính tổng tiền mới
- Cập nhật giao diện (giỏ hàng hiện 1 sản phẩm)

**Bước 3: Người dùng bấm "Thanh toán"**
- File `POSCheckout.tsx` hiển thị màn hình thanh toán
- Người dùng chọn phương thức (tiền mặt/chuyển khoản)

**Bước 4: Lưu đơn hàng**
- Gọi `apiService.ts` → `upsertItem('pos_orders', orderData)`
- `apiService.ts` gửi yêu cầu đến server (`server.ts`)
- Server lưu vào database Supabase

**Bước 5: Cập nhật kho**
- Tự động trừ số lượng tồn kho
- Ghi log vào bảng `audit_logs` (nhật ký kiểm toán)

**Bước 6: In hóa đơn**
- Hiển thị modal `POSReceiptModal.tsx`
- Người dùng có thể in hoặc gửi email

---

## 🤖 AI Agent - "Trợ lý ảo" thông minh

App có 3 AI Agent (trợ lý AI) chuyên biệt:

### 1. 🧠 CFO Agent - Giám đốc tài chính ảo
**Nhiệm vụ:** Tư vấn kinh doanh
- Phân tích doanh thu: "Tháng này lãi bao nhiêu?"
- Đề xuất chiến lược: "Nên giảm giá sản phẩm nào?"
- Cảnh báo rủi ro: "Chi phí tăng bất thường!"

**File code:** `services/agents/cfoAgent.ts`

### 2. 🔔 Alert Agent - Nhân viên cảnh báo
**Nhiệm vụ:** Theo dõi và cảnh báo
- Hết hàng: "Sản phẩm X còn 5 cái!"
- Doanh thu thấp: "Hôm nay bán ít hơn 30% so với hôm qua"
- Nhân viên nghỉ: "Mai có 3 người nghỉ phép"

**File code:** `services/agents/alertAgent.ts`

### 3. 📊 EOD Agent - Nhân viên báo cáo cuối ngày
**Nhiệm vụ:** Tổng kết mỗi ngày
- Gửi email báo cáo lúc 22:00
- Tổng hợp: doanh thu, lợi nhuận, top sản phẩm bán chạy
- So sánh với ngày hôm qua

**File code:** `services/agents/eodAgent.ts`

**Ví dụ email tự động:**
```
📊 Báo cáo ngày 14/05/2026

💰 Doanh thu: 15.500.000đ (+12% so với hôm qua)
📈 Lợi nhuận: 4.200.000đ (27% biên lợi nhuận)
🏆 Top 3 bán chạy:
   1. Áo thun trắng - 45 cái
   2. Quần jean - 32 cái
   3. Giày thể thao - 28 đôi

⚠️ Cảnh báo:
   - Áo khoác đen còn 3 cái (cần nhập thêm)
```

---

## 🔐 Bảo mật - Giữ an toàn dữ liệu

### 1. Xác thực người dùng
- Phải đăng nhập mới vào được app
- Mật khẩu được mã hóa (không ai đọc được, kể cả lập trình viên)

### 2. Phân quyền
- **Chủ cửa hàng:** Xem tất cả, sửa tất cả
- **Thu ngân:** Chỉ bán hàng, không xem báo cáo tài chính
- **Kho:** Chỉ nhập/xuất hàng, không xem lương

### 3. Nhật ký kiểm toán (Audit Log)
Mọi thao tác quan trọng đều được ghi lại:
- Ai đã sửa giá sản phẩm?
- Ai đã xóa đơn hàng?
- Ai đã duyệt lương?

**File code:** `components/audit/AuditListPage.tsx`

---

## 📱 Tính năng đặc biệt

### 1. 🌐 Làm việc offline (không cần mạng)
- Khi mất mạng, app vẫn hoạt động bình thường
- Dữ liệu lưu tạm trên máy (LocalStorage)
- Khi có mạng trở lại, tự động đồng bộ lên server

**File code:** `hooks/useOfflineSync.ts`

### 2. 📊 Biểu đồ trực quan
- Doanh thu theo ngày/tuần/tháng
- Top sản phẩm bán chạy
- Xu hướng lợi nhuận

**Công nghệ:** Recharts (thư viện vẽ biểu đồ)

### 3. 🎨 Giao diện mượt mà
- Hiệu ứng chuyển trang mượt
- Animation khi thêm sản phẩm vào giỏ
- Responsive (tự động co giãn trên điện thoại/máy tính bảng)

**Công nghệ:** Framer Motion (thư viện animation)

### 4. 📤 Xuất Excel
- Xuất danh sách sản phẩm
- Xuất báo cáo doanh thu
- Xuất bảng lương

**File code:** `services/exportService.ts`

---

## 🧪 Kiểm thử - Đảm bảo không lỗi

App có **45 bài test tự động** kiểm tra logic tính toán:

### Ví dụ test tính lương:
```
Test: Tính lương nhân viên có thưởng
- Lương cơ bản: 5.000.000đ
- Thưởng: 1.000.000đ
- Bảo hiểm: 500.000đ
- Kết quả mong đợi: 5.500.000đ
✅ PASS (kết quả đúng)
```

**Chạy test:** `npm test`  
**Tỷ lệ phủ:** 74% code được test (mục tiêu 70-80%)

---

## 🚀 Cách chạy app

### Bước 1: Cài đặt
```bash
npm install
```
(Giống như "cài đặt ứng dụng" trên điện thoại)

### Bước 2: Cấu hình
- Tạo file `.env.local` (file chứa thông tin bí mật)
- Điền thông tin kết nối database, API key AI

### Bước 3: Chạy
```bash
npm run dev
```
- App chạy tại: `http://localhost:3000`
- Mở trình duyệt, vào địa chỉ trên

---

## 📊 Con số ấn tượng

- **12,739 sản phẩm** trong kho
- **40 file code** chỉ riêng màn hình bán hàng (POS)
- **26 bảng** trong database
- **45 bài test** tự động
- **74% code coverage** (tỷ lệ code được test)
- **3 AI Agents** chuyên biệt

---

## 🎯 Tóm tắt - Hiểu nhanh trong 30 giây

**CFO Brain 4.0** là app quản lý cửa hàng thông minh:

1. **Giao diện** (React) - Cái bạn nhìn thấy
2. **Máy chủ** (Express) - Bộ não xử lý
3. **Database** (Supabase) - Kho lưu trữ
4. **AI** (Claude) - Trợ lý tư vấn

**Tính năng chính:**
- 🛒 Bán hàng tại quầy
- 📦 Quản lý kho
- 💰 Tính lương tự động
- 📊 Báo cáo AI
- 📱 Đăng Facebook tự động
- 🌐 Làm việc offline

**Đặc điểm nổi bật:**
- ✅ Không cần mạng vẫn hoạt động
- ✅ AI tư vấn kinh doanh
- ✅ Tự động hóa cao
- ✅ Bảo mật tốt
- ✅ Giao diện đẹp, dễ dùng

---

## 📚 Tài liệu liên quan

- **`README.md`** - Hướng dẫn cài đặt và chạy app
- **`PROJECT_STRUCTURE.md`** - Cấu trúc chi tiết (dành cho lập trình viên)
- **`CLAUDE.md`** - Quy tắc phát triển (dành cho AI)
- **`DECISIONS.md`** - Lý do đằng sau các quyết định kỹ thuật
- **`ROADMAP.md`** - Kế hoạch phát triển tương lai

---

**Cập nhật lần cuối:** 14/05/2026  
**Người viết:** CFO Brain Development Team  
**Mục đích:** Giúp người không biết code hiểu cách app hoạt động
