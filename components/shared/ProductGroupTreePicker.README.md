# ProductGroupTreePicker Component

Component chọn nhóm hàng dạng cây phân cấp cha-con với khả năng mở rộng/thu gọn.

## Tính năng

- ✅ Hiển thị nhóm hàng dạng cây phân cấp (cha >> con)
- ✅ Mở rộng/thu gọn các node cha
- ✅ Tìm kiếm nhóm hàng với auto-expand kết quả
- ✅ Chọn nhiều nhóm hàng với checkbox
- ✅ Hiển thị số lượng sản phẩm trong mỗi nhóm
- ✅ Giao diện dropdown đẹp mắt, dễ sử dụng

## Cách sử dụng

```tsx
import ProductGroupTreePicker from '../shared/ProductGroupTreePicker';
import { ProductGroup } from '../../types';

// Trong component của bạn:
const [selectedCategories, setSelectedCategories] = useState<string[]>([]);

// Tính toán số lượng sản phẩm theo path (optional)
const productCountByPath = useMemo(() => {
  const countMap = new Map<string, number>();
  products.forEach(product => {
    const path = product.categoryPath || product.categoryId || '';
    if (!path) return;
    
    const parts = path.split(' >> ');
    let currentPath = '';
    parts.forEach(part => {
      currentPath = currentPath ? `${currentPath} >> ${part}` : part;
      countMap.set(currentPath, (countMap.get(currentPath) || 0) + 1);
    });
  });
  return countMap;
}, [products]);

// Render component
<ProductGroupTreePicker
  groups={productGroups}
  selectedPaths={selectedCategories}
  onSelectionChange={setSelectedCategories}
  productCountByPath={productCountByPath}
  placeholder="Chọn nhóm hàng"
  className="shrink-0"
/>
```

## Props

| Prop | Type | Required | Mô tả |
|------|------|----------|-------|
| `groups` | `ProductGroup[]` | ✅ | Danh sách nhóm hàng |
| `selectedPaths` | `string[]` | ✅ | Mảng các path đã chọn |
| `onSelectionChange` | `(paths: string[]) => void` | ✅ | Callback khi thay đổi lựa chọn |
| `productCountByPath` | `Map<string, number>` | ❌ | Map số lượng sản phẩm theo path |
| `placeholder` | `string` | ❌ | Text placeholder (mặc định: "Chọn nhóm hàng") |
| `className` | `string` | ❌ | CSS class cho container |

## Cấu trúc dữ liệu

### ProductGroup
```typescript
interface ProductGroup {
  id: string;
  name: string; // Ví dụ: "Thực phẩm >> Đồ uống >> Nước ngọt"
}
```

### Selected Paths
Mảng các full path đã chọn:
```typescript
[
  "Thực phẩm",
  "Thực phẩm >> Đồ uống",
  "Mỹ phẩm >> Chăm sóc da"
]
```

## Lọc sản phẩm theo nhóm đã chọn

Sau khi người dùng chọn nhóm hàng, bạn có thể lọc sản phẩm như sau:

```typescript
const filteredProducts = useMemo(() => {
  const selected = new Set(selectedCategories);
  return products.filter(product => {
    if (selected.size === 0) return true; // Không lọc nếu chưa chọn gì
    
    const productPath = product.categoryPath || product.categoryId || '';
    // Kiểm tra xem path của sản phẩm có khớp với bất kỳ path nào đã chọn
    return Array.from(selected).some(selectedPath => 
      productPath === selectedPath || 
      productPath.startsWith(selectedPath + ' >> ')
    );
  });
}, [products, selectedCategories]);
```

## Ví dụ thực tế

Component này đã được tích hợp vào:
- `GoodsAuditForm.tsx` - Form kiểm kho
- `AuditContainer.tsx` - Container quản lý kiểm kho

## Ghi chú

- Component tự động mở rộng các node cha khi tìm kiếm
- Khi chọn node cha, không tự động chọn các node con (người dùng phải chọn thủ công)
- Hiển thị số lượng sản phẩm bên cạnh tên nhóm nếu có `productCountByPath`
