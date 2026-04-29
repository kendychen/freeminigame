// Apply a single SQL migration to Supabase via direct Postgres connection.
// Usage: node scripts/apply-migration.mjs <path-to-sql>
import { readFileSync } from "node:fs";
import { Client } from "pg";

const file = process.argv[2];
if (!file) {
  console.error("Usage: node scripts/apply-migration.mjs <sql-file>");
  process.exit(1);
}

const dbUrl = process.env.SUPABASE_DB_URL ?? process.env.DATABASE_URL;
if (!dbUrl) {
  console.error("SUPABASE_DB_URL env var missing");
  process.exit(1);
}

const sql = readFileSync(file, "utf8");
const client = new Client({
  connectionString: dbUrl,
  ssl: { rejectUnauthorized: false },
});
await client.connect();
console.log(`Connected. Applying ${file}...`);
try {
  await client.query(sql);
  console.log("✅ Migration applied successfully");
} catch (e) {
  console.error("❌ Failed:", e.message);
  process.exit(1);
} finally {
  await client.end();
}
