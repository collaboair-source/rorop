/**
 * 「별이 되어줘」를 서버 없이 도는 단일 HTML 로 빌드한다.
 * 실행: npm run build:standalone → tools/idol-standalone/dist/idol-standalone.html
 *
 * Next.js 의존은 next/navigation 의 useRouter 뿐이라 router.ts 로 치환하면 그대로 돌아간다.
 */

import { fileURLToPath } from "node:url";
import tailwindcss from "@tailwindcss/postcss";
import { defineConfig } from "vite";

const here = fileURLToPath(new URL(".", import.meta.url));
const repoRoot = fileURLToPath(new URL("../../", import.meta.url));

export default defineConfig({
  root: here,
  base: "./",
  resolve: {
    alias: [
      { find: /^next\/navigation$/, replacement: `${here}router.ts` },
      { find: /^@\//, replacement: `${repoRoot}src/` },
    ],
  },
  css: {
    postcss: { plugins: [tailwindcss()] },
  },
  esbuild: { jsx: "automatic" },
  build: {
    outDir: `${here}dist`,
    emptyOutDir: true,
    target: "es2022",
    cssCodeSplit: false,
    // 단일 인라인 스크립트라 프리로드 폴리필이 필요 없다 (번들에서 네트워크 호출을 완전히 제거한다)
    modulePreload: false,
    assetsInlineLimit: 0,
    codeSplitting: false,
    rollupOptions: {
      output: {
        entryFileNames: "app.js",
        assetFileNames: "app.[ext]",
      },
    },
  },
});
