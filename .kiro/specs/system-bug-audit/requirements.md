# Requirements: System Bug Audit

## Overview
Hệ thống tự động audit và phát hiện lỗi toàn bộ codebase của ứng dụng CFO Brain 4.0, phân loại theo categories và mức độ nghiêm trọng để dễ dàng sửa chữa dần dần.

## Scope
- **Phạm vi**: Toàn bộ ứng dụng (Frontend React Native + Backend Supabase)
- **Loại lỗi**: Tất cả các loại (Logic, Security, Performance, UI/UX, Data Integrity, Error Handling)
- **Output**: File báo cáo markdown được phân loại rõ ràng

---

## Requirement 1: Phát hiện lỗi Logic Nghiệp vụ

**Description**: Hệ thống phải phát hiện các lỗi liên quan đến business logic, data flow, và tính toàn vẹn của dữ liệu.

### Acceptance Criteria:

1. **Race Conditions**
   - Phát hiện các đoạn code có khả năng xảy ra race condition trong async operations
   - Ghi nhận: file path, function name, scenario description, suggested fix

2. **Data Inconsistency**
   - Phát hiện inconsistency giữa state và database
   - Phát hiện calculation errors trong financial logic
   - Ghi nhận: affected data fields, incorrect calculation, expected vs actual

3. **Validation Gaps**
   - Phát hiện missing validation cho user input
   - Phát hiện incomplete validation rules
   - Ghi nhận: input field, missing validation type, security risk level

4. **Offline Sync Conflicts**
   - Phát hiện conflict resolution logic thiếu hoặc sai
   - Ghi nhận: entity type, conflict scenario, current handling, recommended approach

5. **State Management Issues**
   - Phát hiện stale state, unused state, redundant state
   - Ghi nhận: component/screen name, state variable, issue type, cleanup suggestion

6. **Transaction Integrity**
   - Phát hiện missing rollback logic
   - Phát hiện atomic operation violations
   - Ghi nhận: operation name, failure scenario, missing safeguards

7. **Edge Case Handling**
   - Phát hiện unhandled edge cases (empty arrays, null values, boundary values)
   - Ghi nhận: code location, edge case description, current behavior, expected behavior

8. **Business Rule Violations**
   - Phát hiện code không tuân thủ business rules đã định nghĩa
   - Ghi nhận: rule violated, code location, impact assessment

---

## Requirement 2: Phát hiện lỗi Bảo mật

**Description**: Hệ thống phải scan toàn bộ code để phát hiện security vulnerabilities và potential attack vectors.

### Acceptance Criteria:

1. **Authentication Gaps**
   - Phát hiện routes/screens không có authentication check
   - Phát hiện weak session management
   - Ghi nhận: endpoint/screen, access control missing, exploitation scenario

2. **Authorization Flaws**
   - Phát hiện missing role-based access control
   - Phát hiện privilege escalation risks
   - Ghi nhận: resource, required permission, actual check, bypass method

3. **SQL Injection Risks**
   - Phát hiện raw SQL queries không dùng parameterized queries
   - Ghi nhận: query location, vulnerable input, fix recommendation

4. **XSS Vulnerabilities**
   - Phát hiện unescaped user input trong rendering
   - Ghi nhận: component, input source, rendering context

5. **CORS Misconfiguration**
   - Phát hiện overly permissive CORS settings
   - Ghi nhận: endpoint, current config, recommended config

6. **Sensitive Data Exposure**
   - Phát hiện passwords, tokens, secrets hardcoded hoặc logged
   - Ghi nhận: file path, data type, exposure method, severity

7. **File Upload Vulnerabilities**
   - Phát hiện missing file type validation
   - Phát hiện missing size limits
   - Ghi nhận: upload endpoint, validation gaps, attack scenario

8. **Rate Limiting Absence**
   - Phát hiện API endpoints không có rate limiting
   - Ghi nhận: endpoint, attack type (brute force, DOS), recommended limits

9. **Insecure Data Storage**
   - Phát hiện sensitive data stored unencrypted
   - Ghi nhận: storage location, data type, encryption requirement

10. **Dependency Vulnerabilities**
    - Phát hiện outdated packages with known CVEs
    - Ghi nhận: package name, current version, vulnerable version, CVE ID, fix version

---

## Requirement 3: Phát hiện lỗi Hiệu năng

**Description**: Hệ thống phải identify performance bottlenecks và optimization opportunities.

### Acceptance Criteria:

1. **N+1 Query Problems**
   - Phát hiện queries trong loops
   - Ghi nhận: code location, estimated query count, batching suggestion

