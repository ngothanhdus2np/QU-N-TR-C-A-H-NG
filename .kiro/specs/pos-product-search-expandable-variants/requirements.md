# Requirements Document

## Introduction

Tính năng **Hiển thị sản phẩm cha-con có thể mở rộng trong dropdown tìm kiếm POS** nhằm cải thiện trải nghiệm tìm kiếm sản phẩm có biến thể trong module POS (Point of Sale). Hiện tại, dropdown tìm kiếm hiển thị tất cả sản phẩm cha và con trong một danh sách phẳng, gây khó khăn khi có nhiều biến thể. Tính năng mới sẽ cho phép người dùng mở rộng/thu gọn danh sách biến thể con từ sản phẩm cha, giúp danh sách gọn gàng và dễ quản lý hơn.

## Glossary

- **POS_Search_Dropdown**: Dropdown tìm kiếm sản phẩm trong màn hình POS, hiển thị kết quả tìm kiếm dưới ô input
- **Parent_Product**: Sản phẩm cha có thuộc tính `isParent = true` và `variantCount > 0`
- **Variant_Product**: Sản phẩm con (biến thể) có thuộc tính `parentId` trỏ đến sản phẩm cha
- **Expand_Button**: Nút mở rộng/thu gọn hiển thị bên cạnh sản phẩm cha để hiển thị danh sách biến thể con
- **Search_Result_List**: Danh sách kết quả tìm kiếm hiển thị trong dropdown
- **Keyboard_Navigation**: Điều hướng bằng phím mũi tên lên/xuống và phím Enter trong dropdown

## Requirements

### Requirement 1: Hiển thị chỉ sản phẩm cha trong kết quả tìm kiếm ban đầu

**User Story:** Là nhân viên bán hàng, tôi muốn chỉ thấy sản phẩm cha trong danh sách tìm kiếm ban đầu, để danh sách ngắn gọn và dễ quét qua.

#### Acceptance Criteria

1. WHEN người dùng nhập từ khóa tìm kiếm, THE POS_Search_Dropdown SHALL hiển thị chỉ các Parent_Product có tên hoặc SKU khớp với từ khóa
2. THE POS_Search_Dropdown SHALL ẩn tất cả Variant_Product trong danh sách kết quả ban đầu
3. WHERE một Parent_Product có `variantCount > 0`, THE POS_Search_Dropdown SHALL hiển thị badge số lượng biến thể bên cạnh tên sản phẩm
4. WHERE một sản phẩm không phải Parent_Product (không có `isParent = true` hoặc `variantCount = 0`), THE POS_Search_Dropdown SHALL hiển thị sản phẩm đó như bình thường trong danh sách

### Requirement 2: Hiển thị nút mở rộng cho sản phẩm cha

**User Story:** Là nhân viên bán hàng, tôi muốn thấy nút mở rộng bên cạnh sản phẩm cha, để biết sản phẩm này có biến thể và có thể xem danh sách biến thể.

#### Acceptance Criteria

1. WHERE một Parent_Product có `variantCount > 0`, THE POS_Search_Dropdown SHALL hiển thị Expand_Button bên trái tên sản phẩm
2. THE Expand_Button SHALL hiển thị icon mũi tên xoay sang phải khi danh sách biến thể đang thu gọn
3. THE Expand_Button SHALL có kích thước 16x16 pixels và màu slate-500
4. WHERE một sản phẩm không phải Parent_Product, THE POS_Search_Dropdown SHALL không hiển thị Expand_Button

### Requirement 3: Mở rộng danh sách biến thể khi người dùng bấm nút

**User Story:** Là nhân viên bán hàng, tôi muốn bấm vào nút mở rộng để xem danh sách biến thể, để chọn đúng biến thể cần bán.

#### Acceptance Criteria

1. WHEN người dùng bấm vào Expand_Button của một Parent_Product, THE POS_Search_Dropdown SHALL hiển thị danh sách Variant_Product ngay bên dưới Parent_Product đó
2. WHEN danh sách biến thể được mở rộng, THE Expand_Button SHALL xoay icon mũi tên xuống dưới
3. THE POS_Search_Dropdown SHALL lọc Variant_Product dựa trên `parentId` khớp với `id` của Parent_Product
4. THE POS_Search_Dropdown SHALL hiển thị Variant_Product với indent 16 pixels so với Parent_Product để phân biệt cấp độ
5. WHEN người dùng bấm vào Expand_Button lần thứ hai, THE POS_Search_Dropdown SHALL ẩn danh sách Variant_Product và xoay icon mũi tên về phải

### Requirement 4: Hiển thị thông tin biến thể con

**User Story:** Là nhân viên bán hàng, tôi muốn thấy thông tin chi tiết của từng biến thể, để chọn đúng biến thể khách hàng yêu cầu.

#### Acceptance Criteria

1. WHERE một Variant_Product được hiển thị trong danh sách mở rộng, THE POS_Search_Dropdown SHALL hiển thị tên đầy đủ của biến thể bao gồm thuộc tính biến thể
2. WHERE một Variant_Product có `variantAttributes`, THE POS_Search_Dropdown SHALL hiển thị badge thuộc tính màu vàng (amber-100 background, amber-700 text) với nội dung là giá trị thuộc tính nối bằng dấu `•`
3. THE POS_Search_Dropdown SHALL hiển thị SKU, số lượng tồn kho, giá bán và giá vốn của Variant_Product giống như hiển thị sản phẩm thường
4. WHERE Variant_Product có `stock > 0`, THE POS_Search_Dropdown SHALL hiển thị số tồn kho màu emerald-600
5. WHERE Variant_Product có `stock = 0`, THE POS_Search_Dropdown SHALL hiển thị số tồn kho màu rose-600

