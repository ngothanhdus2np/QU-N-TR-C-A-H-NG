# 📱 HƯỚNG DẪN PHÁT HÀNH APP QUA TESTFLIGHT

## 🎯 TESTFLIGHT LÀ GÌ?

TestFlight là công cụ chính thức của Apple để phát hành app thử nghiệm (beta testing).

**Ưu điểm:**
- ✅ Hợp pháp 100%
- ✅ Lên đến 10,000 người dùng
- ✅ Không cần review nghiêm ngặt
- ✅ Dễ cập nhật
- ✅ Miễn phí (chỉ cần Apple Developer $99/năm)

**Nhược điểm:**
- ⚠️ App hết hạn sau 90 ngày (phải upload build mới)
- ⚠️ User phải cài TestFlight app trước
- ⚠️ Không chuyên nghiệp bằng App Store

---

## 📝 BƯỚC 1: CHUẨN BỊ

### **A. Đăng ký Apple Developer Account**

1. Truy cập: https://developer.apple.com/programs/
2. Đăng ký với Apple ID
3. Thanh toán $99/năm
4. Chờ duyệt (1-2 ngày)

### **B. Cài đặt Xcode (trên Mac)**

```bash
# Download từ App Store
# Hoặc từ developer.apple.com

# Kiểm tra version
xcode-select --version

# Cài đặt Command Line Tools
xcode-select --install
```

**Không có Mac?** → Dùng dịch vụ cloud build:
- **Codemagic**: https://codemagic.io/
- **Bitrise**: https://www.bitrise.io/
- **AppCenter**: https://appcenter.ms/

---

## 🛠️ BƯỚC 2: BUILD APP

### **Phương án A: Dùng Capacitor (Khuyến nghị)**

```bash
# 1. Cài đặt Capacitor
npm install @capacitor/core @capacitor/cli
npx cap init "CFO Brain" "com.phucsang.cfobrain"

# 2. Thêm iOS platform
npx cap add ios

# 3. Build web app
npm run build

# 4. Copy sang iOS
npx cap copy ios
npx cap sync

# 5. Mở trong Xcode
npx cap open ios
```

### **Phương án B: Dùng PWABuilder**

```bash
# 1. Truy cập https://www.pwabuilder.com/
# 2. Nhập URL: https://your-app-url.com
# 3. Click "Package for Stores"
# 4. Chọn "iOS" → Download
# 5. Giải nén và mở trong Xcode
```

---

## 🔧 BƯỚC 3: CẤU HÌNH TRONG XCODE

### **A. Mở project**

```bash
# Nếu dùng Capacitor
cd ios/App
open App.xcworkspace

# Nếu dùng PWABuilder
open CFOBrain.xcodeproj
```

### **B. Cấu hình General**

1. Chọn project trong sidebar trái
2. Tab "General"
3. Điền thông tin:

```
Display Name: CFO Brain
Bundle Identifier: com.phucsang.cfobrain
Version: 1.0.0
Build: 1

Deployment Info:
- iOS: 13.0 (hoặc cao hơn)
- iPhone, iPad (hoặc chỉ iPhone)

Signing & Capabilities:
- Team: [Chọn Apple Developer Account của bạn]
- Automatically manage signing: ✅ Bật
```

### **C. Thêm icons**

1. Click vào "App Icon" trong Assets.xcassets
2. Kéo thả icons vào các ô (cần đầy đủ kích thước)
3. Hoặc dùng tool tự động:

```bash
# Tạo tất cả icons từ 1 file
npm install -g app-icon

app-icon generate -i logo.png -o ios/App/App/Assets.xcassets/AppIcon.appiconset
```

### **D. Cấu hình Info.plist**

Thêm các quyền cần thiết:

