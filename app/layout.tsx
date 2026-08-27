import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono, Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/components/theme/theme-provider";
import { Toaster } from "@/components/ui/toast";
import { InAppBrowserBanner } from "@/components/pwa/InAppBrowserBanner";
import { SitePresenceTracker } from "@/components/admin/site-presence-tracker";
import { PageProgress } from "@/components/ui/page-progress";
import { PageNav } from "@/components/layout/PageNav";
import { getUiTheme } from "@/lib/ui-theme";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });
const jakarta = Plus_Jakarta_Sans({
  variable: "--font-jakarta",
  subsets: ["latin", "vietnamese"],
  weight: ["400", "500", "600", "700", "800"],
});

const SITE_URL = "https://hoinhompick.team";
const SITE_NAME = "Hội Nhóm Pickleball";
const DEFAULT_TITLE =
  "Hội Nhóm Pickleball — Bốc thăm, chia bảng, chấm điểm Pickleball miễn phí";
const DEFAULT_DESCRIPTION =
  "Web tổ chức giải đấu Pickleball MIỄN PHÍ: bốc thăm chia bảng realtime, sơ đồ thi đấu tự động (Single Elim, Double Elim, Round Robin, Swiss, Group+KO), trọng tài chấm điểm qua link share. Hoạt động trên điện thoại, không cần đăng ký.";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: DEFAULT_TITLE,
    template: `%s | ${SITE_NAME}`,
  },
  description: DEFAULT_DESCRIPTION,
  applicationName: SITE_NAME,
  generator: "Next.js",
  keywords: [
    "bốc thăm pickleball",
    "chia bảng pickleball",
    "giải đấu pickleball",
    "tổ chức giải pickleball miễn phí",
    "chấm điểm pickleball online",
    "bốc thăm chia bảng realtime",
    "sơ đồ thi đấu pickleball",
    "bracket pickleball Việt Nam",
    "chia cặp pickleball",
    "bốc thăm cầu lông",
    "single elimination Việt Nam",
    "double elimination",
    "round robin",
    "swiss tournament",
    "group knockout",
    "trọng tài pickleball",
    "PWA pickleball",
    "hoinhompick",
    "Hội Nhóm Pickleball",
  ],
  authors: [{ name: "Nguyễn Đắc Linh", url: "https://www.facebook.com/linhnguyendac93" }],
  creator: "Nguyễn Đắc Linh",
  publisher: SITE_NAME,
  category: "Sports",
  alternates: {
    canonical: "/",
    languages: { "vi-VN": "/" },
  },
  openGraph: {
    type: "website",
    siteName: SITE_NAME,
    title: DEFAULT_TITLE,
    description: DEFAULT_DESCRIPTION,
    url: SITE_URL,
    locale: "vi_VN",
    images: [
      {
        url: "/icon",
        width: 192,
        height: 192,
        alt: SITE_NAME,
      },
    ],
  },
  twitter: {
    card: "summary",
    title: DEFAULT_TITLE,
    description: DEFAULT_DESCRIPTION,
    images: ["/icon"],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
      "max-video-preview": -1,
    },
  },
  appleWebApp: {
    capable: true,
    title: SITE_NAME,
    statusBarStyle: "black-translucent",
  },
  formatDetection: { telephone: false, email: false, address: false },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#fafafa" },
    { media: "(prefers-color-scheme: dark)", color: "#0a0a0a" },
  ],
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  viewportFit: "cover",
};

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const uiTheme = await getUiTheme();
  return (
    <html
      lang="vi"
      suppressHydrationWarning
      data-theme={uiTheme}
      className={`${geistSans.variable} ${geistMono.variable} ${jakarta.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col overflow-x-hidden">
        <ThemeProvider>
          <PageProgress />
          <InAppBrowserBanner />
          <SitePresenceTracker />
          <PageNav />
          {children}
          <Toaster />
        </ThemeProvider>
      </body>
    </html>
  );
}
