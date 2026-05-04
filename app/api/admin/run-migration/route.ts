import { NextResponse } from "next/server";

// One-time migration endpoint — remove after use
const MIGRATION_SECRET = "pic-r16-qf-2026-05-05";

export async function POST(req: Request) {
  const { secret } = await req.json().catch(() => ({}));
  if (secret !== MIGRATION_SECRET) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { Client } = require("pg");
    // Try multiple connection configs — Supabase IPv6 only, pooler sometimes works from Vercel
    const configs = [
      { host: "db.luzbuptumedpvgukxnhe.supabase.co", port: 5432, user: "postgres", password: "7U9hVa,KA&6jE%b", database: "postgres", ssl: { rejectUnauthorized: false }, connectionTimeoutMillis: 8000 },
      { host: "aws-0-ap-southeast-1.pooler.supabase.com", port: 5432, user: "postgres.luzbuptumedpvgukxnhe", password: "7U9hVa,KA&6jE%b", database: "postgres", ssl: { rejectUnauthorized: false }, connectionTimeoutMillis: 8000 },
      { host: "aws-0-ap-southeast-1.pooler.supabase.com", port: 6543, user: "postgres.luzbuptumedpvgukxnhe", password: "7U9hVa,KA&6jE%b", database: "postgres", ssl: { rejectUnauthorized: false }, connectionTimeoutMillis: 8000 },
    ];
    let client: typeof Client | null = null;
    let lastError = "";
    for (const cfg of configs) {
      const c = new Client(cfg);
      try { await c.connect(); client = c; break; }
      catch (e: unknown) { lastError = `${cfg.host}:${cfg.port}/${cfg.user}: ${(e as Error).message}`; }
    }
    if (!client) throw new Error(`All connections failed. Last: ${lastError}`);
    await (client as { query: (sql: string) => Promise<unknown> }).query(
      "ALTER TABLE public.pic_matches DROP CONSTRAINT IF EXISTS pic_matches_stage_check"
    );
    await (client as { query: (sql: string) => Promise<unknown> }).query(
      "ALTER TABLE public.pic_matches ADD CONSTRAINT pic_matches_stage_check CHECK (stage IN ('group','r16','quarterfinal','semifinal','final','third'))"
    );
    const check = await (client as { query: (sql: string) => Promise<{ rows: { def: string }[] }> }).query(
      "SELECT pg_get_constraintdef(oid) AS def FROM pg_constraint WHERE conname = 'pic_matches_stage_check'"
    );
    await (client as { end: () => Promise<void> }).end();
    return NextResponse.json({ ok: true, constraint: check.rows[0]?.def });
  } catch (e: unknown) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
