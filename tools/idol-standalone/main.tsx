/**
 * 단일 HTML 빌드 진입점.
 * src/app/idol/layout.tsx 의 셸을 그대로 재현하고, 경로에 맞는 페이지를 렌더한다.
 */

import { createRoot } from "react-dom/client";
import IdolTitlePage from "@/app/idol/page";
import IdolNewGamePage from "@/app/idol/new/page";
import IdolPlayPage from "@/app/idol/play/page";
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
        : route === "/idol/endings"
          ? IdolEndingsPage
          : IdolTitlePage;

  return (
    <div className="idol-root min-h-screen w-full overflow-x-hidden bg-[#0B1020] text-[#EEF0FF]">
      <div className="mx-auto flex min-h-screen w-full max-w-[480px] flex-col bg-[#0B1020] shadow-[0_0_60px_rgba(0,0,0,0.6)]">
        <Page />
      </div>
    </div>
  );
}

const container = document.getElementById("root");
if (container) createRoot(container).render(<App />);
