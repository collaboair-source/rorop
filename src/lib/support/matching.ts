// 규칙 기반 1차 매칭. AI 호출 없이 모든 공고에 점수를 매겨 정렬/필터에 쓴다.
// 점수는 30점에서 시작해 근거(reasons)별 가감 후 0~100 으로 자른다.
// 명백한 결격(지역, 사업경력, 청년/여성 전용 등)은 hard_blockers 에 담고 점수를 35 이하로 제한한다.

import type { BusinessProfile, MatchReason, MatchResult, ProgramStatus, SupportProgram } from "./types";
import { REGION_OPTIONS } from "./profile-default";
import { daysBetween, toISODate, tokenize, uniq } from "./text";

const INTEREST_SYNONYMS: Record<string, string[]> = {
  창업: ["창업", "예비창업", "초기창업", "스타트업"],
  사업화: ["사업화", "시제품", "bm"],
  기술: ["기술", "r&d", "연구개발", "기술개발"],
  "R&D": ["r&d", "연구개발", "기술개발", "연구"],
  금융: ["금융", "융자", "보증", "투자", "자금", "대출"],
  인력: ["인력", "고용", "채용", "일자리", "인건비"],
  수출: ["수출", "해외", "글로벌", "바이어"],
  글로벌: ["글로벌", "해외", "수출", "진출"],
  내수: ["내수", "판로", "마케팅", "유통", "판매"],
  "판로·마케팅": ["판로", "마케팅", "홍보", "전시", "유통", "온라인몰"],
  경영: ["경영", "컨설팅", "진단"],
  "공간·보육": ["공간", "보육", "입주", "사무실", "센터"],
  "멘토링·컨설팅": ["멘토링", "컨설팅", "교육", "코칭"],
  기타: [],
};

const STOPWORDS = new Set([
  "있는", "있다", "위한", "통해", "및", "등", "대한", "관리", "제공", "서비스", "사업", "지원", "기업", "the", "and", "for", "with", "사이의", "한다", "줄인다", "하는", "이를", "그리고", "또는",
]);

export function computeStatus(program: SupportProgram, today: string): { status: ProgramStatus; days_left: number | null } {
  if (!program.apply_end) return { status: "unknown", days_left: null };
  const days = daysBetween(today, program.apply_end);
  if (days < 0) return { status: "closed", days_left: days };
  if (days <= 7) return { status: "closing_soon", days_left: days };
  return { status: "open", days_left: days };
}

/** 창업 후 경과 연수 (예비창업자/창업일 미입력이면 null) */
export function companyAgeYears(profile: BusinessProfile, today: string): number | null {
  if (profile.business_type === "예비창업자" || !profile.founded_at) return null;
  const days = daysBetween(profile.founded_at, today);
  if (!Number.isFinite(days) || days < 0) return null;
  return days / 365.25;
}

function regionTokens(program: SupportProgram): string[] {
  const raw = [program.region, ...program.hashtags].join(",");
  return uniq(
    raw
      .split(/[,，/|\s]+/)
      .map((s) => s.trim())
      .filter((s) => s === "전국" || REGION_OPTIONS.some((r) => s.startsWith(r)))
  );
}

