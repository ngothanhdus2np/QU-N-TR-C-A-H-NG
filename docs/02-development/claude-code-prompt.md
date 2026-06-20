# Prompt cho Claude Code — Áp Phúc Sang UI Foundation

Copy phần sau dấu `---` dán vào Claude Code khi đang mở repo **CFO Brain 4.0**.
Đặt `phuc-sang-ui.css` vào `src/` trước khi chạy. Các việc chia theo 3 mức:
**P0 bắt buộc · P1 quan trọng · P2 hoàn thiện.** Làm hết P0 rồi mới sang P1.

---

Bạn là kỹ sư frontend. Repo CFO Brain 4.0 (React 19 + TS + Vite + Tailwind).
Tôi đã thêm `src/phuc-sang-ui.css` — design token + class `.ps-*` chuẩn hoá theo
thương hiệu Giày Dép Phúc Sang. Refactor UI dùng bộ này, **không đổi logic / dữ liệu /
hành vi / text tiếng Việt** — chỉ đổi trình bày. Mỗi mục 1 commit, sau mỗi commit chạy
`npm run build`. Nếu một màn cần đổi cấu trúc lớn, liệt kê cho tôi quyết định thay vì tự làm.

## Chuẩn bị
- `import './phuc-sang-ui.css'` ở `index.tsx` (sau Tailwind base). KHÔNG xoá Tailwind —
  `.ps-*` dùng CSS variable, chạy song song.
- Font: Inter đã có `<link>` trong `index.html`. Muốn tiêu đề serif (`.ps-display`) thì
  thêm `family=Playfair+Display:wght@700;800` vào link. Family khai trong CSS qua
  `--ps-font-sans / -display / -mono`.

## Nguyên tắc spec (nguồn chân lý — đừng chế số mới)
| Element | Chuẩn |
|---|---|
| Nút / input / select | cao **32** (`.ps-btn` / `.ps-input`), bo **8** |
| Nút chạm quan trọng | cao **44** (`.ps-btn--touch`) |
| Header bảng | cao **36**, pad 0/12, **12/600**, KHÔNG hoa, nền slate-50 |
| Dòng bảng | cao **44**, cell pad 0/12, phân cách 1px slate-100 |
| Toolbar | cao **48**, pad 0/16, gap 8 (`.ps-toolbar`) |
| Card | bo **16** (`.ps-card`); flat 12; brand = nền đỏ |
| Chip / badge | cao 22, pill, 12/700 (`.ps-chip--red|yellow|green|slate`) |
| Spacing | chỉ bội số 4 (4/8/12/16/20/24/32) |
| Thang chữ | `.ps-page-title 28/800 · .ps-section-title 18/800 · .ps-card-title 15/700 · .ps-stat 22/800 · .ps-body 13/400 · .ps-dense 12/400 · .ps-eyebrow 11/900 hoa` |

Màu theo ngữ nghĩa: **Đỏ** = hành động chính/khẩn/nguy hiểm/lỗ/tab chọn/thương hiệu ·
**Vàng** = cảnh báo nhẹ/"Mới"/tôn vinh (nền chip + chữ nâu) · **Lá** = thành công ·
còn lại **slate**. Thay mọi `indigo/violet/sky/blue` accent → đỏ (chính) hoặc slate (phụ).

═══════════════════════════════════════════════════════════════
# P0 · BẮT BUỘC — lỗi khả dụng + nền tảng
═══════════════════════════════════════════════════════════════

**P0.1 — Sửa nút ẩn theo hover (touch).** Tìm mọi `opacity-0 group-hover:opacity-100`
(và `group-hover/...`) trên nút sửa/xoá trong dòng → class `.ps-row-action` (tự hiện trên
máy cảm ứng qua `@media (hover:none)`). File: `expense/ExpenseLedgerTab`, `pos/GoodsProductRow`,
`revenue/LedgerTab`, `marketing/*`, `settings/*`.

**P0.2 — Stepper số lượng giỏ POS.** `pos/POSCart.tsx`: nút `−`/`+` đang
`opacity-0 group-hover/qty:opacity-100`. Đổi sang `.ps-stepper`:
```jsx
<div className="ps-stepper">
  <button className="ps-minus" onClick={() => onUpdate(item.productId, -1)}>−</button>
  <span className="ps-qty">{item.quantity}</span>
  <button className="ps-plus" disabled={...giữ điều kiện cũ...}
          onClick={() => onUpdate(item.productId, +1)}>+</button>
</div>
```
Nút luôn hiện, hit-target 32px (44 trên cảm ứng).

**P0.3 — Xác nhận trước thao tác phá huỷ.** Nút xoá dòng giỏ (`Trash2`) và mọi nút xoá
hàng loạt phải có hộp xác nhận hoặc undo toast. Dùng mẫu modal `.ps-scrim > .ps-modal--sm`
với `.ps-confirm-icon`, footer 2 nút (`.ps-btn--ghost` Huỷ + `.ps-btn--danger` Xoá).

**P0.4 — Tiền & số.** Chuẩn hoá định dạng: `new Intl.NumberFormat('vi-VN').format(n)` + `đ`,
luôn `tabular-nums` căn phải. Số **âm/lỗ = đỏ** (`.ps-money--neg`), **dương/lãi = lá**
(`.ps-money--pos`). Gom thành 1 util `formatVND()` dùng chung, thay các `toLocaleString` rời rạc.

**P0.5 — Thang z-index.** Thay mọi `z-[60] / z-50 / z-40 / z-modal / z-dropdown` lẫn lộn
bằng token: `--ps-z-sticky(10) / dropdown(1000) / overlay(1100) / modal(1110) / toast(1200)`.

