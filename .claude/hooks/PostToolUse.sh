#!/bin/bash
# Chạy tự động sau mỗi lần Edit hoặc Write file TypeScript
# Phát hiện lỗi type ngay lập tức, trước khi Claude tiếp tục

INPUT=$(cat)

FILE_PATH=$(echo "$INPUT" | python3 -c "
import sys, json
try:
    d = json.load(sys.stdin)
    print(d.get('tool_input', {}).get('file_path', ''))
except:
    print('')
" 2>/dev/null)

# Chỉ chạy nếu là file .ts hoặc .tsx
if [[ "$FILE_PATH" == *.ts || "$FILE_PATH" == *.tsx ]]; then
  cd "/Users/apple/phucsang app/QU-N-TR-C-A-H-NG"
  RESULT=$(npx tsc --noEmit 2>&1)
  if [ -n "$RESULT" ]; then
    echo "⚠️  TypeScript errors (PostToolUse hook):"
    echo "$RESULT" | head -30
    exit 2
  fi
fi
