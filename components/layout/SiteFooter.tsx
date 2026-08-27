import Link from "next/link";
import { PickleballLogo } from "@/components/brand/PickleballLogo";
import { FacebookIcon } from "@/components/home/HomeV1";

const COLUMNS = [
  {
    title: "Công cụ",
    links: [
      { href: "/pair/new", label: "Bốc thăm realtime" },
      { href: "/score/new", label: "Tỷ số nhanh" },
      { href: "/quick/new", label: "Chia cặp nhanh" },
      { href: "/quick/pic/new", label: "PIC xoay cặp" },
    ],
  },
  {
    title: "Giải đấu",
    links: [
      { href: "/dashboard", label: "Bảng điều khiển" },
      { href: "/team/new", label: "Giải đồng đội" },
      { href: "/#formats", label: "5 thể thức đấu" },
    ],
  },
  {
    title: "Học",
    links: [
      { href: "/videos", label: "Video kỹ thuật" },
      { href: "/videos?lv=basic", label: "Cơ bản · mới tập" },
      { href: "/videos?lv=advanced", label: "Nâng cao" },
    ],
  },
];

/** Shared V2 footer. Server component. */
export function SiteFooter() {
  return (
    <footer className="mt-auto border-t">
      <div className="mx-auto grid w-full max-w-7xl gap-8 px-4 py-10 text-sm text-muted-foreground sm:grid-cols-2 lg:grid-cols-[1.4fr_1fr_1fr_1fr]">
        <div>
          <div className="flex items-center gap-2 font-bold text-foreground">
            <PickleballLogo size={22} /> Hội Nhóm Pickleball
          </div>
          <p className="mt-2 max-w-xs leading-relaxed">
            Web tổ chức giải Pickleball miễn phí: bốc thăm, sơ đồ thi đấu, chấm điểm qua link.
          </p>
          <p className="mt-3 text-xs">
            © {new Date().getFullYear()} Bản quyền thuộc{" "}
            <a
              href="https://www.facebook.com/linhnguyendac93"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 font-semibold text-foreground hover:text-[#1877F2]"
            >
              Nguyễn Đắc Linh <FacebookIcon className="size-3.5" />
            </a>
          </p>
        </div>
        {COLUMNS.map((c) => (
          <div key={c.title}>
            <div className="mb-2 font-bold text-foreground">{c.title}</div>
            <ul className="space-y-1.5">
              {c.links.map((l) => (
                <li key={l.href}>
                  <Link href={l.href} className="hover:text-foreground">{l.label}</Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </footer>
  );
}
