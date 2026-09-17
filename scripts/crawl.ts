// 주간 크롤링 CLI.
//   npm run crawl                       전체 소스 크롤링 + 저장 + (설정 시) AI 분석/웹훅
//   npm run crawl -- --sources=bizinfo  특정 소스만
//   npm run crawl -- --analyze=5        신규 공고 상위 5건 AI 분석
//   npm run crawl -- --no-notify        웹훅 알림 생략
//   npm run crawl -- --dry-run          저장하지 않고 수집 결과만 출력 (파서 점검용)
//
// crontab 예시 (매주 월요일 09:00):
//   0 9 * * 1 cd /path/to/rorop && npm run crawl >> logs/crawl.log 2>&1

import { runCrawl } from "../src/lib/support/crawlers";
import { crawlBizinfo } from "../src/lib/support/crawlers/bizinfo";
import { crawlKstartup } from "../src/lib/support/crawlers/kstartup";
import { getProfile, storeInfo } from "../src/lib/support/store";
import { scoreProgram } from "../src/lib/support/matching";
import type { ProgramSource } from "../src/lib/support/types";

function arg(name: string): string | undefined {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : undefined;
}
function flag(name: string): boolean {
  return process.argv.includes(`--${name}`);
}

async function main() {
  const sources = (arg("sources")?.split(",").map((s) => s.trim()) as ProgramSource[] | undefined) || ["bizinfo", "kstartup"];
  const analyze = arg("analyze") ? Number(arg("analyze")) : undefined;
  const notify = !flag("no-notify");

  if (flag("dry-run")) {
    const profile = getProfile();
    for (const source of sources) {
      let out;
      try {
        out = source === "bizinfo" ? await crawlBizinfo() : source === "kstartup" ? await crawlKstartup() : null;
      } catch (err) {
        console.log(`\n=== ${source}: 실패 — ${(err as Error).message}`);
        continue;
      }
      if (!out) continue;
      console.log(`\n=== ${source}: ${out.programs.length}건 (${out.method})`);
      for (const w of out.warnings) console.log(`  ! ${w}`);
      const ranked = out.programs.map((p) => ({ p, m: scoreProgram(p, profile) })).sort((a, b) => b.m.score - a.m.score);
      for (const { p, m } of ranked.slice(0, 20)) {
        console.log(`  [${String(m.score).padStart(3)}] ${p.title}  (~${p.apply_end || "미상"}, ${p.region || "-"})`);
        if (m.hard_blockers.length) console.log(`        ✗ ${m.hard_blockers.join("; ")}`);
      }
    }
    return;
  }

  const result = await runCrawl({ trigger: "cli", sources, analyzeTopN: analyze, notify, log: (m) => console.log(m) });
  console.log("\n=== 결과");
  for (const r of result.results) {
    console.log(`  ${r.source}: ${r.ok ? "OK" : "FAIL"} (${r.method}) 수집 ${r.fetched} / 신규 ${r.added} / 변경 ${r.updated}${r.error ? ` — ${r.error}` : ""}`);
  }
  console.log(`  신규 ${result.new_program_ids.length}건, AI 분석 ${result.analyzed_program_ids.length}건, 알림 ${result.notified ? "전송" : "생략"}`);
  if (result.digest_items.length) {
    console.log("\n=== 신규 매칭 상위");
    for (const d of result.digest_items) console.log(`  [${d.match.score}] ${d.program.title} (~${d.program.apply_end || "미상"})`);
  }
  for (const w of result.warnings) console.log(`  ! ${w}`);
  const info = storeInfo();
  console.log(`\n저장소: ${info.file} (공고 ${info.programs}건, 분석 ${info.analyses}건)${info.persist_error ? `\n  ! ${info.persist_error}` : ""}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
