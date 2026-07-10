# Rollback Runbook — CFO Brain 4.0 (prod trên iMac)

> Dùng khi `./scripts/deploy-imac.sh` báo lỗi, hoặc app prod (`cfobrain.phucsang.com.vn`)
> không phản hồi/lỗi sau deploy. Đọc từ trên xuống, dừng ở bước xử lý được sự cố của bạn.

## 0. Trước tiên: deploy script đã tự làm gì?

Từ 2026-07-10, `deploy-imac.sh` tự động:
1. Backup code hiện tại (hardlink) vào `~/cfobrain-backup-prev` TRƯỚC khi ghi đè.
2. Nếu `/health` fail sau deploy → tự động khôi phục backup + restart + health-check lại.
3. Nếu rollback tự động **thành công** → script thoát với thông báo `↩️ Đã ROLLBACK thành công`, app đã chạy lại code cũ. **Không cần làm gì thêm**, trừ khi migration mới cũng cần xử lý (xem mục 2).
4. Nếu rollback tự động **cũng thất bại**, hoặc không có backup (lần deploy đầu tiên) → cần xử lý thủ công theo các mục bên dưới.

## 1. Kịch bản: build/npm install fail trên iMac

Script dừng ở bước "Build trên iMac" (do `set -e`) — code MỚI **chưa** được restart, app cũ vẫn đang chạy bình thường (chưa bị ảnh hưởng, vì restart launchd chỉ xảy ra ở bước sau build).

```bash
ssh -i ~/.ssh/imac_deploy mac@192.168.1.6
cd ~/cfobrain
npm install && npm run build     # xem lỗi cụ thể, sửa rồi chạy lại
```

Sau khi build local thành công thì chạy lại `./scripts/deploy-imac.sh` từ MacBook (script sẽ backup lại và rsync đè lên bản đã sửa).

## 2. Kịch bản: migration SQL fail

`apply-migrations.sh --prod` dùng `--single-transaction` cho từng file — 1 file lỗi thì **chỉ file đó rollback**, các file trước đã chạy thành công vẫn giữ nguyên (không mất). Script `deploy-imac.sh` dừng ngay tại bước 1.6 (trước khi build/restart) — app cũ vẫn chạy bình thường, KHÔNG bị downtime.

Xử lý:
1. Xem lỗi SQL cụ thể trong output.
2. Sửa file migration lỗi trong `supabase_migrations/`.
3. Chạy lại `./scripts/apply-migrations.sh --prod` (chỉ chạy các file CHƯA có trong `schema_migrations`, an toàn để chạy lại nhiều lần).

**Quan trọng**: nếu migration đã APPLY thành công nhưng gây lỗi logic ở bước sau (build/health-check), rollback tự động của `deploy-imac.sh` **chỉ khôi phục CODE, không revert schema**. Vì hầu hết migration trong dự án là additive (thêm cột/bảng/index — `IF NOT EXISTS`), code cũ chạy cùng schema mới thường vẫn hoạt động được. Nếu migration đó có breaking change (đổi tên cột, xóa cột) — phải viết migration mới để revert thủ công, không có cơ chế tự động.

## 3. Kịch bản: deploy xong, health-check fail, rollback tự động CŨNG fail

Đây là tình huống nghiêm trọng nhất — script đã thử khôi phục `~/cfobrain-backup-prev` nhưng app vẫn không lên. Xử lý thủ công:

```bash
ssh -i ~/.ssh/imac_deploy mac@192.168.1.6

# 1. Xem log lỗi thật
tail -100 /tmp/cfobrain-app.log

# 2. Kiểm tra trạng thái launchd
launchctl list | grep cfobrain

# 3. Nếu ~/cfobrain đang là bản lỗi (script đã đổi tên thành ~/cfobrain-failed và
#    không khôi phục được ~/cfobrain-backup-prev), khôi phục thủ công:
ls -la ~ | grep cfobrain     # xác nhận tên thư mục hiện có
rm -rf ~/cfobrain
mv ~/cfobrain-backup-prev ~/cfobrain    # (đổi tên đúng theo những gì ls thấy ở trên)
launchctl kickstart -k gui/$(id -u)/com.cfobrain.app

# 4. Verify lại
curl -s http://localhost:3000/health
```

Nếu vẫn không lên được — kiểm tra Supabase self-host còn chạy không (`docker ps` trong `~/supabase/docker`), vì `/health` giờ kiểm tra kết nối DB thật (từ 2026-07-10) — app có thể hoàn toàn khỏe nhưng Supabase container chết mới là nguyên nhân.

## 4. Kịch bản: cần rollback thủ công (không đợi deploy script)

Nếu phát hiện bản đang chạy có bug nghiêm trọng và muốn rollback ngay (không qua deploy script):

```bash
ssh -i ~/.ssh/imac_deploy mac@192.168.1.6
ls -la ~ | grep cfobrain-backup    # xác nhận có bản backup gần nhất không
rm -rf ~/cfobrain-rollback-now && mv ~/cfobrain ~/cfobrain-rollback-now
mv ~/cfobrain-backup-prev ~/cfobrain
launchctl kickstart -k gui/$(id -u)/com.cfobrain.app
curl -s http://localhost:3000/health
```

**Giới hạn**: chỉ giữ **1 bản backup gần nhất** (không phải lịch sử nhiều version) — nếu 2 lần deploy liên tiếp đều lỗi, bản backup cũng đã là bản lỗi của lần trước. Trong trường hợp đó, cách an toàn nhất là quay lại commit git đã biết chạy tốt (`git log`, `git checkout <commit-cũ>`) rồi deploy lại từ đó.

## 5. Alerting hạ tầng (từ 2026-07-10)

`scripts/health-alert.sh` — cron/launchd chạy mỗi 5 phút trên iMac, bắn Zalo nếu `/health` fail 2 lần liên tiếp. Cài đặt (nếu chưa có):

```bash
ssh -i ~/.ssh/imac_deploy mac@192.168.1.6
crontab -e
# thêm dòng:
*/5 * * * * /Users/mac/cfobrain/scripts/health-alert.sh >> /tmp/cfobrain-health-alert.log 2>&1
```

Nếu nhận được cảnh báo Zalo "🚨 CFO Brain KHÔNG phản hồi" — làm theo mục 3 ở trên.

## 6. Việc KHÔNG được làm

- Không `git push --force` / sửa lịch sử git để "dọn" 1 lần deploy lỗi — deploy không dùng git trên iMac (rsync trực tiếp), không liên quan git history.
- Không xóa `~/cfobrain-backup-prev` hay `~/cfobrain-failed` ngay sau sự cố — giữ lại ít nhất vài giờ để debug, dọn sau khi chắc chắn ổn định.
- Không chạy `deploy-imac.sh` lặp lại liên tục khi đang lỗi — mỗi lần chạy sẽ ghi đè `~/cfobrain-backup-prev` bằng bản lỗi gần nhất, mất luôn "bản tốt cuối cùng" nếu chạy 2 lần lỗi liên tiếp.
