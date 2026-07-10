#!/bin/bash
# Cảnh báo hạ tầng khi app không phản hồi — audit 2026-07-10 mục I.
# Trước đây KHÔNG có cơ chế nào phát hiện app crash/treo ngoài launchd tự restart
# im lặng — nhân viên chỉ biết khi thấy đơn không cập nhật. Script này bắn Zalo khi
# /health fail 2 lần liên tiếp (tránh báo giả do 1 lần chập chờn mạng/tunnel).
#
# CHẠY TRÊN iMAC (không phải MacBook) — nơi app + Zalo OA token thật đang chạy.
# Cài đặt (chạy launchd 5 phút/lần), xem docs/03-deployment/ROLLBACK_RUNBOOK.md:
#   */5 * * * * /Users/mac/cfobrain/scripts/health-alert.sh >> /tmp/cfobrain-health-alert.log 2>&1
#
# Dùng chung ZALO_OA_ACCESS_TOKEN/ZALO_FOLLOWER_ID trong .env.local của app (không
# cần thêm secret riêng) — tự source từ đó nếu chưa có trong môi trường shell.

set -euo pipefail

APP_DIR="${CFOBRAIN_DIR:-$HOME/cfobrain}"
HEALTH_URL="${CFOBRAIN_HEALTH_URL:-http://localhost:3000/health}"
STATE_FILE="${CFOBRAIN_HEALTH_STATE:-/tmp/cfobrain-health-alert.state}"
FAIL_THRESHOLD=2

if [ -z "${ZALO_OA_ACCESS_TOKEN:-}" ] && [ -f "$APP_DIR/.env.local" ]; then
  ZALO_OA_ACCESS_TOKEN=$(grep -E '^ZALO_OA_ACCESS_TOKEN=' "$APP_DIR/.env.local" | tail -1 | cut -d '=' -f2-)
  ZALO_FOLLOWER_ID=$(grep -E '^ZALO_FOLLOWER_ID=' "$APP_DIR/.env.local" | tail -1 | cut -d '=' -f2-)
fi

send_zalo() {
  local text="$1"
  if [ -z "${ZALO_OA_ACCESS_TOKEN:-}" ] || [ -z "${ZALO_FOLLOWER_ID:-}" ]; then
    echo "[health-alert] Zalo chưa cấu hình — bỏ qua gửi cảnh báo: $text"
    return
  fi
  curl -s -X POST "https://openapi.zalo.me/v2.0/oa/message" \
    -H "access_token: $ZALO_OA_ACCESS_TOKEN" \
    -H "Content-Type: application/json" \
    -d "{\"recipient\":{\"user_id\":\"$ZALO_FOLLOWER_ID\"},\"message\":{\"text\":\"$text\"}}" \
    > /dev/null || echo "[health-alert] Gửi Zalo thất bại"
}

FAIL_COUNT=0
[ -f "$STATE_FILE" ] && FAIL_COUNT=$(cat "$STATE_FILE" 2>/dev/null || echo 0)

HTTP_CODE=$(curl -s -o /dev/null -w '%{http_code}' -m 5 "$HEALTH_URL" || echo "000")

if [ "$HTTP_CODE" = "200" ]; then
  if [ "$FAIL_COUNT" -ge "$FAIL_THRESHOLD" ]; then
    send_zalo "✅ CFO Brain đã phục hồi — $HEALTH_URL trả 200 OK trở lại."
  fi
  echo 0 > "$STATE_FILE"
else
  FAIL_COUNT=$((FAIL_COUNT + 1))
  echo "$FAIL_COUNT" > "$STATE_FILE"
  echo "[health-alert] $(date '+%Y-%m-%d %H:%M:%S') health check fail #$FAIL_COUNT (HTTP $HTTP_CODE)"
  if [ "$FAIL_COUNT" -eq "$FAIL_THRESHOLD" ]; then
    send_zalo "🚨 CFO Brain KHÔNG phản hồi ($HEALTH_URL, HTTP $HTTP_CODE) — kiểm tra ngay: ssh vào iMac, xem log /tmp/cfobrain-app.log"
  fi
fi
