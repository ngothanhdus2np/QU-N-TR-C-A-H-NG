# STATE_TRANSITIONS — Trạng thái nghiệp vụ CFO Brain 4.0

> Source: types.ts, services/posOrderService.ts, components/website/WebsiteOrdersPage.tsx, supabase_setup.sql

---

## 1. POSOrder.status

```
┌─────────────────────────────────────────────────────────────┐
│                     POSOrder Status                         │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  [draft] ──────→ [pending]                                  │
│                      │                                      │
│                      ├──→ [completed] ←── direct/offline    │
│                      │                                      │
│                      ├──→ [cancelled]                       │
│                      │         (cộng tồn kho ngay)          │
│                      │                                      │
│                      ├──→ [return_requested]                 │
│                      │         (website: chờ hàng về)       │
│                      │                                      │
│                      └──→ [returned]                        │
│                                (cộng tồn kho)               │
└─────────────────────────────────────────────────────────────┘
```

| Status | Mô tả | Kênh |
|--------|-------|------|
| draft | Chưa hoàn tất (offline queue) | direct |
| pending | Đang chờ xử lý | website |
| completed | Hoàn thành | direct/website |
| cancelled | Đã huỷ | website |
| return_requested | Đang hoàn hàng | website |
| returned | Đã hoàn hàng | website |

**Source:** `types.ts:528` — `POSOrderStatus`

---

## 2. InventoryTransaction.status

```
┌──────────────────────────────────────────────────┐
│            InventoryTransaction Status           │
├──────────────────────────────────────────────────┤
│                                                  │
│  [draft] ──────→ [completed]                     │
│                      │                           │
│                      └──→ [cancelled]             │
│                            (stock rollback)       │
│                                                  │
│  [completed] ──→ [balanced]  (chỉ type=Check)    │
└──────────────────────────────────────────────────┘
```

| Status | Mô tả |
|--------|-------|
| draft | Phiếu tạm (chưa ảnh hưởng tồn kho) |
| completed | Đã hoàn thành (đã trừ/cộng tồn kho) |
| cancelled | Đã huỷ (rollback stock tự động) |
| balanced | Phiếu kiểm kho đã đối chiếu |

**Xoá phiếu:** RPC `delete_inventory_transaction_with_stock()` — chỉ rollback stock nếu status != 'cancelled'

---

## 3. VatDocument.status

```
┌──────────────────────────────────────────────────────────┐
│                  VatDocument Status                      │
├──────────────────────────────────────────────────────────┤
│                                                          │
│  [unallocated] ──→ [partial] ──→ [completed]            │
│                         │                               │
│                         └──→ [over_allocated]            │
│                                                          │
│  [*any*] ──→ [void]  (bất kỳ lúc nào)                  │
└──────────────────────────────────────────────────────────┘
```

**Source:** `types.ts:892`

---

## 4. TaxFilingPeriod.status

```
[draft] ──→ [locked] ──→ [archived]
```

**Mô tả:** Kỳ kê khai VAT. Khi `locked` → không cho phép sửa phân bổ.

---

## 5. Shopee Order Status

```
Bot Shopee (tiếng Việt)      →    DB (shopee_inventory_out.status)
─────────────────────────────────────────────────────────────────
"Chờ xác nhận"/"Chờ lấy hàng" → PENDING
"Đang giao"/"Đã giao cho ĐVVC" → SHIPPING
"Đã giao"/"Đã nhận được hàng" → OK
"Đang hoàn"/"Hoàn hàng"       → RETURN
"Đã hủy"                      → CANCEL
(Bưu tá mất hàng)             → LOST
```

**Source:** `routes/inventoryOutSync.ts`

---

## 6. Employee (trạng thái hoạt động)

```
┌──────────────────────────────────┐
│        Employee Status           │
├──────────────────────────────────┤
│                                  │
│  [active]  ──────→  [resigned]  │
│  resignedDate = null   resignedDate = ngày nghỉ │
└──────────────────────────────────┘
```

Không có trường `status` riêng — hệ thống check `resignedDate` để xác định active/inactive.

---

## 7. PayrollRecord (chốt lương)

```
[chưa chốt]  ──→  [đã chốt]
(không có       (bản ghi tồn tại
bản ghi)         trong payroll_records)
```

**Không có trường status trong `payroll_records`.** "Chốt lương" = upsert bản ghi vào bảng.
Chưa chốt = bản ghi chưa tồn tại. Đã chốt = bản ghi tồn tại.

Khi chốt lương, hệ thống ghi đồng thời 4 bảng (xem OP-012):
- `payroll_records` — bản ghi lương
- `expense_records` — chi phí lương tháng
- `staff_performance` — hồ sơ hiệu năng
- `employees.carryForwardDebt` — nợ chuyển kỳ

---

## 8. POSProduct.status

```
[Active] ──→ [Inactive] ──→ [Discontinued]
```

| Status | Mô tả |
|--------|-------|
| Active | Đang bán (hiển thị trong POS search) |
| Inactive | Tạm ngừng (ẩn khỏi POS, ẩn khỏi dropdown nhập hàng) |
| Discontinued | Ngừng kinh doanh hẳn |

**Source:** `components/pos/GoodsPurchaseForm.tsx` — filter `p.status !== 'Inactive'`

---

## 9. Supplier.status

```
[active] ──↔── [inactive]
```

Đổi được 2 chiều. Nhà cung cấp `inactive` → không hiển thị trong dropdown chọn NCC khi nhập hàng.

---

## 10. Store Order (đơn website) — chi tiết hơn Status POS

```
[pending] ──→ [confirmed] ──→ [shipping] ──→ [completed]
    │               │              │
    │               │              └──→ [return_requested] ──→ [returned]
    │               │
    └──→ [cancelled] (trước khi giao ĐVVC → cộng tồn kho ngay)
```

**Source:** `components/website/WebsiteOrdersPage.tsx`, RPC `update_website_order_status`

---

## 11. Invoice Attachment (hóa đơn VAT đầu vào)

```
Trạng thái thuộc InventoryTransaction.invoice_status:

[none] ──→ [memo_only] ──→ [partial] ──→ [full]
```

| Status | Mô tả |
|--------|-------|
| none | Chưa có hóa đơn |
| memo_only | Có phiếu ghi nhớ, chưa có hóa đơn chính thức |
| partial | Có một phần hóa đơn |
| full | Đủ hóa đơn |
