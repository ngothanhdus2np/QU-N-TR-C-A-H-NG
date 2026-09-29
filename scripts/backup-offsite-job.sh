#!/bin/bash
# scripts/backup-offsite-job.sh — Việc định kỳ của bản off-site: kéo về rồi kiểm tra.
#
# CHẠY TRÊN MACBOOK, do launchd gọi (com.cfobrain.backup-pull.plist).
#
# Tách riêng khỏi hai script con để mỗi script giữ đúng một việc:
#   backup-pull-offsite.sh   — kéo file về (chỉ đọc từ iMac)
#   backup-check-offsite.sh  — đo tuổi bản mới nhất, kêu lên nếu quá cũ
#
# Bước kiểm tra chạy DÙ bước kéo có thất bại — đó chính là trường hợp cần báo nhất:
# iMac không tới được nhiều ngày liền thì bản off-site cũ dần mà không ai hay.

set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "───────────────────────────────────────────────"
echo "[backup-job] $(date '+%Y-%m-%d %H:%M:%S') bắt đầu"

bash "$SCRIPT_DIR/backup-pull-offsite.sh" || echo "[backup-job] ⚠️  Bước kéo thất bại — vẫn chạy tiếp bước kiểm tra"

bash "$SCRIPT_DIR/backup-check-offsite.sh" || echo "[backup-job] ⚠️  Bước kiểm tra lỗi"

echo "[backup-job] $(date '+%Y-%m-%d %H:%M:%S') xong"