2. **Inefficient Database Queries**
   - Phát hiện queries không có index
   - Phát hiện queries fetch quá nhiều data
   - Ghi nhận: query, table, missing index, recommended optimization

3. **Render Performance Issues**
   - Phát hiện components không có memoization khi cần
   - Phát hiện heavy computations trong render
   - Ghi nhận: component, re-render frequency estimate, optimization method

4. **Large Bundle Size**
   - Phát hiện unused imports, large libraries
   - Ghi nhận: file, unused dependency, size impact (KB), tree-shaking opportunity

5. **Memory Leaks**
   - Phát hiện event listeners không được cleanup
   - Phát hiện subscriptions không unsubscribe
   - Ghi nhận: component/service, leak source, cleanup location

6. **Blocking Operations**
   - Phát hiện synchronous operations trên main thread
   - Ghi nhận: operation, estimated time, async alternative

7. **Cache Inefficiency**
   - Phát hiện repeated expensive operations không có cache
   - Ghi nhận: operation, call frequency, cache strategy suggestion

8. **Image Optimization**
   - Phát hiện unoptimized images (large size, wrong format)
   - Ghi nhận: image path, current size, recommended size/format

9. **Network Request Optimization**
   - Phát hiện sequential requests có thể parallel
   - Phát hiện requests không có timeout
   - Ghi nhận: request location, optimization method

10. **Storage Quota Issues**
    - Phát hiện AsyncStorage/localStorage usage approaching limits
    - Ghi nhận: storage key, size, cleanup strategy

---

## Requirement 4: Phát hiện lỗi UI/UX

**Description**: Hệ thống phải identify user experience issues và usability problems.

### Acceptance Criteria:

1. **Missing Loading States**
   - Phát hiện async operations không có loading indicator
   - Ghi nhận: screen/component, operation, user impact

2. **Poor Error Feedback**
   - Phát hiện error handling không có user-friendly message
   - Ghi nhận: error location, current message, suggested improvement

3. **Accessibility Issues**
   - Phát hiện missing accessibility labels
   - Phát hiện poor color contrast
   - Phát hiện insufficient touch target size (< 44px)
   - Ghi nhận: element, accessibility guideline violated, fix

4. **Inconsistent UI States**
   - Phát hiện UI state không sync với data state
   - Ghi nhận: component, desync scenario, fix strategy

5. **Navigation Issues**
   - Phát hiện missing back button handling
   - Phát hiện broken navigation flows
   - Ghi nhận: screen, navigation issue, expected behavior

6. **Form Validation UX**
   - Phát hiện validation errors không clear
   - Phát hiện validation chạy sai timing (too early/late)
   - Ghi nhận: form, validation issue, UX improvement

7. **Performance Perception**
   - Phát hiện operations > 3s không có progress feedback
   - Ghi nhận: operation, duration, feedback missing

8. **Responsive Design Issues**
   - Phát hiện hardcoded dimensions gây vấn đề trên different screen sizes
   - Ghi nhận: component, dimension, responsive alternative

9. **Empty States**
   - Phát hiện screens không handle empty data gracefully
   - Ghi nhận: screen, empty scenario, suggested empty state design

10. **Gesture Conflicts**
    - Phát hiện gesture handlers conflict với nhau
    - Ghi nhận: component, conflicting gestures, resolution

---

## Requirement 5: Cấu trúc File Báo cáo

**Description**: File báo cáo phải có format rõ ràng, dễ đọc, dễ maintain, và support incremental updates.

### Acceptance Criteria:

1. **File Format**
   - File báo cáo phải là markdown (.md)
   - File path: `/BUG_REPORT.md` tại root của project
   - Encoding: UTF-8

2. **Section Structure**
   - File phải có 6 sections chính theo loại lỗi:
     - 1. Logic Nghiệp vụ
     - 2. Bảo mật
     - 3. Hiệu năng
     - 4. UI/UX
     - 5. Data Integrity
     - 6. Error Handling
   - Mỗi section có sub-sections theo mức độ: Critical → High → Medium → Low

3. **Bug Entry Template**
   - Mỗi bug phải follow template:
     ```markdown
     ### [SEVERITY] Bug ID: BUG-{category}-{number}
     
     **File**: `path/to/file.ts:lineNumber`
     **Category**: {category}
     **Discovered**: {date}
     **Status**: ❌ Open | 🔧 In Progress | ✅ Fixed
     
     **Description**:
     {clear description of the issue}
     
     **Impact**:
     - Data Impact: {High/Medium/Low}
     - User Impact: {High/Medium/Low}
     - Frequency: {High/Medium/Low}
     
     **How to Reproduce**:
     {step by step reproduction if applicable}
     
     **Suggested Fix**:
     {actionable fix recommendation}
     
     **Code Snippet** (if helpful):
     ```{language}
     {relevant code}
     ```
     ```

