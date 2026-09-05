/**
 * 단일 HTML 빌드 진입점.
 * src/app/idol/layout.tsx 의 셸을 그대로 재현하고, 경로에 맞는 페이지를 렌더한다.
 * 폰트 변수(--font-body / --font-display)는 entry.css 가 선언하고, 폰트 파일은 index.html 의
 * Google Fonts <link> 가 받는다 (Next 앱에서는 next/font 가 같은 변수를 만든다).
 */

import { createRoot } from "react-dom/client";
import IdolTitlePage from "@/app/idol/page";
import IdolNewGamePage from "@/app/idol/new/page";
import IdolPlayPage from "@/app/idol/play/page";
import IdolAlbumPage from "@/app/idol/album/page";
import IdolEndingsPage from "@/app/idol/endings/page";
import { useRoute } from "./router";
import "./entry.css";

function App() {
  const route = useRoute();
  const Page =
    route === "/idol/new"
      ? IdolNewGamePage
      : route === "/idol/play"
        ? IdolPlayPage
        : route === "/idol/album"
          ? IdolAlbumPage
          : route === "/idol/endings"
            ? IdolEndingsPage
            : IdolTitlePage;

  return (
    <div className="idol-root min-h-screen w-full overflow-x-hidden">
      <div className="mx-auto flex min-h-screen w-full max-w-[480px] flex-col bg-[var(--bg)]">
        <Page />
      </div>
    </div>
  );
}

const container = document.getElementById("root");
if (container) createRoot(container).render(<App />);
