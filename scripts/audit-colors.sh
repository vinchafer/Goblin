#!/bin/bash
grep -rn "#2D4A2B\|#D4A94A\|#3A2E1F\|#F7F4ED\|#EDE8DC\|#F0EBE0\|#6B6B6B\|#2A2A2A\|#9C9589\|#c9933a\|#4a7c3b\|#3A5A37\|#EDE8DC\|#DDD7CC\|#f7f3ec\|#e4ddd2\|#1a1a1a\|#6b6560\|#c8c0b4\|#4A4A4A" \
  apps/web/components --include="*.tsx" --include="*.ts" --include="*.css" \
  > color-audit.txt 2>/dev/null

echo "Total hardcoded color occurrences: $(wc -l < color-audit.txt)"
echo ""
echo "Top colors by frequency:"
grep -oP '#[0-9a-fA-F]{3,8}' color-audit.txt | sort | uniq -c | sort -rn | head -30
