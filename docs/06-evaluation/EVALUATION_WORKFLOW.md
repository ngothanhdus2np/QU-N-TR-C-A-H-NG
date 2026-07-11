# Quy trình đánh giá toàn bộ (Full Audit) — CFO Brain 4.0

> Áp dụng khi user nói **"đánh giá toàn bộ"**, **"full audit"**, hoặc yêu cầu
> "audit production-readiness toàn diện". Được tham chiếu từ `.claude/rules/workflow.md`.
>
> File này viết lại từ quy trình đã thực hành thật qua các vòng audit
> 2026-07-10 (R51), 2026-07-11 (R54, R56) — xem `PRODUCTION_AUDIT_*.md` cùng thư mục.
>
> ⚠️ Các file vai trò riêng (`ROLE_QA.md`, `ROLE_REVIEWER.md`, `ROLE_SECURITY.md`,
> `ROLE_PERFORMANCE.md`, `ROLE_UX.md`, `ROLE_LOGIC.md`) mà workflow.md nhắc tới
> **chưa tồn tại** — checklist từng góc nhìn được nhúng ngay trong file này (mục 3).
> Nếu user gọi 1 vai trò cụ thể → làm đúng phần checklist tương ứng, sâu hơn.

---

## 1. Nguyên tắc bất di bất dịch

1. **Không tin báo cáo cũ** — audit sau phải kiểm chứng lại từng fix của audit trước
   bằng cách đọc code thật (mở đúng file, đúng dòng), không dựa vào TODO/HISTORY ghi "đã xong".
   Lý do thực chứng: R51 từng có dương tính giả (DOMPurify grep 1 dòng), R52 từng phát hiện
   fix "đã xong" nhưng middleware chưa được wire (`errorHandler`).
2. **Soi kỹ phần thay đổi từ lần audit trước** (`git diff` so với HEAD/commit audit trước)
   — bug mới hầu như luôn nằm trong code mới, không nằm ở phần đã qua nhiều vòng audit.
3. **Mỗi finding phải có đủ 4 phần**: (1) đạt / chưa đạt / không áp dụng,
   (2) bằng chứng cụ thể (file:dòng), (3) mức rủi ro nếu bỏ qua, (4) đề xuất cách sửa.
   Phản biện chính finding của mình trước khi ghi (vd: limiter mới có key đúng IP thật
   sau Cloudflare không? nhánh insert của upsert có vỡ NOT NULL không?).
4. **Audit-only nghĩa là không sửa code** trong phiên audit — trừ blocker bảo mật
   dữ liệu thật (vd RLS hở anon) thì vá ngay + ghi rõ vào báo cáo.
5. **Phân biệt "code đã fix" và "prod đã có fix"** — luôn ghi rõ trạng thái
   commit/deploy của từng fix. Fix chưa deploy = prod chưa được bảo vệ.

## 2. Trình tự bắt buộc

```
1. Đọc docs/05-process/TODO.md + HISTORY.md + báo cáo audit gần nhất
2. git status / git diff HEAD — xác định delta chưa commit + HEAD hiện tại
3. Kiểm chứng từng fix của audit trước bằng code thật (nguyên tắc 1)
4. Rà 8 hạng mục (mục 3 dưới) — ưu tiên sâu vào phần delta (nguyên tắc 2)
5. Chạy kiểm tra tự động: npx tsc --noEmit · npm test · vitest run --coverage
6. Viết báo cáo: docs/06-evaluation/PRODUCTION_AUDIT_YYYY-MM-DD.md
   (cùng ngày đã có báo cáo → THÊM section "Audit lần N", không ghi đè)
7. Cập nhật TODO.md (finding mới theo ưu tiên) + HISTORY.md (phiên mới đầu file)
```

## 3. 8 hạng mục chuẩn + góc nhìn vai trò

| # | Hạng mục | Vai trò | Trọng tâm kiểm tra |
|---|---|---|---|
| 1 | Nghiệp vụ cốt lõi | Logic Auditor | Luồng bán/sửa/hủy/trả đơn qua RPC transaction; làm tròn tiền; âm kho/race; đồng bộ đơn–kho–công nợ–báo cáo; **mọi công thức khớp FORMULAS.md và chỉ có 1 nguồn** (vd `src/lib/shopeeProfit.ts`) |
| 2 | Bảo mật | Security Auditor | SQLi/XSS (DOMPurify — grep phải multiline)/CSRF; requireAuth + phân quyền từng route mutate; RLS **mọi bảng mới** (bẫy DEFAULT PRIVILEGES cấp anon); secrets không tracked; rate-limit login + endpoint public |
| 3 | Dữ liệu & lỗi | QA Engineer | Validate cả backend (không tin frontend); transaction/rollback thao tác tiền/kho; biên (qty 0, giá âm, NaN, ký tự đặc biệt, file sai định dạng); log đủ debug + redact |
| 4 | Hiệu năng | Performance Auditor | N+1, index bảng lớn (kiểm CẢ migration lẻ, không chỉ supabase_setup.sql); concurrency; giới hạn query 2000 rows; job nền có điều kiện skip-unchanged |
| 5 | Backup & recovery | Ops | Backup định kỳ tự động + alert khi fail (file 0 byte = fail âm thầm); WAL/transaction khi crash; rollback deploy |
| 6 | UX thực tế | UX Auditor | Lỗi hiển thị tiếng Việt dễ hiểu (`translateError`); mất mạng giữa chừng (offline queue); máy cũ/điện thoại |
| 7 | Kiểm thử | QA Engineer | Số test pass + coverage thật từng file (cảnh giác con số gộp gây hiểu nhầm); luồng tiền quan trọng có test; tầng wiring HTTP có test (pattern `routes/data.test.ts`) |
| 8 | Vận hành | Ops | /health check DB thật; alerting chạy THẬT trên máy prod (không chỉ script tồn tại); secrets/env; tài liệu deploy/rollback/runbook |

## 4. Cấu trúc kết luận bắt buộc

1. **Blocker 🔴** — bắt buộc sửa trước khi tin dùng hoàn toàn.
2. **Nên sửa sớm 🟠 / không chặn go-live 🟡 / nhỏ 🟢** — xếp hạng rõ.
3. **Đánh giá sẵn sàng theo 3 kịch bản** (bảng):
   dùng thật nội bộ · sổ sách duy nhất không lưới an toàn · mở khách ngoài quy mô lớn.
4. So sánh với audit trước: tiến/lùi ở đâu, finding nào tái diễn.

## 5. Giới hạn môi trường đã biết (tránh mất thời gian lặp lại)

- Sandbox agent không có mạng ra ngoài → không verify được `dev.phucsang.com.vn`/prod
  qua browser; chỉ verify được localhost preview.
- SSH đọc host prod (iMac `192.168.1.6`) bị permission classifier chặn trong auto-mode
  → việc xác nhận cron/launchd trên iMac phải nhờ user tự chạy lệnh.
- Ghi/backfill dữ liệu tài chính prod luôn cần user xác nhận bằng lời rõ ràng.
