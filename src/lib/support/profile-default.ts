import type { BusinessProfile } from "./types";

export const INTEREST_OPTIONS = ["금융", "기술", "인력", "수출", "내수", "창업", "경영", "사업화", "R&D", "판로·마케팅", "공간·보육", "멘토링·컨설팅", "글로벌", "기타"];

export const CERTIFICATION_OPTIONS = [
  "벤처기업확인",
  "이노비즈(기술혁신형)",
  "메인비즈(경영혁신형)",
  "기업부설연구소",
  "연구개발전담부서",
  "여성기업확인",
  "장애인기업확인",
  "사회적기업",
  "예비사회적기업",
  "청년창업기업",
  "소상공인확인",
  "중소기업확인서",
  "직접생산확인",
  "ISO 인증",
  "특허 보유",
];

export const REGION_OPTIONS = [
  "서울",
  "경기",
  "인천",
  "부산",
  "대구",
  "광주",
  "대전",
  "울산",
  "세종",
  "강원",
  "충북",
  "충남",
  "전북",
  "전남",
  "경북",
  "경남",
  "제주",
];

/**
 * 기본 프로필. 이 저장소(디자인 수정 관리 SaaS)를 기준으로 채워 두었으며
 * /support/profile 화면에서 실제 사업 내용으로 반드시 수정해서 쓰세요.
 */
export const DEFAULT_PROFILE: BusinessProfile = {
  company_name: "",
  description:
    "디자이너와 클라이언트 사이의 디자인 수정 요청을 구조화된 피드백으로 관리하는 SaaS. 수정 횟수 제한, 버전 비교, 선택 기록을 제공해 디자인 외주 프로젝트의 커뮤니케이션 비용을 줄인다.",
  products: "디자인 리비전 관리 웹서비스 (피드백 구조화, 버전 비교, 수정 횟수 관리)",
  industry: "소프트웨어 개발 및 공급업 (SaaS)",
  keywords: ["SaaS", "디자인", "협업툴", "플랫폼", "소프트웨어", "웹서비스", "AI", "스타트업", "B2B"],
  business_type: "예비창업자",
  founded_at: null,
  region: "서울",
  employees: 1,
  annual_revenue_million_krw: 0,
  certifications: [],
  representative_age: null,
  representative_gender: "",
  interests: ["창업", "사업화", "기술", "R&D", "금융"],
  goals: "초기 사업화 자금, 사무 공간, 멘토링, 초기 고객 확보 채널",
  constraints: "",
  stretch_tolerance: "moderate",
  updated_at: new Date(0).toISOString(),
};