**P0.6 — TopNav chrome trắng.** `components/TopNav.tsx`, hàng 2 `bg-indigo-600` → nền trắng,
item slate-600, item đang chọn chữ đỏ + gạch chân đỏ 3px, chỉ nút "Bán hàng" nền đỏ.
Vai trò "Admin CFO" `text-indigo-500` → đỏ. Popup thông báo `rounded-[2rem]` → 16.

═══════════════════════════════════════════════════════════════
# P1 · QUAN TRỌNG — nhất quán hệ thống
═══════════════════════════════════════════════════════════════

**P1.1 — Bảng → `.ps-table`.** Mọi `<table>` (đặc biệt `expense/ExpenseLedgerTab` px-8 py-6,
`payroll/LedgerTab` header đen, `revenue/*`, `product-group/*`,
`knowledge/MechanismsViolationsSubTab`): thêm `className="ps-table"` (`ps-table--dense` cho
bảng siêu dày). Xoá padding/size/uppercase thủ công trên `th/td`. Cột số `ps-num`. Cột cố định
`ps-col-check|flag|image|action`. Dòng chọn `aria-selected="true"`. Header đen payroll → header sáng.
Nâng cao: header sắp xếp `ps-th--sortable` + `aria-sort`; cột dính `ps-col-sticky-left|right`;
chọn nhiều → `ps-bulkbar`; phân trang `ps-pagination`.

**P1.2 — Nút + input.** `.btn-primary` và mọi `bg-indigo-600 ... rounded-*` (nút chính) →
`ps-btn ps-btn--primary`. Phụ → `ps-btn--secondary`; ghost → `--ghost`; nguy hiểm → `--danger`;
icon vuông toolbar → `ps-icon-btn`. `.input-field` và input/select/textarea rời rạc
(py-1.5/2/2.5/3) → `ps-input` (cao 32, focus ring đỏ).

**P1.3 — Dọn cỡ chữ tuỳ ý (>200 chỗ).** Thay mọi `text-[8px]…[11px]` và `text-2xs` theo
thang chữ (mục Nguyên tắc). Số/SKU thêm `.ps-mono`. Sau khi dọn, **gỡ khối `!important`**
trong `index.html` ép `text-[8-11px]→13px` và `text-xs/sm`.

**P1.4 — Trạng thái dữ liệu.** Chuẩn hoá rỗng/tải/lỗi: empty dùng `.ps-empty` (icon
`.ps-empty-icon` 56px + `.ps-empty-title` + `.ps-empty-sub`); đang tải dùng `.ps-skeleton`;
lỗi dùng `.ps-error-box`. Áp cho mọi bảng/list/dashboard widget.

**P1.5 — Modal & Toast.** Mọi modal → khung `.ps-scrim > .ps-modal` (header/body/footer,
scrim đen 50% không blur, bo 24). Thông báo → `.ps-toast-stack > .ps-toast--success|warning|danger`.
Bỏ các modal tự chế kích thước khác nhau.

**P1.6 — Form.** Field dùng `.ps-field > .ps-label (.ps-required) + .ps-input + .ps-help`.
Lỗi: `.ps-input--error` + `.ps-error-text`. Đồng nhất khoảng cách field.

**P1.7 — Trạng thái nghiệp vụ.** Map màu cố định bằng `.ps-status--ok|in|low|wait|out|err|off`
cho tồn kho (còn/sắp hết/hết), trạng thái đơn, sync. Bỏ tô màu tuỳ hứng.

**P1.8 — Màu cầu vồng.** Thay toàn bộ `indigo/violet/sky/blue` accent (vd `settings/MigrationTab`
6 nút 6 màu, `orders/*`) → đỏ thương hiệu (chính) hoặc slate (phụ). Giữ emerald=thành công,
rose/red=nguy hiểm, amber→vàng=cảnh báo.

═══════════════════════════════════════════════════════════════
# P2 · HOÀN THIỆN
═══════════════════════════════════════════════════════════════

**P2.1 — Icon & motion.** Lucide stroke-width 2, `currentColor`, cỡ theo ngữ cảnh
(14 dòng dày · 16 toolbar · 18 card · 24–32 empty). Chuyển động dùng `--ps-dur-fast/base/slow`
+ `--ps-ease`, không bounce/spring.

**P2.2 — Accessibility.** Đảm bảo `:focus-visible` ring khắp control (CSS lo sẵn cho .ps-*).
Hit-target ≥44 trên cảm ứng (CSS lo qua `@media hover:none`). Nhãn ẩn cho icon-only dùng
`.ps-sr-only` hoặc `aria-label`. Kiểm tra tương phản — không chữ vàng mảnh trên trắng.

**P2.3 — Phím tắt.** Hiển thị phím trong UI bằng `.ps-kbd` (vd `F3`). Giữ gợi ý trong
placeholder kiểu `Tìm hàng hóa (F3)`.

**P2.4 — In ấn.** Hoá đơn 80mm dùng `.ps-receipt`; ẩn chrome khi in bằng `.ps-no-print`;
A4 cho phiếu lương/báo cáo. Giữ logic in hiện có, chỉ chuẩn hoá khung.

═══════════════════════════════════════════════════════════════
Ràng buộc: không thêm tính năng, không đổi text/luồng dữ liệu. Sau mỗi commit:
`npm run build` + mô tả ngắn file đã đổi. Màn cần đổi cấu trúc → hỏi trước.
