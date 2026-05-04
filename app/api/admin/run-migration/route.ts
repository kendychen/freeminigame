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
    const client = new Client({
      connectionString: `postgresql://postgres.luzbuptumedpvgukxnhe:${encodeURIComponent("7U9hVa,KA&6jE%b")}@aws-0-ap-southeast-1.pooler.supabase.com:5432/postgres`,
      ssl: { rejectUnauthorized: false },
    });
    await client.connect();
    await client.query(
      "ALTER TABLE public.pic_matches DROP CONSTRAINT IF EXISTS pic_matches_stage_check"
    );
    await client.query(
      "ALTER TABLE public.pic_matches ADD CONSTRAINT pic_matches_stage_check CHECK (stage IN ('group','r16','quarterfinal','semifinal','final','third'))"
    );
    // Verify
    const check = await client.query(
      "SELECT pg_get_constraintdef(oid) AS def FROM pg_constraint WHERE conname = 'pic_matches_stage_check'"
    );
    await client.end();
    return NextResponse.json({ ok: true, constraint: check.rows[0]?.def });
  } catch (e: unknown) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
