"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  saveSetting, clearSetting, testApiKey, generateCronSecret, revealSetting, runCronBatchNow,
} from "@/app/actions/videos";
import { toast } from "@/components/ui/toast";
import { translateError } from "@/lib/error-messages";
import type { SettingStatus } from "@/lib/settings";

const LABELS: Record<SettingStatus["key"], string> = {
  youtube_api_key: "YouTube Data API key",
  gemini_api_key: "Gemini API key",
  cron_secret: "CRON_SECRET",
};
const SOURCE_VI: Record<SettingStatus["source"], string> = {
  db: "đang dùng giá trị lưu trong admin",
  env: "đang dùng biến môi trường (Vercel)",
  none: "chưa có",
};

const btn = "rounded-md border px-3 py-1.5 text-sm disabled:opacity-50";
const btnPrimary = "rounded-md bg-primary px-3 py-1.5 text-sm text-primary-foreground disabled:opacity-50";

type StateRow = { slug: string; lastRefreshedAt: string | null; lastError: string | null };

export function SettingsPanel({ settings, states }: { settings: SettingStatus[]; states: StateRow[] }) {
  const [pending, start] = useTransition();
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [revealed, setRevealed] = useState<Record<string, string>>({});
  const router = useRouter();
  const siteUrl = typeof window !== "undefined" ? window.location.origin : "";

  const fail = (code: string) =>
    toast({ title: "Lỗi", description: translateError(code), variant: "destructive" });

  const run = (fn: () => Promise<{ error?: string }>, okMsg: string, after?: () => void) =>
    start(async () => {
      const r = await fn();
      if (r.error) return fail(r.error);
      toast({ title: okMsg });
      after?.();
      router.refresh();
    });

  const runBatch = () =>
    start(async () => {
      const r = await runCronBatchNow();
      if (r.error) fail(r.error);
      else {
        toast({
          title: r.done?.length ? `Xong: ${r.done.join(", ")}` : "Không có động tác nào tới hạn",
          description: r.failed?.length ? `Lỗi: ${r.failed.join("; ")}` : undefined,
        });
      }
      router.refresh();
    });

  const reveal = (key: SettingStatus["key"]) =>
    start(async () => {
      const r = await revealSetting(key);
      if (r.error) fail(r.error);
      else setRevealed({ ...revealed, [key]: r.value ?? "" });
    });

  return (
    <section className="mt-10 space-y-6">
      <h2 className="text-xl font-bold">Cấu hình</h2>

      <div className="space-y-4">
        {settings.map((s) => (
          <div key={s.key} className="rounded-lg border p-4">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <span className="font-semibold">{LABELS[s.key]}</span>
              <span className="text-sm text-muted-foreground">
                {s.masked ? `${s.masked} — ${SOURCE_VI[s.source]}` : SOURCE_VI.none}
              </span>
            </div>
            {revealed[s.key] && (
              <code className="mt-2 block break-all rounded bg-muted px-2 py-1 text-xs">{revealed[s.key]}</code>
            )}
            <div className="mt-3 flex flex-wrap gap-2">
              <input
                type="password"
                autoComplete="off"
                placeholder="Dán giá trị mới…"
                value={drafts[s.key] ?? ""}
                onChange={(e) => setDrafts({ ...drafts, [s.key]: e.target.value })}
                className="h-9 min-w-64 flex-1 rounded-md border bg-background px-3 text-sm"
              />
              <button
                type="button"
                disabled={pending || !(drafts[s.key] ?? "").trim()}
                onClick={() =>
                  run(() => saveSetting(s.key, drafts[s.key] ?? ""), "Đã lưu", () => {
                    setDrafts({ ...drafts, [s.key]: "" });
                    setRevealed({ ...revealed, [s.key]: "" });
                  })
                }
                className={btnPrimary}
              >
                Lưu
              </button>
              {s.key !== "cron_secret" ? (
                <button
                  type="button"
                  disabled={pending || !s.masked}
                  onClick={() => run(() => testApiKey(s.key), "Key hợp lệ")}
                  className={btn}
                >
                  Test key
                </button>
              ) : (
                <>
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => run(() => generateCronSecret(), "Đã tạo secret mới — nhớ cập nhật GitHub secret")}
                    className={btn}
                  >
                    Tạo mới
                  </button>
                  <button type="button" disabled={pending || !s.masked} onClick={() => reveal(s.key)} className={btn}>
                    {revealed[s.key] ? "Đã hiện" : "Hiện để copy"}
                  </button>
                </>
              )}
              <button
                type="button"
                disabled={pending || s.source !== "db"}
                onClick={() => run(() => clearSetting(s.key), "Đã xoá giá trị trong admin")}
                className={`${btn} text-destructive`}
              >
                Xoá
              </button>
            </div>
          </div>
        ))}
      </div>

      <div className="rounded-lg border p-4 text-sm">
        <p className="font-semibold">Cron hàng ngày (GitHub Actions, 02:00 UTC = 09:00 VN)</p>
        <p className="mt-1 text-muted-foreground">
          Workflow <code>videos-refresh.yml</code> gọi <code>POST {siteUrl}/api/cron/videos-refresh</code>, mỗi lần 3 động tác
          tới hạn (&gt; 6 ngày). GitHub không cho app đặt secret từ xa — vào <em>Settings → Secrets and variables → Actions</em>{" "}
          của repo và tạo:
        </p>
        <ul className="mt-2 list-disc pl-5">
          <li><code>SITE_URL</code> = <code>{siteUrl}</code></li>
          <li><code>CRON_SECRET</code> = giá trị ở ô CRON_SECRET bên trên (bấm “Hiện để copy”)</li>
        </ul>
        <button type="button" disabled={pending} onClick={runBatch} className={`${btnPrimary} mt-3`}>
          Chạy đợt cron ngay (3 động tác tới hạn)
        </button>
        <p className="mt-1 text-xs text-muted-foreground">Lần đầu bấm 4 lần để phủ đủ 12 động tác.</p>
      </div>

      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-left">
            <tr>
              <th className="px-3 py-2">Động tác</th>
              <th className="px-3 py-2">Cập nhật lần cuối</th>
              <th className="px-3 py-2">Lỗi</th>
            </tr>
          </thead>
          <tbody>
            {states.map((st) => (
              <tr key={st.slug} className="border-t">
                <td className="px-3 py-1.5">{st.slug}</td>
                <td className="px-3 py-1.5">
                  {st.lastRefreshedAt ? new Date(st.lastRefreshedAt).toLocaleString("vi-VN") : "chưa"}
                </td>
                <td className="px-3 py-1.5 text-destructive">{st.lastError ?? ""}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
