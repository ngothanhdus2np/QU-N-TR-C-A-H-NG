#!/bin/bash
# scripts/backup-check-offsite.sh — Kêu lên khi bản backup off-site quá cũ.
#
# CHẠY TRÊN MACBOOK (nơi giữ bản off-site).
#
# Vì sao script này tồn tại: ngày 18/09/2026 phát hiện bản off-site đứng yên từ
# 20/07 — đúng 60 ngày — mà không ai biết. Backup hỏng là loại sự cố IM LẶNG:
# không có thông báo lỗi, không ai thấy gì bất thường, cho tới ngày cần khôi phục
# thì đã muộn. Thứ thiếu không phải là backup, mà là một cái gì đó chịu KÊU LÊN.
#
# Kiểm tra ở đây bắt được CẢ HAI tầng hỏng chỉ bằng một phép đo:
#   - job backup trên iMac ngừng chạy  → file mới nhất không tiến lên nữa
#   - bản kéo off-site ngừng chạy      → file mới nhất cũng không tiến lên nữa
# Vì bản off-site là bản sao của bản trên iMac, tầng nào đứt thì tuổi file cũng tăng.
#
# Kênh báo: thông báo macOS (luôn có sẵn, không cần cấu hình gì) + Zalo nếu đã
# cấu hình. CỐ Ý không phụ thuộc mỗi Zalo — tính tới 18/09/2026 token Zalo vẫn
# trống, nên cảnh báo nào chỉ dựa vào Zalo là lại im lặng y như cũ.

set -euo pipefail

LOCAL_DIR="${CFOBRAIN_BACKUP_DIR:-$HOME/backups/cfobrain}"
MAX_AGE_DAYS="${CFOBRAIN_BACKUP_MAX_AGE_DAYS:-3}"
STATE_FILE="${CFOBRAIN_BACKUP_ALERT_STATE:-/tmp/cfobrain-backup-alert.state}"
# Không báo lại trong vòng 12 tiếng, tránh phiền mỗi lần job chạy.
REALERT_AFTER_SECONDS="${CFOBRAIN_BACKUP_REALERT_SECONDS:-43200}"

ENV_FILE="${CFOBRAIN_ENV_FILE:-$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)/.env.local}"

notify() {
  local title="$1"
  local text="$2"

  echo "[backup-check] $(date '+%Y-%m-%d %H:%M:%S') $text"

  # Thông báo macOS — kênh duy nhất chắc chắn hoạt động mà không cần cấu hình.
  osascript -e "display notification \"$text\" with title \"$title\"" 2>/dev/null || true

  # Zalo — chỉ gửi nếu đã có token. Dùng chung biến với health-alert.sh.
  local token="${ZALO_OA_ACCESS_TOKEN:-}"
  local follower="${ZALO_FOLLOWER_ID:-}"
  if [ -z "$token" ] && [ -f "$ENV_FILE" ]; then
    token=$(grep -E '^ZALO_OA_ACCESS_TOKEN=' "$ENV_FILE" | tail -1 | cut -d '=' -f2- || true)
    follower=$(grep -E '^ZALO_FOLLOWER_ID=' "$ENV_FILE" | tail -1 | cut -d '=' -f2- || true)
  fi
  if [ -n "$token" ] && [ -n "$follower" ]; then
    curl -s -X POST "https://openapi.zalo.me/v2.0/oa/message" \
      -H "access_token: $token" \
      -H "Content-Type: application/json" \
      -d "{\"recipient\":{\"user_id\":\"$follower\"},\"message\":{\"text\":\"$text\"}}" \
      > /dev/null || echo "[backup-check] Gửi Zalo thất bại"
  fi
}

# Chỉ báo lại sau REALERT_AFTER_SECONDS để không spam.
should_alert() {
  [ -f "$STATE_FILE" ] || return 0
  local last now
  last=$(cat "$STATE_FILE" 2>/dev/null || echo 0)
  now=$(date +%s)
  [ $((now - last)) -ge "$REALERT_AFTER_SECONDS" ]
}

mark_alerted() { date +%s > "$STATE_FILE"; }

LATEST=$(ls -t "$LOCAL_DIR"/db-*.sql.gz 2>/dev/null | head -1 || true)

if [ -z "$LATEST" ]; then
  if should_alert; then
    notify "CFO Brain — Backup" "🚨 KHÔNG có bản backup off-site nào trong $LOCAL_DIR. Chạy scripts/backup-pull-offsite.sh và kiểm tra job trên iMac."
    mark_alerted
  fi
  exit 0
fi

# Tuổi tính theo NGÀY GIỜ TRONG TÊN FILE (db-YYYYMMDD-HHMMSS), không theo mtime:
# rsync giữ mtime gốc nên hai cách thường trùng, nhưng tên file là thứ do chính
# job backup sinh ra nên nó phản ánh đúng "lần backup gần nhất là khi nào" kể cả
# khi file bị copy/chép lại về sau.
BASENAME=$(basename "$LATEST")
STAMP=$(echo "$BASENAME" | sed -E 's/^db-([0-9]{8})-([0-9]{6})\.sql\.gz$/\1 \2/')

if [ "$STAMP" = "$BASENAME" ]; then
  # Tên không đúng khuôn — lùi về dùng mtime thay vì đoán mò.
  LATEST_EPOCH=$(stat -f %m "$LATEST")
else
  DATE_PART=$(echo "$STAMP" | cut -d' ' -f1)
  TIME_PART=$(echo "$STAMP" | cut -d' ' -f2)
  LATEST_EPOCH=$(date -j -f "%Y%m%d%H%M%S" "${DATE_PART}${TIME_PART}" +%s 2>/dev/null || stat -f %m "$LATEST")
fi

NOW_EPOCH=$(date +%s)
AGE_DAYS=$(( (NOW_EPOCH - LATEST_EPOCH) / 86400 ))
COUNT=$(ls -1 "$LOCAL_DIR"/db-*.sql.gz 2>/dev/null | wc -l | tr -d ' ')

if [ "$AGE_DAYS" -gt "$MAX_AGE_DAYS" ]; then
  if should_alert; then
    notify "CFO Brain — Backup" "🚨 Backup off-site đã CŨ $AGE_DAYS ngày (mới nhất: $BASENAME, ngưỡng $MAX_AGE_DAYS ngày). Kiểm tra job com.cfobrain.backup trên iMac và com.cfobrain.backup-pull trên MacBook."
    mark_alerted
  else
    echo "[backup-check] Backup cũ $AGE_DAYS ngày — đã báo gần đây, chưa báo lại."
  fi
  exit 0
fi

# Khỏe mạnh: xoá dấu đã-báo để lần hỏng sau được báo ngay.
rm -f "$STATE_FILE" 2>/dev/null || true
echo "[backup-check] $(date '+%Y-%m-%d %H:%M:%S') OK — mới nhất $BASENAME ($AGE_DAYS ngày tuổi), giữ $COUNT bản."
