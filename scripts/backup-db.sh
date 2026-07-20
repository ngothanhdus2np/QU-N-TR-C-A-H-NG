#!/bin/bash
# scripts/backup-db.sh — Sao lưu tự động Supabase Postgres (AUDIT-0710-B, blocker duy nhất).
#
# CHẠY TRÊN iMAC (nơi có DB prod thật). Cũng chạy/test được trên MacBook — khi đó
# nó dump bản Supabase dev local (cùng container tên `supabase-db`), an toàn để kiểm thử.
#
# Vì sao cần: trước đây KHÔNG có backup tự động; 2 file backup_*.sql ở gốc repo = 0 byte
# (fail âm thầm — không ai biết cho tới khi cần khôi phục). Ổ cứng iMac hỏng = mất dữ liệu
# bán hàng thật. Script này:
#   1. pg_dump toàn bộ DB (DB vẫn chạy, không downtime) → nén gzip vào ~/backups/cfobrain/
#   2. CHẶN file 0-byte / quá nhỏ / hỏng (kiểm size + gzip -t) — fix lỗi fail âm thầm
#   3. Giữ N bản gần nhất, xoá bản cũ hơn
#   4. (tuỳ chọn) copy 1 bản ra máy khác (off-site) — backup cùng ổ với data thì vô dụng
#      khi ổ đó hỏng, nên nên có bản nằm ngoài iMac
#   5. Bắn Zalo cảnh báo khi BẤT KỲ bước nào fail (dùng chung token trong .env.local của app)
#
# Cài đặt lịch (launchd trên iMac) + cách KHÔI PHỤC: xem docs/03-deployment/BACKUP_RUNBOOK.md
#
# An toàn: chỉ ĐỌC từ DB (pg_dump nhất quán trên DB đang chạy). Không ghi/sửa gì trong DB.

set -euo pipefail

# ── Cấu hình (override qua biến môi trường nếu cần) ──────────────────────────
BACKUP_DIR="${CFOBRAIN_BACKUP_DIR:-$HOME/backups/cfobrain}"
KEEP_BACKUPS="${CFOBRAIN_BACKUP_KEEP:-14}"          # giữ 14 bản gần nhất
MIN_SIZE_BYTES="${CFOBRAIN_BACKUP_MIN_BYTES:-10240}" # < 10KB = nghi dump rỗng/hỏng
DB_CONTAINER="${CFOBRAIN_DB_CONTAINER:-supabase-db}"
APP_DIR="${CFOBRAIN_DIR:-$HOME/cfobrain}"           # để lấy token Zalo từ .env.local
# Off-site: đích scp (vd "apple@192.168.1.x:~/backups/cfobrain"). Trống = bỏ qua.
OFFSITE_DEST="${CFOBRAIN_BACKUP_OFFSITE:-}"
OFFSITE_SSH_KEY="${CFOBRAIN_BACKUP_OFFSITE_KEY:-}"   # -i key nếu cần

STAMP=$(date +%Y%m%d-%H%M%S)
DUMP_FILE="$BACKUP_DIR/db-$STAMP.sql.gz"
DUMP_ERR="/tmp/cfobrain-backup-dump.err"
DOCKER_BIN="$(command -v docker || echo /usr/local/bin/docker)"

# ── Zalo alert (cùng pattern health-alert.sh) ───────────────────────────────
if [ -z "${ZALO_OA_ACCESS_TOKEN:-}" ] && [ -f "$APP_DIR/.env.local" ]; then
  ZALO_OA_ACCESS_TOKEN=$(grep -E '^ZALO_OA_ACCESS_TOKEN=' "$APP_DIR/.env.local" | tail -1 | cut -d '=' -f2- || true)
  ZALO_FOLLOWER_ID=$(grep -E '^ZALO_FOLLOWER_ID=' "$APP_DIR/.env.local" | tail -1 | cut -d '=' -f2- || true)
fi

send_zalo() {
  local text="$1"
  if [ -z "${ZALO_OA_ACCESS_TOKEN:-}" ] || [ -z "${ZALO_FOLLOWER_ID:-}" ]; then
    echo "[backup-db] Zalo chưa cấu hình — bỏ qua gửi: $text"
    return 0
  fi
  curl -s -X POST "https://openapi.zalo.me/v2.0/oa/message" \
    -H "access_token: $ZALO_OA_ACCESS_TOKEN" \
    -H "Content-Type: application/json" \
    -d "{\"recipient\":{\"user_id\":\"$ZALO_FOLLOWER_ID\"},\"message\":{\"text\":\"$text\"}}" \
    > /dev/null 2>&1 || echo "[backup-db] Gửi Zalo thất bại"
}

