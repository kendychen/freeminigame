"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Trophy, Mail, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { getSupabaseBrowser } from "@/lib/supabase/client";
import { toast } from "@/components/ui/toast";

export const dynamic = "force-dynamic";

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="flex flex-1 items-center justify-center">Đang tải...</div>}>
      <LoginInner />
    </Suspense>
  );
}

function LoginInner() {
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get("next") ?? "/dashboard";
  const oauthError = params.get("oauth_error");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Surface OAuth callback errors so users on mobile actually see why
  // 'Tiếp tục với Google' bounced them back here.
  useEffect(() => {
    if (oauthError) {
      toast({
        title: "Đăng nhập Google thất bại",
        description: oauthError,
        variant: "destructive",
      });
    }
  }, [oauthError]);

  const supabaseConfigured =
    typeof process !== "undefined" &&
    !!process.env.NEXT_PUBLIC_SUPABASE_URL &&
    !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  const onEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supabaseConfigured) {
      toast({ title: "Chưa cấu hình", description: "NEXT_PUBLIC_SUPABASE_URL/ANON_KEY chưa được set.", variant: "destructive" });
      return;
    }
    setSubmitting(true);
    try {
      const supabase = getSupabaseBrowser();
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (error) throw error;
      router.push(next);
      router.refresh();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Đăng nhập thất bại";
      toast({ title: "Lỗi", description: msg, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  const onGoogleLogin = async () => {
    if (!supabaseConfigured) {
      toast({ title: "Chưa cấu hình", variant: "destructive" });
      return;
    }
    const supabase = getSupabaseBrowser();
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`,
      },
    });
    if (error) {
      toast({ title: "Lỗi đăng nhập Google", description: error.message, variant: "destructive" });
    }
  };

  return (
    <div className="flex flex-col flex-1">
      <header className="border-b">
        <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between px-4">
          <Link href="/" className="flex items-center gap-2 font-semibold">
            <Trophy className="size-5 text-primary" />
            FreeMinigame
          </Link>
          <ThemeToggle />
        </div>
      </header>
      <main className="flex flex-1 items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Đăng nhập</CardTitle>
            <CardDescription>
              Truy cập Live Tournament — quản lý giải đấu của bạn với realtime
              multi-admin.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {oauthError && (
              <div className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-xs text-destructive">
                <p className="font-semibold">Đăng nhập Google thất bại</p>
                <p className="mt-1 break-words">{oauthError}</p>
                <p className="mt-2 opacity-90">
                  Nếu đang ở Zalo / Messenger, bấm <strong>⋮</strong> → mở
                  trong Chrome / Safari rồi thử lại. Nếu đang ở Chrome/Safari
                  mà vẫn lỗi, kiểm tra Site URL trong Supabase dashboard.
                </p>
              </div>
            )}
            <Button
              variant="outline"
              className="w-full"
              onClick={onGoogleLogin}
              disabled={submitting}
            >
              <svg className="size-4" viewBox="0 0 24 24" aria-hidden>
                <path
                  fill="currentColor"
                  d="M21.35 11.1H12v3.2h5.35c-.4 2.13-2.13 3.66-5.35 3.66-3.21 0-5.83-2.62-5.83-5.84 0-3.22 2.62-5.84 5.83-5.84 1.83 0 3.05.78 3.75 1.45L18.04 5.4C16.55 4.07 14.55 3.2 12 3.2 7.05 3.2 3 7.25 3 12.2s4.05 9 9 9c5.21 0 8.65-3.66 8.65-8.81 0-.59-.06-1.04-.15-1.49z"
                />
              </svg>
              Tiếp tục với Google
            </Button>
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-background px-2 text-muted-foreground">hoặc</span>
              </div>
            </div>
            <form className="space-y-4" onSubmit={onEmailLogin}>
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Mật khẩu</Label>
                <Input
                  id="password"
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
              <Button type="submit" className="w-full" disabled={submitting}>
                <Mail className="size-4" />
                {submitting ? "Đang đăng nhập…" : "Đăng nhập với email"}
              </Button>
            </form>
          </CardContent>
          <CardFooter className="flex flex-col gap-2">
            <Link
              href="/signup"
              className="w-full text-center text-sm text-muted-foreground hover:text-foreground"
            >
              Chưa có tài khoản? Đăng ký →
            </Link>
            <Link href="/" className="w-full text-center text-sm">
              <Button variant="ghost" size="sm" className="w-full">
                <ArrowLeft className="size-4" />
                Về trang chủ
              </Button>
            </Link>
          </CardFooter>
        </Card>
      </main>
    </div>
  );
}
