# Kế Hoạch Sửa Lỗi Trang Mua Hàng

**Ngày**: 2026-05-18  
**Trang**: Mua hàng / Nhà cung cấp  
**Số lỗi**: 8 issues  
**Ưu tiên**: P1 - HIGH (ảnh hưởng UX)

---

## 📋 DANH SÁCH LỖI

### 🔴 **Issue #1: Thông báo lưu thất bại nhưng vẫn thêm được**
**Mô tả**: Khi thêm nhà cung cấp có thông báo "Lưu thất bại vui lòng thử lại" nhưng nhà cung cấp vẫn được thêm vào database

**Nguyên nhân dự đoán**:
- Toast message hiển thị sai
- Promise handling không đúng
- Success callback bị gọi nhầm

**File liên quan**:
- `components/suppliers/SupplierForm.tsx`
- `components/suppliers/SuppliersContainer.tsx`
- API endpoint `/api/data/suppliers`

**Độ ưu tiên**: 🔴 P0 - CRITICAL (logic error)

---

### 🟡 **Issue #2: Thông báo từ localhost khi xóa nhà cung cấp**
**Mô tả**: Khi xóa nhà cung cấp có thông báo từ localhost (có thể là error message hoặc debug log)

**Nguyên nhân dự đoán**:
- Console.log/error không được xóa
- Error message hiển thị URL localhost
- Toast message chứa debug info

**File liên quan**:
- `components/suppliers/SupplierListPage.tsx`
- `components/suppliers/SuppliersContainer.tsx`

**Độ ưu tiên**: 🟡 P1 - HIGH (UX issue)

---

### 🟡 **Issue #3: Popup thêm nhà cung cấp bị trùng với thanh tiêu đề**
**Mô tả**: Khung popup khi thêm nhà cung cấp bị trùng với thanh tiêu đề (header), cần lùi xuống dưới

**Nguyên nhân**:
- Z-index không đúng
- Top position không tính header height
- Modal positioning issue

**File liên quan**:
- `components/suppliers/SupplierForm.tsx`

**Độ ưu tiên**: 🟡 P1 - HIGH (UI issue)

---

### 🟡 **Issue #4: Trang chi tiết nhà cung cấp chưa có**
**Mô tả**: Chưa có trang chi tiết nhà cung cấp (detail page)

**Cần làm**:
- Tạo component `SupplierDetailPage.tsx`
- Hiển thị thông tin đầy đủ
- Lịch sử giao dịch
- Công nợ
- Thống kê

**File cần tạo**:
- `components/suppliers/SupplierDetailPage.tsx`

**Độ ưu tiên**: 🟡 P1 - HIGH (missing feature)

---

### 🟡 **Issue #5: Mã nhà cung cấp tự động không đúng format**
**Mô tả**: Khi để app thêm mã tự động, format không đúng. Mong muốn: `NCC0001`

**Hiện tại**: Có thể là `SUP001` hoặc format khác  
**Mong muốn**: `NCC0001` (4 chữ số)

**File liên quan**:
- `components/suppliers/SuppliersContainer.tsx`
- Logic generate supplier code

**Độ ưu tiên**: 🟡 P1 - HIGH (data format)

---

### 🟡 **Issue #6: Ô tìm nhà cung cấp không ra nhà cung cấp vừa thêm**
**Mô tả**: Trong phiếu nhập hàng, ô tìm nhà cung cấp không hiển thị nhà cung cấp vừa mới thêm

**Nguyên nhân dự đoán**:
- Cache không refresh
- State không update
- API không fetch lại data

**File liên quan**:
- `components/purchase/PurchaseOrdersPage.tsx`
- `components/purchase/PurchaseOrderDetailModal.tsx`

**Độ ưu tiên**: 🟡 P1 - HIGH (workflow blocker)

---

### 🟢 **Issue #7: Chuyển ô chứng từ lên giữa**
**Mô tả**: Trong phiếu nhập hàng, chuyển ô "Chứng từ" lên giữa mã phiếu nhập và tổng tiền hàng

**Hiện tại**: Chứng từ ở vị trí không hợp lý  
**Mong muốn**: Chứng từ nằm giữa mã phiếu và tổng tiền

**File liên quan**:
- `components/purchase/PurchaseOrderDetailModal.tsx`

**Độ ưu tiên**: 🟢 P2 - MEDIUM (UI improvement)

---

