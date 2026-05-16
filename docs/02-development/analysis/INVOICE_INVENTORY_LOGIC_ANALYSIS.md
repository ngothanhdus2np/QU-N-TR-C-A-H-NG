# BÁO CÁO PHÂN TÍCH LOGIC TÍNH TIỀN HÓA ĐƠN VÀ TỒN KHO

**Ngày phân tích:** 14/05/2026  
**Phạm vi:** Toàn bộ hệ thống POS, Inventory, Revenue

---

## 📊 TÓM TẮT ĐÁNH GIÁ

### ✅ ĐIỂM MẠNH
1. **Logic tính toán chính xác** - Công thức tính tiền rõ ràng, tuân thủ chuẩn kế toán
2. **Bảo vệ tồn kho tốt** - Có guard client-side + RPC atomic server-side
3. **Hỗ trợ đa kịch bản** - Bán hàng, trả hàng, đổi hàng, nhập kho, kiểm kho
4. **Tính năng đầy đủ** - Chiết khấu item/bill, phí khác, split payment, tích điểm

### ⚠️ VẤN ĐỀ CẦN LƯU Ý
1. **Rủi ro làm tròn số** - Chiết khấu % có thể gây sai lệch nhỏ khi tích lũy
2. **Thiếu validation nghiệp vụ** - Chưa kiểm tra giá trị âm, số lượng quá lớn
3. **Chưa có audit trail đầy đủ** - Thiếu log thay đổi giá, chiết khấu
4. **Race condition còn tồn tại** - Client guard không đủ mạnh cho multi-device

---

## 1️⃣ LOGIC TÍNH TIỀN HÓA ĐƠN

### 1.1. Công Thức Tính Toán (POSComputer.tsx)

```typescript
// Bước 1: Tính tổng tiền hàng (trước chiết khấu)
totalBeforeDiscount = Σ(item.quantity × (item.price - item.discount))

// Bước 2: Tính chiết khấu hóa đơn
if (discountType === 'percent') {
  manualDiscountAmount = totalBeforeDiscount × discountValue / 100
} else {
  manualDiscountAmount = discountValue
}

// Bước 3: Tổng chiết khấu
totalDiscount = manualDiscountAmount + autoPromotion

// Bước 4: Tổng thanh toán
netPayable = max(0, totalBeforeDiscount - totalDiscount + otherFees)

// Bước 5: Điểm tích lũy
pointsEarned = floor(netPayable / 10000)
```

**✅ Đánh giá:**
- Công thức đúng chuẩn kế toán
- Có xử lý giá trị âm (max 0)
- Chiết khấu item-level được tính trước, sau đó mới đến bill-level
- Điểm tích lũy làm tròn xuống (floor) - hợp lý

**⚠️ Lưu ý:**
- Chiết khấu % có thể gây sai lệch làm tròn khi tích lũy nhiều đơn
- Ví dụ: 100,000đ × 5% = 5,000đ (OK)
- Nhưng: 99,999đ × 5% = 4,999.95đ → làm tròn thành 5,000đ (sai lệch 0.05đ)

### 1.2. Xử Lý Chiết Khấu Item-Level

```typescript
// Cập nhật chiết khấu từng item
updateItemDiscount(productId, discountAmount) {
  cart.map(item =>
    item.productId === productId
      ? {
          ...item,
          discount: discountAmount,
          total: item.quantity × (item.price - discountAmount)
        }
      : item
  )
}
```

**✅ Đánh giá:**
- Logic đơn giản, dễ hiểu
- Chiết khấu là số tiền cố định (VNĐ), không phải %

**⚠️ Thiếu:**
- Không validate `discountAmount > item.price` (có thể âm)
- Không log lịch sử thay đổi chiết khấu

### 1.3. Xử Lý Trả Hàng (usePOSReturnFlow.ts)

