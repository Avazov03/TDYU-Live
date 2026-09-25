#!/usr/bin/env bash
# PowerShell-safe remote inventory runner.
# Usage on server:
#   bash scripts/run-recording-mux-inventory.sh staging
#   bash scripts/run-recording-mux-inventory.sh production
#
# READ-ONLY. Never runs migration apply. Never prints secrets.

set -euo pipefail

TARGET="${1:-staging}"
case "$TARGET" in
  staging) APP=/var/www/tdyu-live-staging ;;
  production) APP=/var/www/tdyu-live ;;
  *) echo "Usage: $0 staging|production"; exit 1 ;;
esac

cd "$APP"

python3 - <<'PY'
from urllib.parse import urlparse
from pathlib import Path
import os, sys
target = os.environ.get("INV_TARGET", "")
line = [l for l in Path(".env").read_text().splitlines() if l.startswith("DATABASE_URL=")][0]
u = urlparse(line.split("=", 1)[1].strip().strip('"').strip("'"))
path = u.path
print("DB_PATH", path)
if target == "staging" and path != "/tdyulive_staging":
    print("REFUSING: staging target but DB is", path)
    sys.exit(2)
if target == "production" and path == "/tdyulive_staging":
    print("REFUSING: production target but staging DB")
    sys.exit(2)
PY

export INV_TARGET="$TARGET"
export AUDIT_ONLY=true
export RECORDING_MIGRATION_MODE=inventory

# Load env without printing secrets
set -a
# shellcheck disable=SC1091
. ./.env
set +a

echo "TARGET=$TARGET"
echo "PORT=${PORT:-unset}"
echo "LEXIFY_ENV=${LEXIFY_ENV:-unset}"
echo "MUX_TOKEN_ID_PRESENT=$([ -n "${MUX_TOKEN_ID:-}" ] && echo yes || echo no)"
echo "MUX_TOKEN_SECRET_PRESENT=$([ -n "${MUX_TOKEN_SECRET:-}" ] && echo yes || echo no)"
echo "PROD_PID=$(pm2 pid tdyu-live 2>/dev/null || echo unknown)"

# Never pass --apply
npx tsx scripts/recording-mux-inventory.ts

echo "PROD_PID_AFTER=$(pm2 pid tdyu-live 2>/dev/null || echo unknown)"
echo "INVENTORY_OK"
