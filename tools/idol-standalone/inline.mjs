/**
 * vite build 결과(dist/app.js, dist/app.css)를 하나의 HTML 로 합친다.
 *
 * 두 가지를 만든다.
 *  - dist/idol-standalone.html : 브라우저에서 바로 열 수 있는 완전한 HTML (로컬 확인용)
 *  - dist/idol-artifact.html   : <html>/<head>/<body> 없이 본문만 담은 형태 (Artifact 게시용)
 */

import { readFile, writeFile, readdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const dist = fileURLToPath(new URL("./dist/", import.meta.url));

const files = await readdir(dist);
const jsName = files.find((f) => f.endsWith(".js"));
const cssName = files.find((f) => f.endsWith(".css"));
if (!jsName) throw new Error("dist 에 JS 번들이 없다");
if (!cssName) throw new Error("dist 에 CSS 번들이 없다");

const js = await readFile(dist + jsName, "utf8");
const css = await readFile(dist + cssName, "utf8");

// 인라인 <script> 안에서 문서를 조기 종료시키는 시퀀스만 차단한다.
const safeJs = js.replaceAll("</script", "<\\/script");

const title = "별이 되어줘";
const body = `<title>${title}</title>
<style>
${css}
</style>
<div id="root"></div>
<script>
${safeJs}
</script>
`;

await writeFile(dist + "idol-artifact.html", body, "utf8");

await writeFile(
  dist + "idol-standalone.html",
  `<!doctype html>
<html lang="ko">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<meta name="theme-color" content="#0B1020" />
</head>
<body style="margin:0">
${body}</body>
</html>
`,
  "utf8",
);

const kb = (text) => `${Math.round(Buffer.byteLength(text, "utf8") / 1024)}KB`;
console.log(`JS ${kb(js)} / CSS ${kb(css)} → dist/idol-standalone.html, dist/idol-artifact.html`);
