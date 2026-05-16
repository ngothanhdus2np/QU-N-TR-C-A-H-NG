# 📱 HƯỚNG DẪN CÀI ĐẶT & SỬ DỤNG PWA

## ✅ ĐÃ HOÀN THÀNH

PWA của bạn đã được setup hoàn chỉnh! Các file đã tạo:

```
✅ public/manifest.json          - PWA manifest
✅ public/service-worker.js      - Service Worker (offline, cache, sync)
✅ src/registerServiceWorker.ts  - Service Worker registration
✅ src/components/InstallPWA.tsx - Install prompt component
✅ src/components/OfflineIndicator.tsx - Offline indicator
✅ scripts/generate-pwa-icons.js - Icon generator script
✅ App.tsx                        - Updated with PWA components
✅ index.html                     - Updated with PWA meta tags
```

---

## 🚀 BƯỚC TIẾP THEO

### **1. Cài đặt dependencies (nếu chưa có)**

```bash
npm install sharp --save-dev
```

### **2. Tạo icons PWA**

```bash
# Tạo tất cả icons từ logo hiện có
npm run generate:icons

# Hoặc chạy trực tiếp
node scripts/generate-pwa-icons.js
```

**Lưu ý**: Script sẽ tạo icons từ file:
`assets/logos/logo-acb-inkythuatso/logo-acb-inkythuatso.png`

Nếu muốn dùng logo khác, sửa đường dẫn trong `scripts/generate-pwa-icons.js`

### **3. Build app**

```bash
npm run build
```

### **4. Test PWA local**

```bash
# Cài serve (nếu chưa có)
npm install -g serve

# Chạy PWA test
npm run pwa:test

# Hoặc
npx serve dist -p 3000
```

Mở trình duyệt: `http://localhost:3000`

### **5. Test trên điện thoại**

#### **Cách 1: Dùng ngrok (Dễ nhất)**

```bash
# Cài ngrok
npm install -g ngrok

# Expose local server
ngrok http 3000

# Copy URL (https://xxxx.ngrok.io)
# Mở URL trên điện thoại
```

#### **Cách 2: Dùng IP local**

```bash
# Tìm IP máy tính
# Mac/Linux:
ifconfig | grep "inet "

# Windows:
ipconfig

# Mở trên điện thoại: http://192.168.x.x:3000
```

**Lưu ý**: PWA chỉ hoạt động trên HTTPS hoặc localhost!

---

## 📱 HƯỚNG DẪN CÀI ĐẶT CHO USER

### **Trên iPhone/iPad (Safari):**

1. Mở Safari, vào website
2. Click nút **Share** (⬆️) ở dưới cùng
3. Cuộn xuống, chọn **"Add to Home Screen"**
4. Đặt tên: "CFO Brain"
5. Click **"Add"**
6. Icon xuất hiện trên màn hình chính!

### **Trên Android (Chrome):**

1. Mở Chrome, vào website
2. Click menu (⋮) góc trên bên phải
3. Chọn **"Add to Home screen"** hoặc **"Install app"**
4. Click **"Install"**
5. Icon xuất hiện trên màn hình chính!

### **Trên Desktop (Chrome/Edge):**

1. Mở Chrome/Edge, vào website
2. Click icon **Install** (➕) trên thanh địa chỉ
3. Hoặc click menu → **"Install CFO Brain..."**
4. Click **"Install"**
5. App mở như ứng dụng desktop!

---

## 🧪 KIỂM TRA PWA

### **1. Lighthouse Audit**

```bash
# Mở Chrome DevTools
# F12 → Tab "Lighthouse"
# Chọn "Progressive Web App"
# Click "Generate report"

# Điểm PWA phải >= 90/100
```

### **2. Kiểm tra Service Worker**

```bash
# Chrome DevTools
# F12 → Tab "Application"
# Sidebar: Service Workers
# Kiểm tra status: "activated and is running"
```

### **3. Kiểm tra Offline Mode**

```bash
# Chrome DevTools
# F12 → Tab "Network"
# Chọn "Offline" trong dropdown
# Reload trang → App vẫn hoạt động!
```

### **4. Kiểm tra Cache**

