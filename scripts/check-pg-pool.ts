import { config } from "dotenv";
config({ path: ".env" });
import { Pool } from "pg";

async function main() {
  const connectionString = process.env.DATABASE_URL;
  console.log("connecting...");
  const pool = new Pool({ connectionString });
  try {
    const r = await pool.query("select 1 as ok");
    console.log("ok", r.rows[0]);
  } catch (e) {
    console.error("fail", e);
  } finally {
    await pool.end();
  }
}

void main();
