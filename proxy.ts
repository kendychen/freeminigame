import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

const ADMIN_PREFIX = "/admin";

export async function proxy(request: NextRequest) {
  const response = await updateSession(request);

  if (request.nextUrl.pathname.startsWith(ADMIN_PREFIX)) {
    // Optional IP allowlist
    const allowlist = process.env.ADMIN_IP_ALLOWLIST;
    if (allowlist) {
      const ip =
        request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "";
      const allowed = allowlist.split(",").map((s) => s.trim()).filter(Boolean);
      if (allowed.length && !allowed.includes(ip)) {
        return new NextResponse("Forbidden", { status: 403 });
      }
    }
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