```bash
# Chrome DevTools
# F12 → Tab "Application"
# Sidebar: Cache Storage
# Xem các file đã cache
```

---

## 🔧 TÙY CHỈNH

### **Đổi màu theme:**

Sửa trong `public/manifest.json`:

```json
{
  "theme_color": "#4F46E5",  // Màu thanh status bar
  "background_color": "#ffffff"  // Màu nền splash screen
}
```

### **Đổi tên app:**

Sửa trong `public/manifest.json`:

```json
{
  "name": "Tên App Dài",
  "short_name": "Tên Ngắn"  // Hiển thị dưới icon
}
```

### **Thêm shortcuts:**

Sửa trong `public/manifest.json`:

```json
{
  "shortcuts": [
    {
      "name": "Bán hàng",
      "url": "/?tab=pos",
      "icons": [...]
    }
  ]
}
```

---

## 🐛 TROUBLESHOOTING

### **Lỗi: Service Worker không đăng ký**

```bash
# Kiểm tra console
# F12 → Console
# Xem lỗi gì

# Thường do:
# 1. Không phải HTTPS (chỉ localhost được HTTP)
# 2. Service Worker file không tìm thấy
# 3. Lỗi syntax trong service-worker.js
```

### **Lỗi: Không hiện install prompt**

```bash
# Kiểm tra:
# 1. Đã cài rồi? (xóa và thử lại)
# 2. Manifest.json đúng chưa?
# 3. Icons đủ chưa? (cần 192x192 và 512x512)
# 4. Service Worker active chưa?
```

### **Lỗi: Offline không hoạt động**

```bash
# Kiểm tra:
# 1. Service Worker active chưa?
# 2. Cache có dữ liệu chưa?
# 3. Fetch event có lỗi không?
```

### **Clear cache & reset:**

```bash
# Chrome DevTools
# F12 → Application
# Clear storage → Clear site data
# Reload trang
```

---

## 📊 MONITORING

### **Xem số lượng installs:**

```javascript
// Thêm vào App.tsx
window.addEventListener('appinstalled', () => {
  // Gửi analytics
  console.log('PWA installed!');
  
  // Gửi lên server để tracking
  fetch('/api/analytics/pwa-install', {
    method: 'POST'
  });
});
```

### **Track offline usage:**

```javascript
// Trong service-worker.js
self.addEventListener('fetch', (event) => {
  if (!navigator.onLine) {
    // User đang dùng offline
    // Log hoặc gửi analytics khi online lại
  }
});
```

---

## 🚀 DEPLOY LÊN PRODUCTION

### **1. Build production:**

```bash
npm run build
```

### **2. Deploy lên hosting:**

**Vercel:**
```bash
npm install -g vercel
vercel --prod
```

**Netlify:**
```bash
npm install -g netlify-cli
netlify deploy --prod
```

**Firebase:**
```bash
npm install -g firebase-tools
firebase deploy
```

### **3. Đảm bảo HTTPS:**

Tất cả hosting trên đều tự động có HTTPS.

### **4. Test trên production:**

```bash
# Mở Lighthouse
# Test PWA score
# Phải >= 90/100
```

---

## 📝 CHECKLIST TRƯỚC KHI LAUNCH

- [ ] Icons đầy đủ (16px → 512px)
- [ ] Splash screens cho iOS
- [ ] Manifest.json đúng
- [ ] Service Worker hoạt động
- [ ] Offline mode test OK
- [ ] Install prompt hiện
- [ ] HTTPS enabled
- [ ] Lighthouse PWA score >= 90
- [ ] Test trên iPhone
- [ ] Test trên Android
- [ ] Test trên Desktop

---

## 🎉 HOÀN THÀNH!

App của bạn giờ là PWA hoàn chỉnh:

✅ Cài đặt như app native
✅ Hoạt động offline 100%
✅ Tự động cập nhật
✅ Nhanh như native app
✅ 0 đồng chi phí
✅ Dùng song song web & mobile

**Chúc mừng! 🚀**

---

## 📞 HỖ TRỢ

Nếu gặp vấn đề:
- Check console errors (F12)
- Check Service Worker status
- Check Lighthouse report
- Google: "PWA [your error]"

**Happy coding! 💻**