### 🟡 **Issue #8: Popup trong phiếu nhập hàng bị trùng thanh tiêu đề**
**Mô tả**: Popup thêm hàng hóa và thêm nhà cung cấp trong phiếu nhập hàng bị trùng với thanh tiêu đề

**Nguyên nhân**: Giống Issue #3
- Z-index không đúng
- Modal positioning issue

**File liên quan**:
- `components/purchase/PurchaseOrderDetailModal.tsx`
- Nested modals

**Độ ưu tiên**: 🟡 P1 - HIGH (UI issue)

---

## 🎯 KẾ HOẠCH THỰC HIỆN

### **Phase 1: Critical Fixes (1-2 giờ)**
**Mục tiêu**: Fix các lỗi logic nghiêm trọng

#### **Fix 1.1: Thông báo lưu thất bại (Issue #1)** ⚡ CRITICAL
**Thời gian**: 30 phút

**Bước thực hiện**:
1. Đọc `SuppliersContainer.tsx` để tìm logic save
2. Kiểm tra error handling trong `onSave` callback
3. Fix toast message logic
4. Test thêm nhà cung cấp mới

**Expected changes**:
```typescript
// BEFORE (dự đoán)
const handleSave = async (supplier: Supplier) => {
  try {
    await saveSupplier(supplier);
    showToast('Lưu thất bại', 'error'); // ← SAI!
  } catch (error) {
    showToast('Lưu thành công', 'success'); // ← SAI!
  }
};

// AFTER
const handleSave = async (supplier: Supplier) => {
  try {
    await saveSupplier(supplier);
    showToast('Lưu thành công', 'success'); // ← ĐÚNG
  } catch (error) {
    showToast('Lưu thất bại', 'error'); // ← ĐÚNG
  }
};
```

---

#### **Fix 1.2: Mã nhà cung cấp format (Issue #5)** ⚡ HIGH
**Thời gian**: 20 phút

**Bước thực hiện**:
1. Tìm function generate supplier code
2. Sửa format từ `SUP001` → `NCC0001`
3. Test với nhiều nhà cung cấp

**Expected changes**:
```typescript
// BEFORE
const generateSupplierCode = (suppliers: Supplier[]) => {
  const maxCode = Math.max(...suppliers.map(s => 
    parseInt(s.code?.replace('SUP', '') || '0')
  ));
  return `SUP${String(maxCode + 1).padStart(3, '0')}`;
};

// AFTER
const generateSupplierCode = (suppliers: Supplier[]) => {
  const maxCode = Math.max(...suppliers.map(s => 
    parseInt(s.code?.replace('NCC', '') || '0')
  ));
  return `NCC${String(maxCode + 1).padStart(4, '0')}`;
};
```

---

#### **Fix 1.3: Nhà cung cấp vừa thêm không hiển thị (Issue #6)** ⚡ HIGH
**Thời gian**: 30 phút

**Bước thực hiện**:
1. Kiểm tra state management trong PurchaseOrdersPage
2. Thêm refresh logic sau khi thêm supplier
3. Hoặc update local state ngay lập tức

**Expected changes**:
```typescript
// AFTER adding supplier
const handleAddSupplier = async (supplier: Supplier) => {
  await saveSupplier(supplier);
  // Refresh suppliers list
  await fetchSuppliers(); // ← THÊM
  // Or update local state
  setSuppliers(prev => [...prev, supplier]); // ← HOẶC
};
```

---

### **Phase 2: UI Fixes (1 giờ)**
**Mục tiêu**: Fix các vấn đề giao diện

#### **Fix 2.1: Popup trùng thanh tiêu đề (Issue #3, #8)** ⚡ HIGH
**Thời gian**: 30 phút

**Bước thực hiện**:
1. Kiểm tra CSS của modal
2. Thêm `top` offset để tránh header
3. Hoặc tăng `z-index` của modal

**Expected changes**:
```typescript
// In SupplierForm.tsx
<div className="fixed inset-0 z-[1000] bg-slate-950/45 p-3 backdrop-blur-sm md:p-6">
  {/* BEFORE */}
  <div className="mx-auto flex h-full max-h-[900px] w-full max-w-[1500px]...">
  
  {/* AFTER */}
  <div className="mx-auto flex h-full max-h-[900px] w-full max-w-[1500px] mt-16...">
    {/* ↑ Thêm mt-16 để lùi xuống dưới header */}
  </div>
</div>
```

