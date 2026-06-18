# AUDIT_LOG.md — Nhật ký kiểm tra logic tự động (multi-pass)

> Vòng lặp /loop chạy lặp đi lặp lại cho đến khi 1 pass đầy đủ không tìm thấy bug nào.
> Module [x] = đã xong trong pass hiện tại. Sau mỗi pass → reset [ ] và bắt đầu pass mới.

---

## TRẠNG THÁI HIỆN TẠI

✅ **AUDIT HOÀN THÀNH — Pass 3 không tìm thấy bug mới.**

- **Pass đã hoàn thành:** 3
- **Bugs tìm được trong pass 3:** 0
- **Kết quả:** Loop dừng — codebase sạch qua 3 pass liên tiếp (22 + 5 + 0 bugs)

### Checklist pass 3 (hoàn thành)

- [x] components/purchase/
- [x] components/customers/
- [x] components/orders/
- [x] components/finance/
- [x] components/overview/
- [x] components/payroll/
- [x] components/analysis/
- [x] components/expense/
- [x] components/revenue/
- [x] components/reports/

---

## LỊCH SỬ CÁC PASS

### Pass 1 — 2026-06-15 — 22 bugs tìm được

| Module | Bugs | Files sửa |
|---|---|---|
| purchase/ | 6 | PurchaseOrdersContainer, PurchaseOrdersPage, PurchaseReturnsPage |
| customers/ | 4 | CustomerListPage |
| orders/ | 5 | OrderInvoices, OrderReturns |
| finance/ | 1 (design gap, chưa fix) | — |
| overview/ | 0 | — |
| payroll/ | 1 | PayrollManager |
| analysis/ | 0 | — |
| expense/ | 2 | ExpenseLedgerTab, useExpenseRecurring |
| revenue/ | 3 | useShopeeInventoryOut |
| reports/ | 0 | — |
| **TỔNG** | **22** | **9 files** |

**Pattern chính Pass 1:** `onUpdateSurgical` không await → lỗi Supabase im lặng.

---

## CHI TIẾT BUGS PASS 3

_(Không có bug nào — pass sạch hoàn toàn)_

---

## TỔNG KẾT PASS 2 — 2026-06-15 — 5 bugs tìm được

| Module | Bugs |
|---|---|
| purchase/ | 2 (sidebar filters không reset page) |
| customers/ | 0 |
| orders/ | 1 (OrderReturns checkbox filter không reset page) |
| finance/ | 1 (handleVoucherCheck không reset page) |
| overview/ | 0 |
| payroll/ | 1 (bulk undo bỏ sót settlement expense) |
| analysis/ | 0 |
| expense/ | 0 |
| revenue/ | 0 |
| reports/ | 0 |

**Pattern chính Pass 2:** Filter sidebar callbacks gọi setter trực tiếp không kèm `setCurrentPage(1)` → trang 2+ trống khi lọc.

---

## CHI TIẾT BUGS PASS 2

### components/payroll/

| Bug | File | Mô tả | Fix |
|---|---|---|---|
| BUG-PY2-1 | PayrollManager.tsx:380 | Bulk undo toàn bộ lương tháng chỉ xóa expense có prefix `"Chi lương tháng MM/YYYY"` — bỏ sót expense `"Quyết toán lương nghỉ việc - [tên]"` của nhân viên đã nghỉ → orphan expense | Thu thập tên nhân viên settlement trong tháng, filter cả 2 dạng description |

### components/finance/

| Bug | File | Mô tả | Fix |
|---|---|---|---|
| BUG-F2-1 | CashLedgerPage.tsx:530 | `handleVoucherCheck` đổi `voucherType` (checkbox thu/chi) không gọi `setPage(1)` → trang 2+ trống khi toggle filter | Thêm `setPage(1)` vào cuối hàm |

### components/orders/

| Bug | File | Mô tả | Fix |
|---|---|---|---|
| BUG-O2-1 | OrderReturns.tsx:682,697 | Checkbox filter `returnTypeFilter` và `statusFilter` dùng `toggleArr` không kèm `setCurrentPage(1)` → trang 2+ bị trống khi tick filter | Thêm `setCurrentPage(1)` vào onChange callback |

### components/purchase/

| Bug | File | Mô tả | Fix |
|---|---|---|---|
| BUG-P2-1 | PurchaseOrdersPage.tsx:315,324,325,339,352 | Sidebar filters (status, date, supplier, creator) gọi setter trực tiếp không kèm `setCurrentPage(1)` → trang 2+ hiển thị trống khi thay đổi filter | Wrap mỗi onChange thành callback bổ sung `setCurrentPage(1)` |
| BUG-P2-2 | PurchaseReturnsPage.tsx:260,269,270,285,298 | Tương tự BUG-P2-1 trên trang trả hàng nhập | Tương tự BUG-P2-1 |