### Requirement 5: Cho phép chọn sản phẩm cha hoặc biến thể con

**User Story:** Là nhân viên bán hàng, tôi muốn có thể chọn sản phẩm cha hoặc biến thể con, để thêm vào giỏ hàng tùy theo nghiệp vụ.

#### Acceptance Criteria

1. WHEN người dùng bấm vào vùng tên sản phẩm của Parent_Product, THE POS_Search_Dropdown SHALL gọi hàm `addToCart` với Parent_Product
2. WHEN người dùng bấm vào vùng tên sản phẩm của Variant_Product, THE POS_Search_Dropdown SHALL gọi hàm `addToCart` với Variant_Product
3. WHEN người dùng bấm vào Expand_Button, THE POS_Search_Dropdown SHALL không gọi hàm `addToCart`
4. WHEN sản phẩm được thêm vào giỏ hàng, THE POS_Search_Dropdown SHALL đóng dropdown và xóa nội dung ô tìm kiếm

### Requirement 6: Hỗ trợ điều hướng bằng bàn phím

**User Story:** Là nhân viên bán hàng, tôi muốn dùng phím mũi tên và Enter để điều hướng trong danh sách, để thao tác nhanh hơn không cần chuột.

#### Acceptance Criteria

1. WHEN người dùng nhấn phím ArrowDown, THE POS_Search_Dropdown SHALL di chuyển highlight xuống item tiếp theo trong danh sách hiển thị (bao gồm cả Parent_Product và Variant_Product đang mở rộng)
2. WHEN người dùng nhấn phím ArrowUp, THE POS_Search_Dropdown SHALL di chuyển highlight lên item trước đó trong danh sách hiển thị
3. WHEN người dùng nhấn phím Enter trên Parent_Product hoặc Variant_Product, THE POS_Search_Dropdown SHALL gọi hàm `addToCart` với sản phẩm đang được highlight
4. WHEN người dùng nhấn phím Escape, THE POS_Search_Dropdown SHALL đóng dropdown
5. THE Keyboard_Navigation SHALL bỏ qua Expand_Button và chỉ highlight vào vùng sản phẩm

### Requirement 7: Duy trì trạng thái mở rộng khi tìm kiếm thay đổi

**User Story:** Là nhân viên bán hàng, tôi muốn trạng thái mở rộng được reset khi tôi thay đổi từ khóa tìm kiếm, để danh sách luôn gọn gàng khi xem kết quả mới.

#### Acceptance Criteria

1. WHEN người dùng thay đổi nội dung ô tìm kiếm, THE POS_Search_Dropdown SHALL đóng tất cả danh sách biến thể đang mở rộng
2. WHEN người dùng thay đổi nội dung ô tìm kiếm, THE POS_Search_Dropdown SHALL reset tất cả Expand_Button về trạng thái mũi tên phải
3. WHEN người dùng thay đổi thứ tự sắp xếp (sort), THE POS_Search_Dropdown SHALL giữ nguyên trạng thái mở rộng của các Parent_Product

### Requirement 8: Tương thích với logic sort hiện tại

**User Story:** Là nhân viên bán hàng, tôi muốn sắp xếp theo mã hàng hoặc giá tiền vẫn hoạt động đúng, để tìm sản phẩm theo thứ tự mong muốn.

#### Acceptance Criteria

1. WHEN người dùng chọn sort theo mã hàng (skuDesc), THE POS_Search_Dropdown SHALL sắp xếp Parent_Product theo SKU giảm dần
2. WHEN người dùng chọn sort theo giá tiền (priceDesc), THE POS_Search_Dropdown SHALL sắp xếp Parent_Product theo `salePrice` giảm dần
3. WHERE một Parent_Product đang mở rộng, THE POS_Search_Dropdown SHALL sắp xếp Variant_Product bên trong theo cùng tiêu chí sort với Parent_Product
4. THE POS_Search_Dropdown SHALL áp dụng sort trước khi hiển thị danh sách, không ảnh hưởng đến logic filter hiện tại

### Requirement 9: Không thay đổi cấu trúc dữ liệu POSProduct

**User Story:** Là developer, tôi muốn giữ nguyên cấu trúc dữ liệu POSProduct, để không ảnh hưởng đến các module khác đang sử dụng.

#### Acceptance Criteria

1. THE POS_Search_Dropdown SHALL sử dụng các trường hiện có `isParent`, `parentId`, `variantCount`, `variantAttributes` từ interface POSProduct
2. THE POS_Search_Dropdown SHALL không thêm trường mới vào interface POSProduct
3. THE POS_Search_Dropdown SHALL không thay đổi logic tìm kiếm hiện tại trong `searchFilteredProducts`
4. THE POS_Search_Dropdown SHALL chỉ thay đổi logic hiển thị trong component POSHeaderToolbar

### Requirement 10: Hiển thị đúng trong chế độ Return

**User Story:** Là nhân viên bán hàng, tôi muốn dropdown tìm kiếm bị vô hiệu hóa trong chế độ trả hàng, để tránh nhầm lẫn với ô tìm kiếm hàng trả bên dưới.

#### Acceptance Criteria

1. WHERE `mode = 'return'`, THE POS_Search_Dropdown SHALL vô hiệu hóa ô input tìm kiếm
2. WHERE `mode = 'return'`, THE POS_Search_Dropdown SHALL không hiển thị dropdown kết quả tìm kiếm
3. WHERE `mode = 'return'`, THE POS_Search_Dropdown SHALL hiển thị placeholder "Dùng ô tìm hàng trả / hàng đổi bên dưới"
4. WHERE `mode = 'sales'`, THE POS_Search_Dropdown SHALL hoạt động bình thường với tính năng mở rộng/thu gọn biến thể