```xml
<!-- ios/App/App/Info.plist -->
<dict>
  <!-- Tên app -->
  <key>CFBundleDisplayName</key>
  <string>CFO Brain</string>
  
  <!-- Camera (nếu cần quét mã vạch) -->
  <key>NSCameraUsageDescription</key>
  <string>Cần camera để quét mã vạch sản phẩm</string>
  
  <!-- Location (nếu cần chấm công GPS) -->
  <key>NSLocationWhenInUseUsageDescription</key>
  <string>Cần vị trí để chấm công</string>
  
  <!-- Photo Library -->
  <key>NSPhotoLibraryUsageDescription</key>
  <string>Cần truy cập ảnh để upload hình sản phẩm</string>
</dict>
```

---

## 📦 BƯỚC 4: ARCHIVE & UPLOAD

### **A. Archive app**

1. Trong Xcode, chọn menu:
   - **Product** → **Destination** → **Any iOS Device (arm64)**
2. Chọn menu:
   - **Product** → **Archive**
3. Chờ build (5-15 phút)

**Nếu gặp lỗi:**
```bash
# Lỗi signing
→ Kiểm tra Team trong Signing & Capabilities
→ Đảm bảo Bundle ID unique

# Lỗi build
→ Clean build folder: Product → Clean Build Folder
→ Thử lại
```

### **B. Upload lên App Store Connect**

1. Sau khi Archive xong, cửa sổ Organizer tự động mở
2. Chọn archive vừa build
3. Click **Distribute App**
4. Chọn **App Store Connect** → Next
5. Chọn **Upload** → Next
6. Chọn signing options:
   - **Automatically manage signing** (khuyến nghị)
   - Hoặc **Manually manage signing**
7. Click **Upload**
8. Chờ upload (5-10 phút)

---

## 🚀 BƯỚC 5: TẠO TESTFLIGHT BUILD

### **A. Truy cập App Store Connect**

1. Đăng nhập: https://appstoreconnect.apple.com/
2. Click **My Apps**
3. Nếu chưa có app:
   - Click **+** → **New App**
   - Điền thông tin:
     - Platform: iOS
     - Name: CFO Brain 4.0
     - Primary Language: Vietnamese
     - Bundle ID: com.phucsang.cfobrain
     - SKU: cfobrain-001
   - Click **Create**

### **B. Chờ build xử lý**

1. Vào app → Tab **TestFlight**
2. Phần **iOS Builds** sẽ hiện build đang xử lý
3. Trạng thái:
   - **Processing**: Đang xử lý (10-30 phút)
   - **Missing Compliance**: Cần khai báo mã hóa
   - **Ready to Submit**: Sẵn sàng
   - **Testing**: Đang test

### **C. Khai báo Export Compliance**

1. Click vào build
2. Phần **Export Compliance**:
   - **Does your app use encryption?**
   - Chọn **No** (nếu chỉ dùng HTTPS thông thường)
   - Hoặc **Yes** → Trả lời thêm câu hỏi
3. Click **Start Internal Testing**

---

## 👥 BƯỚC 6: THÊM TESTER

### **A. Internal Testing (Nội bộ)**

**Giới hạn:** 100 người (phải có Apple ID trong team)

1. Tab **TestFlight** → **Internal Testing**
2. Click **+** bên cạnh **Testers**
3. Chọn người test (phải thêm vào team trước)
4. Click **Add**

**Thêm người vào team:**
1. **Users and Access** (menu trái)
2. Click **+**
3. Nhập email
4. Chọn role: **App Manager** hoặc **Developer**
5. Gửi lời mời

### **B. External Testing (Công khai)** ⭐ KHUYẾN NGHỊ

**Giới hạn:** 10,000 người (bất kỳ ai có link)

1. Tab **TestFlight** → **External Testing**
2. Click **+** → **Create New Group**
3. Đặt tên group: "Public Beta"
4. Click **Create**
5. Click vào group vừa tạo
6. Click **Add Build**
7. Chọn build → **Next**
8. Điền thông tin:
   - **What to Test**: Mô tả tính năng cần test
   - **Test Information**: Hướng dẫn test
   - **App Review Information**: Thông tin liên hệ
9. Click **Submit for Review**

