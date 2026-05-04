import { notFound } from "next/navigation";
import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { loadPicEventState } from "@/app/actions/pic";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import RefereeButton from "./RefereeButton";

export const dynamic = "force-dynamic";

export default async function PicOverviewPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const { user } = await requireUser();
  const state = await loadPicEventState(slug);
  if (!state || state.ownerId !== user.id) notFound();

  const totalMatches =
    state.groups.reduce((s, g) => s + g.matches.length, 0) +
    state.knockoutMatches.length;
  const doneMatches =
    state.groups.reduce((s, g) => s + g.matches.filter((m) => m.status === "completed").length, 0) +
    state.knockoutMatches.filter((m) => m.status === "completed").length;

  const nextHint =
    state.stage === "group"
      ? "Nhập điểm các trận vòng bảng."
      : state.stage === "draw"
      ? "Bốc thăm cặp đôi vào vòng knockout."
      : state.stage === "knockout"
      ? "Đang thi đấu vòng knockout."
      : "Giải đấu đã kết thúc.";

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader><CardTitle className="text-sm">VĐV</CardTitle></CardHeader>
          <CardContent><p className="text-2xl font-bold">{state.players.length}</p></CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-sm">Trận</CardTitle></CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{doneMatches} / {totalMatches}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-sm">Trạng thái</CardTitle></CardHeader>
          <CardContent>
            <p className="text-2xl font-bold capitalize">
              {state.stage === "group" ? "Vòng bảng" :
               state.stage === "draw" ? "Bốc thăm" :
               state.stage === "knockout" ? "Knockout" : "Hoàn thành"}
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Bước tiếp theo</CardTitle>
          <CardDescription>{nextHint}</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          <Link href={`/pic/${slug}/matches`}>
            <Button>Quản lý trận đấu</Button>
          </Link>
          <RefereeButton eventId={state.id} />
        </CardContent>
      </Card>
    </div>
  );
}
