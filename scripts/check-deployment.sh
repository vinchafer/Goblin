#!/bin/bash
set -euo pipefail

API_URL="${API_URL:-https://api.justgoblin.com}"

echo "=== GOBLIN DEPLOYMENT CHECK ==="
echo ""
echo "Web (Vercel):"
curl -sf https://justgoblin.com/api/version | jq . || echo "  ERROR: web unreachable"
echo ""
echo "API (Railway):"
curl -sf "${API_URL}/version" | jq . || echo "  ERROR: API unreachable"
echo ""
echo "If both show the same git commit: deployment successful."
echo "If commits differ or service unreachable: check Railway/Vercel logs."
