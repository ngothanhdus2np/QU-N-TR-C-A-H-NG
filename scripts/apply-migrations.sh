#!/bin/bash
# Chạy các migration trong supabase_migrations/ CHƯA từng chạy trên DB đích.
# Sổ theo dõi: bảng schema_migrations (theo TÊN FILE — số trùng 005/019 không sao).
#
# Cách dùng:
#   ./scripts/apply-migrations.sh              → áp vào Supabase DEV local (MacBook)
#   ./scripts/apply-migrations.sh --prod       → áp vào Supabase PROD (iMac, qua SSH)
#   ./scripts/apply-migrations.sh --staging    → áp vào Supabase DEV/staging (iMac, qua SSH,
#                                                container supabase-db-dev — môi trường dev
#                                                riêng biệt, tách khỏi DB prod)
#   ./scripts/apply-migrations.sh --baseline   → KHÔNG chạy SQL, chỉ đánh dấu tất cả
#                                                file hiện có là "đã chạy" (dùng 1 lần
#                                                khi DB đã có sẵn schema tương đương)
#   (có thể kết hợp: --prod --baseline, --staging --baseline)
#
# Quy tắc viết migration mới:
#   - Đặt tên: <số kế tiếp>_<mô tả>.sql (vd: 021_them_bang_x.sql)
#   - SQL nên idempotent (IF NOT EXISTS / CREATE OR REPLACE)
#   - Mỗi file chạy trong 1 transaction — lỗi giữa chừng = rollback cả file

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MIGRATIONS_DIR="$SCRIPT_DIR/../supabase_migrations"
IMAC="mac@192.168.1.6"
SSH_KEY="$HOME/.ssh/imac_deploy"

TARGET="local"
BASELINE=0
for arg in "$@"; do
  case "$arg" in
    --prod) TARGET="prod" ;;
    --staging) TARGET="staging" ;;
    --baseline) BASELINE=1 ;;
    *) echo "Tham số không hợp lệ: $arg"; exit 1 ;;
  esac
done

# psql_run [flags...] — chạy psql trên DB đích, SQL đưa qua stdin
psql_run() {
  case "$TARGET" in
    prod)
      ssh -i "$SSH_KEY" "$IMAC" "/usr/local/bin/docker exec -i supabase-db psql -U postgres -d postgres $*"
      ;;
    staging)
      ssh -i "$SSH_KEY" "$IMAC" "/usr/local/bin/docker exec -i supabase-db-dev psql -U postgres -d postgres $*"
      ;;
    *)
      docker exec -i supabase-db psql -U postgres -d postgres "$@"
      ;;
  esac
}

echo "🎯 Đích: $TARGET$([ $BASELINE -eq 1 ] && echo ' (chế độ BASELINE — không thực thi SQL)')"

# 1. Tạo sổ theo dõi nếu chưa có
echo "CREATE TABLE IF NOT EXISTS schema_migrations (name text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now());" | psql_run -q

# 2. Lấy danh sách đã chạy
APPLIED=$(echo "SELECT name FROM schema_migrations;" | psql_run -tA)

# 3. Duyệt migration theo thứ tự tên file (glob tự sort, an toàn với path có dấu cách)
PENDING=0
for f in "$MIGRATIONS_DIR"/*.sql; do
  NAME=$(basename "$f")
  if echo "$APPLIED" | grep -qx "$NAME"; then
    continue
  fi
  PENDING=$((PENDING + 1))
  if [ $BASELINE -eq 1 ]; then
    echo "INSERT INTO schema_migrations (name) VALUES ('$NAME') ON CONFLICT DO NOTHING;" | psql_run -q
    echo "  📌 baseline: $NAME"
  else
    echo "  ▶ chạy: $NAME"
    # --single-transaction: lỗi giữa file = rollback cả file, sổ không ghi
    if psql_run -q -v ON_ERROR_STOP=1 --single-transaction < "$f"; then
      echo "INSERT INTO schema_migrations (name) VALUES ('$NAME') ON CONFLICT DO NOTHING;" | psql_run -q
      echo "  ✅ xong: $NAME"
    else
      echo ""
      echo "❌ MIGRATION LỖI: $NAME — đã rollback file này, DỪNG tại đây."
      echo "   Sửa file rồi chạy lại (các file trước đó đã ghi sổ, không chạy lặp)."
      exit 1
    fi
  fi
done

if [ $PENDING -eq 0 ]; then
  echo "✅ Không có migration nào chờ — schema $TARGET đã mới nhất."
else
  [ $BASELINE -eq 1 ] && echo "✅ Baseline $PENDING file." || echo "✅ Đã áp $PENDING migration."
fi