```typescript
// Tính tổng tiền trả
totalReturnBeforeDiscount = Σ(returnItem.total)

// Tính số tiền hoàn lại cuối cùng
finalReturnAmount = max(0, totalReturnBeforeDiscount - returnDiscount - returnFee + returnOtherRefund)

// Tính chênh lệch với đơn mới (nếu đổi hàng)
netReturnDifference = finalReturnAmount - netPayable

// Số tiền trả khách
amountToPayCustomer = netReturnDifference > 0 ? netReturnDifference : 0

// Số tiền khách phải trả thêm
customerPaysDifference = netReturnDifference < 0 ? abs(netReturnDifference) : 0
```

**✅ Đánh giá:**
- Logic trả hàng chính xác
- Hỗ trợ cả trả thuần túy và đổi hàng
- Tính chênh lệch đúng

**⚠️ Thiếu:**
- Không kiểm tra `returnItem.quantity > originalQuantity`
- Không validate thời gian trả hàng (có thể trả sau 1 năm?)

---

## 2️⃣ LOGIC CẬP NHẬT TỒN KHO

### 2.1. Bảo Vệ Tồn Kho Client-Side (POSComputer.tsx)

```typescript
// Guard khi thêm vào giỏ
addToCart(product) {
  const qtyInCart = existingItem?.quantity ?? 0
  if (!allowSellOutOfStock && (product.stock <= 0 || qtyInCart >= product.stock)) {
    showStockWarning(`${product.name} — không đủ hàng (tồn: ${product.stock})`)
    return
  }
  // ... thêm vào giỏ
}

// Guard khi thanh toán
handleCheckout() {
  const insufficientItem = cart.find(item => {
    const product = products.find(p => p.id === item.productId)
    return !product || product.stock < item.quantity
  })
  
  if (insufficientItem) {
    showStockWarning(`${insufficientItem.name} — không đủ hàng`)
    return
  }
  // ... xử lý thanh toán
}
```

**✅ Đánh giá:**
- Có kiểm tra tồn kho trước khi thêm vào giỏ
- Có kiểm tra lại trước khi thanh toán
- Có cờ `allowSellOutOfStock` để bỏ qua kiểm tra

**⚠️ Vấn đề:**
- **Race condition:** 2 POS cùng bán 1 sản phẩm còn 1 cái
  - POS A: Kiểm tra stock = 1 → OK → Thêm vào giỏ
  - POS B: Kiểm tra stock = 1 → OK → Thêm vào giỏ
  - POS A: Thanh toán → stock = 0
  - POS B: Thanh toán → stock = -1 ❌
- Client-side guard không đủ mạnh cho multi-device

### 2.2. Bảo Vệ Atomic Server-Side (supabase_setup.sql)

