#!/bin/bash
# Deploy app lên iMac cá nhân
# Chạy từ MacBook: ./scripts/deploy-imac.sh
#
# Rollback tự động (audit 2026-07-10 mục K): trước khi ghi đè code, backup bản đang
# chạy bằng hardlink (rẻ, tức thì — không copy nội dung file không đổi). Nếu health-check
# sau deploy fail, tự động khôi phục lại bản backup + restart, rồi báo kết quả rõ ràng.
# LƯU Ý: rollback chỉ khôi phục CODE, KHÔNG khôi phục schema DB (migration không tự
# revert) — xem docs/03-deployment/ROLLBACK_RUNBOOK.md khi cần xử lý sâu hơn.

set -e

IMAC_USER="mac"
IMAC_IP="192.168.1.6"
IMAC_DIR="~/cfobrain"
BACKUP_DIR="~/cfobrain-backup-prev"
APP_LABEL="com.cfobrain.app"
SSH_KEY="$HOME/.ssh/imac_deploy"

echo "🚀 Bắt đầu deploy lên iMac..."

# Bước 0: Backup bản đang chạy (hardlink, giữ đúng 1 bản gần nhất) — có thể fail vô hại
# nếu đây là lần deploy đầu tiên (chưa có gì để backup).
echo "🧷 Backup bản hiện tại (để rollback nếu cần)..."
ssh -i $SSH_KEY "$IMAC_USER@$IMAC_IP" "rm -rf $BACKUP_DIR && cp -Rl $IMAC_DIR $BACKUP_DIR" \
  && echo "✅ Backup xong" \
  || echo "⚠️  Không backup được (có thể là lần deploy đầu tiên) — tiếp tục, không rollback được nếu lần này lỗi"

# Bước 1: Sync code
echo "📦 Đang copy code lên iMac..."
rsync -az --delete \
  -e "ssh -i $SSH_KEY" \
  --exclude='node_modules' \
  --exclude='.git' \
  --exclude='dist' \
  --exclude='supabase' \
  --exclude='.env.local' \
  "/Users/apple/phucsang app/QU-N-TR-C-A-H-NG/" \
  "$IMAC_USER@$IMAC_IP:$IMAC_DIR/"

echo "✅ Copy xong"

# Bước 1.6: Chạy migration SQL còn thiếu trên DB prod (sổ theo dõi: bảng schema_migrations)
# Lỗi migration = DỪNG deploy (set -e) — code mới không lên khi schema hỏng
echo "🗃  Kiểm tra & chạy migration trên DB prod..."
"$(cd "$(dirname "$0")" && pwd)/apply-migrations.sh" --prod

# Bước 1.5: Inject build timestamp vào Service Worker để browser phát hiện version mới
BUILD_TIME=$(date +%Y%m%d%H%M%S)
echo "🔖 SW version: $BUILD_TIME"
ssh -i $SSH_KEY "$IMAC_USER@$IMAC_IP" "sed -i '' \"s/cfo-brain-v[0-9a-zA-Z.]*/cfo-brain-v$BUILD_TIME/g\" $IMAC_DIR/public/service-worker.js"

# Bước 2: Build trên iMac
echo "🔨 Đang build trên iMac..."
ssh -i $SSH_KEY "$IMAC_USER@$IMAC_IP" "export PATH=/usr/local/bin:/usr/bin:/bin:\$PATH && cd $IMAC_DIR && npm install --silent && npm run build"

echo "✅ Build xong"

# Bước 3: Restart app
echo "🔄 Đang restart app..."
ssh -i $SSH_KEY "$IMAC_USER@$IMAC_IP" "export PATH=/usr/local/bin:/usr/bin:/bin:\$PATH && launchctl kickstart -k gui/\$(id -u)/$APP_LABEL 2>/dev/null || launchctl start $APP_LABEL"

echo "✅ Restart xong"