**Hoặc**:
```typescript
// Adjust positioning
<div className="fixed inset-0 z-[1000] flex items-center justify-center p-4 pt-20">
  {/* ↑ pt-20 để tránh header */}
</div>
```

---

#### **Fix 2.2: Chuyển ô chứng từ (Issue #7)** 🟢 MEDIUM
**Thời gian**: 15 phút

**Bước thực hiện**:
1. Mở `PurchaseOrderDetailModal.tsx`
2. Tìm layout của form
3. Di chuyển field "Chứng từ" lên giữa

**Expected changes**:
```typescript
// BEFORE
<div>Mã phiếu nhập</div>
<div>Tổng tiền hàng</div>
<div>Chứng từ</div> {/* ← Ở dưới */}

// AFTER
<div>Mã phiếu nhập</div>
<div>Chứng từ</div> {/* ← Di chuyển lên */}
<div>Tổng tiền hàng</div>
```

---

#### **Fix 2.3: Xóa thông báo localhost (Issue #2)** 🟡 HIGH
**Thời gian**: 15 phút

**Bước thực hiện**:
1. Tìm tất cả `console.log` trong supplier files
2. Xóa hoặc comment out
3. Kiểm tra toast messages có chứa localhost URL không

**Expected changes**:
```typescript
// BEFORE
const handleDelete = async (id: string) => {
  try {
    await deleteSupplier(id);
    console.log('Deleted from http://localhost:3000/api/...'); // ← XÓA
    showToast('Xóa thành công từ localhost', 'success'); // ← SỬA
  } catch (error) {
    console.error(error); // ← XÓA
  }
};

// AFTER
const handleDelete = async (id: string) => {
  try {
    await deleteSupplier(id);
    showToast('Xóa nhà cung cấp thành công', 'success'); // ← ĐÚNG
  } catch (error) {
    showToast('Xóa thất bại', 'error');
  }
};
```

---

### **Phase 3: New Feature (2 giờ)**
**Mục tiêu**: Tạo trang chi tiết nhà cung cấp

#### **Fix 3.1: Trang chi tiết nhà cung cấp (Issue #4)** 🟡 HIGH
**Thời gian**: 2 giờ

**Bước thực hiện**:
1. Tạo file `SupplierDetailPage.tsx`
2. Design layout với các sections:
   - Thông tin cơ bản
   - Thống kê (tổng mua, công nợ)
   - Lịch sử giao dịch
   - Danh sách phiếu nhập
3. Integrate với routing
4. Test với data thực

**Component structure**:
```typescript
// SupplierDetailPage.tsx
interface SupplierDetailPageProps {
  supplier: Supplier;
  purchaseOrders: PurchaseOrder[];
  onEdit: () => void;
  onDelete: () => void;
  onBack: () => void;
}

const SupplierDetailPage: React.FC<SupplierDetailPageProps> = ({
  supplier,
  purchaseOrders,
  onEdit,
  onDelete,
  onBack,
}) => {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <button onClick={onBack}>← Quay lại</button>
        <div className="flex gap-2">
          <button onClick={onEdit}>Sửa</button>
          <button onClick={onDelete}>Xóa</button>
        </div>
      </div>

      {/* Info Card */}
      <div className="grid grid-cols-2 gap-6">
        <div>
          <h3>Thông tin cơ bản</h3>
          <p>Mã: {supplier.code}</p>
          <p>Tên: {supplier.name}</p>
          <p>SĐT: {supplier.phone}</p>
          <p>Email: {supplier.email}</p>
          <p>Địa chỉ: {supplier.address}</p>
        </div>
        <div>
          <h3>Thống kê</h3>
          <p>Tổng mua: {supplier.totalPurchase}</p>
          <p>Công nợ: {supplier.currentDebt}</p>
          <p>Trạng thái: {supplier.status}</p>
        </div>
      </div>

      {/* Purchase History */}
      <div>
        <h3>Lịch sử nhập hàng</h3>
        <table>
          {/* List of purchase orders */}
        </table>
      </div>
    </div>
  );
};
```

---

## 📊 TIMELINE TỔNG HỢP

