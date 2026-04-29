import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default async function AdminOverview({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const { supabase } = await requireUser();
  const { data: t } = await supabase
    .from("tournaments")
    .select("*")
    .eq("slug", slug)
    .maybeSingle();
  if (!t) notFound();
  const [{ count: teamCount }, { count: matchCount }] = await Promise.all([
    supabase.from("teams").select("id", { count: "exact", head: true }).eq("tournament_id", t.id),
    supabase.from("matches").select("id", { count: "exact", head: true }).eq("tournament_id", t.id),
  ]);

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Đội</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{teamCount ?? 0}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Trận</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{matchCount ?? 0}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Trạng thái</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold capitalize">{t.status}</p>
          </CardContent>
        </Card>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Bước tiếp theo</CardTitle>
          <CardDescription>
            {teamCount === 0
              ? "Thêm đội tham gia trước khi tạo bảng đấu."
              : matchCount === 0
                ? "Sẵn sàng tạo bảng đấu."
                : "Bảng đấu đang chạy. Nhập điểm ở trang Bảng đấu."}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex gap-2">
          <Link href={`/t/${slug}/admin/teams`}>
            <Button variant="outline">Quản lý đội</Button>
          </Link>
          <Link href={`/t/${slug}/admin/bracket`}>
            <Button>Bảng đấu</Button>
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}
