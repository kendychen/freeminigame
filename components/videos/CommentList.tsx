"use client";
import { useState, useTransition } from "react";
import Link from "next/link";
import { postComment, deleteComment } from "@/app/actions/videos";
import { toast } from "@/components/ui/toast";
import { translateError } from "@/lib/error-messages";
import { COMMENT_MAX } from "@/lib/videos/comment-rules";

export type CommentItem = {
  id: string;
  body: string;
  createdAt: string;
  user: { id: string; displayName: string; avatarUrl: string | null };
  canDelete: boolean;
};

export function CommentList({
  technique,
  videoId,
  comments,
  loggedIn,
  onChanged,
}: {
  technique: string;
  videoId: string;
  comments: CommentItem[];
  loggedIn: boolean;
  onChanged: () => void;
}) {
  const [body, setBody] = useState("");
  const [pending, start] = useTransition();
  const submit = () =>
    start(async () => {
      const r = await postComment(technique, videoId, body);
      if (r.error) {
        toast({ title: "Lỗi", description: translateError(r.error), variant: "destructive" });
        return;
      }
      setBody("");
      onChanged();
    });
  const remove = (id: string) =>
    start(async () => {
      const r = await deleteComment(id);
      if (r.error) {
        toast({ title: "Lỗi", description: translateError(r.error), variant: "destructive" });
      } else {
        onChanged();
      }
    });
  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold">Bình luận ({comments.length})</h3>
      {loggedIn ? (
        <div className="space-y-1">
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            maxLength={COMMENT_MAX}
            rows={2}
            placeholder="Chia sẻ cảm nhận hoặc mẹo tập…"
            className="w-full rounded-md border bg-background p-2 text-sm"
          />
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>
              {body.length}/{COMMENT_MAX}
            </span>
            <button
              type="button"
              onClick={submit}
              disabled={pending || !body.trim()}
              className="rounded-md bg-primary px-3 py-1 text-primary-foreground disabled:opacity-50"
            >
              Gửi
            </button>
          </div>
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">
          <Link
            href={`/login?next=${encodeURIComponent(`/videos/${technique}`)}`}
            className="text-primary"
          >
            Đăng nhập
          </Link>{" "}
          để bình luận.
        </p>
      )}
      <ul className="space-y-2">
        {comments.map((c) => (
          <li key={c.id} className="rounded-md border p-2 text-sm">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>
                {c.user.displayName} · {new Date(c.createdAt).toLocaleDateString("vi-VN")}
              </span>
              {c.canDelete && (
                <button type="button" onClick={() => remove(c.id)} className="text-destructive">
                  Xoá
                </button>
              )}
            </div>
            <p className="mt-1 whitespace-pre-wrap">{c.body}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}
