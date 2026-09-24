#!/usr/bin/env bash
# Staging Next.js entry — loads .env into the process so FF_* are deterministic.
# PM2-injected env previously shadowed .env file values (Next does not override existing keys).
set -euo pipefail
cd "$(dirname "$0")"
if [ -f .env ]; then
  set -a
  # shellcheck disable=SC1091
  source .env
  set +a
fi
exec ./node_modules/.bin/next start -p "${PORT:-3101}"
