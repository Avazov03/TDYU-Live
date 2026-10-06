import { config } from "dotenv";
import { Pool } from "pg";

config({ path: ".env" });

const connectionString = process.env.DATABASE_URL || "";
const host = new URL(
  connectionString.replace(/^postgresql:/i, "http:").replace(/^postgres:/i, "http:"),
).hostname;
if (host !== "localhost" && host !== "127.0.0.1") {
  console.error("refused");
  process.exit(1);
}

async function main() {
const pool = new Pool({ connectionString });
const users = await pool.query(
  `SELECT email, role FROM users ORDER BY role, email`,
);
console.log("users", users.rowCount);
for (const row of users.rows) console.log(row.role, row.email);
const courses = await pool.query(
  `SELECT title_uz, lifecycle_status, is_published, list_price FROM courses ORDER BY title_uz`,
);
console.log("courses", courses.rowCount);
for (const row of courses.rows) {
  console.log(row.lifecycle_status, row.is_published, row.list_price, row.title_uz);
}
const lessons = await pool.query(
  `SELECT title_uz, status FROM lessons ORDER BY title_uz`,
);
console.log("lessons", lessons.rowCount);
for (const row of lessons.rows) console.log(row.status, row.title_uz);
await pool.end();
}
main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
