import type { Metadata, Viewport } from "next";
import { JetBrains_Mono, Noto_Sans_KR, Outfit } from "next/font/google";

import { ServiceWorkerRegister } from "@/components/sw-register";
import { APP_NAME } from "@/lib/constants";
import { cn } from "@/lib/utils";
import "./globals.css";

const bodyFont = Noto_Sans_KR({
  variable: "--font-body",
  subsets: ["latin"],
  weight: ["400", "500", "700"],
});

const displayFont = Outfit({
  variable: "--font-display",
  subsets: ["latin"],
  weight: ["500", "600", "700"],
});

const monoFont = JetBrains_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: `${APP_NAME} · PT 맨몸 스쿼트 스크리닝`,
  description:
    "트레이너 전용 모바일 스크리닝 앱. 맨몸 스쿼트 영상 분석, 추가 검사 기록, 공유 리포트 발행을 지원합니다.",
  manifest: "/manifest.webmanifest",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#c75a1b",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <body
        className={cn(
          bodyFont.variable,
          displayFont.variable,
          monoFont.variable,
          "min-h-screen bg-background text-foreground antialiased",
        )}
      >
        <ServiceWorkerRegister />
        {children}
      </body>
    </html>
  );
}
