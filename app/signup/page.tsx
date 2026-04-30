"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Trophy, Mail } from "lucide-react";
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

export default function SignupPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const onGoogleSignup = async () => {
    try {
      const supabase = getSupabaseBrowser();
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${window.location.origin}/auth/callback?next=/dashboard`,
        },
      });
      if (error) throw error;
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Đăng ký Google thất bại";
      toast({ title: "Lỗi", description: msg, variant: "destructive" });
    }
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const supabase = getSupabaseBrowser();
      // Sign up — email confirmation is controlled by Supabase project setting
      // (Auth → Providers → Email → "Confirm email" must be OFF for instant access).
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { full_name: name },
        },
      });
      if (error) throw error;
      // If email confirmation is OFF, session is established immediately.
      if (data.session) {
        router.push("/dashboard");
        router.refresh();
        return;
      }
      // Fallback: try sign-in (works if confirmation was skipped server-side).
      const { error: signInErr } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (!signInErr) {
        router.push("/dashboard");
        router.refresh();
        return;
      }
      toast({
        title: "Đăng ký thành công",
        description: "Bạn có thể đăng nhập ngay.",
      });
      router.push("/login");
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Đăng ký thất bại";
      toast({ title: "Lỗi", description: msg, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex flex-col flex-1">
      <header className="border-b">
        <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between px-4">
          <Link href="/" className="flex items-center gap-2 font-semibold">
            <Trophy className="size-5 text-primary" />
            Hội Nhóm Pickleball
          </Link>
          <ThemeToggle />
        </div>
      </header>
      <main className="flex flex-1 items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Đăng ký tài khoản</CardTitle>
            <CardDescription>
              Tạo tài khoản để dùng Live Tournament. Không cần xác minh email.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Button
              variant="outline"
              className="w-full"
              onClick={onGoogleSignup}
              disabled={submitting}
            >
              <svg className="size-4" viewBox="0 0 24 24" aria-hidden>
                <path
                  fill="currentColor"
                  d="M21.35 11.1H12v3.2h5.35c-.4 2.13-2.13 3.66-5.35 3.66-3.21 0-5.83-2.62-5.83-5.84 0-3.22 2.62-5.84 5.83-5.84 1.83 0 3.05.78 3.75 1.45L18.04 5.4C16.55 4.07 14.55 3.2 12 3.2 7.05 3.2 3 7.25 3 12.2s4.05 9 9 9c5.21 0 8.65-3.66 8.65-8.81 0-.59-.06-1.04-.15-1.49z"
                />
              </svg>
              Đăng ký với Google
            </Button>
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-background px-2 text-muted-foreground">
                  hoặc
                </span>
              </div>
            </div>
            <form className="space-y-4" onSubmit={onSubmit}>
              <div className="space-y-2">
                <Label htmlFor="name">Tên hiển thị</Label>
                <Input
                  id="name"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>
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
                <Label htmlFor="password">Mật khẩu (≥6 ký tự)</Label>
                <Input
                  id="password"
                  type="password"
                  minLength={6}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
              <Button type="submit" className="w-full" disabled={submitting}>
                <Mail className="size-4" />
                {submitting ? "Đang tạo tài khoản…" : "Đăng ký bằng email"}
              </Button>
              <p className="text-xs text-muted-foreground text-center">
                Tự động đăng nhập sau khi tạo. Không cần xác minh email.
              </p>
            </form>
          </CardContent>
          <CardFooter>
            <Link
              href="/login"
              className="w-full text-center text-sm text-muted-foreground hover:text-foreground"
            >
              Đã có tài khoản? Đăng nhập →
            </Link>
          </CardFooter>
        </Card>
      </main>
    </div>
  );
}
