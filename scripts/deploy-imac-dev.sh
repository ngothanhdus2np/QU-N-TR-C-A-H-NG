#!/bin/bash
# Deploy app lên môi trường DEV/staging trên iMac (tách biệt hoàn toàn khỏi prod)
# Chạy từ MacBook: ./scripts/deploy-imac-dev.sh
#
# Khác với deploy-imac.sh (prod):
#   - Thư mục code riêng: ~/cfobrain-dev (không đụng ~/cfobrain của prod)
#   - launchd service riêng: com.cfobrain.app.dev (không đụng com.cfobrain.app)
#   - Migration chạy vào Supabase DEV riêng (container supabase-db-dev, port 8010)
#     — không chạm DB prod (supabase-db, port 8000)
#   - App chạy port 3010, public qua https://dev.phucsang.com.vn

set -e

IMAC_USER="mac"
IMAC_IP="192.168.1.2"
IMAC_DIR="~/cfobrain-dev"
APP_LABEL="com.cfobrain.app.dev"
SSH_KEY="$HOME/.ssh/imac_deploy"

echo "🚀 Bắt đầu deploy lên iMac (DEV)..."

# Bước 1: Sync code
echo "📦 Đang copy code lên iMac (~/cfobrain-dev)..."
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

# Bước 1.6: Chạy migration SQL còn thiếu trên DB dev/staging (KHÔNG đụng DB prod)
echo "🗃  Kiểm tra & chạy migration trên DB staging..."
"$(cd "$(dirname "$0")" && pwd)/apply-migrations.sh" --staging

# Bước 1.5: Inject build timestamp vào Service Worker
BUILD_TIME=$(date +%Y%m%d%H%M%S)
echo "🔖 SW version: $BUILD_TIME"
ssh -i $SSH_KEY "$IMAC_USER@$IMAC_IP" "sed -i '' \"s/cfo-brain-v[0-9a-zA-Z.]*/cfo-brain-v$BUILD_TIME/g\" $IMAC_DIR/public/service-worker.js"

# Bước 2: Build trên iMac
echo "🔨 Đang build trên iMac..."
ssh -i $SSH_KEY "$IMAC_USER@$IMAC_IP" "export PATH=/usr/local/bin:/usr/bin:/bin:\$PATH && cd $IMAC_DIR && npm install --silent && npm run build"

echo "✅ Build xong"

# Bước 3: Restart app dev
echo "🔄 Đang restart app (dev)..."
ssh -i $SSH_KEY "$IMAC_USER@$IMAC_IP" "export PATH=/usr/local/bin:/usr/bin:/bin:\$PATH && launchctl kickstart -k gui/\$(id -u)/$APP_LABEL 2>/dev/null || launchctl start $APP_LABEL"

echo "✅ Restart xong"

# Bước 4: Kiểm tra
sleep 3
STATUS=$(ssh -i $SSH_KEY "$IMAC_USER@$IMAC_IP" "curl -s http://localhost:3010/health")
if [ "$STATUS" = "OK" ]; then
  echo ""
  echo "✅ Deploy DEV thành công! App đang chạy tại:"
  echo "   🌐 https://dev.phucsang.com.vn"
else
  echo "⚠️  App dev chưa phản hồi, kiểm tra log: ssh $IMAC_USER@$IMAC_IP 'tail -50 /tmp/cfobrain-app-dev.log'"
fi
