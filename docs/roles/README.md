# 🎭 Quy Trình Kiểm Tra - Roles

Thư mục này chứa các quy trình kiểm tra theo vai trò (roles) và quy trình đánh giá tổng thể để đảm bảo chất lượng code và sản phẩm.

---

## 📋 Danh Sách Quy Trình

### 0. [EVALUATION_WORKFLOW.md](./EVALUATION_WORKFLOW.md)
**Quy trình đánh giá tổng thể hệ thống**
- Các bước thực hiện đánh giá
- Tools & commands cần dùng
- Checklist đánh giá
- Template báo cáo

**Thời gian đọc:** ~5 phút  
**Mục đích:** Hướng dẫn đánh giá định kỳ

---

### 1. [ROLE_LOGIC.md](./ROLE_LOGIC.md)
**Kiểm tra Logic & Business Rules**
- Kiểm tra tính đúng đắn của logic nghiệp vụ
- Validate business rules
- Kiểm tra edge cases
- Review data flow

**Thời gian đọc:** ~8 phút

---

### 2. [ROLE_PERFORMANCE.md](./ROLE_PERFORMANCE.md)
**Kiểm tra Performance & Optimization**
- Đánh giá hiệu năng
- Phát hiện bottlenecks
- Kiểm tra memory leaks
- Review render performance

**Thời gian đọc:** ~6 phút

---

### 3. [ROLE_QA.md](./ROLE_QA.md)
**Kiểm tra Quality Assurance**
- Test coverage
- Bug detection
- Regression testing
- User acceptance testing

**Thời gian đọc:** ~7 phút

---

### 4. [ROLE_REVIEWER.md](./ROLE_REVIEWER.md)
**Kiểm tra Code Review**
- Code quality
- Best practices
- Code style & conventions
- Documentation

**Thời gian đọc:** ~6 phút

---

### 5. [ROLE_SECURITY.md](./ROLE_SECURITY.md)
**Kiểm tra Security & Safety**
- Security vulnerabilities
- Authentication & authorization
- Data protection
- Input validation

**Thời gian đọc:** ~6 phút

---

### 6. [ROLE_UX.md](./ROLE_UX.md)
**Kiểm tra User Experience**
- UI/UX consistency
- Accessibility
- User flow
- Responsive design

**Thời gian đọc:** ~7 phút

---

## 🎯 Khi nào dùng quy trình nào?

### Đánh giá định kỳ (mỗi sprint/milestone):
→ Chạy **EVALUATION_WORKFLOW.md** để đánh giá tổng thể

### Trước khi commit code:
→ Chạy qua **ROLE_REVIEWER.md** để kiểm tra code quality

### Trước khi merge PR:
→ Chạy qua **ROLE_LOGIC.md** + **ROLE_QA.md** để đảm bảo logic đúng và có tests

### Trước khi deploy:
→ Chạy qua **ROLE_SECURITY.md** + **ROLE_PERFORMANCE.md** để đảm bảo an toàn và hiệu năng

### Trước khi release:
→ Chạy qua **TẤT CẢ 6 ROLES** để đảm bảo chất lượng tổng thể

### Khi làm feature mới:
→ Chạy qua **ROLE_UX.md** để đảm bảo trải nghiệm người dùng tốt

---

## 🔄 Quy Trình Kiểm Tra Chuẩn

### 1. Development Phase
```
Code → ROLE_REVIEWER → Fix issues → Commit
```

### 2. Testing Phase
```
Feature complete → ROLE_LOGIC + ROLE_QA → Fix bugs → Ready for review
```

### 3. Pre-deployment Phase
```
PR approved → ROLE_SECURITY + ROLE_PERFORMANCE → Optimize → Ready to deploy
```

### 4. Pre-release Phase
```
All features done → ALL 6 ROLES → Final fixes → Release
```

### 5. Periodic Evaluation
```
Sprint end → EVALUATION_WORKFLOW → Generate report → Plan improvements
```

---

## 📊 Checklist Tổng Hợp

Sử dụng checklist này để đảm bảo đã chạy đủ các quy trình:

- [ ] **EVALUATION_WORKFLOW** - Đánh giá tổng thể định kỳ
- [ ] **ROLE_LOGIC** - Logic nghiệp vụ đúng
- [ ] **ROLE_PERFORMANCE** - Hiệu năng tốt
- [ ] **ROLE_QA** - Test coverage đủ
- [ ] **ROLE_REVIEWER** - Code quality cao
- [ ] **ROLE_SECURITY** - Bảo mật tốt
- [ ] **ROLE_UX** - Trải nghiệm người dùng tốt

---

## 🚀 Automation

### Pre-commit Hook
Tự động chạy ROLE_REVIEWER trước khi commit:

```bash
# .git/hooks/pre-commit
#!/bin/bash
echo "🔍 Running ROLE_REVIEWER checks..."
# Add your checks here
```

### Pre-push Hook
Tự động chạy ROLE_LOGIC + ROLE_QA trước khi push:

```bash
# .git/hooks/pre-push
#!/bin/bash
echo "🔍 Running ROLE_LOGIC + ROLE_QA checks..."
npm test
npx tsc --noEmit
```

### CI/CD Pipeline
Tự động chạy tất cả roles trong CI/CD:

```yaml
# .github/workflows/quality-check.yml
name: Quality Check
on: [pull_request]
jobs:
  check:
    runs-on: ubuntu-latest
    steps:
      - name: ROLE_REVIEWER
        run: npm run lint
      - name: ROLE_LOGIC + ROLE_QA
        run: npm test
      - name: ROLE_SECURITY
        run: npm audit
      - name: ROLE_PERFORMANCE
        run: npm run build
```

### Scheduled Evaluation
Tự động chạy EVALUATION_WORKFLOW định kỳ:

```yaml
# .github/workflows/periodic-evaluation.yml
name: Periodic Evaluation
on:
  schedule:
    - cron: '0 0 * * 0'  # Mỗi Chủ nhật
jobs:
  evaluate:
    runs-on: ubuntu-latest
    steps:
      - name: Run Evaluation
        run: npm run evaluate
```

---

## 📚 Tài Liệu Liên Quan

- [Security Audit Report](../02-development/analysis/SECURITY_AUDIT_REPORT.md) - Báo cáo bảo mật
- [App Evaluation Report](../02-development/analysis/APP_EVALUATION_REPORT.md) - Đánh giá tổng thể
- [Documentation Guidelines](../DOCUMENTATION_GUIDELINES.md) - Quy định về tài liệu

---

## 💡 Tips

1. **Không cần chạy tất cả roles mọi lúc** - Chọn role phù hợp với giai đoạn
2. **Tự động hóa khi có thể** - Dùng hooks và CI/CD
3. **Cập nhật roles thường xuyên** - Thêm checklist mới khi cần
4. **Chia sẻ với team** - Đảm bảo mọi người hiểu và tuân thủ
5. **Chạy EVALUATION_WORKFLOW định kỳ** - Mỗi sprint hoặc milestone

---

**Cập nhật lần cuối:** 16/05/2026  
**Số lượng quy trình:** 7 (1 workflow + 6 roles)  
**Mục đích:** Quy trình kiểm tra chất lượng tổng thể
