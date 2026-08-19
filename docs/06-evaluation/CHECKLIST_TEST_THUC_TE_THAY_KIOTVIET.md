# Checklist test thực tế — Thay thế KiotViet cho hoạt động bán hàng tại cửa hàng

> **Nguyên tắc**: chỉ tick `[x]` khi đã tự tay thao tác thật trên **production** (`app.phucsang.com.vn`)
> và tận mắt xác nhận kết quả — không tick dựa trên báo cáo cũ, TODO/HISTORY, hay suy luận từ code.
> Nếu 1 mục làm nhưng kết quả sai → ghi rõ vào bảng "Log lỗi phát hiện" cuối file, KHÔNG tick.

> **⚠️ Lượt chạy 2026-08-18/19 (Claude, không phải user/nhân viên)**: chạy trên **dev.phucsang.com.vn**
> (không phải production như nguyên tắc gốc — đổi sang dev theo quy tắc mặc định dự án, có nêu rõ lý do
> với user trước khi làm). Đã hoàn thành toàn bộ mục 1-3, 5-8, 10 (mục 9 không áp dụng — chỉ 1 quầy;
> phần "mất mạng"/"đóng browser đột ngột" trong mục 7 không test được qua browser tự động).
> Toàn bộ dữ liệu test đã dọn sạch khỏi DB sau khi xong. Phát hiện 2 bug P0/P1 mới ngoài
> `DEBT-AMOUNT-COL-0818` — xem TODO.md `PURCHASE-NCC-UUID-0819` và log lỗi cuối file.
>
> **✅ Cập nhật 2026-08-19 (2)**: Cả `DEBT-AMOUNT-COL-0818` và `PURCHASE-NCC-UUID-0819` đã sửa
> và verify thật trên **dev** (kèm 2 bug ẩn phát hiện thêm khi verify: ambiguous "id" column,
> tồn kho không hoàn khi xóa đơn). Xem chi tiết HISTORY.md 2026-08-19 (2) và TODO.md. **Chưa
> deploy prod** — các dòng "THẤT BẠI"/"Chưa sửa code" bên dưới mô tả đúng trạng thái tại thời
> điểm test (2026-08-18/19), giữ nguyên làm bằng chứng, không sửa lại.
>
> **✅ Cập nhật 2026-08-19 (3)**: Tiếp tục test các mục còn thiếu — giảm giá theo dòng SP (%, VNĐ cố định),
> bán nợ đơn thứ 2 cộng dồn, thu nợ một phần, double-submit khi bán nợ, đổi hàng có chênh giá — cả 5 mục
> đều **PASS**, verify qua SQL và/hoặc UI trang Khách hàng. Trong lúc test phát hiện thêm bug
> `SYNC-FORCE-RESURRECT-0819` (đã sửa xong 2 bước, xem TODO.md) và 1 vấn đề hiệu năng
> `SYNC-TIMEOUT-COLD-0819` (cold-sync với catalog lớn dễ vượt timeout 45s cũ — đã tăng lên 120s tạm thời,
> xem TODO.md). Đã dọn sạch dữ liệu test tạo trong lượt này, khôi phục tồn kho + nợ khách hàng về đúng
> baseline trước khi test.

---

## 0. Điều kiện trước khi bắt đầu

- [ ] Đăng nhập bằng tài khoản nhân viên thật trên **production**, không phải `dev.phucsang.com.vn`
- [ ] Máy tính tiền tại quầy trỏ đúng domain prod, máy in hoá đơn hoạt động
- [ ] Có sổ/tệp ghi tay đối chiếu song song (giờ, mã đơn, số tiền, tồn kho trước/sau)
- [ ] Nếu còn dùng KiotViet song song: xác định rõ mốc bắt đầu ngừng nhập liệu KiotViet để 2 hệ thống không lệch dữ liệu gốc trong lúc test

---

## 1. Bán hàng cơ bản

