# 📝 QUY ĐỊNH VỀ TÀI LIỆU VÀ BÁO CÁO

**Ngày ban hành:** 14/05/2026  
**Áp dụng cho:** Tất cả thành viên team

---

## 🎯 MỤC ĐÍCH

Quy định này nhằm:
- ✅ Đảm bảo tài liệu được lưu đúng vị trí
- ✅ Dễ dàng tìm kiếm và quản lý
- ✅ Tránh rải rác file ở thư mục gốc
- ✅ Duy trì cấu trúc dự án chuyên nghiệp

---

## 📁 CẤU TRÚC THỨ BẬC

### Thư mục gốc (Root)
**CHỈ ĐƯỢC PHÉP:**
- `README.md` - Giới thiệu dự án
- File config: `.env`, `package.json`, `tsconfig.json`, v.v.
- File build: `vite.config.ts`, `eslint.config.js`, v.v.

**KHÔNG ĐƯỢC PHÉP:**
- ❌ File báo cáo (.md)
- ❌ File phân tích (.md)
- ❌ File hướng dẫn (.md)
- ❌ File tài liệu (.md)

### Thư mục docs/
**TẤT CẢ tài liệu phải nằm trong `docs/`**

---

## 📋 QUY TẮC LƯU TRỮ FILE BÁO CÁO

### 1️⃣ Báo cáo Phân tích (Analysis Reports)

**Lưu tại:** `docs/02-development/`

**Ví dụ:**
- `INVOICE_INVENTORY_LOGIC_ANALYSIS.md` ✅
- `PERFORMANCE_ANALYSIS.md` ✅
- `SECURITY_AUDIT_REPORT.md` ✅

**Quy tắc đặt tên:**
```
[FEATURE]_[TYPE]_ANALYSIS.md
[FEATURE]_[TYPE]_REPORT.md

Ví dụ:
- PAYMENT_LOGIC_ANALYSIS.md
- DATABASE_PERFORMANCE_REPORT.md
- API_SECURITY_ANALYSIS.md
```

---

### 2️⃣ Báo cáo Fix/Sửa lỗi (Fix Reports)

**Lưu tại:** `docs/02-development/`

**Ví dụ:**
- `INVOICE_INVENTORY_FIXES.md` ✅
- `BUG_FIX_SUMMARY.md` ✅
- `HOTFIX_REPORT_2026_05.md` ✅

**Quy tắc đặt tên:**
```
[FEATURE]_FIXES.md
[TYPE]_FIX_SUMMARY.md
HOTFIX_REPORT_[YYYY_MM].md

Ví dụ:
- AUTHENTICATION_FIXES.md
- CRITICAL_FIX_SUMMARY.md
- HOTFIX_REPORT_2026_05.md
```

---

### 3️⃣ Báo cáo Kiểm tra (Check/Test Reports)

**Lưu tại:** `docs/02-development/`

**Ví dụ:**
- `FINAL_CHECK_REPORT.md` ✅
- `QA_TEST_REPORT.md` ✅
- `REGRESSION_TEST_REPORT.md` ✅

**Quy tắc đặt tên:**
```
[TYPE]_CHECK_REPORT.md
[TYPE]_TEST_REPORT.md

Ví dụ:
- SECURITY_CHECK_REPORT.md
- INTEGRATION_TEST_REPORT.md
- UAT_REPORT.md
```

---

### 4️⃣ Báo cáo Đồng bộ/Sync (Sync Reports)

**Lưu tại:** `docs/03-deployment/`

**Ví dụ:**
- `SUPABASE_SYNC_REPORT.md` ✅
- `DATABASE_MIGRATION_REPORT.md` ✅
- `DATA_SYNC_STATUS.md` ✅

**Quy tắc đặt tên:**
```
[SERVICE]_SYNC_REPORT.md
[TYPE]_MIGRATION_REPORT.md

Ví dụ:
- REDIS_SYNC_REPORT.md
- DATABASE_MIGRATION_REPORT_V2.md
- API_SYNC_STATUS.md
```

---

### 5️⃣ Hướng dẫn Triển khai (Deployment Guides)

**Lưu tại:** `docs/03-deployment/`

