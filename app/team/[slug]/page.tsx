import { notFound } from "next/navigation";
import Link from "next/link";
import { Check, X } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { loadTeamEventState } from "@/app/actions/team";
import { validateSquadRoster } from "@/lib/team/validate";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import ShareViewerButton, { RefereeLinkButton } from "./ShareViewerButton";

export const dynamic = "force-dynamic";

export default async function TeamOverviewPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const { user } = await requireUser();
  const state = await loadTeamEventState(slug);
  if (!state || state.event.owner_id !== user.id) notFound();

  const { event, squads, players, ties, rubbers } = state;
  const config = event.config;
  const doneTies = ties.filter((t) => t.status === "completed").length;

  const squadChecks = squads.map((squad) => {
    const roster = players.filter((p) => p.squad_id === squad.id);
    return {
      squad,
      m: roster.filter((p) => p.gender === "M").length,
      f: roster.filter((p) => p.gender === "F").length,
      errors: validateSquadRoster(squad.name, roster, config),
    };
  });
  const allReady = squads.length >= 2 && squadChecks.every((c) => c.errors.length === 0);
  const hasLineup = rubbers.some((r) => r.a1_id || r.a2_id || r.b1_id || r.b2_id);
  const hasScored = rubbers.some((r) => r.status !== "pending");

  const steps = [
    { label: "Thêm đội", done: squads.length >= 2 },
    { label: "Gán VĐV", done: allReady },
    { label: "Tạo lịch", done: event.stage !== "setup" },
    { label: "Xếp đội hình", done: hasLineup || hasScored },
    { label: "Nhập điểm", done: event.stage === "done" },
  ];
  const currentIdx = steps.findIndex((s) => !s.done);

  const nextHint =
    currentIdx === 0 ? "Thêm ít nhất 2 đội để bắt đầu." :
    currentIdx === 1 ? "Gán VĐV Nam/Nữ vào từng đội cho đủ đội hình tối thiểu." :
    currentIdx === 2 ? "Các đội đã sẵn sàng — tạo lịch thi đấu." :
    currentIdx === 3 ? "Xếp đội hình từng trận đối đầu." :
    currentIdx === 4 ? "Nhập điểm các trận đối đầu." :
    "Giải đấu đã kết thúc — xem BXH chung cuộc.";
  const nextHref =
    currentIdx >= 0 && currentIdx <= 2 ? `/team/${slug}/squads` : `/team/${slug}/ties`;
  const nextLabel =
    currentIdx >= 0 && currentIdx <= 2 ? "Quản lý đội & VĐV" :
    currentIdx >= 0 ? "Quản lý đối đầu" : "Xem kết quả";

  const stageLabel =
    event.stage === "setup" ? "Thiết lập" :
    event.stage === "group" ? "Vòng bảng" :
    event.stage === "knockout" ? "Knockout" : "Hoàn thành";

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader><CardTitle className="text-sm">Đội</CardTitle></CardHeader>
          <CardContent><p className="text-2xl font-bold">{squads.length}</p></CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-sm">VĐV</CardTitle></CardHeader>
          <CardContent><p className="text-2xl font-bold">{players.length}</p></CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-sm">Trận đối đầu</CardTitle></CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{doneTies} / {ties.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-sm">Trạng thái</CardTitle></CardHeader>
          <CardContent><p className="text-2xl font-bold">{stageLabel}</p></CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Bước tiếp theo</CardTitle>
          <CardDescription>{nextHint}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-center gap-1.5 text-xs">
            {steps.map((step, i) => (
              <span key={step.label} className="flex items-center gap-1.5">
                {i > 0 && <span className="text-muted-foreground/50">→</span>}
                <span
                  className={
                    i === currentIdx
                      ? "rounded-full bg-primary/10 px-2 py-0.5 font-medium text-primary"
                      : step.done
                      ? "flex items-center gap-1 text-muted-foreground"
                      : "text-muted-foreground/60"
                  }
                >
                  {step.done && <Check className="size-3" />}
                  {step.label}
                </span>
              </span>
            ))}
          </div>
          <div className="flex flex-wrap gap-2">
            <Link href={nextHref}>
              <Button>{nextLabel}</Button>
            </Link>
            <ShareViewerButton slug={slug} />
            <RefereeLinkButton eventId={event.id} />
          </div>
        </CardContent>
      </Card>

      {event.stage === "setup" && squads.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Đội hình tối thiểu</CardTitle>
            <CardDescription>
              Mỗi đội cần đủ VĐV cho các nội dung đã chọn trước khi tạo lịch.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {squadChecks.map((c) => (
              <div key={c.squad.id} className="rounded-lg border p-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="min-w-0 truncate text-sm font-medium">{c.squad.name}</p>
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {c.m} nam · {c.f} nữ
                  </span>
                </div>
                {c.errors.length === 0 ? (
                  <p className="mt-1 flex items-center gap-1 text-xs text-green-600 dark:text-green-500">
                    <Check className="size-3.5" /> Sẵn sàng
                  </p>
                ) : (
                  <ul className="mt-1 space-y-0.5">
                    {c.errors.map((err) => (
                      <li key={err} className="flex items-start gap-1 text-xs text-destructive">
                        <X className="mt-0.5 size-3.5 shrink-0" />
                        {err.replace(`Đội ${c.squad.name} `, "")}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