| Phase | Tasks | Time | Priority |
|-------|-------|------|----------|
| **Phase 1** | Critical Fixes | 1-2h | 🔴 P0-P1 |
| - Fix 1.1 | Toast message logic | 30min | 🔴 P0 |
| - Fix 1.2 | Supplier code format | 20min | 🟡 P1 |
| - Fix 1.3 | Refresh supplier list | 30min | 🟡 P1 |
| **Phase 2** | UI Fixes | 1h | 🟡 P1-P2 |
| - Fix 2.1 | Modal positioning | 30min | 🟡 P1 |
| - Fix 2.2 | Move field | 15min | 🟢 P2 |
| - Fix 2.3 | Remove localhost msg | 15min | 🟡 P1 |
| **Phase 3** | New Feature | 2h | 🟡 P1 |
| - Fix 3.1 | Supplier detail page | 2h | 🟡 P1 |
| **TOTAL** | | **4-5h** | |

---

## 🎯 THỨ TỰ ƯU TIÊN

### **Làm ngay (Critical)**
1. ✅ Fix toast message logic (Issue #1) - 30min
2. ✅ Fix supplier code format (Issue #5) - 20min
3. ✅ Fix supplier list refresh (Issue #6) - 30min

### **Làm tiếp (High)**
4. ✅ Fix modal positioning (Issue #3, #8) - 30min
5. ✅ Remove localhost messages (Issue #2) - 15min

### **Làm sau (Medium-Low)**
6. ✅ Move field position (Issue #7) - 15min
7. ✅ Create detail page (Issue #4) - 2h

---

## 🔍 FILES CẦN SỬA

### **Sửa ngay**:
1. `components/suppliers/SuppliersContainer.tsx` - Toast logic, code generation
2. `components/suppliers/SupplierForm.tsx` - Modal positioning
3. `components/purchase/PurchaseOrdersPage.tsx` - Supplier refresh
4. `components/purchase/PurchaseOrderDetailModal.tsx` - Field position, modal positioning

### **Tạo mới**:
1. `components/suppliers/SupplierDetailPage.tsx` - Detail page

---

## ✅ TESTING CHECKLIST

### **Sau khi fix Issue #1**:
- [ ] Thêm nhà cung cấp mới → Thông báo "Lưu thành công"
- [ ] Thêm nhà cung cấp với lỗi → Thông báo "Lưu thất bại"
- [ ] Kiểm tra database có đúng data không

### **Sau khi fix Issue #2**:
- [ ] Xóa nhà cung cấp → Không có thông báo localhost
- [ ] Kiểm tra console không có log localhost

### **Sau khi fix Issue #3, #8**:
- [ ] Mở popup thêm nhà cung cấp → Không bị che bởi header
- [ ] Mở popup trong phiếu nhập → Không bị che bởi header
- [ ] Test trên mobile và desktop

### **Sau khi fix Issue #4**:
- [ ] Click vào nhà cung cấp → Hiển thị trang chi tiết
- [ ] Xem thông tin đầy đủ
- [ ] Xem lịch sử giao dịch

### **Sau khi fix Issue #5**:
- [ ] Thêm nhà cung cấp mới → Mã tự động là NCC0001
- [ ] Thêm nhà cung cấp thứ 2 → Mã là NCC0002
- [ ] Thêm nhà cung cấp thứ 100 → Mã là NCC0100

### **Sau khi fix Issue #6**:
- [ ] Thêm nhà cung cấp mới
- [ ] Vào phiếu nhập hàng
- [ ] Tìm nhà cung cấp vừa thêm → Phải hiển thị

### **Sau khi fix Issue #7**:
- [ ] Mở phiếu nhập hàng
- [ ] Kiểm tra thứ tự: Mã phiếu → Chứng từ → Tổng tiền

---

## 🚀 BƯỚC TIẾP THEO

### **Immediate (Bây giờ)**:
1. Đọc các file liên quan để hiểu code
2. Bắt đầu với Issue #1 (Critical)
3. Test từng fix một

### **After Fixes**:
1. Commit từng fix riêng biệt
2. Test tổng thể
3. Deploy lên staging
4. User testing

---

## 📝 NOTES

### **Lưu ý khi fix**:
- Test kỹ mỗi fix trước khi chuyển sang fix tiếp theo
- Commit nhỏ, thường xuyên
- Không fix nhiều issues cùng lúc
- Giữ code style nhất quán

### **Potential Risks**:
- Issue #1 có thể ảnh hưởng data integrity
- Issue #6 có thể liên quan đến caching strategy
- Issue #4 cần design UI mới

---

**Kế hoạch tạo bởi**: Kiro AI  
**Ngày**: 2026-05-18  
**Tổng thời gian dự kiến**: 4-5 giờ  
**Status**: ⏭️ Sẵn sàng bắt đầu
