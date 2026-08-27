import Link from "next/link";
import { PickleballLogo } from "@/components/brand/PickleballLogo";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { AuthNavLink } from "@/components/nav/AuthNavLink";
import { FacebookIcon } from "@/components/home/HomeV1";
import { NavLinks } from "./NavLinks";

/** Shared V2 header: logo · nav · theme/facebook · auth link. Server component. */
export function SiteHeader() {
  return (
    <header className="sticky top-0 z-30 border-b bg-background/85 backdrop-blur">
      <div className="mx-auto flex h-14 w-full max-w-7xl items-center gap-5 px-4 sm:h-16">
        <Link href="/" className="flex shrink-0 items-center gap-2 text-[15px] font-extrabold">
          <PickleballLogo size={28} />
          <span>Hội Nhóm Pickleball</span>
        </Link>
        <NavLinks />
        <div className="ml-auto flex items-center gap-1.5">
          <ThemeToggle />
          <a
            href="https://www.facebook.com/linhnguyendac93"
            target="_blank"
            rel="noopener noreferrer"
            className="hidden size-9 items-center justify-center rounded-xl border text-[#1877F2] transition-colors hover:bg-[#1877F2]/10 sm:flex"
            aria-label="Facebook admin Nguyễn Đắc Linh"
            title="Facebook admin"
          >
            <FacebookIcon className="size-4" />
          </a>
          <AuthNavLink className="rounded-xl" />
        </div>
      </div>
    </header>
  );
}