```sql
-- RPC function đảm bảo atomic decrement
CREATE OR REPLACE FUNCTION decrement_product_stock(
  p_product_id UUID,
  p_quantity    INT
) RETURNS TABLE(id UUID, stock INT) AS $$
BEGIN
  RETURN QUERY
  UPDATE pos_products
  SET stock = pos_products.stock - p_quantity
  WHERE pos_products.id = p_product_id
    AND pos_products.stock >= p_quantity  -- ✅ Kiểm tra atomic
  RETURNING pos_products.id, pos_products.stock;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

**✅ Đánh giá:**
- **Atomic operation** - Đảm bảo không có race condition
- **WHERE stock >= quantity** - Chỉ trừ khi đủ hàng
- **RETURNING** - Trả về kết quả để client biết thành công/thất bại

**⚠️ Vấn đề:**
- **App KHÔNG SỬ DỤNG RPC này!** 
- Code hiện tại chỉ update trực tiếp bảng `pos_products`
- RPC chỉ là "trang trí", không được gọi trong `posOrderService.ts`

### 2.3. Cập Nhật Tồn Kho Thực Tế (posOrderService.ts)

```typescript
// Bán hàng
async function processPlaceOrder({ order, updatedProducts, ... }) {
  // 1. Tính COGS
  const orderCogs = calculateOrderCogs(currentProducts, order.items)
  
  // 2. Cập nhật revenue
  const revenueRecord = buildRevenueUpdate(existingRevenue, order, orderCogs)
  
  // 3. Tạo inventory transaction
  const inventoryTransaction = buildSaleTransaction(order, currentProducts, updatedProducts)
  
  // 4. Lưu order
  await pushBatch('posOrders', [order])
  
  // 5. Cập nhật stock (KHÔNG DÙNG RPC!)
  const stockUpdates = order.items.map(item => ({
    key: 'posProducts',
    item: findProduct(updatedProducts, item.productId)
  }))
  await updateSurgical([...stockUpdates, { key: 'inventoryTransactions', item: inventoryTransaction }])
  
  // 6. Cập nhật customer
  if (updatedCustomer) {
    await updateSurgical([{ key: 'posCustomers', item: updatedCustomer }])
  }
  
  // 7. Cập nhật revenue
  if (existingRevenue) {
    await updateSurgical([{ key: 'revenue', item: revenueRecord }])
  } else {
    await pushBatch('revenue', [revenueRecord])
  }
}
```

**✅ Đánh giá:**
- Cập nhật đầy đủ: stock, inventory transaction, revenue, customer
- Có tính COGS chính xác
- Có tạo audit trail (inventory transaction)

**⚠️ Vấn đề:**
- **Không dùng RPC atomic** - Vẫn có race condition
- **Không rollback khi lỗi** - Nếu bước 5 thành công nhưng bước 7 lỗi → dữ liệu không nhất quán
- **Không có transaction wrapper** - Các bước không atomic

---

## 3️⃣ LOGIC TÍNH GIÁ VỐN (COGS)

### 3.1. Tính COGS Đơn Hàng

```typescript
function calculateOrderCogs(products: POSProduct[], items: POSOrderItem[]) {
  return items.reduce((sum, item) => {
    const product = findProduct(products, item.productId)
    return sum + (product?.importPrice || 0) × item.quantity
  }, 0)
}
```

**✅ Đánh giá:**
- Công thức đơn giản: COGS = Σ(importPrice × quantity)
- Dùng giá nhập cố định (fixed cost method)

**⚠️ Vấn đề:**
- **Không hỗ trợ FIFO/LIFO** - Chỉ dùng giá nhập cố định
- **Không cập nhật giá nhập trung bình** - Khi nhập hàng mới với giá khác
- **Không xử lý trường hợp product = null** - Có thể trả về COGS = 0 sai

### 3.2. Cập Nhật Revenue

```typescript
function buildRevenueUpdate(existingRevenue, order, orderCogs) {
  if (existingRevenue) {
    const updatedNetRevenue = existingRevenue.netRevenue + order.finalAmount
    const updatedTotalCogs = existingRevenue.totalCogs + orderCogs
    return {
      ...existingRevenue,
      totalGrossRevenue: existingRevenue.totalGrossRevenue + order.totalAmount,
      discount: existingRevenue.discount + order.discount,
      netRevenue: updatedNetRevenue,
      totalCogs: updatedTotalCogs,
      grossProfit: updatedNetRevenue - updatedTotalCogs,
    }
  }
  
  return {
    id: crypto.randomUUID(),
    date: revenueDate,
    totalGrossRevenue: order.totalAmount,
    discount: order.discount,
    revenueOther: 0,
    returnsValue: 0,
    netRevenue: order.finalAmount,
    totalCogs: orderCogs,
    grossProfit: order.finalAmount - orderCogs,
  }
}
```

**✅ Đánh giá:**
- Cập nhật đầy đủ các trường revenue
- Tính gross profit chính xác: netRevenue - totalCogs
- Tích lũy đúng khi có nhiều đơn trong ngày

**⚠️ Vấn đề:**
- **Không xử lý trả hàng** - Khi trả hàng, cần trừ COGS và revenue
- **Không cập nhật returnsValue** - Trường này luôn = 0

---

## 4️⃣ PHÂN TÍCH INVENTORY TRANSACTIONS

### 4.1. Các Loại Transaction

```typescript
type TransactionType = 
  | 'Import'           // Nhập kho
  | 'PurchaseReturn'   // Trả hàng nhập
  | 'Export'           // Xuất kho
  | 'Check'            // Kiểm kho
  | 'Sale'             // Bán hàng
  | 'Return'           // Trả hàng
  | 'internal_use'     // Sử dụng nội bộ
  | 'disposal'         // Hủy hàng
