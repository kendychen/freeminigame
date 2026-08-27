import { NextResponse } from "next/server";
import { refreshDue } from "@/lib/videos/refresh";

export const maxDuration = 60;

export async function POST(req: Request) {
  const auth = req.headers.get("authorization") ?? "";
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const results = await refreshDue(3);
  return NextResponse.json({ results });
}
