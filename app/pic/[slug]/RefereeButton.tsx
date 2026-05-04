"use client";

import { useState, useTransition } from "react";
import { Link2, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getPicRefereeToken } from "@/app/actions/pic";

export default function RefereeButton({ eventId }: { eventId: string }) {
  const [copied, setCopied] = useState(false);
  const [pending, start] = useTransition();

  const handleCopy = () => {
    start(async () => {
      const res = await getPicRefereeToken(eventId);
      if ("token" in res) {
        const url = `${window.location.origin}/pic/r/${res.token}`;
        await navigator.clipboard.writeText(url);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }
    });
  };

  return (
    <Button variant="outline" onClick={handleCopy} disabled={pending}>
      {copied ? <Check className="size-4 text-green-500" /> : <Link2 className="size-4" />}
      {copied ? "Đã copy link" : "Link trọng tài"}
    </Button>
  );
}
