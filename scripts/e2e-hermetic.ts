/**
 * Hermetic browser E2E: throwaway Postgres → migrate → seed → next build → next start → Playwright.
 * Needs only Docker and node_modules; never touches staging/production or local .env* files.
 *
 * Usage: npm run test:e2e:full [-- <runner flags> <playwright args>]
 *   --skip-build  (or E2E_FULL_SKIP_BUILD=1) reuse the existing .next build made by this runner
 *   --keep-db     (or E2E_FULL_KEEP_DB=1)    leave the Postgres container running afterwards
 *   --no-docker   (or E2E_FULL_NO_DOCKER=1)  DATABASE_URL is already served (e.g. CI service container)
 * Anything else is passed to `playwright test` (e.g. `e2e/access --headed`).
 * PowerShell eats `--`: use the env vars or `npx tsx scripts/e2e-hermetic.ts --skip-build ...`.
 */

import { spawn, spawnSync, type ChildProcess } from "child_process";
import { existsSync, mkdirSync, readFileSync, rmSync } from "fs";
import { createConnection } from "net";
import os from "os";
import path from "path";

const ROOT = path.resolve(__dirname, "..");
/** Relative to ROOT (the cwd of every child): Windows shell spawning splits absolute paths with spaces. */
const COMPOSE = ["compose", "-f", "docker-compose.e2e.yml"];
const RUNNER_FLAGS = new Set(["--skip-build", "--keep-db", "--no-docker"]);
const ENV_FLAGS = {
  E2E_FULL_SKIP_BUILD: "--skip-build",
  E2E_FULL_KEEP_DB: "--keep-db",
  E2E_FULL_NO_DOCKER: "--no-docker",
} as const;
/** Shell variables with these prefixes are dropped unless e2e/hermetic.env sets them. */
const SCRUBBED_PREFIXES = ["E2E_", "FF_", "MUX_", "AI_", "GEMINI_", "AUTH_", "NEXTAUTH_", "LEXIFY_", "RECORDING_"];
const SCRUBBED_KEYS = ["DATABASE_URL", "TEST_BASE_URL", "PLAYWRIGHT_BASE_URL", "NODE_ENV", "PORT", "STAGING"];

function parseEnvFile(file: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const line of readFileSync(file, "utf8").split(/\r?\n/)) {
    const m = /^\s*([A-Z0-9_]+)\s*=(.*)$/.exec(line);
    if (m) out[m[1]] = m[2].trim();
  }
  return out;
}

type Env = Record<string, string | undefined>;

function buildEnv(): Env {
  const env: Env = {};
  for (const [k, v] of Object.entries(process.env)) {
    if (SCRUBBED_KEYS.includes(k) || SCRUBBED_PREFIXES.some((p) => k.startsWith(p))) continue;
    env[k] = v;
  }
  Object.assign(env, parseEnvFile(path.join(ROOT, "e2e", "hermetic.env")));
  const storage = path.join(os.tmpdir(), "lexify-e2e-recordings");
  rmSync(storage, { recursive: true, force: true });
  mkdirSync(storage, { recursive: true });
  env.RECORDING_STORAGE_ROOT = storage;
  // Stops Next from loading .env / .env.production.local (real keys) on top of this environment.
  env.__NEXT_PROCESSED_ENV = "true";
  env.NEXT_TELEMETRY_DISABLED = "1";
  return env;
}

function step(name: string) {
  console.log(`\n=== e2e:full — ${name} ===`);
}

/** Windows STATUS_ACCESS_VIOLATION — sporadic native crash of `next build` on some machines. */
const WIN_ACCESS_VIOLATION = 3221225477;

function run(cmd: string, args: string[], env: Env, opts: { retryOnNativeCrash?: boolean } = {}) {
  const spawnIt = () =>
    spawnSync(cmd, args, { cwd: ROOT, env: env as NodeJS.ProcessEnv, stdio: "inherit", shell: process.platform === "win32" });
  let res = spawnIt();
  for (let attempt = 2; opts.retryOnNativeCrash && res.status === WIN_ACCESS_VIOLATION && attempt <= 3; attempt++) {
    console.log(`\n${cmd} ${args.join(" ")} crashed natively (0xC0000005) — attempt ${attempt}/3`);
    res = spawnIt();
  }
  if (res.status !== 0) throw new Error(`${cmd} ${args.join(" ")} exited with ${res.status ?? res.signal}`);
}

