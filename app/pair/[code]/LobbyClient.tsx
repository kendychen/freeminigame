"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Users,
  Copy,
  Check,
  Lock,
  Unlock,
  Dice5,
  LogIn,
  LogOut,
  Eye,
  Wifi,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "@/components/ui/toast";
import { usePairLobby, type PairSessionState } from "@/hooks/usePairLobby";
import { SpinningWheel } from "@/components/pair/SpinningWheel";

export interface LobbyClientProps {
  code: string;
  hostTokenFromUrl: string | null;
  initial: PairSessionState;
}

export function LobbyClient({
  code,
  hostTokenFromUrl,
  initial,
}: LobbyClientProps) {
  // Host token: from URL, or localStorage, or null
  const [hostToken, setHostToken] = useState<string | null>(null);
  useEffect(() => {
    if (hostTokenFromUrl) {
      localStorage.setItem(`pair-host-${code}`, hostTokenFromUrl);
      setHostToken(hostTokenFromUrl);
      // Strip ?host= from URL so host copying address bar doesn't leak token.
      window.history.replaceState({}, "", `/pair/${code}`);
      return;
    }
    const stored = localStorage.getItem(`pair-host-${code}`);
    if (stored) setHostToken(stored);
  }, [code, hostTokenFromUrl]);

  const { session, presence } = usePairLobby(
    code,
    initial,
    hostToken ? "host" : "viewer",
  );

  const [myId, setMyId] = useState<string | null>(null);
  const [myName, setMyName] = useState("");
  const [joinName, setJoinName] = useState("");
  const [joining, setJoining] = useState(false);
  const [shuffling, setShuffling] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem(`pair-me-${code}`);
    if (stored) {
      const obj = JSON.parse(stored) as { id: string; name: string };
      setMyId(obj.id);
      setMyName(obj.name);
    }
  }, [code]);

  const isHost = !!hostToken;
  const isLocked = session.status === "locked";
  const isShuffled = session.status === "shuffled";
  const isShuffling = session.status === "shuffling";
  const me = useMemo(
    () => session.participants.find((p) => p.id === myId) ?? null,
    [session.participants, myId],
  );

  const shareUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}/pair/${code}`
      : "";

  const onCopy = async () => {
    if (!shareUrl) return;
    await navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const onJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!joinName.trim()) return;
    setJoining(true);
    try {
      const res = await fetch(`/api/pair/${code}/join`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: joinName.trim() }),
      });
      const json = (await res.json()) as {
        participant?: { id: string; name: string };
        error?: string;
      };
      if (!res.ok || !json.participant) {
        toast({
          title: "Không vào được",
          description: json.error ?? "Lỗi",
          variant: "destructive",
        });
        return;
      }
      localStorage.setItem(
        `pair-me-${code}`,
        JSON.stringify({
          id: json.participant.id,
          name: json.participant.name,
        }),
      );
      setMyId(json.participant.id);
      setMyName(json.participant.name);
      setJoinName("");
    } finally {
      setJoining(false);
    }
  };

  const onLeave = async () => {
    if (!myId) return;
    if (!confirm("Rời khỏi phòng?")) return;
    await fetch(`/api/pair/${code}/leave`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ participantId: myId }),
    });
    localStorage.removeItem(`pair-me-${code}`);
    setMyId(null);
    setMyName("");
  };

  const onShuffle = async () => {
    if (!hostToken) return;
    if (session.participants.length < 2) {
      toast({
        title: "Chưa đủ người",
        description: "Cần ít nhất 2 người",
        variant: "destructive",
      });
      return;
    }
    setShuffling(true);
    try {
      const res = await fetch(`/api/pair/${code}/shuffle`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ hostToken, spinDurationMs: 7000 }),
      });
      const json = (await res.json()) as { error?: string };
      if (!res.ok) {
        toast({
          title: "Lỗi bốc thăm",
          description: json.error ?? "",
          variant: "destructive",
        });
      }
    } finally {
      setShuffling(false);
    }
  };

  const onToggleLock = async () => {
    if (!hostToken) return;
    await fetch(`/api/pair/${code}/lock`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ hostToken, locked: !isLocked }),
    });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">{session.title}</h1>
          <p className="text-sm text-muted-foreground">
            Mã phòng:{" "}
            <code className="rounded bg-secondary px-1.5 py-0.5 font-mono text-sm">
              {code}
            </code>{" "}
            · Nhóm {session.group_size} người ·{" "}
            <span
              className={
                isShuffling
                  ? "text-primary animate-pulse font-semibold"
                  : isLocked && session.shuffle_count === 0
                    ? "text-muted-foreground"
                    : isLocked
                      ? "text-destructive"
                      : isShuffled
                        ? "text-primary"
                        : "text-muted-foreground"
              }
            >
              {isShuffling
                ? "🎲 ĐANG BỐC THĂM..."
                : isLocked && session.shuffle_count === 0
                  ? "👁️ Preset · chỉ xem"
                  : isLocked
                    ? `🔒 Đã khoá · bốc ${session.shuffle_count} lần`
                    : isShuffled
                      ? `🎲 Đã bốc ${session.shuffle_count} lần`
                      : "🟢 Đang chờ tham gia"}
            </span>
          </p>
        </div>
        <div className="flex items-center gap-2 self-start">
          {/* Presence indicator */}
          <span
            className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs ${
              presence.hostOnline
                ? "border-green-500/50 bg-green-500/10 text-green-700 dark:text-green-400"
                : "border-muted bg-muted/30 text-muted-foreground"
            }`}
            title={
              presence.hostOnline ? "Host đang trực tuyến" : "Host offline"
            }
          >
            <span
              className={`size-2 rounded-full ${
                presence.hostOnline
                  ? "bg-green-500 animate-pulse"
                  : "bg-muted-foreground"
              }`}
            />
            Host {presence.hostOnline ? "online" : "offline"}
          </span>
          {presence.viewerCount > 0 && (
            <span className="inline-flex items-center gap-1 rounded-full border bg-secondary px-2 py-0.5 text-xs">
              <Eye className="size-3" />
              {presence.viewerCount}
            </span>
          )}
          {isHost ? (
            <span className="rounded-full border border-primary/40 bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
              👑 Bạn là Host
            </span>
          ) : (
            <span className="rounded-full border bg-secondary px-3 py-1 text-xs font-medium text-muted-foreground">
              👁️ Bạn đang xem
            </span>
          )}
        </div>
      </div>

      {/* Viewer-only info banner */}
      {!isHost && !isShuffling && (
        <div className="rounded-lg border bg-secondary/30 p-3 text-sm">
          🔒 <strong>Chỉ host được bốc thăm.</strong>{" "}
          <span className="text-muted-foreground">
            {presence.hostOnline
              ? "Đợi host bấm bốc thăm — kết quả sẽ hiện cho bạn ngay khi xong."
              : "Host đang offline. Kết quả sẽ tự động hiện khi host bốc."}
          </span>
        </div>
      )}

      {/* SHUFFLING SPINNER — broadcast realtime to all */}
      {isShuffling && session.shuffling_until && (
        <SpinningWheel
          participants={session.participants}
          groupSize={session.group_size}
          shufflingUntil={session.shuffling_until}
        />
      )}

      {/* Share link card */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Link chia sẻ</CardTitle>
        </CardHeader>
        <CardContent className="flex gap-2">
          <Input value={shareUrl} readOnly className="flex-1 font-mono text-sm" />
          <Button onClick={onCopy} variant="outline">
            {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
            {copied ? "Đã copy" : "Copy"}
          </Button>
        </CardContent>
      </Card>

      {/* Join form OR identity */}
      {!me && !isLocked && !isShuffling && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Tham gia phòng</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={onJoin} className="flex gap-2">
              <Input
                placeholder="Tên của bạn"
                value={joinName}
                onChange={(e) => setJoinName(e.target.value)}
                maxLength={40}
                required
                className="flex-1"
              />
              <Button type="submit" disabled={joining || !joinName.trim()}>
                <LogIn className="size-4" />
                {joining ? "Đang vào…" : "Vào phòng"}
              </Button>
            </form>
          </CardContent>
        </Card>
      )}

      {me && (
        <div className="flex items-center justify-between rounded-lg border bg-primary/5 p-3 text-sm">
          <span>
            👋 Bạn đang trong phòng với tên <strong>{myName}</strong>
          </span>
          <Button variant="ghost" size="sm" onClick={onLeave}>
            <LogOut className="size-4" />
            Rời
          </Button>
        </div>
      )}

      {/* Participants */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-3 space-y-0">
          <CardTitle className="text-base flex items-center gap-2">
            <Users className="size-4" />
            Người tham gia ({session.participants.length})
          </CardTitle>
          {isHost && (
            <div className="flex gap-2">
              <Button
                onClick={onShuffle}
                disabled={
                  shuffling ||
                  isShuffling ||
                  session.participants.length < 2
                }
                size="sm"
              >
                <Dice5
                  className={`size-4 ${
                    shuffling || isShuffling ? "animate-spin" : ""
                  }`}
                />
                {shuffling || isShuffling
                  ? "Đang bốc..."
                  : isShuffled
                    ? "Bốc lại"
                    : "🎲 Bốc thăm"}
              </Button>
              <Button onClick={onToggleLock} variant="outline" size="sm">
                {isLocked ? (
                  <>
                    <Unlock className="size-4" />
                    Mở khoá
                  </>
                ) : (
                  <>
                    <Lock className="size-4" />
                    Khoá
                  </>
                )}
              </Button>
            </div>
          )}
        </CardHeader>
        <CardContent>
          {session.participants.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">
              Chưa có ai tham gia. Share link cho mọi người để bắt đầu.
            </p>
          ) : (
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {session.participants.map((p, i) => (
                <div
                  key={p.id}
                  className={`flex items-center gap-2 rounded-md border p-2 ${
                    p.id === myId ? "bg-primary/10 border-primary/30" : ""
                  } ${isShuffling ? "animate-pulse" : ""}`}
                >
                  <span className="flex size-8 items-center justify-center rounded-full bg-primary/10 text-sm font-medium text-primary">
                    {i + 1}
                  </span>
                  <span className="truncate">{p.name}</span>
                  {p.id === myId && (
                    <span className="ml-auto text-xs text-primary">(bạn)</span>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Result */}
      {session.result && !isShuffling && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Dice5 className="size-4 text-primary" />
              Kết quả bốc thăm (lần {session.shuffle_count})
              {session.shuffled_at && (
                <span className="text-xs font-normal text-muted-foreground">
                  · {new Date(session.shuffled_at).toLocaleTimeString("vi-VN")}
                </span>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {session.result.groups.map((groupIds, i) => (
                  <div
                    key={i}
                    className="rounded-lg border bg-card p-3 transition-shadow hover:shadow-md"
                    style={{
                      animation: `fadeInUp 0.5s ease-out ${i * 0.1}s both`,
                    }}
                  >
                    <div className="text-xs text-muted-foreground mb-2">
                      {session.group_size === 2 ? "Cặp" : "Nhóm"} #{i + 1}
                    </div>
                    <div className="space-y-1">
                      {groupIds.map((id) => {
                        const p = session.participants.find((x) => x.id === id);
                        return (
                          <div
                            key={id}
                            className={`text-sm font-medium ${
                              id === myId ? "text-primary" : ""
                            }`}
                          >
                            {p?.name ?? "—"}
                            {id === myId && (
                              <span className="ml-1 text-xs">(bạn)</span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
              {session.result.byes.length > 0 && (
                <div className="rounded-md border bg-secondary/30 p-3 text-sm">
                  <span className="text-muted-foreground">Miễn (BYE):</span>{" "}
                  {session.result.byes
                    .map(
                      (id) =>
                        session.participants.find((x) => x.id === id)?.name ??
                        "—",
                    )
                    .join(", ")}
                </div>
              )}
            </div>
            <style jsx>{`
              @keyframes fadeInUp {
                from {
                  opacity: 0;
                  transform: translateY(20px);
                }
                to {
                  opacity: 1;
                  transform: translateY(0);
                }
              }
            `}</style>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
