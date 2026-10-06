import { config } from "dotenv";
config({ path: ".env" });

const u = process.env.DATABASE_URL || "";
console.log("len", u.length);
console.log("prefix", u.slice(0, 25));
console.log("typeof", typeof process.env.DATABASE_URL);

try {
  const normalized = u.replace(/^postgresql:/i, "http:").replace(/^postgres:/i, "http:");
  const x = new URL(normalized);
  console.log("user_type", typeof x.username, "user_len", x.username.length);
  console.log("pass_type", typeof x.password, "pass_len", x.password.length);
  console.log("host", x.hostname);
} catch (e) {
  console.log("parse_err", e instanceof Error ? e.message : e);
}