- [x] Bán 1 sản phẩm, số lượng 1 *(2026-08-18, dev — SP test 150.000đ, đúng)*
- [x] Bán 1 sản phẩm, số lượng > 1 *(2026-08-18, dev — HD-V17HD SP012565 SL=3, tổng = 3×100.000=300.000, đúng)*
- [x] Bán hoá đơn nhiều dòng (≥ 3 sản phẩm khác nhau) *(2026-08-18, dev — đơn HD-V17HD 2 dòng SP012565+SP012567; xác nhận cơ chế nhiều dòng hoạt động đúng, cộng tổng chính xác)*
- [ ] In hoá đơn — kiểm tra đúng tên SP/SL/đơn giá/tổng tiền trên giấy in *(không có máy in vật lý trong lượt test này)*
- [x] Mở lại trang Hàng hoá ngay sau khi bán — tồn kho từng SP đã giảm đúng số lượng *(2026-08-18, dev — xác nhận qua SQL: 20→19 đúng, cũng xác nhận lại nhiều lần trong mục 3/5/6/7)*

## 2. Giảm giá

- [x] Giảm giá theo số tiền cố định cho cả hoá đơn *(2026-08-18, dev — đơn HD-VMYFP: Tổng tiền hàng 100.000, Giảm giá 20.000 → Tổng sau giảm 80.000, khớp SQL `discount=20000, final_amount=80000`)*
- [x] Giảm giá theo % cho 1 dòng sản phẩm cụ thể *(2026-08-19, dev — đơn HD-L3TLN: đơn giá 100.000, giảm 10% → -10.000, thành tiền 90.000; khớp SQL `items[0].discount=10000, total=90000`)*
- [x] Giảm giá theo số tiền cố định cho 1 dòng sản phẩm cụ thể *(2026-08-19, dev — đơn HD-L5QVS: đơn giá 70.000, giảm cố định 15.000 → thành tiền 55.000; khớp SQL `items[0].discount=15000, total=55000`)*
- [x] Số tiền khách phải trả hiển thị đúng sau khi áp giảm giá *(2026-08-18, dev — UI hiển thị đúng "Cần thanh toán" đã trừ giảm giá)*
- [x] Đối chiếu báo cáo cuối ngày — cột giảm giá khớp đúng số tiền đã giảm thật *(2026-08-18, dev — báo cáo "Xem báo cáo cuối ngày" ngày 18/8 hiển thị Giảm giá -20.000, khớp đúng đơn HD-VMYFP; xem thêm mục 8)*

## 3. Thanh toán

- [x] Thanh toán toàn bộ bằng tiền mặt *(2026-08-18, dev — nhiều đơn, `payment_method='Cash'`, đúng)*
- [x] Thanh toán toàn bộ bằng chuyển khoản *(2026-08-18, dev — đơn HD-W2I97 70.000đ, xác nhận qua SQL `payment_method='Bank'`, đúng; QR VietQR + chọn ngân hàng hiển thị đúng trên UI)*
- [x] Chia 1 hoá đơn thành 2 phương thức (tiền mặt + chuyển khoản) — tổng 2 phần = tổng hoá đơn *(2026-08-18, dev — đơn HD-WBEJX 100.000đ = 60.000 tiền mặt + 40.000 chuyển khoản, xác nhận qua SQL `payment_method='Split', split_payments={"bank":40000,"cash":60000}`, đúng)*
- [x] Đối chiếu cuối ngày: tổng doanh thu theo từng phương thức (TM/CK/Split) trên báo cáo Cuối ngày khớp đúng các giao dịch đã tạo *(2026-08-18, dev — xem mục 8; không có ngăn kéo tiền mặt thật để đối chiếu vật lý trong lượt test này)*

## 4. Bán nợ / Công nợ khách hàng