```

**✅ Đánh giá:**
- Đầy đủ các loại transaction
- Mỗi loại có logic riêng

### 4.2. RPC Apply Transaction (supabase_setup.sql)

```sql
CREATE OR REPLACE FUNCTION apply_inventory_transaction_with_stock(
  p_transaction JSONB
) RETURNS TABLE(transaction_id UUID, date TEXT, type TEXT) AS $$
DECLARE
  item JSONB;
  tx_type TEXT := p_transaction->>'type';
BEGIN
  -- 1. Insert/Update transaction
  INSERT INTO inventory_transactions (...) VALUES (...)
  ON CONFLICT (id) DO UPDATE SET ...;
  
  -- 2. Update stock theo từng loại
  FOR item IN SELECT * FROM jsonb_array_elements(p_transaction->'items')
  LOOP
    IF tx_type = 'Import' THEN
      UPDATE pos_products SET stock = stock + quantity WHERE id = productId;
    ELSIF tx_type = 'Sale' THEN
      UPDATE pos_products SET stock = stock - quantity WHERE id = productId AND stock >= quantity;
      IF NOT FOUND THEN RAISE EXCEPTION 'Insufficient stock';
    ELSIF tx_type = 'Return' THEN
      UPDATE pos_products SET stock = stock + quantity WHERE id = productId;
    ELSIF tx_type = 'Check' THEN
      UPDATE pos_products SET stock = newStock WHERE id = productId;
    END IF;
  END LOOP;
  
  RETURN QUERY SELECT tx_id, p_transaction->>'date', tx_type;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

**✅ Đánh giá:**
- **Atomic transaction** - Tất cả items cùng commit/rollback
- **Kiểm tra stock khi Sale** - Không cho bán khi hết hàng
- **Hỗ trợ nhiều loại transaction**

**⚠️ Vấn đề:**
- **App KHÔNG SỬ DỤNG RPC này!**
- Chỉ dùng cho Import/Check từ UI, không dùng cho Sale từ POS
- POS vẫn update trực tiếp → vẫn có race condition

---

## 5️⃣ CÁC VẤN ĐỀ NGHIÊM TRỌNG

### 🔴 VẤN ĐỀ 1: Race Condition Tồn Kho

**Mô tả:**
- 2 POS cùng bán 1 sản phẩm còn 1 cái
- Cả 2 đều pass client guard
- Cả 2 đều update stock thành công
- Kết quả: stock = -1

**Nguyên nhân:**
- Không dùng RPC atomic `decrement_product_stock`
- Update trực tiếp bảng `pos_products`

**Giải pháp:**
```typescript
// Thay vì:
await updateSurgical([{ key: 'posProducts', item: updatedProduct }])

// Nên dùng:
const result = await supabase.rpc('decrement_product_stock', {
  p_product_id: item.productId,
  p_quantity: item.quantity
})

if (!result.data || result.data.length === 0) {
  throw new Error(`Không đủ tồn kho: ${item.name}`)
}
```

### 🔴 VẤN ĐỀ 2: Không Có Transaction Rollback

**Mô tả:**
- Nếu bước 5 thành công nhưng bước 7 lỗi
- Stock đã trừ nhưng revenue chưa cập nhật
- Dữ liệu không nhất quán

**Giải pháp:**
- Dùng Supabase transaction hoặc
- Implement compensating transaction (rollback thủ công)

### 🟡 VẤN ĐỀ 3: Thiếu Validation Nghiệp Vụ

**Các trường hợp chưa validate:**
1. Chiết khấu > giá bán → total âm
2. Số lượng quá lớn (> 1 triệu) → có thể nhập nhầm
3. Giá bán = 0 → có thể quên nhập giá
4. Trả hàng sau 1 năm → không hợp lý
5. Trả số lượng > số lượng mua → gian lận

