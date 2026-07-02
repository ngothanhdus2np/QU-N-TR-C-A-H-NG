#!/bin/bash
# Deploy app lên iMac cá nhân
# Chạy từ MacBook: ./scripts/deploy-imac.sh

set -e

IMAC_USER="mac"
IMAC_IP="192.168.1.3"
IMAC_DIR="~/cfobrain"
APP_LABEL="com.cfobrain.app"
SSH_KEY="$HOME/.ssh/imac_deploy"

echo "🚀 Bắt đầu deploy lên iMac..."

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

# Bước 4: Kiểm tra
sleep 3
STATUS=$(ssh -i $SSH_KEY "$IMAC_USER@$IMAC_IP" "curl -s http://localhost:3000/health")
if [ "$STATUS" = "OK" ]; then
  echo ""
  echo "✅ Deploy thành công! App đang chạy tại:"
  echo "   🌐 https://cfobrain.phucsang.com.vn"
  echo "   🏠 http://192.168.1.3:3000"
else
  echo "⚠️  App chưa phản hồi, kiểm tra log: ssh $IMAC_USER@$IMAC_IP 'tail -50 /tmp/cfobrain-app.log'"
fi
