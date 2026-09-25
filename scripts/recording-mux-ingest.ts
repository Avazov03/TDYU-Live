/**
 * Phase 8.1 — signed-only Mux ingest for ONE durable recording file.
 *
 * Dry-run by default (no Mux calls, no DB writes).
 * Apply requires CONFIRM_REAL_MUX_INGEST=true, and on production also
 * CONFIRM_PRODUCTION_RECORDING_INGEST=true. Re-running is safe (ledger + passthrough).
 *
 * Usage:
 *   npm run db:recording:mux-ingest -- --env-file <.env> --lesson <id> --storage-key <key> \
 *     [--origin legacy_recovery|live] [--apply] [--timeout-min 20]
 */

import {
  argValue,
  assertEnvConsistent,
  confirmed,
  credentialStatus,
  dbName,
  hasFlag,
  isProductionTarget,
  loadScriptEnv,
} from "./recording-script-env";

loadScriptEnv();

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function runIngest(opts: {
  lessonId: string;
  storageKey: string;
  origin: "live" | "legacy_recovery";
  expectedSha256?: string | null;
  timeoutMin: number;
}) {
  const ingest = await import("../src/lib/recording-mux-ingest");
  const started = await ingest.startRecordingMuxIngest({
    lessonId: opts.lessonId,
    storageKey: opts.storageKey,
    expectedSha256: opts.expectedSha256 ?? null,
    origin: opts.origin,
  });
  console.log(JSON.stringify({ step: "start", ...started }));
  if (started.state !== "UPLOADED" && started.state !== "REUSED") return { started, final: null };

  const deadline = Date.now() + opts.timeoutMin * 60_000;
  let delay = 10_000;
  for (;;) {
    const final = await ingest.finalizeRecordingMuxIngest({
      lessonId: opts.lessonId,
      storageKey: opts.storageKey,
      origin: opts.origin,
    });
    console.log(JSON.stringify({ step: "finalize", ...final }));
    if (final.state !== "PENDING") return { started, final };
    if (Date.now() > deadline) return { started, final: { state: "TIMEOUT" as const } };
    await sleep(delay);
    delay = Math.min(delay * 1.5, 60_000);
  }
}

async function main() {
  assertEnvConsistent();
  const lessonId = argValue("--lesson");
  const storageKey = argValue("--storage-key");
  const origin = argValue("--origin") === "live" ? "live" : "legacy_recovery";
  const timeoutMin = Number(argValue("--timeout-min") ?? 20);
  if (!lessonId || !storageKey) throw new Error("usage: --lesson <id> --storage-key <key> [--apply]");

  const creds = credentialStatus();
  const { parseRecordingStorageKey } = await import("../src/lib/recording-storage");
  const parsed = parseRecordingStorageKey(storageKey);
  const plan = { db: dbName(), lessonId, storageKey, origin, keyKind: parsed?.kind ?? "INVALID", ...creds };

  if (!hasFlag("--apply")) {
    console.log(JSON.stringify({ status: "DRY_RUN", ...plan }, null, 2));
    return;
  }
  if (!confirmed("CONFIRM_REAL_MUX_INGEST")) throw new Error("REFUSING: set CONFIRM_REAL_MUX_INGEST=true");
  if (isProductionTarget() && !confirmed("CONFIRM_PRODUCTION_RECORDING_INGEST")) {
    throw new Error("REFUSING: set CONFIRM_PRODUCTION_RECORDING_INGEST=true for production");
  }
  const result = await runIngest({ lessonId, storageKey, origin, timeoutMin });
  console.log(JSON.stringify({ status: result.final?.state ?? result.started.state, ...plan }, null, 2));
  const { prisma } = await import("../src/lib/prisma");
  await prisma.$disconnect();
}

if (process.argv[1]?.includes("recording-mux-ingest")) {
  main().catch((err) => {
    console.error(err instanceof Error ? err.message : err);
    process.exit(1);
  });
}
