/**
 * Deploy gate: exits 0 only when the commit being deployed is proven green.
 *
 *   npm run ci:gate               # HEAD
 *   npx tsx scripts/require-green-ci.ts <sha> [--wait]
 *
 * Proof, in order: the GitHub Actions CI run for that commit (needs an authenticated `gh`), or — while
 * the workflow is not on GitHub yet — a local stamp written by a full, clean `npm run test:e2e:full`
 * on exactly that commit (.e2e-stamps/<sha>.json). A failed CI run is never overridden by a stamp.
 * --wait polls (up to 30 min) while the run is queued/in progress.
 */
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

const args = process.argv.slice(2);
const wait = args.includes("--wait");
const sha = execFileSync("git", ["rev-parse", args.find((a) => !a.startsWith("--")) ?? "HEAD"], {
  encoding: "utf8",
}).trim();
const short = sha.slice(0, 7);

type Run = { databaseId: number; status: string; conclusion: string; url: string };

function runsFor(commit: string): Run[] | null {
  try {
    const out = execFileSync(
      "gh",
      ["run", "list", "--workflow", "ci.yml", "--commit", commit, "--json", "databaseId,status,conclusion,url", "--limit", "5"],
      { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] },
    );
    return JSON.parse(out) as Run[];
  } catch {
    return null;
  }
}

function localStamp(): { passedAt: string } | null {
  const file = path.resolve(__dirname, "..", ".e2e-stamps", `${sha}.json`);
  if (!existsSync(file)) return null;
  const stamp = JSON.parse(readFileSync(file, "utf8")) as { sha: string; passedAt: string };
  return stamp.sha === sha ? stamp : null;
}

function passWithStampOrFail(reason: string): never {
  const stamp = localStamp();
  if (stamp) {
    console.log(`ci:gate — ${reason}; local full hermetic suite passed on ${short} at ${stamp.passedAt}`);
    process.exit(0);
  }
  console.error(`ci:gate — ${reason} and no local stamp. Run npm run test:e2e:full on a clean ${short}.`);
  process.exit(1);
}

async function main() {
  const deadline = Date.now() + 30 * 60_000;
  for (;;) {
    const runs = runsFor(sha);
    if (runs === null) passWithStampOrFail("GitHub CI unavailable (no ci.yml on GitHub or gh not authenticated)");
    const [latest] = runs;
    if (!latest) passWithStampOrFail(`no CI run for ${short}`);
    if (latest.status === "completed") {
      if (latest.conclusion === "success") {
        console.log(`ci:gate — green for ${short} (${latest.url})`);
        return;
      }
      console.error(`ci:gate — CI ${latest.conclusion} for ${short}: ${latest.url}`);
      process.exit(1);
    }
    if (!wait || Date.now() > deadline) {
      console.error(`ci:gate — CI still ${latest.status} for ${short}: ${latest.url} (use --wait)`);
      process.exit(1);
    }
    console.log(`ci:gate — ${latest.status}, waiting… ${latest.url}`);
    await new Promise((r) => setTimeout(r, 20_000));
  }
}

main().catch((err) => {
  console.error("ci:gate —", err instanceof Error ? err.message : err);
  process.exit(1);
});
