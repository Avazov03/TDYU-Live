#!/usr/bin/env bash
# Fresh disposable DB: apply all Prisma migrations (verify chain).
# Never prints DATABASE_URL / passwords.
# Creates DB tdyulive_migrate_verify, migrates, drops.
set -euo pipefail
cd /var/www/tdyu-live-staging

# Prefer local peer/superuser for CREATE DATABASE; fall back to staging role.
ADMIN_PSQL="psql -v ON_ERROR_STOP=1"
if sudo -u postgres psql -tAc "SELECT 1" >/dev/null 2>&1; then
  ADMIN_PSQL="sudo -u postgres psql -v ON_ERROR_STOP=1"
elif command -v psql >/dev/null && psql -d postgres -tAc "SELECT 1" >/dev/null 2>&1; then
  ADMIN_PSQL="psql -d postgres -v ON_ERROR_STOP=1"
fi

echo "Using admin psql for CREATE DATABASE (role not printed)"
$ADMIN_PSQL -c "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname='tdyulive_migrate_verify' AND pid <> pg_backend_pid();" >/dev/null 2>&1 || true
$ADMIN_PSQL -c "DROP DATABASE IF EXISTS tdyulive_migrate_verify;"
$ADMIN_PSQL -c "CREATE DATABASE tdyulive_migrate_verify OWNER CURRENT_USER;"

# Build verify URL from staging .env host/user but swap DB name — without echoing.
export DATABASE_URL
DATABASE_URL="$(python3 - <<'PY'
from pathlib import Path
from urllib.parse import urlparse, urlunparse
env={}
for line in Path(".env").read_text(encoding="utf-8", errors="replace").splitlines():
    line=line.strip()
    if not line or line.startswith("#") or "=" not in line: continue
    k,v=line.split("=",1)
    env[k]=v.strip().strip('"').strip("'")
u=urlparse(env["DATABASE_URL"])
# If staging role cannot connect to new DB owned by postgres, use peer via unix — try staging creds with new db name
print(urlunparse(u._replace(path="/tdyulive_migrate_verify")))
PY
)"

# Grant connect to staging role if needed
STAGING_ROLE=$(python3 - <<'PY'
from pathlib import Path
from urllib.parse import urlparse
env={}
for line in Path(".env").read_text(encoding="utf-8", errors="replace").splitlines():
    line=line.strip()
    if not line or line.startswith("#") or "=" not in line: continue
    k,v=line.split("=",1)
    env[k]=v.strip().strip('"').strip("'")
print(urlparse(env["DATABASE_URL"]).username or "")
PY
)
if [[ -n "$STAGING_ROLE" ]]; then
  $ADMIN_PSQL -d tdyulive_migrate_verify -c "GRANT ALL ON SCHEMA public TO \"$STAGING_ROLE\";" >/dev/null 2>&1 || true
  $ADMIN_PSQL -c "GRANT ALL PRIVILEGES ON DATABASE tdyulive_migrate_verify TO \"$STAGING_ROLE\";" >/dev/null 2>&1 || true
  $ADMIN_PSQL -c "ALTER DATABASE tdyulive_migrate_verify OWNER TO \"$STAGING_ROLE\";" >/dev/null 2>&1 || true
fi

echo "Running prisma migrate deploy on disposable DB (URL masked)"
npx prisma migrate deploy
$ADMIN_PSQL -d tdyulive_migrate_verify -tAc "SELECT to_regclass('public.recordings');" | grep -qx recordings
$ADMIN_PSQL -d tdyulive_migrate_verify -tAc "SELECT 1 FROM pg_type WHERE typname='RecordingStatus';" | grep -qx 1
$ADMIN_PSQL -c "DROP DATABASE IF EXISTS tdyulive_migrate_verify;"
echo FRESH_MIGRATE_OK