4. **Table of Contents**
   - File phải có TOC tự động link đến từng section
   - Format:
     ```markdown
     ## 📊 Summary
     - Total Bugs: {count}
     - Critical: {count}
     - High: {count}
     - Medium: {count}
     - Low: {count}
     
     ## 📑 Table of Contents
     1. [Logic Nghiệp vụ](#1-logic-nghiệp-vụ) ({count} bugs)
     2. [Bảo mật](#2-bảo-mật) ({count} bugs)
     ...
     ```

5. **Metadata Header**
   - File phải bắt đầu với metadata:
     ```markdown
     # 🐛 BUG AUDIT REPORT
     
     **Project**: CFO Brain 4.0
     **Audit Date**: {date}
     **Audit Scope**: {scope description}
     **Auditor**: System Bug Audit Tool
     **Version**: {version}
     ```

6. **Severity Indicators**
   - Phải dùng emoji/icon cho mức độ:
     - 🔴 Critical
     - 🟠 High
     - 🟡 Medium
     - 🟢 Low

7. **Status Tracking**
   - Mỗi bug phải có status với emoji:
     - ❌ Open
     - 🔧 In Progress
     - ✅ Fixed
     - ⏭️ Deferred
     - ❓ Need Discussion

8. **Search-Friendly Format**
   - Bug IDs phải unique và searchable: `BUG-{CATEGORY_CODE}-{NUMBER}`
   - Category codes: LOGIC, SEC, PERF, UX, DATA, ERR

9. **Incremental Update Support**
   - File phải support append new bugs without breaking existing structure
   - Each bug must have unique ID để avoid duplicates

10. **Validation Rules**
    - Every bug entry MUST have:
      - File path
      - Category
      - Severity
      - Description
      - Suggested fix
    - File phải validate được bởi markdown linter

---

## Requirement 6: Tiêu chí Đánh giá Mức độ Nghiêm trọng

**Description**: Hệ thống phải có objective scoring system để classify bug severity consistently.

### Acceptance Criteria:

1. **Scoring Factors**
   - Severity = f(Data Impact, User Impact, Frequency)
   - Mỗi factor scored 0-3:
     - 0 = None
     - 1 = Low
     - 2 = Medium
     - 3 = High

2. **Data Impact Scoring**
   - 3 (High): Data loss, corruption, financial errors
   - 2 (Medium): Data inconsistency, stale data
   - 1 (Low): Display-only data issues
   - 0 (None): No data affected

3. **User Impact Scoring**
   - 3 (High): App crash, complete feature failure, security breach
   - 2 (Medium): Feature partially broken, confusing UX
   - 1 (Low): Minor inconvenience, cosmetic issues
   - 0 (None): No user-facing impact

4. **Frequency Scoring**
   - 3 (High): Every use, always reproducible
   - 2 (Medium): Common scenarios, > 50% of users affected
   - 1 (Low): Edge cases, < 10% of users
   - 0 (None): Theoretical only

5. **Severity Mapping**
   - Total score 7-9: 🔴 Critical
   - Total score 5-6: 🟠 High
   - Total score 3-4: 🟡 Medium
   - Total score 0-2: 🟢 Low

6. **Critical Override Rules**
   - Any security vulnerability → Minimum High
   - Data loss/corruption → Minimum High
   - App crash → Minimum High
   - Financial calculation error → Minimum Critical

7. **Context Adjustments**
   - Production bugs: +1 severity level
   - Affects offline mode: +1 severity level
   - Has workaround available: -1 severity level

8. **Documentation Requirement**
   - Each bug must show score breakdown:
     ```
     Severity Score: 7 (Critical)
     - Data Impact: 3 (High) - Financial data corruption
     - User Impact: 2 (Medium) - Feature partially broken
     - Frequency: 2 (Medium) - Common in multi-user scenarios
     ```

9. **Consistency Check**
   - Same bug type in different files should get same severity
   - Severity assignment must be reproducible

10. **Review Threshold**
    - Critical và High bugs require human review confirmation
    - Medium và Low can be auto-assigned

---

## Requirement 7: Workflow Thực hiện Audit

**Description**: Hệ thống phải có clear workflow để execute audit efficiently và incrementally.

