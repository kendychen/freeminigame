"use client";

import { useState } from "react";
import { Link2, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getTeamRefereeToken } from "@/app/actions/team";

export default function ShareViewerButton({ slug }: { slug: string }) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    const url = `${window.location.origin}/team/v/${slug}`;
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Button variant="outline" onClick={copy}>
      {copied ? <Check className="size-4" /> : <Link2 className="size-4" />}
      {copied ? "Đã copy!" : "Link xem kết quả"}
    </Button>
  );
}

export function RefereeLinkButton({ eventId }: { eventId: string }) {
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    let tk = token;
    if (!tk) {
      setLoading(true);
      const res = await getTeamRefereeToken(eventId);
      setLoading(false);
      if (!("token" in res)) return;
      tk = res.token;
      setToken(tk);
    }
    const url = `${window.location.origin}/team/r/${tk}`;
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      prompt("Copy link:", url);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Button variant="outline" onClick={copy} disabled={loading}>
      {copied ? <Check className="size-4 text-green-500" /> : <Link2 className="size-4" />}
      {copied ? "Đã copy" : "Link trọng tài"}
    </Button>
  );
}
