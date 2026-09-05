import type { Metadata, Viewport } from "next";
import { Black_Han_Sans, Gothic_A1 } from "next/font/google";
import "./idol.css";

/**
 * 1.3 타이포그래피 — 본문 Gothic A1(400·500·700·800), 디스플레이 Black Han Sans(400).
 * 두 폰트를 CSS 변수로 셸에 걸고, 컴포넌트는 `var(--font-body)` / `var(--font-display)` 만 참조한다.
 * subsets 는 preload 대상만 지정한다 (한글 서브셋 파일은 next/font 가 CSS 전체에서 찾아 함께 받는다).
 */
const body = Gothic_A1({
  weight: ["400", "500", "700", "800"],
  subsets: ["latin"],
  display: "swap",
  variable: "--font-body",
  fallback: ["Apple SD Gothic Neo", "Malgun Gothic", "sans-serif"],
});

const display = Black_Han_Sans({
  weight: "400",
  subsets: ["latin"],
  display: "swap",
  variable: "--font-display",
  fallback: ["Apple SD Gothic Neo", "Malgun Gothic", "sans-serif"],
});

export const metadata: Metadata = {
  title: "별이 되어줘 — 남자 아이돌 키우기",
  description:
    "소규모 기획사의 신입 매니저가 되어 연습생 한 명을 3년간 키우는 턴제 육성 시뮬레이션.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#FBF8FC",
};

export default function IdolLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className={`idol-root ${body.variable} ${display.variable} min-h-screen w-full overflow-x-hidden`}>
      <div className="mx-auto flex min-h-screen w-full max-w-[480px] flex-col bg-[var(--bg)]">
        {children}
      </div>
    </div>
  );
}
