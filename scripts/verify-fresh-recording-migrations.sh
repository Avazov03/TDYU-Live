#!/usr/bin/env bash
# Fresh disposable DB: apply all Prisma migrations (verify chain).
# Creates DB tdyulive_migrate_verify, migrates, drops. No production touch.
set -euo pipefail
cd /var/www/tdyu-live-staging
python3 - <<'PY'
from pathlib import Path
from urllib.parse import urlparse, urlunparse
env={}
for line in Path(".env").read_text(encoding="utf-8", errors="replace").splitlines():
    line=line.strip()
    if not line or line.startswith("#") or "=" not in line: continue
    k,v=line.split("=",1)
    env[k]=v.strip().strip('"').strip("'")
u=urlparse(env["DATABASE_URL"])
# admin connection to postgres db
admin=u._replace(path="/postgres")
verify=u._replace(path="/tdyulive_migrate_verify")
print(f"export ADMIN_URL={urlunparse(admin).split('?',1)[0]!r}")
print(f"export VERIFY_URL={urlunparse(verify)!r}")
print(f"export VERIFY_BASE={urlunparse(verify).split('?',1)[0]!r}")
PY
eval "$(python3 - <<'PY'
from pathlib import Path
from urllib.parse import urlparse, urlunparse
env={}
for line in Path(".env").read_text(encoding="utf-8", errors="replace").splitlines():
    line=line.strip()
    if not line or line.startswith("#") or "=" not in line: continue
    k,v=line.split("=",1)
    env[k]=v.strip().strip('"').strip("'")
u=urlparse(env["DATABASE_URL"])
admin=u._replace(path="/postgres")
verify=u._replace(path="/tdyulive_migrate_verify")
print(f"export ADMIN_URL={urlunparse(admin).split('?',1)[0]!r}")
print(f"export VERIFY_URL={urlunparse(verify)!r}")
print(f"export VERIFY_BASE={urlunparse(verify).split('?',1)[0]!r}")
PY
)"

echo "Drop/create verify DB"
psql "$ADMIN_URL" -v ON_ERROR_STOP=1 -c "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname='tdyulive_migrate_verify' AND pid <> pg_backend_pid();" || true
psql "$ADMIN_URL" -v ON_ERROR_STOP=1 -c "DROP DATABASE IF EXISTS tdyulive_migrate_verify;"
psql "$ADMIN_URL" -v ON_ERROR_STOP=1 -c "CREATE DATABASE tdyulive_migrate_verify;"

export DATABASE_URL="$VERIFY_URL"
npx prisma migrate deploy
psql "$VERIFY_BASE" -tAc "SELECT to_regclass('public.recordings');" | grep -qx recordings
psql "$VERIFY_BASE" -tAc "SELECT 1 FROM pg_type WHERE typname='RecordingStatus';" | grep -qx 1
psql "$ADMIN_URL" -v ON_ERROR_STOP=1 -c "DROP DATABASE IF EXISTS tdyulive_migrate_verify;"
echo FRESH_MIGRATE_OK
