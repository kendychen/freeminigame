import Link from "next/link";
import { Button } from "@/components/ui/button";

/** Opens the fullscreen TV page in a new tab (cast/mirror that tab to the TV). */
export function TvModeButton({ href }: { href: string }) {
  return (
    <Link href={href} target="_blank" rel="noopener">
      <Button variant="outline">📺 Màn hình hiển thị</Button>
    </Link>
  );
}
