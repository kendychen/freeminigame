"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ArrowLeft, Home, BookOpen } from "lucide-react";

// Fullscreen / embedded surfaces get no chrome.
const HIDDEN_PREFIXES = ["/embed/", "/display/"];

export function PageNav() {
  const pathname = usePathname();
  const router = useRouter();
  if (pathname === "/" || HIDDEN_PREFIXES.some((p) => pathname.startsWith(p))) return null;

  const back = () => {
    if (typeof window !== "undefined" && window.history.length > 1) router.back();
    else router.push("/");
  };

  const cls =
    "inline-flex h-8 items-center gap-1.5 rounded-md border bg-card px-2.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground";

  return (
    <div className="mx-auto flex w-full max-w-7xl items-center gap-2 px-4 pt-3">
      <button type="button" onClick={back} className={cls} aria-label="Quay lại trang trước">
        <ArrowLeft className="size-3.5" />
        Quay lại
      </button>
      <Link href="/" className={cls} aria-label="Về trang chủ">
        <Home className="size-3.5" />
        Trang chủ
      </Link>
      {pathname !== "/huong-dan" && (
        <Link href="/huong-dan" className={`${cls} ml-auto`} aria-label="Xem hướng dẫn sử dụng">
          <BookOpen className="size-3.5" />
          Hướng dẫn
        </Link>
      )}
    </div>
  );
}
