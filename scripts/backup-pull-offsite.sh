#!/bin/bash
# scripts/backup-pull-offsite.sh — Kéo bản backup mới nhất TỪ iMac VỀ MacBook (off-site copy).
#
# CHẠY TRÊN MACBOOK. Tái dùng SSH key sẵn có (~/.ssh/imac_deploy) — không cần cấu hình mới.
#
# Vì sao: backup-db.sh trên iMac đã lưu bản sao vào ~/backups/cfobrain/ NGAY TRÊN iMac.
# Nhưng backup cùng ổ với dữ liệu gốc thì vô dụng khi ổ iMac hỏng. Script này kéo bản
# mới nhất về MacBook (máy khác) → có bản nằm NGOÀI iMac. Chạy khi MacBook bật (best-effort).
#
# Có thể hẹn giờ bằng launchd (com.cfobrain.backup-pull.plist) hoặc chạy tay khi cần.
# An toàn: chỉ ĐỌC (rsync pull), không ghi gì lên iMac.

set -euo pipefail

IMAC="${CFOBRAIN_IMAC:-mac@192.168.1.6}"
SSH_KEY="${CFOBRAIN_SSH_KEY:-$HOME/.ssh/imac_deploy}"
REMOTE_DIR="${CFOBRAIN_REMOTE_BACKUP_DIR:-/Users/mac/backups/cfobrain}"
LOCAL_DIR="${CFOBRAIN_BACKUP_DIR:-$HOME/backups/cfobrain}"
KEEP_BACKUPS="${CFOBRAIN_BACKUP_KEEP:-30}"   # MacBook giữ nhiều hơn (30) làm kho off-site

mkdir -p "$LOCAL_DIR"

if ! ssh -i "$SSH_KEY" -o ConnectTimeout=10 -o BatchMode=yes "$IMAC" 'true' 2>/dev/null; then
  echo "[backup-pull] ⚠️  Không SSH được tới iMac ($IMAC) — bỏ qua lần này (iMac tắt/không cùng mạng?)"
  exit 0   # không coi là lỗi cứng — chỉ là lần pull này bỏ qua
fi

echo "[backup-pull] ⬇️  Kéo backup mới từ iMac ($REMOTE_DIR) về $LOCAL_DIR ..."
rsync -az --ignore-existing -e "ssh -i $SSH_KEY" \
  "$IMAC:$REMOTE_DIR/db-*.sql.gz" "$LOCAL_DIR/" 2>/dev/null || {
    echo "[backup-pull] ⚠️  Chưa có file backup nào trên iMac (job iMac đã chạy chưa?)"
    exit 0
  }

# Rotate bản off-site trên MacBook
ls -t "$LOCAL_DIR"/db-*.sql.gz 2>/dev/null | tail -n +$((KEEP_BACKUPS + 1)) | xargs rm -f 2>/dev/null || true

LATEST=$(ls -t "$LOCAL_DIR"/db-*.sql.gz 2>/dev/null | head -1 || true)
COUNT=$(ls -1 "$LOCAL_DIR"/db-*.sql.gz 2>/dev/null | wc -l | tr -d ' ')
if [ -n "$LATEST" ]; then
  echo "[backup-pull] ✅ Off-site OK — mới nhất: $(basename "$LATEST") ($(du -h "$LATEST" | cut -f1)); giữ ${COUNT}/${KEEP_BACKUPS} bản tại $LOCAL_DIR"
else
  echo "[backup-pull] (chưa có bản nào)"
fi
