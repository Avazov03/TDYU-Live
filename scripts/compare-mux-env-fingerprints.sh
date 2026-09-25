#!/usr/bin/env bash
# Compare staging vs production env fingerprints (no secret values).
set -euo pipefail
python3 - <<'PY'
from pathlib import Path
import hashlib

def fp(path: str, key: str) -> str:
    p = Path(path)
    if not p.exists():
        return "absent"
    for line in p.read_text().splitlines():
        if line.startswith(key + "="):
            val = line.split("=", 1)[1].strip().strip('"').strip("'")
            if not val:
                return "empty"
            return hashlib.sha256(val.encode()).hexdigest()[:12]
    return "absent"

s = "/var/www/tdyu-live-staging/.env"
p = "/var/www/tdyu-live/.env"
print("PROD_PID=", Path("/home/ubuntu/.pm2/pids/tdyu-live-3.pid").read_text().strip() if Path("/home/ubuntu/.pm2/pids/tdyu-live-3.pid").exists() else "unknown")
for k in ["MUX_TOKEN_ID", "MUX_TOKEN_SECRET", "DATABASE_URL", "MUX_SIGNING_KEY_ID"]:
    sf, pf = fp(s, k), fp(p, k)
    if sf == "absent" and pf == "absent":
        cmp = "BOTH_ABSENT"
    elif sf == pf:
        cmp = "SAME"
    else:
        cmp = "DIFFERENT"
    print(f"{k}: staging_fp={sf} prod_fp={pf} cmp={cmp}")
    if k.startswith("MUX_TOKEN") and cmp == "SAME" and sf not in ("absent", "empty"):
        print("STOP: staging and production share Mux credential fingerprint")
        raise SystemExit(3)
print("ENV_SEPARATION_OK")
PY