**Giải pháp:**
```typescript
// Validate trong addToCart
if (item.discount > item.price) {
  throw new Error('Chiết khấu không được lớn hơn giá bán')
}

if (item.quantity > 10000) {
  showWarning('Số lượng quá lớn, vui lòng kiểm tra lại')
}

// Validate trong handleCheckout
if (order.finalAmount <= 0) {
  throw new Error('Tổng tiền phải lớn hơn 0')
}
```

### 🟡 VẤN ĐỀ 4: Thiếu Audit Trail

**Các thông tin chưa log:**
1. Lịch sử thay đổi giá sản phẩm
2. Lịch sử thay đổi chiết khấu
3. Người thực hiện thay đổi
4. Lý do hủy đơn/trả hàng

**Giải pháp:**
- Dùng bảng `audit_logs` đã có trong SQL
- Log mọi thay đổi quan trọng

### 🟡 VẤN ĐỀ 5: Không Xử Lý Trả Hàng Trong Revenue

**Mô tả:**
- Khi trả hàng, không cập nhật `returnsValue` trong revenue
- Không trừ COGS khi trả hàng
- Gross profit không chính xác

**Giải pháp:**
```typescript
// Trong processReturnOrder
const returnCogs = calculateOrderCogs(currentProducts, returnedItems)
const revenueUpdate = {
  ...existingRevenue,
  returnsValue: existingRevenue.returnsValue + totalReturnBeforeDiscount,
  netRevenue: existingRevenue.netRevenue - finalReturnAmount,
  totalCogs: existingRevenue.totalCogs - returnCogs,
  grossProfit: (existingRevenue.netRevenue - finalReturnAmount) - (existingRevenue.totalCogs - returnCogs)
}
```

---

## 6️⃣ KHUYẾN NGHỊ

### 🎯 Ưu Tiên Cao (Cần Fix Ngay)

1. **Sử dụng RPC atomic cho stock update**
   - File: `services/posOrderService.ts`
   - Thay `updateSurgical` bằng `supabase.rpc('decrement_product_stock')`

2. **Xử lý trả hàng trong revenue**
   - File: `services/posOrderService.ts`
   - Cập nhật `returnsValue` và trừ COGS

3. **Thêm validation nghiệp vụ**
   - File: `components/pos/POSComputer.tsx`
   - Validate chiết khấu, số lượng, giá bán

### 🎯 Ưu Tiên Trung Bình

4. **Implement transaction rollback**
   - Dùng try-catch và compensating transaction

5. **Thêm audit trail**
   - Log mọi thay đổi quan trọng vào `audit_logs`

6. **Hỗ trợ FIFO/LIFO cho COGS**
   - Tính giá vốn chính xác hơn

### 🎯 Ưu Tiên Thấp

7. **Tối ưu performance**
   - Cache products trong memory
   - Batch update nhiều items

8. **Thêm báo cáo chi tiết**
   - Báo cáo tồn kho theo thời gian
   - Báo cáo COGS theo sản phẩm

---

## 7️⃣ KẾT LUẬN

### Tổng Quan
Logic tính tiền hóa đơn và tồn kho của app **CƠ BẢN ĐÃ ĐÚNG** và hoạt động tốt cho:
- ✅ Cửa hàng đơn lẻ, 1 POS
- ✅ Bán hàng thông thường, không phức tạp
- ✅ Không có yêu cầu audit nghiêm ngặt

### Cần Cải Thiện Cho
- ⚠️ Multi-device (nhiều POS cùng bán)
- ⚠️ Yêu cầu audit trail đầy đủ
- ⚠️ Tính COGS chính xác (FIFO/LIFO)
- ⚠️ Xử lý trả hàng phức tạp

### Điểm Số Tổng Thể
- **Tính chính xác:** 8/10 (trừ 2 điểm vì race condition và thiếu validation)
- **Tính đầy đủ:** 7/10 (trừ 3 điểm vì thiếu audit trail và FIFO/LIFO)
- **Tính ổn định:** 6/10 (trừ 4 điểm vì race condition và không có rollback)
- **Tổng điểm:** 7/10 ⭐⭐⭐⭐⭐⭐⭐

---

**Người phân tích:** Kiro AI  
**Ngày:** 14/05/2026  
**Phiên bản app:** Latest
