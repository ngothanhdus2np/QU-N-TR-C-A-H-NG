#!/bin/bash

# Script kiểm tra cấu trúc tài liệu
# Sử dụng: ./scripts/check-docs-structure.sh

echo "🔍 Kiểm tra cấu trúc tài liệu..."
echo ""

# Đếm file .md ở root (trừ README.md)
md_files=$(ls *.md 2>/dev/null | grep -v "README.md")
count=$(echo "$md_files" | grep -c "^" 2>/dev/null || echo 0)

if [ "$count" -gt 0 ]; then
    echo "❌ Phát hiện $count file .md không đúng vị trí ở root:"
    echo ""
    echo "$md_files" | sed 's/^/  - /'
    echo ""
    echo "📋 QUY ĐỊNH:"
    echo "  • File .md KHÔNG ĐƯỢC phép ở thư mục gốc (trừ README.md)"
    echo "  • Vui lòng di chuyển vào docs/ theo loại"
    echo ""
    echo "📁 Gợi ý di chuyển:"
    echo ""
    
    # Gợi ý di chuyển dựa trên tên file
    while IFS= read -r file; do
        if [[ "$file" == *"ANALYSIS"* ]] || [[ "$file" == *"FIX"* ]] || [[ "$file" == *"TEST"* ]] || [[ "$file" == *"COMPLETION"* ]]; then
            echo "  mv $file docs/02-development/"
        elif [[ "$file" == *"DEPLOYMENT"* ]] || [[ "$file" == *"SYNC"* ]] || [[ "$file" == *"SETUP"* ]]; then
            echo "  mv $file docs/03-deployment/"
        elif [[ "$file" == *"MOBILE"* ]] || [[ "$file" == *"TESTFLIGHT"* ]] || [[ "$file" == *"APP_STORE"* ]]; then
            echo "  mv $file docs/04-mobile/"
        else
            echo "  # Xác định loại và di chuyển: $file"
        fi
    done <<< "$md_files"
    
    echo ""
    echo "📖 Xem chi tiết: docs/DOCUMENTATION_GUIDELINES.md"
    echo ""
    exit 1
else
    echo "✅ Cấu trúc tài liệu đúng quy định!"
    echo ""
    echo "📊 Thống kê:"
    echo "  • File .md ở root: 1 (README.md)"
    echo "  • File .md trong docs/: $(find docs -name '*.md' | wc -l | tr -d ' ')"
    echo ""
    echo "📁 Cấu trúc docs/:"
    for dir in docs/*/; do
        if [ -d "$dir" ]; then
            count=$(find "$dir" -maxdepth 1 -name '*.md' | wc -l | tr -d ' ')
            echo "  • $(basename "$dir"): $count files"
        fi
    done
    echo ""
    exit 0
fi