**Ví dụ:**
- `PWA_SETUP_GUIDE.md` ✅
- `DOCKER_DEPLOYMENT_GUIDE.md` ✅
- `AWS_DEPLOYMENT_GUIDE.md` ✅

**Quy tắc đặt tên:**
```
[PLATFORM]_SETUP_GUIDE.md
[PLATFORM]_DEPLOYMENT_GUIDE.md

Ví dụ:
- KUBERNETES_SETUP_GUIDE.md
- VERCEL_DEPLOYMENT_GUIDE.md
- NGINX_CONFIGURATION_GUIDE.md
```

---

### 6️⃣ Hướng dẫn Testing (Testing Guides)

**Lưu tại:** `docs/03-deployment/`

**Ví dụ:**
- `QR_CODE_TESTING_GUIDE.md` ✅
- `E2E_TESTING_GUIDE.md` ✅
- `LOAD_TESTING_GUIDE.md` ✅

**Quy tắc đặt tên:**
```
[TYPE]_TESTING_GUIDE.md

Ví dụ:
- UNIT_TESTING_GUIDE.md
- INTEGRATION_TESTING_GUIDE.md
- PERFORMANCE_TESTING_GUIDE.md
```

---

### 7️⃣ Phân tích Mobile (Mobile Analysis)

**Lưu tại:** `docs/04-mobile/`

**Ví dụ:**
- `MOBILE_APP_ANALYSIS.md` ✅
- `IOS_PERFORMANCE_ANALYSIS.md` ✅
- `ANDROID_COMPATIBILITY_REPORT.md` ✅

**Quy tắc đặt tên:**
```
MOBILE_[FEATURE]_ANALYSIS.md
[PLATFORM]_[TYPE]_REPORT.md

Ví dụ:
- MOBILE_PUSH_NOTIFICATION_ANALYSIS.md
- IOS_MEMORY_USAGE_REPORT.md
- ANDROID_BATTERY_OPTIMIZATION_REPORT.md
```

---

### 8️⃣ Hướng dẫn Mobile (Mobile Guides)

**Lưu tại:** `docs/04-mobile/`

**Ví dụ:**
- `TESTFLIGHT_DISTRIBUTION_GUIDE.md` ✅
- `APP_STORE_SUBMISSION_GUIDE.md` ✅
- `REACT_NATIVE_SETUP_GUIDE.md` ✅

**Quy tắc đặt tên:**
```
[PLATFORM]_[ACTION]_GUIDE.md

Ví dụ:
- GOOGLE_PLAY_SUBMISSION_GUIDE.md
- EXPO_BUILD_GUIDE.md
- FASTLANE_SETUP_GUIDE.md
```

---

### 9️⃣ Báo cáo Hoàn thành (Completion Reports)

**Lưu tại:** `docs/02-development/`

**Ví dụ:**
- `COMPLETION_SUMMARY.md` ✅
- `SPRINT_COMPLETION_REPORT.md` ✅
- `MILESTONE_REPORT.md` ✅

**Quy tắc đặt tên:**
```
COMPLETION_SUMMARY.md
[SPRINT]_COMPLETION_REPORT.md
[MILESTONE]_REPORT.md

Ví dụ:
- SPRINT_12_COMPLETION_REPORT.md
- Q2_2026_MILESTONE_REPORT.md
- PHASE_1_COMPLETION_SUMMARY.md
```

---

### 🔟 Báo cáo Tổ chức lại (Reorganization Reports)

**Lưu tại:** `docs/02-development/`

**Ví dụ:**
- `REORGANIZATION_SUMMARY.md` ✅
- `CODE_REFACTORING_REPORT.md` ✅
- `ARCHITECTURE_MIGRATION_REPORT.md` ✅

**Quy tắc đặt tên:**
```
REORGANIZATION_SUMMARY.md
[TYPE]_REFACTORING_REPORT.md
[TYPE]_MIGRATION_REPORT.md

Ví dụ:
- DATABASE_REFACTORING_REPORT.md
- MICROSERVICES_MIGRATION_REPORT.md
- FOLDER_STRUCTURE_REORGANIZATION.md
```

---

### 1️⃣1️⃣ Quy trình Kiểm tra - Roles (Quality Check Roles)

