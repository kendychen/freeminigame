// Apply a single SQL migration to Supabase via direct Postgres connection.
// Usage: node scripts/apply-migration.mjs <path-to-sql>
import { readFileSync } from "node:fs";
import { Client } from "pg";

const file = process.argv[2];
if (!file) {
  console.error("Usage: node scripts/apply-migration.mjs <sql-file>");
  process.exit(1);
}

const sql = readFileSync(file, "utf8");
const client = new Client({
  host: process.env.PGHOST ?? "aws-0-ap-southeast-1.pooler.supabase.com",
  port: parseInt(process.env.PGPORT ?? "5432"),
  user: process.env.PGUSER ?? "postgres.luzbuptumedpvgukxnhe",
  password: process.env.PGPASSWORD ?? "7U9hVa,KA&6jE%b",
  database: process.env.PGDATABASE ?? "postgres",
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
