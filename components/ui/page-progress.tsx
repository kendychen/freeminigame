"use client";

import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

/** Top progress bar — animates on link click, completes on pathname change. */
export function PageProgress() {
  const pathname = usePathname();
  const [progress, setProgress] = useState(0);
  const [visible, setVisible] = useState(false);

  // Detect link clicks → start progress
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      const link = target?.closest("a") as HTMLAnchorElement | null;
      if (!link) return;
      const href = link.getAttribute("href");
      if (!href) return;
      // Skip external, anchor, mail, tel
      if (
        href.startsWith("http") ||
        href.startsWith("#") ||
        href.startsWith("mailto:") ||
        href.startsWith("tel:") ||
        link.target === "_blank" ||
        link.hasAttribute("download") ||
        e.metaKey || e.ctrlKey || e.shiftKey
      ) return;
      // Same-page link → skip
      if (href === pathname || href === pathname + "/") return;

      setVisible(true);
      setProgress(15);
      setTimeout(() => setProgress((p) => (p < 70 ? 50 : p)), 150);
      setTimeout(() => setProgress((p) => (p < 80 ? 75 : p)), 400);
      setTimeout(() => setProgress((p) => (p < 90 ? 88 : p)), 1000);
    };
    document.addEventListener("click", onClick, { capture: true });
    return () => document.removeEventListener("click", onClick, { capture: true });
  }, [pathname]);

  // On pathname change → complete + hide
  useEffect(() => {
    if (!visible) return;
    setProgress(100);
    const t = setTimeout(() => {
      setVisible(false);
      setProgress(0);
    }, 250);
    return () => clearTimeout(t);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  if (!visible && progress === 0) return null;

  return (
    <div
      aria-hidden
      className="pointer-events-none fixed left-0 z-[100] h-0.5 bg-primary shadow-[0_0_8px_rgba(0,0,0,0.3)] transition-[width,opacity] duration-200 ease-out"
      style={{
        top: "env(safe-area-inset-top)",
        width: `${progress}%`,
        opacity: visible ? 1 : 0,
      }}
    />
  );
}
