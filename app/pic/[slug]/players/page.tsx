import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { loadPicEventState } from "@/app/actions/pic";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const dynamic = "force-dynamic";

export default async function PicPlayersPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const { user } = await requireUser();
  const state = await loadPicEventState(slug);
  if (!state || state.ownerId !== user.id) notFound();

  const { players, groups } = state;

  const playerGroup = (playerId: string) =>
    groups.find((g) => g.playerIds.includes(playerId));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold">VĐV ({players.length} người)</h2>
      </div>

      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {players.map((p) => {
          const group = playerGroup(p.id);
          return (
            <Card key={p.id}>
              <CardHeader className="py-3">
                <CardTitle className="flex items-center justify-between text-sm font-semibold">
                  <span>{p.name}</span>
                  {group && (
                    <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                      Bảng {group.label}
                    </span>
                  )}
                </CardTitle>
              </CardHeader>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