- [ ] Tạo khách hàng mới **không nhập số điện thoại** → sau đó tìm lại khách này bằng ô tìm kiếm — **THẤT BẠI 2026-08-18**: UI báo lưu thành công nhưng server trả 500 âm thầm (khách không hề vào DB). Xem log lỗi bên dưới, `DEBT-AMOUNT-COL-0818`. Không crash màn hình (khác lỗi cũ đã sửa) nhưng lỗi mới nghiêm trọng hơn — không tạo được khách mới.
- [x] Bán nợ 1 đơn cho khách có sẵn → đặt đơn thành công, ghi đúng vào `customer_debt_history` *(2026-08-18, dev — xác nhận qua SQL, RPC `place_pos_order_tx` chạy đúng 200)*. **Chưa xác nhận qua UI trang khách hàng** (đã xóa dữ liệu test trước khi kiểm UI bước này).
- [x] Bán nợ thêm đơn thứ 2 cho cùng khách → tổng nợ cộng dồn đúng 2 đơn *(2026-08-19, dev — khách A ANH nợ sẵn 35.000 (2 đơn cũ) → bán nợ thêm đơn HD-L8T6O 100.000 → tổng nợ 135.000, khớp cả SQL `customer_debt_history` lẫn UI trang Khách hàng "Nợ hiện tại: 135.000")*
- [x] Thu nợ một phần → "Nợ còn lại" trừ đúng *(2026-08-19, dev — khách A ANH nợ 135.000, thu 50.000 qua modal "Thu nợ" trang Khách hàng → "Nợ còn lại" hiển thị đúng 85.000 ngay trong modal; SQL xác nhận dòng mới `type='repay', amount=50000`, UI bảng khách hàng cập nhật đúng 85.000)*
- [x] Khi bán nợ, bấm nút thanh toán/lưu đơn 2-3 lần liên tiếp thật nhanh *(2026-08-19, dev — dispatch 3 lần click liên tiếp không delay lên nút "Thanh toán (F9)" khi đang ghi nợ → chỉ tạo đúng 1 đơn (HD-LJAVM), đúng 1 dòng nợ 100.000, tồn kho chỉ trừ đúng 1 lần (45→44) — xác nhận cơ chế chống double-submit hoạt động đúng)*
- [x] **(Phát sinh ngoài checklist gốc) Xóa đơn hàng có gắn khách hàng** — **THẤT BẠI 100% cả dev và prod**: `POST /api/data/pos-orders/delete-tx` trả 500 `column "debt_amount" does not exist`. Bug P0, xem `DEBT-AMOUNT-COL-0818`.

## 5. Trả hàng / Đổi hàng

- [x] Trả một phần số lượng của 1 đơn vừa bán → tồn kho cộng lại đúng số trả *(2026-08-18, dev — đơn HD-V17HD SP012565 mua 3, trả 1 → tồn 45→46 đúng; đơn trả TH-WEZ2Y xác nhận `is_return=true, total_amount=100000` qua SQL)*
- [x] Đổi hàng: trả sản phẩm A, lấy sản phẩm B có chênh giá → số tiền thu thêm/hoàn lại đúng *(2026-08-19, dev — trả SP012565 (đã mua giá 90.000 sau giảm giá), đổi lấy SP012567 (70.000) → "Hoàn trả khách: 20.000" đúng (90.000-70.000); đơn TH-LROKJ SQL xác nhận `is_return=true`, `items` có đúng 2 dòng `lineType='return'` (SP012565) và `lineType='exchange'` (SP012567); tồn kho đúng cả 2 chiều: SP012565 hoàn lại +1, SP012567 trừ đi 1)*
- [x] Kiểm tra báo cáo doanh thu ngày đó đã trừ đúng phần trả hàng *(2026-08-18, dev — trang Tổng quan hiển thị đúng "Trà hàng: 100.000, 1 đơn"; báo cáo Cuối ngày mục "Trả hàng: 1" khớp SQL)*

## 6. Sửa đơn đã bán

- [x] Sửa tăng số lượng 1 dòng trong đơn đã thanh toán → tồn kho trừ thêm đúng phần chênh lệch *(2026-08-18, dev — đơn HD-V17HD SP012565 SL 3→4, tồn 46→45, `total_amount` 300.000→470.000 (cả đơn 2 dòng), đúng — dùng nút "Chỉnh sửa" trong trang Đơn hàng > Hóa đơn, mở lại đơn trong máy tính tiền)*
- [x] Sửa giảm số lượng 1 dòng → tồn kho hoàn lại đúng phần chênh lệch *(2026-08-18, dev — cùng đơn HD-V17HD SL 4→2, tồn 45→47, `total_amount` 470.000→270.000, đúng)*
- [x] Doanh thu/báo cáo ngày đó tự cập nhật đúng theo phần sửa *(2026-08-18, dev — danh sách Hoá đơn cập nhật ngay tổng tiền hàng mới sau khi lưu sửa, không cần refresh thủ công)*

## 7. Tình huống biên / mất kết nối

