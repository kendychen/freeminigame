import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/components/theme/theme-provider";
import { Toaster } from "@/components/ui/toast";
import { InAppBrowserBanner } from "@/components/pwa/InAppBrowserBanner";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "FreeMinigame — Chia cặp & bảng đấu miễn phí",
  description:
    "Tạo bảng đấu, chia cặp, và quản lý giải đấu minigame miễn phí. Hỗ trợ Single Elim, Double Elim, Round Robin, Swiss và Group + Knockout.",
  metadataBase: new URL("https://hoinhompick.team"),
  applicationName: "FreeMinigame",
  appleWebApp: {
    capable: true,
    title: "FreeMinigame",
    statusBarStyle: "black-translucent",
  },
  formatDetection: { telephone: false },
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

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="vi"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <ThemeProvider>
          <InAppBrowserBanner />
          {children}
          <Toaster />
        </ThemeProvider>
      </body>
    </html>
  );
}