**Lưu tại:** `docs/roles/`

**Ví dụ:**
- `ROLE_LOGIC.md` ✅
- `ROLE_PERFORMANCE.md` ✅
- `ROLE_QA.md` ✅
- `ROLE_REVIEWER.md` ✅
- `ROLE_SECURITY.md` ✅
- `ROLE_UX.md` ✅

**Quy tắc đặt tên:**
```
ROLE_[ROLE_NAME].md

Ví dụ:
- ROLE_LOGIC.md
- ROLE_PERFORMANCE.md
- ROLE_SECURITY.md
- ROLE_ACCESSIBILITY.md
```

**Lưu ý:**
- Thư mục `docs/roles/` dành riêng cho các quy trình kiểm tra theo vai trò
- Không được lưu các file role vào `docs/02-development/` hoặc `docs/05-process/`
- Mỗi role phải có checklist và quy trình rõ ràng

---

## 🚫 CÁC LỖI THƯỜNG GẶP

### ❌ SAI
```
Root/
├── MY_ANALYSIS_REPORT.md          ❌ Không được ở root
├── BUG_FIX_SUMMARY.md             ❌ Không được ở root
├── DEPLOYMENT_GUIDE.md            ❌ Không được ở root
└── TESTING_REPORT.md              ❌ Không được ở root
```

### ✅ ĐÚNG
```
docs/
├── 02-development/
│   ├── MY_ANALYSIS_REPORT.md      ✅ Đúng vị trí
│   └── BUG_FIX_SUMMARY.md         ✅ Đúng vị trí
├── 03-deployment/
│   ├── DEPLOYMENT_GUIDE.md        ✅ Đúng vị trí
│   └── TESTING_REPORT.md          ✅ Đúng vị trí
└── roles/
    ├── ROLE_LOGIC.md              ✅ Đúng vị trí
    └── ROLE_SECURITY.md           ✅ Đúng vị trí
```

---

## 📊 BẢNG TRA CỨU NHANH

| Loại file | Thư mục | Ví dụ |
|-----------|---------|-------|
| Phân tích logic | `02-development/` | `*_ANALYSIS.md` |
| Báo cáo fix | `02-development/` | `*_FIXES.md` |
| Báo cáo test | `02-development/` | `*_TEST_REPORT.md` |
| Báo cáo hoàn thành | `02-development/` | `COMPLETION_*.md` |
| Quy trình kiểm tra (Roles) | `roles/` | `ROLE_*.md` |
| Sync report | `03-deployment/` | `*_SYNC_REPORT.md` |
| Deployment guide | `03-deployment/` | `*_DEPLOYMENT_GUIDE.md` |
| Testing guide | `03-deployment/` | `*_TESTING_GUIDE.md` |
| Mobile analysis | `04-mobile/` | `MOBILE_*.md` |
| Mobile guide | `04-mobile/` | `*_GUIDE.md` |

---

## 🔄 QUY TRÌNH TẠO FILE MỚI

### Bước 1: Xác định loại file
- Đây là báo cáo gì? (Analysis, Fix, Test, Deployment, v.v.)

### Bước 2: Chọn thư mục phù hợp
- Tra cứu bảng trên để chọn thư mục

### Bước 3: Đặt tên theo quy tắc
- Sử dụng format đã quy định
- Viết hoa, dùng underscore `_`

### Bước 4: Tạo file
```bash
# Ví dụ: Tạo báo cáo phân tích payment
touch docs/02-development/PAYMENT_LOGIC_ANALYSIS.md
```

### Bước 5: Cập nhật index (nếu cần)
- Thêm link vào `docs/README.md` nếu file quan trọng

---

## 🧹 DỌN DẸP FILE CŨ

### Nếu phát hiện file .md ở root:

```bash
# 1. Xác định loại file
# 2. Di chuyển vào thư mục phù hợp
mv ROOT_FILE.md docs/[appropriate-folder]/

# 3. Kiểm tra không còn file .md ở root (trừ README.md)
ls *.md
# Chỉ nên thấy: README.md
```

### Script tự động kiểm tra:

