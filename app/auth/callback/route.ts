import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const next = url.searchParams.get("next") ?? "/dashboard";
  const errParam = url.searchParams.get("error");
  const errDesc = url.searchParams.get("error_description");

  // Provider rejected (user cancelled, mismatched redirect, etc.) — bounce
  // back to /login with the original message so the user sees what failed.
  if (errParam) {
    const back = new URL("/login", url.origin);
    back.searchParams.set("oauth_error", errDesc ?? errParam);
    return NextResponse.redirect(back);
  }

  if (!code) {
    const back = new URL("/login", url.origin);
    back.searchParams.set("oauth_error", "missing_code");
    return NextResponse.redirect(back);
  }

  try {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) {
      const back = new URL("/login", url.origin);
      back.searchParams.set("oauth_error", error.message);
      return NextResponse.redirect(back);
    }
  } catch (e) {
    const back = new URL("/login", url.origin);
    back.searchParams.set(
      "oauth_error",
      e instanceof Error ? e.message : "exchange_failed",
    );
    return NextResponse.redirect(back);
  }

  return NextResponse.redirect(new URL(next, url.origin));
}
