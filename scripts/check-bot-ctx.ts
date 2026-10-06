import { config } from "dotenv";
config({ path: ".env" });

async function main() {
  const { loadBotContext } = await import("../src/lib/telegram/context");
  const ctx = await loadBotContext("0");
  console.log("linked", ctx.linked, "ok");
}

void main().catch((e) => {
  console.error("FAIL", e);
  process.exit(1);
});
