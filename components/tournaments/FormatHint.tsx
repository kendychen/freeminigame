import Link from "next/link";
import { FORMAT_GUIDE } from "@/lib/formats-guide";

/** Plain-language box under a format <Select>. */
export function FormatHint({ format }: { format: string }) {
  const g = FORMAT_GUIDE[format];
  if (!g) return null;
  return (
    <div className="rounded-lg border border-primary/30 bg-primary/5 px-3 py-2.5 text-sm">
      <p>{g.short}</p>
      <p className="mt-1 text-xs text-muted-foreground">
        Hợp với: {g.fit}{" "}
        <Link href="/huong-dan#the-thuc" className="underline underline-offset-2 hover:text-foreground">
          So sánh các thể thức
        </Link>
      </p>
    </div>
  );
}