fail() {
  trap - ERR                        # tránh đệ quy trap
  local msg="$1"
  echo "[backup-db] ❌ $msg"
  send_zalo "🔴 BACKUP THẤT BẠI — CFO Brain ($(hostname -s), $(date '+%H:%M %d/%m')): ${msg}. Dữ liệu bán hàng CHƯA được sao lưu — kiểm tra ngay."
  [ -f "$DUMP_FILE" ] && rm -f "$DUMP_FILE"   # xoá file rác nửa chừng
  exit 1
}
trap 'fail "lỗi bất ngờ (dòng $LINENO)"' ERR

# ── 1. Điều kiện tiên quyết ──────────────────────────────────────────────────
mkdir -p "$BACKUP_DIR"
if ! "$DOCKER_BIN" ps --format '{{.Names}}' | grep -q "^${DB_CONTAINER}$"; then
  fail "container '$DB_CONTAINER' không chạy — Supabase có thể đang down"
fi

# ── 2. Dump (pipefail bắt lỗi pg_dump ngay cả khi gzip thành công) ───────────
echo "[backup-db] 📦 Dump DB từ container '$DB_CONTAINER' (không downtime)..."
if ! "$DOCKER_BIN" exec "$DB_CONTAINER" pg_dump -U postgres -d postgres --clean --if-exists 2>"$DUMP_ERR" | gzip > "$DUMP_FILE"; then
  fail "pg_dump lỗi: $(tail -3 "$DUMP_ERR" 2>/dev/null | tr '\n' ' ')"
fi

# ── 3. Guard file rỗng/quá nhỏ (FIX lỗi fail âm thầm 0-byte) ─────────────────
SIZE=$(stat -f%z "$DUMP_FILE" 2>/dev/null || stat -c%s "$DUMP_FILE" 2>/dev/null || echo 0)
if [ "$SIZE" -lt "$MIN_SIZE_BYTES" ]; then
  fail "file backup chỉ ${SIZE} bytes (< ${MIN_SIZE_BYTES}) — nghi dump rỗng/hỏng"
fi

# ── 4. Kiểm tra toàn vẹn nén ─────────────────────────────────────────────────
if ! gzip -t "$DUMP_FILE" 2>/dev/null; then
  fail "file backup hỏng (gzip -t thất bại): $DUMP_FILE"
fi
echo "[backup-db] ✅ OK — $(du -h "$DUMP_FILE" | cut -f1) → $DUMP_FILE"

# ── 5. Copy off-site (best-effort — KHÔNG chặn nếu máy đích tắt) ─────────────
if [ -n "$OFFSITE_DEST" ]; then
  SCP_OPTS=(-o ConnectTimeout=10 -o BatchMode=yes)
  [ -n "$OFFSITE_SSH_KEY" ] && SCP_OPTS+=(-i "$OFFSITE_SSH_KEY")
  if scp "${SCP_OPTS[@]}" "$DUMP_FILE" "$OFFSITE_DEST/" 2>/dev/null; then
    echo "[backup-db] 🛰  Đã copy off-site → $OFFSITE_DEST"
  else
    echo "[backup-db] ⚠️  Copy off-site thất bại (máy đích tắt/không tới được) — bản local vẫn có"
    send_zalo "🟡 BACKUP: bản local OK nhưng copy dự phòng ra $OFFSITE_DEST thất bại (máy đích có thể đang tắt). Không khẩn cấp."
  fi
fi

# ── 6. Rotate: giữ N bản mới nhất ────────────────────────────────────────────
ls -t "$BACKUP_DIR"/db-*.sql.gz 2>/dev/null | tail -n +$((KEEP_BACKUPS + 1)) | xargs rm -f 2>/dev/null || true

COUNT=$(ls -1 "$BACKUP_DIR"/db-*.sql.gz 2>/dev/null | wc -l | tr -d ' ')
echo "[backup-db] Hoàn tất. Đang giữ ${COUNT}/${KEEP_BACKUPS} bản tại $BACKUP_DIR"
