// 지원사업 크롤러 / 매칭 / AI 가이드 공용 타입

export type ProgramSource = "bizinfo" | "kstartup" | "manual";

export const SOURCE_LABEL: Record<ProgramSource, string> = {
  bizinfo: "기업마당(비즈인포)",
  kstartup: "K-Startup(창업진흥원)",
  manual: "직접 추가",
};

export interface Attachment {
  name: string;
  url: string;
}

/** 크롤링된 공고를 소스와 무관하게 정규화한 형태 */
export interface SupportProgram {
  id: string; // `${source}:${external_id}`
  source: ProgramSource;
  external_id: string;
  title: string;
  summary: string; // 사업 개요 (plain text)
  category: string; // 지원분야 (금융/기술/인력/수출/내수/창업/경영/기타, 사업화/창업교육 등)
  subcategory: string;
  target: string; // 지원대상 요약 (예: 중소기업, 예비창업자)
  target_detail: string; // 신청대상 상세
  exclusion: string; // 제외 대상
  region: string; // 지원지역 (전국, 서울, 경기 ...)
  business_age: string; // 사업경력 조건 (예비창업자, 3년미만 ...)
  target_age: string; // 대상 연령
  organization: string; // 소관부처 / 공고기관
  executing_org: string; // 수행기관 / 주관기관
  department: string; // 담당부서
  apply_start: string | null; // YYYY-MM-DD
  apply_end: string | null; // YYYY-MM-DD (null = 상시/예산 소진 시까지/미상)
  apply_method: string;
  contact: string;
  url: string;
  hashtags: string[];
  attachments: Attachment[];
  posted_at: string | null;
  first_seen_at: string;
  last_seen_at: string;
  updated_at: string;
  content_hash: string;
}

export type BusinessType = "예비창업자" | "개인사업자" | "법인";
export type StretchTolerance = "conservative" | "moderate" | "aggressive";

/** 내 사업 프로필 — 매칭과 AI 분석의 기준이 된다 */
export interface BusinessProfile {
  company_name: string;
  description: string; // 사업 설명 (자유 서술)
  products: string; // 주요 제품 / 서비스
  industry: string; // 업종
  keywords: string[]; // 핵심 키워드 (매칭용)
  business_type: BusinessType;
  founded_at: string | null; // YYYY-MM-DD (예비창업자면 null)
  region: string; // 사업장 소재지 시/도 (예: 서울, 경기)
  employees: number;
  annual_revenue_million_krw: number; // 연 매출 (백만원)
  certifications: string[]; // 벤처기업, 이노비즈, 여성기업, 기업부설연구소, 사회적기업 ...
  representative_age: number | null;
  representative_gender: "male" | "female" | "";
  interests: string[]; // 관심 지원 분야
  goals: string; // 지원사업으로 얻고 싶은 것 (자금, 공간, 멘토링, 판로 ...)
  constraints: string; // 제약 / 메모 (예: 지방 이전 불가, 매칭 자금 여력 없음)
  stretch_tolerance: StretchTolerance; // 요건에 "끼워 맞추기"를 어디까지 허용할지
  updated_at: string;
}

export interface MatchReason {
  label: string;
  delta: number;
}

export type ProgramStatus = "open" | "closing_soon" | "closed" | "unknown";

/** 규칙 기반 1차 매칭 결과 (AI 호출 없이 계산) */
export interface MatchResult {
  program_id: string;
  score: number; // 0 ~ 100
  status: ProgramStatus;
  days_left: number | null;
  hard_blockers: string[];
  reasons: MatchReason[];
  matched_keywords: string[];
}

export type EligibilityStatus = "충족" | "미충족" | "불명확";

export interface EligibilityItem {
  requirement: string;
  status: EligibilityStatus;
  note: string;
}

export interface StretchAngle {
  angle: string; // 어떤 각도로 우리 사업을 재해석/포장할지
  how: string; // 구체적으로 사업계획서에 어떻게 쓸지
  risk: "낮음" | "보통" | "높음";
}

export interface RequirementToAcquire {
  requirement: string; // 새로 확보해야 할 요건 (예: 벤처기업확인, 기업부설연구소 설립)
  why: string; // 이 공고에서 왜 필요한지
  how: string; // 확보 방법 (기관, 절차)
  effort: string; // 난이도 / 비용
  lead_time: string; // 소요 기간
}

export interface PlanSection {
  section: string;
  points: string[];
}

export interface ApplicationGuide {
  timeline: string[]; // 마감 역산 일정
  documents: string[]; // 준비 서류
  plan_outline: PlanSection[]; // 사업계획서 목차별 핵심 포인트
  key_messages: string[]; // 심사위원에게 어필할 핵심 메시지
  evaluation_focus: string[]; // 예상 평가 지표와 대응
}

export type FitLevel = "높음" | "보통" | "낮음" | "불가";
export type RecommendedAction = "지원 권장" | "각도 조정 후 지원" | "요건 확보 후 지원" | "패스";

/** AI(Claude)가 생성한 적합도 분석 + 지원 가이드 */
export interface ProgramAnalysis {
  program_id: string;
  profile_hash: string; // 분석 당시 프로필 해시 (프로필이 바뀌면 재분석 권장)
  model: string;
  created_at: string;
  fit_score: number; // 0 ~ 100
  fit_level: FitLevel;
  recommended_action: RecommendedAction;
  summary: string;
  eligibility: EligibilityItem[];
  direct_angles: string[]; // 현재 사업 그대로 어필할 수 있는 포인트
  stretch_angles: StretchAngle[]; // "어거지라도" 끼워 맞추는 각도
  requirements_to_acquire: RequirementToAcquire[]; // 새로 갖춰야 할 요건과 확보 방법
  application_guide: ApplicationGuide;
  risks: string[];
  next_steps: string[];
}

export type CrawlTrigger = "manual" | "cron" | "cli";
export type CrawlMethod = "api" | "html" | "none";

export interface CrawlSourceResult {
  source: ProgramSource;
  ok: boolean;
  method: CrawlMethod;
  fetched: number;
  added: number;
  updated: number;
  error?: string;
}

export interface CrawlLog {
  id: string;
  trigger: CrawlTrigger;
  started_at: string;
  finished_at: string;
  results: CrawlSourceResult[];
  new_program_ids: string[];
  analyzed_program_ids: string[];
  notified: boolean;
}

/** 목록 API가 돌려주는 형태: 공고 + 규칙 점수 + (있으면) AI 분석 요약 */
export interface ProgramListItem extends SupportProgram {
  match: MatchResult;
  analysis: Pick<ProgramAnalysis, "fit_score" | "fit_level" | "recommended_action" | "created_at" | "profile_hash"> | null;
  is_new: boolean;
}