function portInUse(port: number) {
  return new Promise<boolean>((resolve) => {
    const socket = createConnection({ port, host: "127.0.0.1" });
    socket.once("connect", () => {
      socket.destroy();
      resolve(true);
    });
    socket.once("error", () => resolve(false));
  });
}

async function waitForApp(url: string, server: ChildProcess, timeoutMs = 180_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (server.exitCode !== null) throw new Error(`next start exited early with ${server.exitCode}`);
    const ok = await fetch(url).then((r) => r.status === 200, () => false);
    if (ok) return;
    await new Promise((r) => setTimeout(r, 1000));
  }
  throw new Error(`App did not answer 200 at ${url} within ${timeoutMs / 1000}s`);
}

function stopServer(server: ChildProcess | null) {
  if (!server?.pid || server.exitCode !== null) return;
  if (process.platform === "win32") spawnSync("taskkill", ["/pid", String(server.pid), "/T", "/F"], { stdio: "ignore" });
  else {
    try {
      process.kill(-server.pid, "SIGTERM");
    } catch {
      server.kill("SIGTERM");
    }
  }
}

async function main() {
  const argv = process.argv.slice(2).filter((a) => a !== "--");
  const flags = new Set(argv.filter((a) => RUNNER_FLAGS.has(a)));
  // PowerShell drops the `--` separator, so npm swallows the flags; env vars work in every shell.
  for (const [name, flag] of Object.entries(ENV_FLAGS)) if (process.env[name] === "1") flags.add(flag);
  const playwrightArgs = argv.filter((a) => !RUNNER_FLAGS.has(a));
  const env = buildEnv();
  const port = Number(env.PORT);
  const baseUrl = env.TEST_BASE_URL!;
  const toolEnv = { ...env };
  delete toolEnv.NODE_ENV;

  console.log(`e2e:full flags: [${[...flags].join(" ")}] playwright args: [${playwrightArgs.join(" ")}]`);
  if (await portInUse(port)) throw new Error(`Port ${port} is already in use — stop that process first.`);

  let server: ChildProcess | null = null;
  let exitCode = 1;
  try {
    if (!flags.has("--no-docker")) {
      step("Postgres (docker-compose.e2e.yml)");
      spawnSync("docker", [...COMPOSE, "down", "--remove-orphans"], { cwd: ROOT, stdio: "ignore" });
      run("docker", [...COMPOSE, "up", "-d", "--wait"], toolEnv);
    }

    step("migrate");
    run("npx", ["prisma", "migrate", "deploy"], toolEnv);

    step("seed");
    run("npx", ["tsx", "scripts/e2e-hermetic-seed.ts"], toolEnv);

    if (flags.has("--skip-build") && existsSync(path.join(ROOT, ".next", "BUILD_ID"))) {
      step("build (skipped, reusing .next)");
    } else {
      step("build");
      // Turbopack builds crash on some Windows machines (0xC0000005); webpack is stable there.
      run("npx", ["next", "build", ...(process.platform === "win32" ? ["--webpack"] : [])], toolEnv, {
        retryOnNativeCrash: true,
      });
    }

    step(`start (${baseUrl})`);
    server = spawn("npx", ["next", "start", "-p", String(port)], {
      cwd: ROOT,
      env: toolEnv as NodeJS.ProcessEnv,
      stdio: ["ignore", "inherit", "inherit"],
      shell: process.platform === "win32",
      detached: process.platform !== "win32",
    });
    await waitForApp(`${baseUrl}/login`, server);

    step(`playwright ${playwrightArgs.join(" ")}`.trim());
    const res = spawnSync("npx", ["playwright", "test", ...playwrightArgs], {
      cwd: ROOT,
      env: env as NodeJS.ProcessEnv,
      stdio: "inherit",
      shell: process.platform === "win32",
    });
    exitCode = res.status ?? 1;
  } finally {
    stopServer(server);
    if (!flags.has("--no-docker") && !flags.has("--keep-db")) {
      spawnSync("docker", [...COMPOSE, "down", "--remove-orphans"], { cwd: ROOT, stdio: "ignore" });
    }
  }
  process.exit(exitCode);
}

main().catch((e) => {
  console.error(`\ne2e:full failed: ${e instanceof Error ? e.message : e}`);
  process.exit(1);
});