export function scoreProgram(program: SupportProgram, profile: BusinessProfile, today = toISODate(new Date())): MatchResult {
  const reasons: MatchReason[] = [];
  const blockers: string[] = [];
  const matchedKeywords: string[] = [];
  let score = 30;

  const { status, days_left } = computeStatus(program, today);
  if (status === "closed") {
    return { program_id: program.id, score: 0, status, days_left, hard_blockers: ["접수 마감"], reasons: [{ label: "접수 마감", delta: -30 }], matched_keywords: [] };
  }

  const title = program.title.toLowerCase();
  const fullText = [
    program.title,
    program.summary,
    program.category,
    program.subcategory,
    program.target,
    program.target_detail,
    program.region,
    program.business_age,
    program.target_age,
    program.hashtags.join(" "),
  ]
    .join(" ")
    .toLowerCase();
  const targetText = [program.target, program.target_detail, program.business_age, program.title].join(" ").toLowerCase();

  // 1. 키워드
  let kwScore = 0;
  for (const kw of profile.keywords) {
    const k = kw.trim().toLowerCase();
    if (!k) continue;
    if (title.includes(k)) {
      kwScore += 10;
      matchedKeywords.push(kw);
    } else if (fullText.includes(k)) {
      kwScore += 6;
      matchedKeywords.push(kw);
    }
  }
  kwScore = Math.min(30, kwScore);
  if (kwScore > 0) {
    score += kwScore;
    reasons.push({ label: `키워드 일치 ${matchedKeywords.length}개 (${matchedKeywords.slice(0, 4).join(", ")})`, delta: kwScore });
  }

  // 2. 사업 설명 용어 겹침
  const profileTokens = uniq(tokenize(`${profile.description} ${profile.products} ${profile.industry}`)).filter((t) => !STOPWORDS.has(t) && t.length >= 2);
  const programTokens = new Set(tokenize(fullText));
  const overlap = profileTokens.filter((t) => programTokens.has(t) && !profile.keywords.some((k) => k.toLowerCase() === t));
  if (overlap.length > 0) {
    const delta = Math.min(10, overlap.length * 2);
    score += delta;
    reasons.push({ label: `사업 설명 용어 겹침 (${overlap.slice(0, 4).join(", ")})`, delta });
  }

  // 3. 관심 분야
  const catText = `${program.category} ${program.subcategory} ${program.hashtags.join(" ")} ${program.title}`.toLowerCase();
  const hitInterest = profile.interests.find((i) => {
    const syn = INTEREST_SYNONYMS[i] || [i.toLowerCase()];
    return syn.some((s) => s && catText.includes(s));
  });
  if (hitInterest) {
    score += 12;
    reasons.push({ label: `관심 분야 일치 (${hitInterest})`, delta: 12 });
  }

  // 4. 지역
  const regions = regionTokens(program);
  const myRegion = profile.region.trim();
  if (regions.length === 0 || regions.includes("전국")) {
    score += 5;
    reasons.push({ label: "전국 / 지역 제한 없음", delta: 5 });
    // 본문에 특정 지역만 언급된 경우 약한 감점
    if (myRegion && regions.length === 0) {
      const mentioned = REGION_OPTIONS.filter((r) => title.includes(r.toLowerCase()) || title.includes(`${r}시`) || title.includes(`${r}도`));
      if (mentioned.length > 0 && !mentioned.some((r) => myRegion.startsWith(r))) {
        score -= 10;
        reasons.push({ label: `제목에 타 지역 언급 (${mentioned.join(", ")})`, delta: -10 });
      }
    }
  } else if (myRegion && regions.some((r) => r.startsWith(myRegion) || myRegion.startsWith(r))) {
    score += 10;
    reasons.push({ label: `지역 일치 (${myRegion})`, delta: 10 });
  } else {
    score -= 30;
    blockers.push(`지역 불일치 (공고: ${regions.join(", ")} / 내 사업장: ${myRegion || "미입력"})`);
    reasons.push({ label: "지역 불일치", delta: -30 });
  }

  // 5. 사업경력 / 창업 단계
  const age = companyAgeYears(profile, today);
  const isPre = profile.business_type === "예비창업자";
  const bizAge = program.business_age.replace(/\s+/g, "");
  if (bizAge && !/전체|무관|제한없음/.test(bizAge)) {
    const allowsPre = /예비/.test(bizAge);
    let ok = false;
    if (isPre) ok = allowsPre;
    else if (age !== null) {
      const unders = Array.from(bizAge.matchAll(/(\d+)년(미만|이내|이하)/g)).map((m) => Number(m[1]));
      const overs = Array.from(bizAge.matchAll(/(\d+)년이상/g)).map((m) => Number(m[1]));
      ok = unders.some((n) => age < n) || overs.some((n) => age >= n);
      if (unders.length === 0 && overs.length === 0) ok = true; // 해석 불가 → 통과
    } else ok = true;
    if (ok) {
      score += 8;
      reasons.push({ label: `사업경력 조건 충족 (${program.business_age})`, delta: 8 });
    } else {
      score -= 35;
      blockers.push(`사업경력 조건 불일치 (공고: ${program.business_age} / 나: ${isPre ? "예비창업자" : `창업 ${age?.toFixed(1)}년`})`);
      reasons.push({ label: "사업경력 조건 불일치", delta: -35 });
    }
  } else {
    const preMentioned = /예비\s*창업/.test(targetText);
    const firmMentioned = /(창업\s*\d+\s*년|초기\s*창업|창업\s*기업|중소기업|소상공인|스타트업|기업)/.test(targetText);
    const within = targetText.match(/창업\s*(\d+)\s*년\s*(이내|미만|이하)/);
    const atLeast = targetText.match(/업력\s*(\d+)\s*년\s*이상/);
    if (preMentioned && !firmMentioned && !isPre) {
      score -= 35;
      blockers.push("예비창업자 전용 공고");
      reasons.push({ label: "예비창업자 전용", delta: -35 });
    } else if (within && age !== null && age > Number(within[1])) {
      score -= 30;
      blockers.push(`창업 ${within[1]}년 이내 조건 초과 (창업 ${age.toFixed(1)}년)`);
      reasons.push({ label: `창업 ${within[1]}년 이내 조건 초과`, delta: -30 });
    } else if (atLeast && age !== null && age < Number(atLeast[1])) {
      score -= 30;
      blockers.push(`업력 ${atLeast[1]}년 이상 조건 미달 (창업 ${age.toFixed(1)}년)`);
      reasons.push({ label: `업력 ${atLeast[1]}년 이상 미달`, delta: -30 });
    } else if (isPre && !preMentioned && /(사업자\s*등록|중소기업|소상공인|업력)/.test(targetText)) {
      score -= 20;
      reasons.push({ label: "사업자(기업) 대상으로 보임 — 예비창업자는 사업자 등록 필요 가능성", delta: -20 });
    } else if (within || preMentioned) {
      score += 6;
      reasons.push({ label: "창업 단계 조건 충족", delta: 6 });
    }
  }

  // 6. 청년 / 여성 / 장애인 / 중장년
  const demoText = `${targetText} ${program.target_age}`.toLowerCase();
  const repAge = profile.representative_age;
  if (/청년/.test(demoText) && !/청년\s*(고용|채용|인턴|근로자|일자리)/.test(demoText)) {
    if (repAge === null) reasons.push({ label: "청년(만 39세 이하) 요건 — 대표자 나이 미입력", delta: 0 });
    else if (repAge <= 39) {
      score += 8;
      reasons.push({ label: "청년 요건 충족", delta: 8 });
    } else {
      score -= 25;
      blockers.push(`청년(만 39세 이하) 요건 불충족 (대표 ${repAge}세)`);
      reasons.push({ label: "청년 요건 불충족", delta: -25 });
    }
  }
  const ageRange = program.target_age.match(/만\s*(\d+)\s*세\s*이상\s*~?\s*만\s*(\d+)\s*세\s*이하/);
  if (ageRange && repAge !== null && !/전체|무관/.test(program.target_age)) {
    const [min, max] = [Number(ageRange[1]), Number(ageRange[2])];
    if (repAge < min || repAge > max) {
      score -= 20;
      blockers.push(`대상 연령 불일치 (${program.target_age})`);
      reasons.push({ label: "대상 연령 불일치", delta: -20 });
    }
  }
  if (/여성\s*(기업|창업|대표|ceo)/.test(demoText)) {
    const isWoman = profile.representative_gender === "female" || profile.certifications.some((c) => c.includes("여성기업"));
    if (isWoman) {
      score += 8;
      reasons.push({ label: "여성기업 요건 충족", delta: 8 });
    } else {
      score -= 25;
      blockers.push("여성기업/여성 창업자 대상 공고");
      reasons.push({ label: "여성기업 대상", delta: -25 });
    }
  }
  if (/장애인\s*(기업|창업)/.test(demoText)) {
    if (profile.certifications.some((c) => c.includes("장애인"))) {
      score += 8;
      reasons.push({ label: "장애인기업 요건 충족", delta: 8 });
    } else {
      score -= 25;
      blockers.push("장애인기업 대상 공고");
      reasons.push({ label: "장애인기업 대상", delta: -25 });
    }
  }
  if (/(중장년|시니어|4050)/.test(demoText)) {
    if (repAge !== null && repAge >= 40) {
      score += 5;
      reasons.push({ label: "중장년 요건 충족", delta: 5 });
    } else if (repAge !== null) {
      score -= 15;
      reasons.push({ label: "중장년(만 40세 이상) 대상", delta: -15 });
    }
  }

  // 7. 인증 우대
  const certChecks: [RegExp, string, number][] = [
    [/벤처/, "벤처기업확인", 5],
    [/이노비즈/, "이노비즈", 5],
    [/(기업부설)?연구소/, "기업부설연구소", 5],
    [/사회적\s*기업/, "사회적기업", 5],
    [/특허/, "특허", 4],
  ];
  for (const [re, cert, delta] of certChecks) {
    if (re.test(fullText) && profile.certifications.some((c) => c.includes(cert))) {
      score += delta;
      reasons.push({ label: `${cert} 보유 (공고에서 언급)`, delta });
    }
  }

  // 8. 제외 대상에 내가 해당하는지
  const excl = program.exclusion.toLowerCase();
  if (excl) {
    if (isPre && /예비\s*창업자?\s*(는|은)?\s*(제외|불가)/.test(excl)) {
      score -= 30;
      blockers.push("제외 대상: 예비창업자");
      reasons.push({ label: "제외 대상에 해당 (예비창업자)", delta: -30 });
    }
  }

  // 9. 마감 정보
  if (status === "closing_soon") reasons.push({ label: `마감 임박 D-${days_left}`, delta: 0 });
  if (status === "unknown") reasons.push({ label: "마감일 미확인 (상시 / 예산 소진 시)", delta: 0 });

  score = Math.round(Math.max(0, Math.min(100, score)));
  if (blockers.length > 0) score = Math.min(score, 35);

  return { program_id: program.id, score, status, days_left, hard_blockers: blockers, reasons, matched_keywords: uniq(matchedKeywords) };
}

export function rankPrograms(programs: SupportProgram[], profile: BusinessProfile, today = toISODate(new Date())): Map<string, MatchResult> {
  const map = new Map<string, MatchResult>();
  for (const p of programs) map.set(p.id, scoreProgram(p, profile, today));
  return map;
}
