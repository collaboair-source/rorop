import type { Metadata, Viewport } from "next";
import "./idol.css";

export const metadata: Metadata = {
  title: "별이 되어줘 — 남자 아이돌 키우기",
  description:
    "소규모 기획사의 신입 매니저가 되어 연습생 한 명을 3년간 키우는 턴제 육성 시뮬레이션.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#0B1020",
};

export default function IdolLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="idol-root min-h-screen w-full overflow-x-hidden bg-[#0B1020] text-[#EEF0FF]">
      <div className="mx-auto flex min-h-screen w-full max-w-[480px] flex-col bg-[#0B1020] shadow-[0_0_60px_rgba(0,0,0,0.6)]">
        {children}
      </div>
    </div>
  );
}
