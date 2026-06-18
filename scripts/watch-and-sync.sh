#!/bin/bash
# Auto-sync code lên iMac khi có file thay đổi
# Chạy: ./scripts/watch-and-sync.sh
# Dừng: Ctrl+C

IMAC_USER="mac"
IMAC_IP="192.168.1.3"
IMAC_DIR="~/cfobrain"
PROJECT_DIR="/Users/apple/phucsang app/QU-N-TR-C-A-H-NG"
APP_LABEL="com.cfobrain.app"

# Kiểm tra fswatch
if ! command -v fswatch &> /dev/null; then
  echo "⚠️  Cài fswatch trước: brew install fswatch"
  exit 1
fi

echo "👀 Đang theo dõi file thay đổi..."
echo "   Mọi thay đổi sẽ tự sync lên iMac"
echo "   Nhấn Ctrl+C để dừng"
echo ""

LAST_BUILD=0
BUILD_DELAY=5  # giây chờ sau lần thay đổi cuối trước khi build

do_sync_and_build() {
  echo "📦 Đang sync lên iMac..."
  rsync -az --delete \
    --exclude='node_modules' \
    --exclude='.git' \
    --exclude='dist' \
    --exclude='supabase' \
    --exclude='.env.local' \
    "$PROJECT_DIR/" \
    "$IMAC_USER@$IMAC_IP:$IMAC_DIR/" 2>/dev/null

  echo "🔨 Đang build..."
  ssh "$IMAC_USER@$IMAC_IP" "cd $IMAC_DIR && npm run build --silent" 2>/dev/null

  echo "🔄 Restart app..."
  ssh "$IMAC_USER@$IMAC_IP" "launchctl kickstart -k gui/\$(id -u)/$APP_LABEL 2>/dev/null" 2>/dev/null

  echo "✅ $(date '+%H:%M:%S') — Deploy xong!"
}

# Theo dõi file thay đổi (bỏ qua node_modules, dist, .git)
fswatch -o \
  --exclude='node_modules' \
  --exclude='dist' \
  --exclude='.git' \
  --exclude='*.log' \
  "$PROJECT_DIR" | while read; do
    NOW=$(date +%s)
    # Debounce: chờ 5 giây sau lần thay đổi cuối
    if [ $((NOW - LAST_BUILD)) -gt $BUILD_DELAY ]; then
      LAST_BUILD=$NOW
      do_sync_and_build
    fi
  done
