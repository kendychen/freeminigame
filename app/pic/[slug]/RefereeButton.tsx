"use client";

import { useState } from "react";
import { Link2, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getPicRefereeToken } from "@/app/actions/pic";

export default function RefereeButton({
  eventId,
  groupLabels,
}: {
  eventId: string;
  groupLabels: string[];
}) {
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);

  const ensureToken = async (): Promise<string | null> => {
    if (token) return token;
    setLoading(true);
    const res = await getPicRefereeToken(eventId);
    setLoading(false);
    if ("token" in res) { setToken(res.token); return res.token; }
    return null;
  };

  const copy = async (key: string, suffix: string) => {
    const tk = await ensureToken();
    if (!tk) return;
    const url = `${window.location.origin}/pic/r/${tk}${suffix}`;
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      prompt("Copy link:", url);
    }
    setCopied(key);
    setTimeout(() => setCopied(null), 2000);
  };

  if (groupLabels.length === 0) {
    return (
      <Button variant="outline" onClick={() => copy("all", "")} disabled={loading}>
        {copied === "all" ? <Check className="size-4 text-green-500" /> : <Link2 className="size-4" />}
        {copied === "all" ? "Đã copy" : "Link trọng tài"}
      </Button>
    );
  }

  return (
    <div className="flex flex-wrap gap-2">
      {groupLabels.map((label) => (
        <Button
          key={label}
          variant="outline"
          size="sm"
          onClick={() => copy(label, `?g=${label}`)}
          disabled={loading}
        >
          {copied === label ? <Check className="size-4 text-green-500" /> : <Link2 className="size-4" />}
          {copied === label ? "Đã copy" : `Bảng ${label}`}
        </Button>
      ))}
    </div>
  );
}
