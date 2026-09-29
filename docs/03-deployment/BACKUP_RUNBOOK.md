# Runbook — Sao lưu & Khôi phục dữ liệu (Backup & Restore)

> Giải quyết blocker **AUDIT-0710-B** (backup tự động — điểm yếu nhất hệ thống).
> Tạo 2026-07-20. Kiểm chứng script trên Supabase local: dump 16MB (73.8MB giải nén),
> đủ schema + dữ liệu + RPC + auth.users; guard 0-byte + container-down + gzip hỏng đều bắt đúng.

## 1. Tổng quan

| Thành phần | Máy | Vai trò |
|---|---|---|
| `scripts/backup-db.sh` | **iMac** (prod) | Dump DB mỗi ngày 02:30 → `~/backups/cfobrain/`, chặn file rỗng, Zalo alert khi fail |
| `scripts/com.cfobrain.backup.plist` | **iMac** | launchd hẹn giờ chạy backup-db.sh |
| `scripts/backup-pull-offsite.sh` | **MacBook** | Kéo bản mới nhất từ iMac về MacBook (bản off-site, phòng ổ iMac hỏng) |

**Nguyên tắc 3-2-1 rút gọn**: dữ liệu gốc trên iMac + bản backup trên iMac + **bản off-site trên MacBook**.
Backup nằm cùng ổ với dữ liệu gốc = vô dụng khi ổ đó hỏng → **bắt buộc có bản off-site**.

---

## 2. Cài đặt trên iMAC (bắt buộc — phần chính)

SSH vào iMac rồi chạy (giả định app ở `/Users/mac/cfobrain`):

```bash
ssh -i ~/.ssh/imac_deploy mac@imac-ca-mac   # hoặc: ssh imac-cfobrain

# 1. Đảm bảo code mới nhất đã có trên iMac (deploy hoặc git pull) — cần scripts/backup-db.sh
ls ~/cfobrain/scripts/backup-db.sh

# 2. Chạy thử 1 lần bằng tay (KHÔNG downtime — chỉ đọc DB)
bash ~/cfobrain/scripts/backup-db.sh
#   Kỳ vọng: "✅ OK — NNM → ~/backups/cfobrain/db-YYYYMMDD-HHMMSS.sql.gz"

# 3. Cài lịch tự động (launchd, mỗi ngày 02:30)
cp ~/cfobrain/scripts/com.cfobrain.backup.plist ~/Library/LaunchAgents/
launchctl load -w ~/Library/LaunchAgents/com.cfobrain.backup.plist

# 4. Xác nhận đã nạp
launchctl list | grep com.cfobrain.backup
```

> Nếu app KHÔNG ở `/Users/mac/cfobrain`: sửa đường dẫn trong `.plist` (2 chỗ: `ProgramArguments` và `CFOBRAIN_DIR`) trước khi copy.

**Cảnh báo Zalo**: script tự lấy `ZALO_OA_ACCESS_TOKEN` + `ZALO_FOLLOWER_ID` từ `~/cfobrain/.env.local`
(giống `health-alert.sh`). Khi backup fail → chủ cửa hàng nhận tin Zalo ngay.

---

## 3. Cài đặt off-site trên MACBOOK (BẮT BUỘC — không phải tuỳ chọn)

> ⚠️ Mục này trước đây ghi là "tuỳ chọn" và hậu quả là **bản off-site đứng yên từ 20/07 đến
> 18/09/2026 — 60 ngày — mà không ai biết**. Script `backup-pull-offsite.sh` đã có từ 20/07
> nhưng chưa bao giờ được hẹn giờ. Script không ai gọi thì cũng như không tồn tại.
> Đã sửa 18/09/2026: có plist sẵn trong repo và có cảnh báo khi backup quá cũ.

```bash
cd ~/"phucsang app/QU-N-TR-C-A-H-NG"

# 1. Chạy thử bằng tay (chỉ ĐỌC từ iMac, không ghi gì lên đó)
bash scripts/backup-offsite-job.sh

# 2. Cài lịch tự động
cp scripts/com.cfobrain.backup-pull.plist ~/Library/LaunchAgents/
launchctl bootstrap gui/$(id -u) ~/Library/LaunchAgents/com.cfobrain.backup-pull.plist

# 3. Xác nhận đã nạp
launchctl list | grep cfobrain        # kỳ vọng: com.cfobrain.backup-pull
tail -12 /tmp/cfobrain-backup-pull.log
```

**Job này làm hai việc mỗi 6 tiếng** (và ngay khi máy bật):

| Script | Việc |
|---|---|
| `backup-pull-offsite.sh` | Kéo bản mới từ iMac về `~/backups/cfobrain/` (giữ 30 bản) |
| `backup-check-offsite.sh` | Đo tuổi bản mới nhất; quá 3 ngày → **thông báo macOS** (+ Zalo nếu đã cấu hình) |

