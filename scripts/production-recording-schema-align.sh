#!/usr/bin/env bash
# Production Recording schema alignment (Prisma migrate deploy).
# Modes: backup | counts | deploy | verify
# NO Mux. NO Recording row backfill. NO PM2 reload. NO feature flags.
set -euo pipefail

MODE="${1:?usage: $0 backup|counts|deploy|verify}"
PROD_APP=/var/www/tdyu-live
STAGING_APP=/var/www/tdyu-live-staging
BACKUP_DIR=/home/ubuntu/backups/tdyu-live
COMMIT="${DEPLOY_COMMIT:-}"

parse_prod_env() {
  python3 - <<'PY'
from pathlib import Path
from urllib.parse import urlparse
env={}
for line in Path("/var/www/tdyu-live/.env").read_text(encoding="utf-8", errors="replace").splitlines():
    line=line.strip()
    if not line or line.startswith("#") or "=" not in line: continue
    k,v=line.split("=",1)
    env[k]=v.strip().strip('"').strip("'")
db=env["DATABASE_URL"]
u=urlparse(db)
name=u.path.lstrip("/")
if name != "tdyulive":
    raise SystemExit(f"REFUSING: expected DB tdyulive, got {name!r}")
if "staging" in name:
    raise SystemExit("REFUSING: staging DB")
base=db.split("?",1)[0]
Path("/tmp/prod-db-base.url").write_text(base)
Path("/tmp/prod-db-name.txt").write_text(name)
Path("/tmp/prod-db-host.txt").write_text(u.hostname or "")
# full URL for prisma — keep only in /tmp with 600
Path("/tmp/prod-database-url.txt").write_text(db)
print("DB_NAME", name)
print("DB_HOST", u.hostname)
PY
  chmod 600 /tmp/prod-database-url.txt /tmp/prod-db-base.url 2>/dev/null || true
}

psql_prod() {
  local base
  base=$(cat /tmp/prod-db-base.url)
  psql "$base" "$@"
}

case "$MODE" in
  backup)
    parse_prod_env
    mkdir -p "$BACKUP_DIR"
    STAMP=$(date -u +%Y%m%dT%H%M%SZ)
    OUT="$BACKUP_DIR/tdyulive-pre-recording-schema-$STAMP.dump"
    echo "BACKUP_START path=$OUT"
    pg_dump --format=custom --file="$OUT" "$(cat /tmp/prod-db-base.url)"
    ls -lh "$OUT"
    test -s "$OUT"
    echo "BACKUP_VERIFIED=YES"
    echo "BACKUP_PATH=$OUT"
    ;;

  counts)
    parse_prod_env
    echo "PROD_PID=$(pm2 pid tdyu-live)"
    echo "DB_NAME=$(cat /tmp/prod-db-name.txt)"
    psql_prod -v ON_ERROR_STOP=1 <<'SQL'
SELECT 'users' AS t, COUNT(*)::text AS c FROM users
UNION ALL SELECT 'courses', COUNT(*)::text FROM courses
UNION ALL SELECT 'lessons', COUNT(*)::text FROM lessons
UNION ALL SELECT 'payments', COUNT(*)::text FROM payments
UNION ALL SELECT 'subscriptions', COUNT(*)::text FROM subscriptions
UNION ALL SELECT 'entitlements', COUNT(*)::text FROM entitlements
UNION ALL SELECT 'purchases', COALESCE((SELECT COUNT(*)::text FROM information_schema.tables WHERE table_name='purchases' AND table_schema='public'),'0')
;
SQL
    # safer per-table
    for t in users courses lessons payments subscriptions entitlements purchases enrollments recordings live_sessions; do
      exists=$(psql_prod -tAc "SELECT to_regclass('public.$t');")
      if [ -n "$exists" ]; then
        echo "$t $(psql_prod -tAc "SELECT COUNT(*) FROM $t;")"
      else
        echo "$t ABSENT"
      fi
    done
    echo "MUX_IDS"
    psql_prod -tAc "SELECT id || '|' || mux_vod_playback_id FROM lessons WHERE mux_vod_playback_id IS NOT NULL ORDER BY id;"
    echo "MIGRATIONS"
    psql_prod -tAc 'SELECT migration_name FROM "_prisma_migrations" WHERE finished_at IS NOT NULL ORDER BY finished_at;'
    ;;

  verify)
    parse_prod_env
    echo "PROD_PID=$(pm2 pid tdyu-live)"
    rec=$(psql_prod -tAc "SELECT to_regclass('public.recordings');")
    test "$rec" = "recordings"
    enum=$(psql_prod -tAc "SELECT 1 FROM pg_type WHERE typname='RecordingStatus';")
    test "$enum" = "1"
    live=$(psql_prod -tAc "SELECT to_regclass('public.live_sessions');")
    test "$live" = "live_sessions"
    echo "RECORDINGS_COLS"
    psql_prod -tAc "SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name='recordings' ORDER BY ordinal_position;"
    echo "INDEXES"
    psql_prod -tAc "SELECT indexname FROM pg_indexes WHERE tablename='recordings' ORDER BY indexname;"
    echo "MUX_IDS"
    psql_prod -tAc "SELECT id || '|' || mux_vod_playback_id FROM lessons WHERE mux_vod_playback_id IS NOT NULL ORDER BY id;"
    curl -sS -o /dev/null -w "PROD_HTTP=%{http_code}\n" https://lexify.zonic.fit/
    echo "PROD_PID_AFTER=$(pm2 pid tdyu-live)"
    (grep -E '^FF_RECORDING' "$PROD_APP/.env" || echo "PROD_RECORDING_FF=none")
    echo SCHEMA_VERIFY_OK
    ;;

  deploy)
    parse_prod_env
    echo "=== PRE COUNTS ==="
    bash "$0" counts | tee /tmp/prod-schema-pre.txt
    PRE_MUX=$(psql_prod -tAc "SELECT id || '|' || mux_vod_playback_id FROM lessons WHERE mux_vod_playback_id IS NOT NULL ORDER BY id;")
    echo "=== ENSURE MIGRATION FILES ==="
    cd "$STAGING_APP"
    git fetch --all --tags
    if [[ -n "$COMMIT" ]]; then
      git checkout "$COMMIT"
    fi
    echo "GIT_HEAD=$(git rev-parse HEAD)"
    echo "=== PRISMA MIGRATE DEPLOY (PRODUCTION DB) ==="
    export DATABASE_URL
    DATABASE_URL="$(cat /tmp/prod-database-url.txt)"
    export DATABASE_URL
    export LEXIFY_ENV=production
    export PORT=3100
    npx prisma migrate deploy
    echo "=== POST VERIFY ==="
    bash "$0" verify
    POST_MUX=$(psql_prod -tAc "SELECT id || '|' || mux_vod_playback_id FROM lessons WHERE mux_vod_playback_id IS NOT NULL ORDER BY id;")
    if [[ "$PRE_MUX" != "$POST_MUX" ]]; then
      echo "FATAL: Mux lesson playback IDs changed"
      echo "PRE=$PRE_MUX"
      echo "POST=$POST_MUX"
      exit 3
    fi
    echo "MUX_IDS_UNCHANGED=YES"
    bash "$0" counts | tee /tmp/prod-schema-post.txt
    echo DEPLOY_OK
    ;;

  *)
    echo "unknown mode"; exit 1
    ;;
esac