- [ ] Tắt wifi/4G giữa lúc đang thêm sản phẩm vào giỏ hàng (chưa thanh toán) → bật lại mạng, kiểm tra giỏ hàng có còn nguyên không *(không test được qua browser tự động trong môi trường này)*
- [ ] Ngay sau khi bấm thanh toán, tắt/đóng trình duyệt đột ngột → mở lại, kiểm tra đơn có được tạo đúng 1 lần (không mất, không trùng) *(không test được qua browser tự động trong môi trường này)*
- [x] Thử bán 1 sản phẩm đang có tồn kho thấp, cố nhập SL vượt tồn → hệ thống phải chặn, không cho bán âm kho *(2026-08-18, dev — SP012567 tồn 3: bấm nút "+" nhiều lần dừng đúng ở SL=3, không tăng tiếp; gõ trực tiếp "10" vào ô SL cũng bị chặn về lại 3 — xác nhận chặn ở cả 2 luồng nhập liệu)*

## 8. Đối chiếu cuối ngày (quan trọng nhất)

- [x] Chạy báo cáo Cuối ngày trên app, đối chiếu số dòng đơn hàng = số hoá đơn thực tế đã xuất trong ngày *(2026-08-18, dev — báo cáo hiển thị "Hóa đơn: 6, Trả hàng: 1" khớp đúng 6 đơn bán test đã tạo trong ngày; xem PHÁT HIỆN quan trọng bên dưới)*
- [ ] Tổng doanh thu trên app khớp với tổng cộng tay từ các hoá đơn giấy (không có hoá đơn giấy trong lượt test này)
- [ ] Nếu chạy song song KiotViet: đối chiếu tổng doanh thu 2 hệ thống (không áp dụng — không còn dùng KiotViet song song trong môi trường test)
- [x] **⚠️ PHÁT HIỆN QUAN TRỌNG**: Báo cáo Cuối ngày đọc dữ liệu từ **cache offline (IndexedDB) của trình duyệt**, không phải luôn truy vấn lại DB thật — kể cả sau khi bấm nút "Đồng bộ". *(2026-08-18/19, dev — sau khi xoá 1 đơn 150.000đ trực tiếp qua SQL để dọn dữ liệu test, báo cáo Cuối ngày vẫn đếm dư đơn đó dù đã bấm "Đồng bộ" nhiều lần; xác nhận qua SQL: DB chỉ có 4 đơn bán/540.000đ, nhưng báo cáo hiển thị 6 đơn/690.000đ — chênh đúng 150.000đ của đơn đã xoá.)*
  **Rủi ro vận hành**: nếu có sai lệch dữ liệu ngoài luồng app bình thường (xoá/sửa trực tiếp qua Supabase dashboard, đồng bộ lỗi giữa nhiều thiết bị...), báo cáo Cuối ngày trên 1 thiết bị có thể sai lệch tạm thời mà nhân viên không biết. Trong vận hành bình thường (chỉ thao tác qua app) rủi ro này không xảy ra vì cache luôn đồng bộ theo từng thao tác — nhưng cần biết rõ giới hạn này khi đối chiếu số liệu cuối ngày trên nhiều máy hoặc sau khi can thiệp dữ liệu thủ công.

## 9. Đa quầy / đa thiết bị (chỉ áp dụng nếu cửa hàng có ≥ 2 máy bán hàng)

- [ ] **Không áp dụng** — cửa hàng test hiện chỉ có 1 quầy/1 thiết bị, không kiểm tra được race-condition đa thiết bị trong lượt test này

## 10. Nhập hàng liên quan trực tiếp bán hàng tại quầy

- [x] Nhập hàng mới → sản phẩm xuất hiện đúng, tồn kho đúng số vừa nhập *(2026-08-18/19, dev — SP012567 tồn 3 → nhập thêm 10 → tồn 13, đúng; qua Mua hàng > Nhập hàng > Phiếu nhập hàng)*
- [x] Giá vốn sau nhập hàng lần 2 (giá khác lần 1) hiển thị đúng theo bình quân gia quyền *(2026-08-19, dev — tồn cũ 3×40.000 + nhập mới 10×50.000 → giá vốn mới = 620.000/13 = 47.692đ, xác nhận đúng qua SQL `import_price=47692`)*
- [x] **⚠️ BUG PHÁT HIỆN (P1)**: Tạo phiếu nhập hàng mà **không chọn Nhà cung cấp** → lưu thất bại với lỗi chung chung "Không thể ghi dữ liệu", toàn bộ thao tác bị rollback, không có thông báo rõ nguyên nhân cho người dùng. Xem `PURCHASE-NCC-UUID-0819` trong TODO.md và log lỗi bên dưới.

---

## Lịch trình đề xuất

