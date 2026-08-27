import { NextResponse } from "next/server";
import { refreshDue } from "@/lib/videos/refresh";
import { getSetting } from "@/lib/settings";

export const maxDuration = 60;

export async function POST(req: Request) {
  const auth = req.headers.get("authorization") ?? "";
  const { value: secret } = await getSetting("cron_secret");
  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const results = await refreshDue(2);
  return NextResponse.json({ results });
}
