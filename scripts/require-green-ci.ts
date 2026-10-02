/**
 * Deploy gate: exits 0 only when the CI workflow succeeded for the commit being deployed.
 *
 *   npm run ci:gate               # HEAD
 *   npx tsx scripts/require-green-ci.ts <sha> [--wait]
 *
 * --wait polls (up to 30 min) while the run is queued/in progress. Needs an authenticated `gh` CLI.
 */
import { execFileSync } from "node:child_process";

const args = process.argv.slice(2);
const wait = args.includes("--wait");
const sha =
  args.find((a) => !a.startsWith("--")) ??
  execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim();

type Run = { databaseId: number; status: string; conclusion: string; url: string; headSha: string };

function runsFor(commit: string): Run[] {
  const out = execFileSync(
    "gh",
    ["run", "list", "--workflow", "ci.yml", "--commit", commit, "--json", "databaseId,status,conclusion,url,headSha", "--limit", "5"],
    { encoding: "utf8" },
  );
  return JSON.parse(out) as Run[];
}

async function main() {
  const deadline = Date.now() + 30 * 60_000;
  for (;;) {
    const [latest] = runsFor(sha);
    if (!latest) {
      console.error(`ci:gate — no CI run for ${sha.slice(0, 7)}. Push the commit first (git push manba main).`);
      process.exit(1);
    }
    if (latest.status === "completed") {
      if (latest.conclusion === "success") {
        console.log(`ci:gate — green for ${sha.slice(0, 7)} (${latest.url})`);
        return;
      }
      console.error(`ci:gate — CI ${latest.conclusion} for ${sha.slice(0, 7)}: ${latest.url}`);
      process.exit(1);
    }
    if (!wait || Date.now() > deadline) {
      console.error(`ci:gate — CI still ${latest.status} for ${sha.slice(0, 7)}: ${latest.url} (use --wait)`);
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