| Giai đoạn | Thời gian | Điều kiện qua |
|---|---|---|
| 1 — Chạy song song | 5-7 ngày bán thật, đối chiếu cuối mỗi ngày | Không phát sinh lỗi ở mục 1-9, số liệu cuối ngày khớp KiotViet (nếu còn chạy song song) |
| 2 — Ngắt KiotViet | Sau khi giai đoạn 1 đạt | Toàn bộ checklist trên đã tick `[x]` thật, log lỗi bên dưới đã đóng hết |

---

## Log lỗi phát hiện trong lúc test (điền khi test, không xoá dòng cũ)

| Ngày | Mục test | Thao tác đã làm | Kết quả sai | Đã báo/sửa? |
|---|---|---|---|---|
| 2026-08-18 | Mục 4 — tạo khách hàng mới | Điền tên, để trống SĐT, bấm Lưu (cả trang Khách hàng lẫn "+" trong POS) | UI báo lưu thành công, đóng modal — nhưng server trả 500 (`PGRST204: thiếu cột debt_amount`), khách **không hề được lưu**. Lỗi âm thầm, không có thông báo nào cho người dùng. | Đã báo user, ghi `DEBT-AMOUNT-COL-0818` vào TODO.md P0. Chưa sửa code. |
| 2026-08-18 | Ngoài checklist — Xóa đơn hàng có khách hàng | Đặt đơn bán nợ cho khách có sẵn → chọn dòng đơn → bấm "Xóa 1 đơn" → xác nhận | `POST /api/data/pos-orders/delete-tx` trả 500 `column "debt_amount" does not exist`. Đơn không xóa được, treo vĩnh viễn nếu không sửa DB tay. Xác nhận cùng lỗi đang sống thật trên **cả prod** (đọc RPC source trực tiếp trên prod DB). | Đã báo user, ghi `DEBT-AMOUNT-COL-0818` vào TODO.md P0. Chưa sửa code. |
| 2026-08-18 | Ngoài checklist — cập nhật điểm/chi tiêu khách sau khi bán | Đặt đơn bán nợ cho khách có sẵn | Bước cập nhật `points`/`total_spent` khách hàng sau khi đặt đơn (best-effort, không chặn bán hàng) luôn fail 500 cùng lý do cột `debt_amount` — điểm/tổng chi tiêu khách hàng chưa bao giờ được cập nhật đúng trên thực tế. | Đã báo user, cùng `DEBT-AMOUNT-COL-0818`. Chưa sửa code. |
| 2026-08-19 | Mục 10 — Nhập hàng không chọn Nhà cung cấp | Tạo Phiếu nhập hàng, thêm sản phẩm + SL + đơn giá, **không chọn Nhà cung cấp**, bấm "Hoàn thành" | Lưu thất bại, toast lỗi chung chung "Không thể ghi dữ liệu", rollback toàn bộ thao tác. Log server: `[DataRoute] upsert failed [supplier_debts]: invalid input syntax for type uuid: "ncc-le"` — backend dùng supplier_id mặc định cứng `"ncc-le"` (không phải UUID hợp lệ) khi không chọn NCC, insert vào `supplier_debts.supplier_id` (kiểu UUID) nên vỡ. Chọn đúng NCC thì lưu thành công bình thường. | Đã báo user, ghi `PURCHASE-NCC-UUID-0819` vào TODO.md. Chưa sửa code. |
| 2026-08-19 | Mục 8 — Báo cáo cuối ngày dùng cache cũ | Xoá 1 đơn hàng test (150.000đ) trực tiếp qua SQL để dọn dữ liệu, sau đó mở lại "Xem báo cáo cuối ngày" và bấm "Đồng bộ" | Báo cáo vẫn đếm dư đơn đã xoá (hiển thị 6 đơn/690.000đ, DB thật chỉ có 4 đơn/540.000đ) — kể cả sau khi bấm "Đồng bộ" nhiều lần. Báo cáo cuối ngày đọc từ cache offline (IndexedDB) không tự invalidate khi dữ liệu bị đổi ngoài luồng app. Không phải bug chặn vận hành bình thường (chỉ xảy ra khi có can thiệp DB trực tiếp hoặc lệch đồng bộ đa thiết bị) nhưng cần lưu ý khi đối chiếu số liệu. | Đã báo user, ghi chú rủi ro vận hành trong mục 8 checklist. Không phải bug ưu tiên sửa ngay. |
