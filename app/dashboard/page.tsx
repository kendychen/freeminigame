import Link from "next/link";
import { Plus, Trophy, ArrowRight, Users } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { createServiceClient } from "@/lib/supabase/service";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const { user, supabase } = await requireUser();
  const svc = createServiceClient();

  const [tournamentsRes, picEventsRes] = await Promise.all([
    supabase
      .from("tournaments")
      .select("id, slug, name, format, status, created_at")
      .or(`owner_id.eq.${user.id},id.in.(${await getCoAdminTournamentIds(supabase, user.id)})`)
      .is("deleted_at", null)
      .order("created_at", { ascending: false }),
    svc
      .from("pic_events")
      .select("id, slug, name, stage, created_at")
      .eq("owner_id", user.id)
      .order("created_at", { ascending: false }),
  ]);

  const list = tournamentsRes.data ?? [];
  const picList = picEventsRes.data ?? [];

  return (
    <div className="flex flex-col flex-1">
      <header className="border-b">
        <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between px-4">
          <Link href="/" className="flex items-center gap-2 font-semibold">
            <Trophy className="size-5 text-primary" />
            Hội Nhóm Pickleball
          </Link>
          <div className="flex items-center gap-4">
            <span className="hidden text-sm text-muted-foreground sm:block">
              {user.email}
            </span>
            <form action="/auth/signout" method="post">
              <Button variant="ghost" size="sm" type="submit">
                Đăng xuất
              </Button>
            </form>
            <ThemeToggle />
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 space-y-10">

        {/* PIC xoay cặp section */}
        <section>
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold flex items-center gap-2">
                <Users className="size-5 text-primary" />
                PIC xoay cặp
              </h2>
              <p className="mt-0.5 text-sm text-muted-foreground">Giải đấu xoay cặp đôi cá nhân</p>
            </div>
            <Link href="/pic/new">
              <Button size="sm">
                <Plus className="size-4" />
                Tạo giải PIC
              </Button>
            </Link>
          </div>
          {picList.length === 0 ? (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Chưa có giải PIC nào</CardTitle>
                <CardDescription>Tạo giải đấu xoay cặp đầu tiên của bạn.</CardDescription>
              </CardHeader>
              <CardContent>
                <Link href="/pic/new"><Button size="sm">Tạo giải PIC</Button></Link>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {picList.map((e) => (
                <Link key={e.id} href={`/pic/${e.slug}`}>
                  <Card className="transition-shadow hover:shadow-md">
                    <CardHeader className="pb-2">
                      <CardTitle className="flex items-center justify-between text-base">
                        <span className="truncate">{e.name}</span>
                        <ArrowRight className="size-4 shrink-0 text-muted-foreground" />
                      </CardTitle>
                      <CardDescription className="capitalize">
                        PIC xoay cặp · {
                          e.stage === "group" ? "Vòng bảng" :
                          e.stage === "draw" ? "Bốc thăm" :
                          e.stage === "knockout" ? "Knockout" : "Hoàn thành"
                        }
                      </CardDescription>
                    </CardHeader>
                  </Card>
                </Link>
              ))}
            </div>
          )}
        </section>

        {/* Live tournaments section */}
        <section>
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold">Giải đấu Live</h2>
              <p className="mt-0.5 text-sm text-muted-foreground">Quản lý các giải đấu Live Mode</p>
            </div>
            <Link href="/dashboard/new">
              <Button size="sm">
                <Plus className="size-4" />
                Tạo giải mới
              </Button>
            </Link>
          </div>
          {list.length === 0 ? (
            <Card>
              <CardHeader>
                <CardTitle>Chưa có giải đấu nào</CardTitle>
                <CardDescription>Bắt đầu bằng cách tạo giải đấu đầu tiên của bạn.</CardDescription>
              </CardHeader>
              <CardContent>
                <Link href="/dashboard/new"><Button>Tạo giải đầu tiên</Button></Link>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {list.map((t) => (
                <Link key={t.id} href={`/t/${t.slug}/admin`}>
                  <Card className="transition-shadow hover:shadow-md">
                    <CardHeader>
                      <CardTitle className="flex items-center justify-between text-lg">
                        <span className="truncate">{t.name}</span>
                        <ArrowRight className="size-4 shrink-0 text-muted-foreground" />
                      </CardTitle>
                      <CardDescription className="capitalize">
                        {t.format.replace("_", " ")} · {t.status}
                      </CardDescription>
                    </CardHeader>
                  </Card>
                </Link>
              ))}
            </div>
          )}
        </section>

      </main>
    </div>
  );
}

async function getCoAdminTournamentIds(
  supabase: Awaited<ReturnType<typeof requireUser>>["supabase"],
  userId: string,
): Promise<string> {
  const { data } = await supabase
    .from("tournament_admins")
    .select("tournament_id")
    .eq("admin_id", userId);
  const ids = (data ?? []).map((r) => r.tournament_id);
  return ids.length ? ids.join(",") : "00000000-0000-0000-0000-000000000000";
}
