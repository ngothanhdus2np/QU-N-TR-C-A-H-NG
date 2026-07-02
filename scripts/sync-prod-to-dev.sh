#!/bin/bash
# Đồng bộ dữ liệu Supabase PROD (iMac) → Supabase DEV local (MacBook)
#
# Chạy từ MacBook:  ./scripts/sync-prod-to-dev.sh
#
# Làm 3 việc:
#   1. pg_dump toàn bộ DB postgres từ container supabase-db trên iMac
#      → lưu bản nén vào ~/backups/cfobrain/ (kiêm backup ngoài iMac — DEVOPS-01)
#   2. Restore vào supabase-db local trên MacBook (ghi đè dữ liệu dev cũ)
#   3. Đồng bộ file storage (ảnh sản phẩm...) về volumes/storage local
#
# An toàn: chỉ ĐỌC từ prod (pg_dump nhất quán trên DB đang chạy). Không ghi gì lên iMac.

set -euo pipefail

IMAC="mac@192.168.1.3"
SSH_KEY="$HOME/.ssh/imac_deploy"
DEV_DOCKER_DIR="$HOME/supabase-dev/docker"
BACKUP_DIR="$HOME/backups/cfobrain"
STAMP=$(date +%Y%m%d-%H%M%S)
DUMP_FILE="$BACKUP_DIR/prod-$STAMP.sql.gz"
KEEP_BACKUPS=14   # giữ 14 bản gần nhất, xóa bản cũ hơn

mkdir -p "$BACKUP_DIR"

# Kiểm tra Supabase dev local đang chạy
if ! docker ps --format '{{.Names}}' | grep -q '^supabase-db$'; then
  echo "❌ supabase-db local chưa chạy. Mở Docker rồi: cd $DEV_DOCKER_DIR && docker compose up -d"
  exit 1
fi

echo "1/4 📦 Dump DB prod từ iMac (DB vẫn chạy bình thường, không downtime)..."
ssh -i "$SSH_KEY" "$IMAC" '/usr/local/bin/docker exec supabase-db pg_dump -U postgres -d postgres --clean --if-exists' \
  | gzip > "$DUMP_FILE"
echo "   → $(du -h "$DUMP_FILE" | cut -f1) lưu tại $DUMP_FILE"

echo "2/4 ♻️  Restore vào Supabase dev local (dữ liệu dev cũ bị ghi đè)..."
# --clean trong dump tự DROP + CREATE lại từng object. Một số lệnh DROP hệ thống
# (event trigger, publication realtime) có thể báo lỗi vô hại → không dùng ON_ERROR_STOP.
gunzip -c "$DUMP_FILE" | docker exec -i supabase-db psql -U postgres -d postgres -q 2>&1 \
  | grep -E "^ERROR" | grep -vE "must be owner|does not exist|cannot drop|depends on|permission denied for (schema|table) (pg_|information_schema)" \
  | head -20 || true

echo "3/4 🖼  Đồng bộ file storage (ảnh)..."
rsync -az -e "ssh -i $SSH_KEY" "$IMAC:~/supabase/docker/volumes/storage/" "$DEV_DOCKER_DIR/volumes/storage/" || echo "   (bỏ qua — storage trống hoặc không truy cập được)"

echo "4/4 🔄 Restart các service Supabase local để nhận schema/data mới..."
(cd "$DEV_DOCKER_DIR" && docker compose restart auth rest realtime storage > /dev/null 2>&1)

# Sync ghi đè DB dev = trạng thái prod → áp lại các migration CHƯA deploy lên prod
# (sổ schema_migrations đi kèm trong dump nên chỉ chạy đúng phần còn thiếu)
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
"$SCRIPT_DIR/apply-migrations.sh" || echo "⚠️  apply-migrations local lỗi — kiểm tra tay: ./scripts/apply-migrations.sh"

# Dọn backup cũ (giữ $KEEP_BACKUPS bản mới nhất)
ls -t "$BACKUP_DIR"/prod-*.sql.gz 2>/dev/null | tail -n +$((KEEP_BACKUPS + 1)) | xargs rm -f 2>/dev/null || true

# Kiểm tra nhanh kết quả
ROWS=$(docker exec supabase-db psql -U postgres -d postgres -tAc "SELECT count(*) FROM pos_orders" 2>/dev/null || echo "0")
USERS=$(docker exec supabase-db psql -U postgres -d postgres -tAc "SELECT count(*) FROM auth.users" 2>/dev/null || echo "0")
echo ""
echo "✅ Xong: pos_orders = $ROWS dòng, auth.users = $USERS tài khoản (đăng nhập dev bằng đúng tài khoản như prod)"
echo "   Backup: $DUMP_FILE"
