"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Users,
  Copy,
  Check,
  Lock,
  Unlock,
  Dice5,
  Zap,
  LogIn,
  LogOut,
  Eye,
  Wifi,
  X,
  Pin,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "@/components/ui/toast";
import { usePairLobby, type PairSessionState } from "@/hooks/usePairLobby";
import type { PairParticipant } from "@/lib/pair/shuffle";
import { SpinningWheel } from "@/components/pair/SpinningWheel";
import { ChatBox } from "@/components/chat/ChatBox";
import { translateError } from "@/lib/error-messages";

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
  const [stepBusy, setStepBusy] = useState(false);
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

  // Quay từng nhóm: đã quay được nhóm nào chưa, và còn quay tiếp được không.
  const drawComplete = session.draw_complete === true;
  const stepGroupCount = session.result?.groups.length ?? 0;
  // Những người đã được chia ở các lượt trước — không còn trong lồng cầu.
  const spunIds = useMemo(
    () => [
      ...(session.result?.groups.flat() ?? []),
      ...(session.result?.byes ?? []),
    ],
    [session.result],
  );

  // Nhóm vừa công bố, kèm tag (A/B hoặc Nam/Nữ) để đọc rõ trên banner.
  const announce = useMemo(() => {
    const lg = session.last_group;
    if (!lg || !Array.isArray(lg.ids) || lg.ids.length === 0) return null;
    const members = lg.ids.map((id) => {
      const p = session.participants.find((x) => x.id === id);
      return {
        id,
        name: p?.name ?? "—",
        tag: (p?.tag ?? "").trim() || null,
      };
    });
    return { index: lg.index, fromPin: lg.fromPin === true, members };
  }, [session.last_group, session.participants]);

  const announceTotal = session.participants.length;
  const announceDone = spunIds.length;
  const announceLeft = Math.max(0, announceTotal - announceDone);
  const stepStarted = stepGroupCount > 0 && !drawComplete;
  const stepDisabled =
    stepBusy ||
    isShuffling ||
    shuffling ||
    drawComplete ||
    session.participants.length < session.group_size;
  const me = useMemo(
    () => session.participants.find((p) => p.id === myId) ?? null,
    [session.participants, myId],
  );

  // --- Pinned groups ---------------------------------------------------
  const [pinMode, setPinMode] = useState(false);
  const [pinSel, setPinSel] = useState<string[]>([]);
  const [pinBusy, setPinBusy] = useState(false);

  // Chỉ cần biết ai đã bị ghim để không cho chọn lại. Phòng không hiện danh
  // sách nhóm ghim cho bất kỳ ai, nên không cần màu hay thứ tự nhóm nữa.
  const pinnedIds = useMemo(() => {
    const counts = new Map<string, number>();
    for (const p of session.participants) {
      const pin = (p.pin ?? "").trim();
      if (pin) counts.set(pin, (counts.get(pin) ?? 0) + 1);
    }
    const ids = new Set<string>();
    for (const p of session.participants) {
      const pin = (p.pin ?? "").trim();
      if (pin && (counts.get(pin) ?? 0) >= 2) ids.add(p.id);
    }
    return ids;
  }, [session.participants]);

  const canPin = isHost && !isShuffled && !isShuffling;
  const pinActive = pinMode && canPin;

  // Members can leave while the host is picking — only ids still in the room
  // count towards the counter and the confirm button. Once the draw starts
  // (canPin false) the selection is dropped entirely, so nothing stale can
  // survive into a later render.
  const pinSelValid = useMemo(
    () =>
      canPin
        ? pinSel.filter((id) => session.participants.some((p) => p.id === id))
        : [],
    [canPin, pinSel, session.participants],
  );

  const togglePinSel = (id: string) => {
    setPinSel((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  };

  const exitPinMode = () => {
    setPinMode(false);
    setPinSel([]);
  };

  const onConfirmPin = async () => {
    if (!hostToken) return;
    const ids = pinSelValid;
    setPinBusy(true);
    try {
      const res = await fetch(`/api/pair/${code}/pin`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ hostToken, ids }),
      });
      const json = (await res.json()) as { error?: string };
      if (!res.ok) {
        toast({
          title: "Ghim thất bại",
          description: translateError(json.error),
          variant: "destructive",
        });
        return;
      }
      toast({ title: `Đã ghim ${ids.length} người` });
      exitPinMode();
    } catch {
      toast({
        title: "Ghim thất bại",
        description: "Mất kết nối — thử lại",
        variant: "destructive",
      });
    } finally {
      setPinBusy(false);
    }
  };

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

  // --- Quay từng nhóm --------------------------------------------------
  const onStepDraw = async (action: "one" | "all") => {
    if (!hostToken) return;
    if (session.participants.length < session.group_size) {
      toast({
        title: "Chưa đủ người",
        description: `Cần ít nhất ${session.group_size} người`,
        variant: "destructive",
      });
      return;
    }
    setStepBusy(true);
    try {
      const res = await fetch(`/api/pair/${code}/draw-step`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          hostToken,
          action,
          spinDurationMs: action === "all" ? 2500 : 4000,
        }),
      });
      const json = (await res.json()) as { error?: string };
      if (!res.ok) {
        toast({
          title: "Lỗi bốc thăm",
          description: translateError(json.error),
          variant: "destructive",
        });
      }
    } catch {
      toast({
        title: "Lỗi bốc thăm",
        description: "Mất kết nối — thử lại",
        variant: "destructive",
      });
    } finally {
      setStepBusy(false);
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

  const onClose = async () => {
    if (!hostToken) return;
    if (
      !confirm(
        "Đóng phòng? Sau khi đóng, link sẽ ko vào được nữa và mọi người sẽ thấy 404.",
      )
    )
      return;
    const res = await fetch(`/api/pair/${code}/close`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ hostToken }),
    });
    if (res.ok) {
      localStorage.removeItem(`pair-host-${code}`);
      localStorage.removeItem(`pair-me-${code}`);
      window.location.href = "/";
    } else {
      const json = (await res.json()) as { error?: string };
      toast({
        title: "Lỗi đóng phòng",
        description: json.error ?? "",
        variant: "destructive",
      });
    }
  };

  const [applying, setApplying] = useState(false);
  const onApplyToTournament = async () => {
    if (!hostToken) return;
    setApplying(true);
    try {
      const res = await fetch(`/api/pair/${code}/apply`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ hostToken }),
      });
      const json = (await res.json()) as {
        ok?: boolean;
        mode?: "group" | "team" | "none";
        teamsCreated?: number;
        groupsAssigned?: number;
        already?: boolean;
        error?: string;
      };
      if (!res.ok || !json.ok) {
        toast({
          title: "Áp dụng thất bại",
          description: json.error ?? "Lỗi không xác định",
          variant: "destructive",
        });
        return;
      }
      if (json.already) {
        toast({
          title: "Đã có đội trong giải",
          description: "Kết quả đã được áp dụng từ trước.",
        });
      } else if (json.mode === "team") {
        toast({
          title: "Đã tạo đội",
          description: `${json.teamsCreated ?? 0} đội đã được tạo trong giải đấu.`,
        });
      } else if (json.mode === "group") {
        toast({
          title: "Đã chia bảng",
          description: `${json.groupsAssigned ?? 0} đội đã được gán bảng + sơ đồ thi đấu.`,
        });
      } else {
        toast({ title: "Đã áp dụng" });
      }
    } finally {
      setApplying(false);
    }
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
                  : isShuffled
                    ? "✅ Đã bốc thăm xong"
                    : isLocked
                      ? "🔒 Đã khoá"
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

      {/* CÔNG BỐ CẶP VỪA QUAY — to, ở trên, realtime cho mọi người cùng thấy */}
      {announce && !isShuffling && (
        <div
          key={`announce-${announce.index}`}
          className="announce overflow-hidden rounded-2xl border-2 border-primary bg-gradient-to-br from-primary/20 via-card to-primary/10 p-5 text-center shadow-lg sm:p-7"
        >
          <p className="text-xs font-bold uppercase tracking-widest text-primary sm:text-sm">
            🎉 Vừa quay ra ·{" "}
            {session.group_size === 2 ? "Cặp" : "Nhóm"} #{announce.index + 1}
          </p>
          <div className="mt-3 flex flex-wrap items-center justify-center gap-x-3 gap-y-2 sm:gap-x-4">
            {announce.members.map((m, mi) => (
              <span key={m.id} className="flex items-center gap-2 sm:gap-3">
                {mi > 0 && (
                  <span className="text-xl font-black text-primary/50 sm:text-3xl">
                    +
                  </span>
                )}
                <span className="flex flex-col items-center">
                  <span className="text-2xl font-black leading-tight sm:text-4xl">
                    {m.name}
                  </span>
                  {m.tag && (
                    <span className="mt-1 rounded-full border border-primary/40 bg-primary/10 px-2.5 py-0.5 text-xs font-bold text-primary sm:text-sm">
                      {m.tag}
                    </span>
                  )}
                </span>
              </span>
            ))}
          </div>
          <p className="mt-4 text-sm text-muted-foreground">
            Đã quay {announceDone}/{announceTotal} người
            {drawComplete
              ? " · ✅ Đã quay xong toàn bộ"
              : announceLeft > 0
                ? ` · còn ${announceLeft} người trong lồng cầu`
                : ""}
          </p>
          <style jsx>{`
            @keyframes announcePop {
              0% {
                opacity: 0;
                transform: scale(0.9) translateY(12px);
              }
              60% {
                transform: scale(1.03) translateY(0);
              }
              100% {
                opacity: 1;
                transform: scale(1) translateY(0);
              }
            }
            .announce {
              animation: announcePop 0.45s ease-out both;
            }
          `}</style>
        </div>
      )}

      {/* SHUFFLING SPINNER — broadcast realtime to all */}
      {isShuffling && session.shuffling_until && (
        <SpinningWheel
          participants={session.participants}
          groupSize={session.group_size}
          shufflingUntil={session.shuffling_until}
          assignedIds={spunIds}
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
                  isShuffled ||
                  // Đã quay từng cặp rồi thì dùng "Phát ra tất" để quay nốt;
                  // route bốc 1 lần sẽ từ chối vì shuffle_count đã tăng.
                  stepGroupCount > 0 ||
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
                    ? "✅ Đã bốc thăm"
                    : stepStarted
                      ? "🎲 Bốc hết 1 lần"
                      : "🎲 Bốc thăm"}
              </Button>
              {!drawComplete && !isShuffled && (
                <>
                  <Button
                    onClick={() => onStepDraw("one")}
                    disabled={stepDisabled}
                    variant="secondary"
                    size="sm"
                    title={`Quay ra ${session.group_size} người thành 1 cặp`}
                  >
                    <Dice5
                      className={`size-4 ${
                        stepBusy || isShuffling ? "animate-spin" : ""
                      }`}
                    />
                    {stepBusy || isShuffling
                      ? "Đang quay…"
                      : `🎯 Quay 1 cặp${
                          stepStarted ? ` (${stepGroupCount})` : ""
                        }`}
                  </Button>
                  <Button
                    onClick={() => onStepDraw("all")}
                    disabled={stepDisabled}
                    variant="outline"
                    size="sm"
                    title="Quay hết số người còn lại"
                  >
                    <Zap className="size-4" />
                    ⚡ Phát ra tất
                  </Button>
                </>
              )}
              {canPin && (
                <Button
                  onClick={() => (pinMode ? exitPinMode() : setPinMode(true))}
                  variant={pinMode ? "secondary" : "outline"}
                  size="sm"
                >
                  <Pin className="size-4" />
                  {pinMode ? "Đang ghim…" : "Ghim nhóm"}
                </Button>
              )}
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
              <Button onClick={onClose} variant="destructive" size="sm">
                <X className="size-4" />
                Đóng phòng
              </Button>
            </div>
          )}
        </CardHeader>
        <CardContent className="space-y-3">
          {pinActive && (
            <div className="flex flex-wrap items-center gap-2 rounded-md border border-primary/30 bg-primary/5 p-3 text-sm">
              <span className="flex-1">
                Chạm vào người bạn muốn ghim chung ·{" "}
                <strong>
                  Đã chọn {pinSelValid.length}/{session.group_size}
                </strong>
              </span>
              <Button
                size="sm"
                onClick={onConfirmPin}
                disabled={
                  pinBusy ||
                  pinSelValid.length < 2 ||
                  pinSelValid.length > session.group_size
                }
              >
                <Pin className="size-4" />
                Ghim {pinSelValid.length} người
              </Button>
              <Button size="sm" variant="ghost" onClick={exitPinMode}>
                Huỷ
              </Button>
            </div>
          )}

          {/* Không hiện danh sách nhóm đã ghim cho bất kỳ ai, kể cả host: hệ
              thống vẫn giữ cặp, nhưng phòng không có dấu hiệu nào lộ ra. Muốn
              bỏ ghim thì sửa ở /admin/settings. */}

          {session.participants.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">
              Chưa có ai tham gia. Share link cho mọi người để bắt đầu.
            </p>
          ) : (
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {session.participants.map((p, i) => {
                const members = session.participantMembers?.[p.id] ?? [];
                // Người đã ghim không tô màu gì: màu nền là một chỉ dấu, nhìn
                // hai thẻ cùng màu là đoán ra cặp. Vẫn chặn chọn lại họ.
                const isPinned = pinnedIds.has(p.id);
                const selected = pinSel.includes(p.id);
                const selectable = pinActive && !isPinned;
                return (
                  <div
                    key={p.id}
                    role={selectable ? "button" : undefined}
                    tabIndex={selectable ? 0 : undefined}
                    onClick={selectable ? () => togglePinSel(p.id) : undefined}
                    onKeyDown={
                      selectable
                        ? (e) => {
                            if (e.key === "Enter" || e.key === " ") {
                              e.preventDefault();
                              togglePinSel(p.id);
                            }
                          }
                        : undefined
                    }
                    className={`flex items-start gap-2 rounded-md border p-2 ${
                      p.id === myId ? "bg-primary/10 border-primary/30" : ""
                    } ${isShuffling ? "animate-pulse" : ""} ${
                      selectable ? "cursor-pointer hover:border-primary/50" : ""
                    } ${selected ? "ring-2 ring-primary" : ""}`}
                  >
                    <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-medium text-primary">
                      {i + 1}
                    </span>
                    <span className="flex flex-1 flex-col gap-0.5 truncate">
                      <span className="truncate font-medium">
                        {p.name}
                      </span>
                      {members.length > 0 && (
                        <span className="truncate text-[11px] text-muted-foreground">
                          {members.join(" · ")}
                        </span>
                      )}
                    </span>
                    {p.id === myId && (
                      <span className="ml-auto text-xs text-primary">(bạn)</span>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Result — ở chế độ quay từng cặp, các nhóm đã công bố vẫn hiện trong
          lúc đang quay lượt kế tiếp, không bị ẩn đi rồi hiện lại. */}
      {session.result && (!isShuffling || stepGroupCount > 0) && (
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
                {session.result.groups.map((groupIds, i) => {
                  const isLatest = session.last_group?.index === i;
                  return (
                  <div
                    key={i}
                    className={`rounded-lg border bg-card p-3 transition-shadow hover:shadow-md ${
                      isLatest ? "border-primary ring-2 ring-primary/40" : ""
                    }`}
                    style={{
                      animation: `fadeInUp 0.5s ease-out ${i * 0.1}s both`,
                    }}
                  >
                    <div className="text-xs text-muted-foreground mb-2">
                      {session.group_size === 2 ? "Cặp" : "Nhóm"} #{i + 1}
                      {isLatest && (
                        <span className="ml-1 font-medium text-primary">
                          ✨ vừa quay
                        </span>
                      )}
                    </div>
                    <div className="space-y-1.5">
                      {groupIds.map((id) => {
                        const p = session.participants.find((x) => x.id === id);
                        const members = session.participantMembers?.[id] ?? [];
                        return (
                          <div
                            key={id}
                            className={`text-sm ${
                              id === myId ? "text-primary" : ""
                            }`}
                          >
                            <div className="flex items-center gap-1.5 font-medium">
                              <span>{p?.name ?? "—"}</span>
                              {(p?.tag ?? "").trim() && (
                                <span className="rounded border border-primary/40 bg-primary/10 px-1.5 py-0.5 text-[10px] font-bold text-primary">
                                  {p!.tag!.trim()}
                                </span>
                              )}
                              {id === myId && (
                                <span className="text-xs">(bạn)</span>
                              )}
                            </div>
                            {members.length > 0 && (
                              <div className="text-[11px] text-muted-foreground">
                                {members.join(" · ")}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                  );
                })}
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
              {isHost && session.linked_tournament_id && (
                <div className="flex flex-wrap items-center gap-2 rounded-md border border-primary/30 bg-primary/5 p-3 text-sm">
                  <div className="flex-1">
                    <p className="font-medium">
                      {session.player_id_map
                        ? "Tạo đội từ kết quả"
                        : "Áp dụng chia bảng vào giải"}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {session.player_id_map
                        ? "Mỗi nhóm sẽ thành 1 đội, thành viên tự gán."
                        : "Cập nhật bảng A/B/C/D + sinh sơ đồ thi đấu."}
                    </p>
                  </div>
                  <Button
                    onClick={onApplyToTournament}
                    disabled={applying}
                    size="sm"
                  >
                    {applying ? "Đang áp dụng…" : "Áp dụng vào giải"}
                  </Button>
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

      <ChatBox channelKey={`pair:${code}`} defaultName={myName} title="Chat phòng bốc thăm" />
    </div>
  );
}