# Poll /health tối đa 15 lần (1s/lần) NGAY TRÊN iMac (1 lần ssh, tránh round-trip mạng mỗi
# lần thử) thay vì sleep cố định — tsx (chạy TS trực tiếp, không phải build sẵn) + kết nối
# DB đầu tiên có thể mất hơn vài giây để sẵn sàng, sleep cố định ngắn từng gây rollback
# NHẦM dù app thực ra lên khỏe (xảy ra thật ở lần deploy 2026-07-10 lúc 23:55).
# `|| echo CURL_FAILED` bên trong BẮT BUỘC — nếu không, curl fail (ECONNREFUSED lúc app
# chưa kịp bind port) làm cả vòng lặp remote thoát sớm, và với `set -e` phía LOCAL script
# sẽ THOÁT NGAY khi gán biến, bỏ qua toàn bộ logic rollback bên dưới (đã xảy ra thật —
# exit code 7 — ở lần chạy đầu tiên 2026-07-10 lúc 23:51).
wait_for_health() {
  ssh -i $SSH_KEY "$IMAC_USER@$IMAC_IP" '
    for i in $(seq 1 15); do
      STATUS=$(curl -s http://localhost:3000/health 2>/dev/null || echo CURL_FAILED)
      if [ "$STATUS" = "OK" ]; then echo OK; exit 0; fi
      sleep 1
    done
    echo "$STATUS"
  '
}

# Bước 4: Kiểm tra — health-check giờ verify DB thật (xem server.ts), nên "OK" nghĩa là
# app VÀ Supabase đều phản hồi, không chỉ process còn sống.
STATUS=$(wait_for_health)
if [ "$STATUS" = "OK" ]; then
  echo ""
  echo "✅ Deploy thành công! App đang chạy tại:"
  echo "   🌐 https://cfobrain.phucsang.com.vn"
  echo "   🏠 http://$IMAC_IP:3000"
  exit 0
fi

# Bước 5: Health-check fail → thử tự động rollback về bản backup (nếu có)
echo "⚠️  App chưa phản hồi đúng (trả về: '$STATUS') — thử rollback tự động..."
HAS_BACKUP=$(ssh -i $SSH_KEY "$IMAC_USER@$IMAC_IP" "[ -d $BACKUP_DIR ] && echo yes || echo no")
if [ "$HAS_BACKUP" != "yes" ]; then
  echo "❌ Không có bản backup để rollback (có thể là lần deploy đầu tiên)."
  echo "   Kiểm tra log: ssh -i $SSH_KEY $IMAC_USER@$IMAC_IP 'tail -50 /tmp/cfobrain-app.log'"
  echo "   Xem thêm: docs/03-deployment/ROLLBACK_RUNBOOK.md"
  exit 1
fi

ssh -i $SSH_KEY "$IMAC_USER@$IMAC_IP" "
  rm -rf ${IMAC_DIR}-failed
  mv $IMAC_DIR ${IMAC_DIR}-failed
  mv $BACKUP_DIR $IMAC_DIR
  export PATH=/usr/local/bin:/usr/bin:/bin:\$PATH
  launchctl kickstart -k gui/\$(id -u)/$APP_LABEL 2>/dev/null || launchctl start $APP_LABEL
"
STATUS2=$(wait_for_health)
if [ "$STATUS2" = "OK" ]; then
  echo "↩️  Đã ROLLBACK thành công — app đang chạy lại code CŨ (bản deploy lỗi giữ tại ${IMAC_DIR}-failed để debug)."
  echo "   ⚠️  Nếu migration mới đã chạy ở Bước 1.6, schema DB KHÔNG được revert — xem docs/03-deployment/ROLLBACK_RUNBOOK.md"
  exit 1
else
  echo "❌ Rollback cũng thất bại — CẦN CAN THIỆP THỦ CÔNG NGAY."
  echo "   SSH vào máy: ssh -i $SSH_KEY $IMAC_USER@$IMAC_IP"
  echo "   Xem: docs/03-deployment/ROLLBACK_RUNBOOK.md"
  exit 1
fi
