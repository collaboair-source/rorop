import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Rorop HQ",
  description: "나만의 비서 · 업무 사령부 — 사업, 할 일, 코멘트, AI 비서를 한 곳에서",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body className="bg-gray-50 text-gray-900 min-h-screen antialiased">
        {children}
      </body>
    </html>
  );
}
