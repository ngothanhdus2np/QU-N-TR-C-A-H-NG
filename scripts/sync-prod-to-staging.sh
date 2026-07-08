#!/bin/bash
# Làm mới dữ liệu môi trường DEV/STAGING trên iMac (dev.phucsang.com.vn)
# bằng snapshot mới nhất từ PROD.
#
# KHÁC với scripts/sync-prod-to-dev.sh (bản cũ, đồng bộ vào Supabase local
# chạy trên MacBook — dùng khi cần dev offline, không đụng gì tới script này).
# Script này đồng bộ vào Supabase DEV chạy TRÊN iMac (supabase-db-dev),
# phục vụ link https://dev.phucsang.com.vn always-on.
#
# CHỈ ĐỌC trên prod (pg_dump). GHI ĐÈ toàn bộ dữ liệu hiện có trên dev/staging.
# KHÔNG tự động chạy trong deploy-imac-dev.sh — tránh mất dữ liệu test đang
# xây dựng dở trên dev mỗi lần đẩy code. Chạy tay khi cần dữ liệu mới.
#
# Chạy từ MacBook: ./scripts/sync-prod-to-staging.sh

set -e

IMAC_USER="mac"
IMAC_IP="192.168.1.6"
SSH_KEY="$HOME/.ssh/imac_deploy"

echo "⚠️  Script này sẽ GHI ĐÈ toàn bộ dữ liệu hiện có trên DEV/STAGING (supabase-db-dev"
echo "   trên iMac, phục vụ https://dev.phucsang.com.vn) bằng dữ liệu PROD tại thời điểm chạy."
echo "   Dữ liệu test đang có trên dev sẽ MẤT. Prod KHÔNG bị ảnh hưởng (chỉ đọc)."
read -p "Gõ 'yes' để tiếp tục: " CONFIRM
if [ "$CONFIRM" != "yes" ]; then
  echo "Đã huỷ."
  exit 1
fi

echo "📦 Đang dump dữ liệu từ PROD (chỉ đọc, không ảnh hưởng prod)..."
ssh -i "$SSH_KEY" "$IMAC_USER@$IMAC_IP" bash <<'REMOTE'
set -e
export PATH=/usr/local/bin:/usr/bin:/bin:$PATH
DUMP_FILE="/tmp/prod_to_staging_$(date +%Y%m%d%H%M%S).sql"
docker exec supabase-db pg_dump -U postgres -d postgres --clean --if-exists -F p > "$DUMP_FILE"
echo "$DUMP_FILE" > /tmp/cfobrain_staging_sync_dumpfile.txt
echo "✅ Dump xong: $(du -h "$DUMP_FILE" | cut -f1)"
REMOTE

echo "📥 Đang restore vào DEV/STAGING (supabase-db-dev)..."
ssh -i "$SSH_KEY" "$IMAC_USER@$IMAC_IP" bash <<'REMOTE'
set -e
export PATH=/usr/local/bin:/usr/bin:/bin:$PATH
DUMP_FILE=$(cat /tmp/cfobrain_staging_sync_dumpfile.txt)
# supabase_admin (không phải postgres) — đủ quyền DROP/ALTER object thuộc
# supabase_auth_admin/supabase_storage_admin khi --clean dump chạy lại.
cat "$DUMP_FILE" | docker exec -i supabase-db-dev psql -U supabase_admin -d postgres -v ON_ERROR_STOP=0 > /tmp/staging_sync_restore_log.txt 2>&1
ERR_COUNT=$(grep -c "^ERROR" /tmp/staging_sync_restore_log.txt || true)
echo "✅ Restore xong (${ERR_COUNT} dòng lỗi — thường là index/graphql nội bộ vô hại, xem /tmp/staging_sync_restore_log.txt trên iMac nếu > ~15 dòng)"
rm -f "$DUMP_FILE"
REMOTE

echo "🔍 Verify số dòng khớp giữa prod và dev/staging..."
ssh -i "$SSH_KEY" "$IMAC_USER@$IMAC_IP" bash <<'REMOTE'
export PATH=/usr/local/bin:/usr/bin:/bin:$PATH
echo "table | prod | dev/staging"
for t in pos_orders customers shopee_inventory_out revenue_records audit_logs; do
  P=$(docker exec supabase-db psql -U postgres -d postgres -t -c "SELECT count(*) FROM $t;" 2>/dev/null | tr -d ' ')
  D=$(docker exec supabase-db-dev psql -U supabase_admin -d postgres -t -c "SELECT count(*) FROM $t;" 2>/dev/null | tr -d ' ')
  echo "$t | $P | $D"
done
REMOTE

echo ""
echo "✅ Đồng bộ xong! https://dev.phucsang.com.vn giờ có dữ liệu mới nhất từ prod."
echo "   Không cần restart app dev — chỉ dữ liệu thay đổi, không phải code."
