# 📖 Hướng Dẫn & Implementation (Guides)

Thư mục này chứa các hướng dẫn kỹ thuật và tài liệu implementation chi tiết.

---

## 📋 Danh Sách Hướng Dẫn

### 1. [PRINT_TEMPLATES_GUIDE.md](./PRINT_TEMPLATES_GUIDE.md)
**Hướng dẫn Print Templates**
- Cấu trúc print templates
- Cách tùy chỉnh templates
- Invoice, Exchange, Barcode, Payroll templates
- Best practices

**Thời gian đọc:** ~10 phút  
**Mục đích:** Hướng dẫn sử dụng và tùy chỉnh templates in

---

### 2. [VIRTUALIZATION_IMPLEMENTATION.md](./VIRTUALIZATION_IMPLEMENTATION.md)
**Hướng dẫn Virtualization** - Performance optimization
- Vấn đề: 250k DOM nodes, 2-5s render
- Kiến trúc: Virtual rows, flatten logic
- Implementation details (code examples)
- Performance metrics: 50x faster, 99% less DOM
- Best practices (size estimation, overscan)
- Common issues & solutions
- Future improvements

**Thời gian đọc:** ~10 phút  
**Mục đích:** Hướng dẫn implement virtualization cho performance

---

## 🎯 Khi nào đọc?

### Bạn làm việc với print templates?
→ Đọc **PRINT_TEMPLATES_GUIDE.md** để hiểu cách tùy chỉnh

### Bạn gặp vấn đề performance với danh sách lớn?
→ Đọc **VIRTUALIZATION_IMPLEMENTATION.md** để học cách optimize

---

## 📊 Tóm Tắt Nhanh

| Hướng dẫn | Loại | Độ khó | Độ ưu tiên |
|-----------|------|--------|------------|
| PRINT_TEMPLATES_GUIDE | Tính năng | Trung bình | ⭐⭐⭐⭐ |
| VIRTUALIZATION_IMPLEMENTATION | Performance | Khó | ⭐⭐⭐⭐⭐ |

---

## 💡 Tips

### Print Templates:
- Test trên nhiều trình duyệt
- Kiểm tra responsive
- Validate data trước khi in

### Virtualization:
- Chỉ dùng cho danh sách >1000 items
- Estimate row height chính xác
- Test scroll performance trên mobile

---

**Cập nhật lần cuối:** 16/05/2026  
**Số lượng hướng dẫn:** 2