**Vì sao chu kỳ 6 tiếng chứ không phải một mốc giờ cố định**: MacBook hay ngủ/tắt, trượt mốc là
mất luôn ngày đó. Chu kỳ + `RunAtLoad` nghĩa là máy thức lúc nào thì bắt kịp lúc đó.

**Vì sao cảnh báo dùng thông báo macOS chứ không chỉ Zalo**: tính tới 18/09/2026 token Zalo trong
`.env.local` vẫn **trống**, nên `health-alert.sh` chạy bao lâu nay mà chưa từng báo được cho ai.
Cảnh báo nào chỉ dựa vào Zalo là lại im lặng y như cũ.

**Một phép đo bắt được cả hai tầng hỏng**: bản off-site là bản sao của bản trên iMac, nên job
backup trên iMac chết hay bản kéo chết thì tuổi file mới nhất đều tăng lên như nhau.

MacBook không phải lúc nào cũng bật → bản off-site vẫn là **best-effort**, KHÔNG thay thế được
việc backup trên iMac phải chạy đều. Muốn chắc chắn hơn nữa → thêm cloud (xem mục 6).

---

## 4. Kiểm tra đang chạy tốt

```bash
# Trên iMac — xem log lần chạy gần nhất + danh sách bản backup
tail -20 /tmp/cfobrain-backup.log
ls -lh ~/backups/cfobrain/

# Kích hoạt chạy ngay (không chờ 02:30) để test launchd
launchctl start com.cfobrain.backup
```

Dấu hiệu khỏe: mỗi ngày có thêm 1 file `db-*.sql.gz` kích thước hợp lý (vài chục MB), giữ tối đa 14 bản.

---

## 5. KHÔI PHỤC (Restore) — quan trọng nhất, đọc kỹ TRƯỚC khi cần

> ⚠️ Restore GHI ĐÈ toàn bộ DB hiện tại. Chỉ làm khi thực sự cần (mất dữ liệu / dựng lại máy).
> Luôn dump 1 bản "hiện trạng" trước khi restore (phòng restore nhầm).

```bash
# Trên iMac (hoặc máy có container supabase-db cần phục hồi):

# 0. (An toàn) sao lưu hiện trạng trước đã
bash ~/cfobrain/scripts/backup-db.sh

# 1. Chọn bản cần khôi phục
ls -lt ~/backups/cfobrain/
BK=~/backups/cfobrain/db-YYYYMMDD-HHMMSS.sql.gz   # đổi thành file thật

# 2. Kiểm tra file toàn vẹn trước khi restore
gzip -t "$BK" && echo "file OK"

# 3. Restore (dump có --clean --if-exists nên tự DROP + tạo lại từng object)
#    Một số lệnh DROP hệ thống (event trigger/publication) báo lỗi vô hại → KHÔNG dùng ON_ERROR_STOP
gunzip -c "$BK" | docker exec -i supabase-db psql -U postgres -d postgres -q

# 4. Restart các service Supabase để nhận schema/data mới
cd ~/supabase/docker && docker compose restart auth rest realtime storage

# 5. Kiểm tra nhanh
docker exec supabase-db psql -U postgres -d postgres -tAc "SELECT count(*) FROM pos_orders"
docker exec supabase-db psql -U postgres -d postgres -tAc "SELECT count(*) FROM auth.users"
```

> Restore vào schema `auth`/`storage` cần quyền — nếu gặp lỗi "must be owner", dùng role
> `supabase_admin` thay `postgres` (xem ghi chú hạ tầng dev/staging). Với restore full DB như trên
> thì role `postgres` (superuser trong container) thường đủ.

---

## 6. Nâng cấp tương lai (tuỳ chọn)

- **Cloud off-site** (chống mất cả iMac lẫn MacBook — cháy/trộm): đẩy `db-*.sql.gz` lên MEGA/Google
  Drive/S3 sau mỗi lần backup. Đặt biến `CFOBRAIN_BACKUP_OFFSITE` hoặc thêm bước upload cuối `backup-db.sh`.
  Cần tài khoản + CLI (vd `mega-put`, `rclone`).
- **Mã hoá**: nếu backup chứa dữ liệu nhạy cảm và lưu cloud → `gpg` mã hoá trước khi upload.
- **Kiểm tra restore định kỳ**: mỗi tháng thử restore 1 bản vào Supabase dev để chắc chắn backup dùng được thật.

---

## 7. Trạng thái

- [x] Script backup + guard chống fail âm thầm (0-byte/container-down/gzip hỏng) — **đã test**.
- [x] launchd iMac + puller off-site MacBook — **đã viết**.
- [ ] **Cài trên iMac** (mục 2) — cần chạy trên iMac (SSH tự động bị chặn — chủ cửa hàng/agent có quyền chạy).
- [ ] (tuỳ chọn) Cloud off-site.