### Acceptance Criteria:

1. **CLI Commands**
   - `npm run audit` - Run full audit
   - `npm run audit:quick` - Quick scan (high priority issues only)
   - `npm run audit:category {category}` - Scan specific category
   - `npm run audit:file {filepath}` - Scan single file
   - `npm run audit:incremental` - Scan only changed files since last audit

2. **Progress Tracking**
   - Console output phải show progress:
     ```
     🔍 Scanning: /services/posOrderService.ts
     ✅ Completed: 45/120 files (37%)
     🐛 Found: 12 bugs (3 Critical, 5 High, 4 Medium)
     ⏱️ Estimated time remaining: 15 minutes
     ```

3. **Scan Order Priority**
   - Order phải là:
     1. Services layer (business logic)
     2. Database queries
     3. API endpoints
     4. Components (high-usage first)
     5. Screens
     6. Utilities
     7. Configuration files

4. **Incremental Audit**
   - System phải track last audit date trong metadata
   - Chỉ scan files modified after last audit
   - Maintain bug history (fixed bugs không bị xóa, chỉ update status)

5. **Parallel Processing**
   - Scan multiple files concurrently (max 4 parallel)
   - Each category can be scanned independently

6. **Error Handling**
   - If scan crashes, save progress
   - Resume từ last successful checkpoint
   - Log scan errors to separate file: `AUDIT_ERRORS.log`

7. **Verification Step**
   - After scan, run verification:
     - Check all bug IDs unique
     - Validate markdown structure
     - Ensure all required fields present
   - Output validation report

8. **Report Generation Time**
   - Full audit phải complete trong < 30 phút cho codebase ~100 files
   - Incremental audit < 5 phút

9. **Configuration File**
   - Support config file: `audit.config.json`
     ```json
     {
       "exclude": ["node_modules", "build", "*.test.ts"],
       "severity_threshold": "Medium",
       "max_bugs_per_file": 10,
       "enable_auto_fix": false
     }
     ```

10. **Output Formats**
    - Default: Markdown
    - Optional: JSON export for CI/CD integration
    - Optional: HTML dashboard

11. **Comparison Mode**
    - `npm run audit:compare {old_report} {new_report}`
    - Show: New bugs, Fixed bugs, Regression (bugs reappeared)

12. **Dashboard View**
    - Generate web dashboard: `audit-dashboard.html`
    - Show: Bug trends, category breakdown, file hotspots
    - Interactive filtering by severity, category, file

13. **Auto-Fix Capability** (Phase 2)
    - For safe fixes (e.g., add missing validation)
    - `npm run audit:fix {bug_id}`
    - Create git commit with fix

14. **Scheduled Audits**
    - Support cron-style scheduling
    - Auto-run audit daily/weekly
    - Send summary report via notification

15. **Performance Benchmarking**
    - Track audit execution time over time
    - Alert if audit time increases significantly (> 50%)

---

## Requirement 8: Tích hợp Development Workflow

**Description**: Hệ thống audit phải seamlessly integrate với existing dev workflow và tools.

### Acceptance Criteria:

1. **Pre-commit Hook**
   - Run quick audit on staged files before commit
   - Block commit nếu discover Critical bugs in changed files
   - Show warning for High bugs, allow commit with confirmation

2. **CI/CD Integration**
   - Add audit step to GitHub Actions / CI pipeline
   - Fail build nếu có new Critical bugs
   - Post audit summary as PR comment

3. **IDE Integration**
   - Generate ESLint-compatible warnings from audit results
   - Show inline warnings in VS Code / IDE

4. **Bug Tracking Integration**
   - Auto-create tickets in Jira/Linear/GitHub Issues từ audit report
   - Link bug ID to ticket ID
   - Sync status bidirectionally

5. **Notification System**
   - Send Slack/Discord notification after audit completes
   - Include summary stats và link to report

---

## Out of Scope

- Auto-fixing bugs (chỉ report và suggest, không tự sửa)
- Runtime monitoring (chỉ static analysis)
- Performance profiling (chỉ detect obvious issues, không measure actual performance)
- Third-party service bugs (chỉ audit code của project, không audit Supabase/external APIs)

---

## Success Metrics

1. **Coverage**: >= 95% của codebase được scan
2. **Accuracy**: <= 10% false positives
3. **Performance**: Full audit completes trong <= 30 phút
4. **Actionability**: >= 90% của reported bugs có suggested fix
5. **Adoption**: Developers fix >= 80% của Critical+High bugs trong 2 tuần
