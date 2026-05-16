#!/bin/bash
# Inject TODO + HISTORY context once per session

PROJECT_DIR="/Users/apple/phucsang app/QU-N-TR-C-A-H-NG"
TODO_FILE="$PROJECT_DIR/docs/05-process/TODO.md"
HISTORY_FILE="$PROJECT_DIR/docs/05-process/HISTORY.md"

TODO_CONTENT=""
HISTORY_CONTENT=""

if [ -f "$TODO_FILE" ]; then
  TODO_CONTENT=$(cat "$TODO_FILE")
fi

if [ -f "$HISTORY_FILE" ]; then
  HISTORY_CONTENT=$(head -n 50 "$HISTORY_FILE")
fi

CONTEXT="=== ĐẦU CA: ĐỌC BẮT BUỘC ===

--- TODO.md (việc đang chờ) ---
$TODO_CONTENT

--- HISTORY.md (50 dòng đầu — context phiên trước) ---
$HISTORY_CONTENT

=== KẾT THÚC CONTEXT ===
Quy trình bắt buộc: CLARIFY → CONFIRM → IMPLEMENT → REPORT. KHÔNG code trước khi user xác nhận."

# Escape for JSON using python3
python3 -c "
import sys, json
ctx = sys.stdin.read()
print(json.dumps({
  'hookSpecificOutput': {
    'hookEventName': 'SessionStart',
    'additionalContext': ctx
  }
}))
" <<< "$CONTEXT"
