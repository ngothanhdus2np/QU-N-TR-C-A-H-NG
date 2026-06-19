# DEBT_LOGIC — Công nợ khách hàng & nhà cung cấp

> Source: types.ts, components/suppliers/SupplierContainer.tsx,
>         components/customers/CustomerDetailPage.tsx, services/posOrderService.ts

---

## PHẦN 1: Công nợ khách hàng

### Mô hình dữ liệu

```
pos_customers
  debt_amount: number  ← số dư hiện tại (snapshot, cập nhật khi có transaction)

customer_debt_history
  customer_id: UUID FK → pos_customers
  order_id: UUID (nếu phát sinh từ đơn hàng)
  type: 'debt' | 'repay'
  amount: number
  date: TEXT
  note: TEXT
```

### Luồng 1: Phát sinh công nợ khi bán hàng ghi nợ

**Trigger:** Nhân viên chọn "Ghi nợ" khi thanh toán POS

**Processing:**
```
1. POSOrder tạo bình thường (finalAmount > 0)
2. INSERT customer_debt_history {
     type: 'debt',
     amount: debtAmount,
     order_id: newOrderId,
     date: today
   }
3. UPDATE pos_customers SET debt_amount += debtAmount
```

**Source:** `services/posOrderService.ts:processPlaceOrder()`

---

### Luồng 2: Khách thanh toán nợ

**Trigger:** Nhân viên nhập khoản thanh toán nợ trong trang Khách hàng

**Processing:**
```
1. INSERT customer_debt_history {
     type: 'repay',
     amount: repayAmount,
     date: today,
     note: ghi chú
   }
2. UPDATE pos_customers SET debt_amount -= repayAmount
   (có thể về 0 hoặc dư — không giới hạn)
```

**Source:** `components/customers/CustomerDetailPage.tsx`

---

### Luồng 3: Trả hàng từ đơn ghi nợ

**Điểm quan trọng:**

Khi khách trả hàng, hệ thống **KHÔNG tự động giảm `debt_amount`**.

**Lý do:** Đơn trả hàng không biết chắc khách đã trả nợ hay chưa.

**Hành động thủ công cần thiết:**
- Nhân viên phải vào trang Khách hàng → ghi thêm khoản "Hoàn tiền" (repay) để giảm nợ.

**Source:** `components/pos/POSComputer.tsx` — `returnUpdatedCustomer` không có `debtAmount` field.

---

### Xem lịch sử công nợ khách

```
components/customers/CustomerDetailPage.tsx
  → Hiển thị customer_debt_history (sorted by date DESC)
  → Tính số dư chạy (running balance)
  → Phân biệt màu: debt=đỏ, repay=xanh
```

---

## PHẦN 2: Công nợ nhà cung cấp

### Mô hình dữ liệu (Transaction Model)

```
supplier_debts
  supplier_id: UUID FK → suppliers
  supplier_name: TEXT
  date: TEXT
  type: 'purchase' | 'payment'
  amount: number
  description: TEXT

Số dư hiện tại (computed runtime):
  currentDebt = Σ(amount WHERE type='purchase') - Σ(amount WHERE type='payment')
```

**Lý do dùng transaction model (không snapshot):**
- Tránh race condition khi nhiều thiết bị ghi đồng thời
- Audit trail đầy đủ — biết chính xác từng lần mua/trả
- Dễ kiểm tra đối soát với NCC

---

### Luồng 1: Phát sinh công nợ khi nhập hàng

**Trigger:** Hoàn thành phiếu nhập hàng

**Processing:**
```
INSERT supplier_debts {
  type: 'purchase',
  amount: totalAfterDiscount,
  supplier_id, supplier_name,
  date: today,
  description: "Nhập hàng - " + referenceId
}
```

**Source:** `components/purchase/PurchaseOrdersContainer.tsx:handleCompletePurchase()`

---

### Luồng 2: Thanh toán công nợ NCC (thủ công)

**Trigger:** Nhân viên nhập khoản thanh toán trong trang Nhà cung cấp

**Processing:**
```
INSERT supplier_debts {
  type: 'payment',
  amount: paymentAmount,
  supplier_id, supplier_name,
  date: today,
  description: ghi chú
}
```

**Source:** `components/suppliers/SupplierContainer.tsx`

---

### Luồng 3: Giảm công nợ khi trả hàng nhập

**Trigger:** Hoàn thành phiếu trả hàng nhập

**Processing:**
```
Trường hợp A — Đổi lấy hàng hoá khác (không cần tiền mặt):
  INSERT supplier_debts {
    type: 'payment',
    amount: returnValue,
    description: "Trả hàng - " + referenceId
  }

Trường hợp B — NCC trả tiền mặt:
  INSERT supplier_debts {
    type: 'payment',
    amount: cashPaidBySuplier,
    description: "NCC trả tiền mặt - " + referenceId
  }

Rollback nếu lỗi: xóa cả 2 debt records đã insert
```

**Source:** `components/purchase/PurchaseOrdersContainer.tsx:handleCompleteReturn()`

---

### Xem công nợ NCC

```
components/suppliers/SupplierDetailView.tsx
  → Fetch supplier_debts WHERE supplier_id = X
  → Group by tháng, tính running balance
  → currentDebt = Σpurchase - Σpayment
```

---

## PHẦN 3: Nợ lương nhân viên (Carry-forward Debt)

### Mô hình dữ liệu

```
employees.carry_forward_debt: number  ← nợ hiện tại chưa trả
payroll_records.carry_forward_deduction: number  ← trừ kỳ này
payroll_records.carry_forward_debt_out: number   ← nợ còn lại chuyển kỳ sau
```

### Khi nào phát sinh nợ lương?

1. Net pay âm (nhân viên nợ tiền do vi phạm, thiếu hụt,...)
2. Tổng khấu trừ (advance + shortage + fine) > tổng thu nhập

### Luồng tính nợ carry-forward

**Kỳ N:**
```
carryForwardDebt = employees.carry_forward_debt  (nợ từ kỳ trước)
carryForwardDeduction = min(carryForwardDebt, available_amount)
  (chỉ trừ tối đa = phần có thể trừ trong kỳ)
carryForwardDebtOut = carryForwardDebt - carryForwardDeduction
  (nợ còn lại chuyển kỳ sau)
```

**Sau chốt lương kỳ N:**
```
UPDATE employees SET carry_forward_debt = carryForwardDebtOut
```

**Source:** `src/lib/businessLogic.payroll.ts` (carry-forward logic)

---

## Đặc điểm chung của 3 loại công nợ

| | Công nợ KH | Công nợ NCC | Nợ lương |
|--|-----------|------------|---------|
| Bảng | customer_debt_history | supplier_debts | employees + payroll_records |
| Model | Transaction + Snapshot | Transaction only | Snapshot per kỳ |
| Số dư tổng | pos_customers.debt_amount | Tính runtime | employees.carry_forward_debt |
| Chiều dương | 'debt' | 'purchase' | nợ (netPay < 0) |
| Chiều âm | 'repay' | 'payment' | carryForwardDeduction |
| Auto-sync | Có (khi bán hàng) | Có (khi nhập hàng) | Có (khi chốt lương) |
| Manual entry | Có (trang KH) | Có (trang NCC) | Có (nút "Tính lại lịch sử") |