```bash
#!/bin/bash
# check_docs_structure.sh

echo "🔍 Kiểm tra cấu trúc tài liệu..."

# Đếm file .md ở root (trừ README.md)
count=$(ls *.md 2>/dev/null | grep -v "README.md" | wc -l)

if [ $count -gt 0 ]; then
    echo "❌ Phát hiện $count file .md không đúng vị trí ở root:"
    ls *.md | grep -v "README.md"
    echo ""
    echo "Vui lòng di chuyển vào docs/ theo quy định!"
    exit 1
else
    echo "✅ Cấu trúc tài liệu đúng quy định!"
    exit 0
fi
```

---

## 📝 TEMPLATE FILE BÁO CÁO

### Template cơ bản:

```markdown
# [TIÊU ĐỀ BÁO CÁO]

**Ngày:** [DD/MM/YYYY]  
**Người thực hiện:** [Tên]  
**Trạng thái:** [Draft/In Progress/Completed]

---

## 🎯 MỤC ĐÍCH

[Mô tả mục đích của báo cáo]

---

## 📊 PHÂN TÍCH

[Nội dung phân tích]

---

## ✅ KẾT LUẬN

[Kết luận và khuyến nghị]

---

## 📋 CHECKLIST

- [ ] Item 1
- [ ] Item 2
- [ ] Item 3

---

**Cập nhật lần cuối:** [DD/MM/YYYY]
```

---

## 🎯 TRÁCH NHIỆM

### Developer
- ✅ Tạo file báo cáo đúng vị trí
- ✅ Đặt tên theo quy tắc
- ✅ Cập nhật index nếu cần

### Reviewer
- ✅ Kiểm tra vị trí file trong PR
- ✅ Yêu cầu di chuyển nếu sai
- ✅ Không merge PR có file sai vị trí

### Team Lead
- ✅ Review cấu trúc định kỳ
- ✅ Nhắc nhở team tuân thủ
- ✅ Cập nhật quy định khi cần

---

## 🚀 AUTOMATION

### Pre-commit hook

Tạo file `.git/hooks/pre-commit`:

```bash
#!/bin/bash

# Kiểm tra file .md ở root (trừ README.md)
staged_md_files=$(git diff --cached --name-only --diff-filter=A | grep "^[^/]*\.md$" | grep -v "README.md")

if [ ! -z "$staged_md_files" ]; then
    echo "❌ Lỗi: Phát hiện file .md mới ở root:"
    echo "$staged_md_files"
    echo ""
    echo "Vui lòng di chuyển vào docs/ theo quy định:"
    echo "  docs/02-development/  - Báo cáo phát triển"
    echo "  docs/03-deployment/   - Hướng dẫn triển khai"
    echo "  docs/04-mobile/       - Tài liệu mobile"
    echo ""
    exit 1
fi

exit 0
```

Kích hoạt:
```bash
chmod +x .git/hooks/pre-commit
```

---

## 📚 TÀI LIỆU THAM KHẢO

- [Cấu trúc docs/](README.md)
- [Quick Start](QUICK_START.md)
- [Báo cáo tổ chức lại](../DOCS_REORGANIZATION_COMPLETE.md)

---

## 🔄 LỊCH SỬ THAY ĐỔI

| Ngày | Phiên bản | Thay đổi |
|------|-----------|----------|
| 14/05/2026 | 1.0 | Phiên bản đầu tiên |

---

## ❓ FAQ

**Q: Tôi tạo file báo cáo tạm thời, có cần tuân thủ không?**  
A: Có! Mọi file .md đều phải tuân thủ. Nếu tạm thời, đặt tên với prefix `TEMP_` và xóa sau khi xong.

**Q: File báo cáo của AI agent nên lưu ở đâu?**  
A: Tùy loại báo cáo. Nếu là phân tích → `02-development/`, nếu là deployment → `03-deployment/`.

**Q: Tôi có thể tạo sub-folder trong docs/ không?**  
A: Có, nhưng phải thảo luận với team trước. Ví dụ: `docs/02-development/reports/`.

**Q: File README.md có được phép ở root không?**  
A: Có! README.md là file duy nhất được phép ở root.

---

**Quy định này có hiệu lực từ:** 14/05/2026  
**Áp dụng cho:** Tất cả thành viên team  
**Cập nhật bởi:** Kiro AI