**Chờ Apple review:** 1-2 ngày (nhanh hơn App Store nhiều)

### **C. Thêm tester bằng email**

1. Trong group, click **Testers** → **+**
2. Nhập email của tester
3. Click **Add**
4. Tester sẽ nhận email mời

### **D. Tạo Public Link** ⭐ DỄ NHẤT

1. Trong group, bật **Public Link**
2. Copy link (dạng: https://testflight.apple.com/join/XXXXXX)
3. Chia sẻ link này cho user
4. User click link → Cài TestFlight → Cài app

---

## 📲 BƯỚC 7: USER CÀI ĐẶT APP

### **Hướng dẫn cho user:**

**Bước 1: Cài TestFlight**
1. Mở App Store trên iPhone/iPad
2. Tìm "TestFlight"
3. Tải app TestFlight (miễn phí, chính thức của Apple)

**Bước 2: Cài app của bạn**

**Cách A: Dùng link (Dễ nhất)**
1. Click vào link bạn gửi (https://testflight.apple.com/join/XXXXXX)
2. Tự động mở TestFlight
3. Click "Accept" → "Install"
4. Xong!

**Cách B: Dùng code**
1. Mở TestFlight
2. Click "Redeem"
3. Nhập code (bạn cung cấp)
4. Click "Redeem" → "Install"

**Bước 3: Mở app**
1. App xuất hiện trên màn hình chính
2. Có dấu chấm cam (beta)
3. Sử dụng bình thường

---

## 🔄 BƯỚC 8: CẬP NHẬT APP

### **Khi có phiên bản mới:**

```bash
# 1. Tăng version/build number
# Trong Xcode: General → Version: 1.0.1, Build: 2

# 2. Build lại
npm run build
npx cap copy ios
npx cap sync

# 3. Archive & Upload (như bước 4)
# Product → Archive → Distribute App

# 4. Trong App Store Connect
# TestFlight → Chọn group → Add Build → Chọn build mới

# 5. User tự động nhận thông báo update trong TestFlight
```

**Lưu ý:**
- Mỗi build chỉ hoạt động **90 ngày**
- Sau 90 ngày, phải upload build mới
- User sẽ nhận thông báo khi có update

---

## 📊 BƯỚC 9: THEO DÕI & FEEDBACK

### **A. Xem thống kê**

1. App Store Connect → TestFlight
2. Xem:
   - Số lượng tester
   - Số lượng session
   - Số lượng crash
   - Feedback từ user

### **B. Crash Reports**

1. Xcode → Window → Organizer
2. Tab **Crashes**
3. Xem chi tiết crash
4. Fix bug → Upload build mới

### **C. Thu thập feedback**

1. Trong TestFlight, user có thể:
   - Chụp screenshot + gửi feedback
   - Đánh giá app
2. Bạn nhận feedback trong App Store Connect

---

## 💡 TIPS & TRICKS

### **1. Tự động hóa build**

```bash
# Sử dụng Fastlane
gem install fastlane

# Khởi tạo
cd ios
fastlane init

# Tạo lane cho TestFlight
# fastlane/Fastfile
lane :beta do
  increment_build_number
  build_app(scheme: "App")
  upload_to_testflight
end

# Chạy
fastlane beta
```

### **2. Tạo QR Code cho link TestFlight**

```bash
# Dùng tool online
https://www.qr-code-generator.com/

# Hoặc dùng API
https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=https://testflight.apple.com/join/XXXXXX
```

### **3. Tạo landing page**

```html
<!DOCTYPE html>
<html>
<head>
  <title>Tải CFO Brain Beta</title>
  <meta name="viewport" content="width=device-width, initial-scale=1">
</head>
<body style="text-align: center; padding: 50px; font-family: Arial;">
  <h1>🎉 Tham gia Beta Test CFO Brain!</h1>
  
  <div style="margin: 30px 0;">
    <img src="app-icon.png" width="120" style="border-radius: 20px;">
  </div>
  
  <h2>Bước 1: Cài TestFlight</h2>
  <a href="https://apps.apple.com/app/testflight/id899247664" 
     style="display: inline-block; background: #007AFF; color: white; 
            padding: 15px 30px; text-decoration: none; border-radius: 10px; margin: 10px;">
    📲 Tải TestFlight
  </a>
  
  <h2>Bước 2: Cài CFO Brain</h2>
  <a href="https://testflight.apple.com/join/XXXXXX" 
     style="display: inline-block; background: #34C759; color: white; 
            padding: 15px 30px; text-decoration: none; border-radius: 10px; margin: 10px;">
    🚀 Tham gia Beta
  </a>
  
  <div style="margin-top: 50px;">
    <img src="qr-code.png" width="200">
    <p>Hoặc quét QR Code</p>
  </div>
</body>
</html>
```

### **4. Email template cho tester**

```
Tiêu đề: 🎉 Mời bạn test CFO Brain Beta!

Nội dung:
Xin chào,

Bạn được mời tham gia test phiên bản beta của CFO Brain - Hệ thống quản lý doanh nghiệp tích hợp AI.

📱 CÁCH CÀI ĐẶT:

Bước 1: Cài TestFlight
→ Mở App Store
→ Tìm "TestFlight"
→ Tải về (miễn phí)

Bước 2: Cài CFO Brain
→ Click link này: https://testflight.apple.com/join/XXXXXX
→ Hoặc mở TestFlight và nhập code: XXXXXX

✨ TÍNH NĂNG CHÍNH:
• Quản lý bán hàng POS
• Quản lý kho hàng
• Quản lý nhân sự & lương
• Phân tích doanh thu
• Tư vấn AI

📝 FEEDBACK:
Nếu gặp lỗi hoặc có góp ý, vui lòng:
• Chụp screenshot trong TestFlight
• Hoặc email: support@cfobrain.com

Cảm ơn bạn đã tham gia!

---
Team CFO Brain
```

---

## ⚠️ LƯU Ý QUAN TRỌNG

### **Giới hạn:**
- ⏰ Mỗi build chỉ hoạt động **90 ngày**
- 👥 Tối đa **10,000 external testers**
- 📱 Tối đa **100 internal testers**
- 🔢 Tối đa **100 builds** active cùng lúc

### **Quy định:**
- ✅ Được dùng cho beta testing
- ✅ Được thu thập feedback
- ❌ KHÔNG được dùng như App Store chính thức
- ❌ KHÔNG được bán app qua TestFlight
- ❌ KHÔNG được dùng cho production lâu dài

### **Best Practices:**
- 📅 Upload build mới mỗi 2-3 tháng (trước khi hết 90 ngày)
- 📝 Viết rõ "What to Test" mỗi build
- 🐛 Fix bug nhanh dựa trên feedback
- 📊 Theo dõi crash reports thường xuyên
- 💬 Trả lời feedback của tester

---

## 🎯 KẾT LUẬN

TestFlight là cách **TỐT NHẤT** để phát hành app iOS mà không cần lên App Store chính thức:

✅ **Ưu điểm:**
- Hợp pháp 100%
- Dễ dàng, nhanh chóng
- Lên đến 10,000 user
- Miễn phí (chỉ cần Apple Developer)
- Dễ cập nhật

❌ **Nhược điểm:**
- Build hết hạn sau 90 ngày
- User phải cài TestFlight trước
- Không chuyên nghiệp bằng App Store

**Phù hợp cho:**
- Beta testing
- Internal tools
- App cho nhóm nhỏ
- Test trước khi lên App Store chính thức

**Không phù hợp cho:**
- App thương mại lâu dài
- App cần độ tin cậy cao
- App cho khách hàng cuối

---

## 📞 HỖ TRỢ

Nếu gặp vấn đề:
- Apple Developer Support: https://developer.apple.com/support/
- TestFlight Help: https://developer.apple.com/testflight/

Chúc bạn thành công! 🚀
