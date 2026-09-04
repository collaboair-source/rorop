/**
 * 엔딩 15종 — GDD 11절 표 순서 그대로.
 * 36개월차 판정은 이 배열 순서대로 첫 매치. 조기 엔딩 3종은 엔진 규칙이 직접 지정하므로 condition 은 항상 false.
 * 에필로그의 {name} 은 아이돌 이름으로 치환된다.
 */

import type { EndingDef, EndingId, GameState } from "../types";

// 엔딩 조건 임계값 (GDD 11절)
export const ENDING_PARTNER_MIN_BOND = 95;
export const ENDING_PARTNER_MIN_FANS = 500_000;
export const ENDING_WORLD_STAR_MIN_FANS = 5_000_000;
export const ENDING_WORLD_STAR_MIN_CORE_AVG = 80;
export const ENDING_NATIONAL_MIN_FANS = 2_000_000;
export const ENDING_NATIONAL_MIN_VARIETY = 65;
export const ENDING_NATIONAL_MIN_REPUTATION = 70;
export const ENDING_TOP_IDOL_MIN_FANS = 1_000_000;
export const ENDING_ACTOR_MIN_ACTING = 80;
export const ENDING_ACTOR_MIN_FANS = 100_000;
export const ENDING_VARIETY_MIN = 85;
export const ENDING_VOCAL_MIN = 90;
export const ENDING_DANCE_MIN = 90;
export const ENDING_RAP_MIN = 85;
export const ENDING_LONGRUN_MIN_FANS = 100_000;
export const ENDING_INDIE_MIN_SKILL = 60;

function coreAverage(state: GameState): number {
  const s = state.idol.skills;
  return (s.vocal + s.dance + s.rap + s.visual + s.variety) / 5;
}

const RAW = [
  // --- 조기 엔딩 (엔진 규칙이 직접 지정) -------------------------------------
  {
    id: "contract_terminated",
    title: "계약 종료",
    grade: "D",
    summary: "24개월차까지 데뷔하지 못하고 계약이 끝났다.",
    hint: "정해진 기한 안에 무대에 서지 못하면.",
    text:
      "대표는 길게 말하지 않았다. 계약서에 적힌 날짜가 지났고, 회사는 더 기다릴 여력이 없었다.\n" +
      "{name}은 연습실 열쇠를 반납하고 짐을 쌌다. 옷 몇 벌과 악보 파일이 전부였다.\n" +
      "골목을 나서며 {name}이 웃었다. 후회는 없다고, 다만 조금 더 잘하고 싶었다고 했다.\n" +
      "몇 달 뒤 다른 회사 연습실에서 그를 봤다는 이야기를 들었다. 확인하지는 못했다.",
    condition: () => false,
  },
  {
    id: "burnout_leave",
    title: "떠나간 별",
    grade: "D",
    summary: "한계를 넘긴 하람이 스스로 무대를 떠났다.",
    hint: "스트레스가 끝까지 차오른 날, 붙잡을 수 있는 손이 없다면.",
    text:
      "마지막 날 {name}은 평소보다 일찍 나와 연습실을 정리했다. 거울에 남은 손자국까지 닦아냈다.\n" +
      "\"매니저님, 저 진짜 좋아했어요. 이 일도, 여기도.\"\n" +
      "그 말을 남기고 {name}은 문을 닫았다. 붙잡지 못한 이유를 오래 생각했다.\n" +
      "빈 연습실에는 아직 그의 물병이 남아 있었다.",
    condition: () => false,
  },
  {
    id: "scandal_fall",
    title: "스캔들의 늪",
    grade: "D",
    summary: "무너진 평판을 끝내 회복하지 못했다.",
    hint: "대중의 신뢰를 완전히 잃으면.",
    text:
      "기사들은 사실과 추측을 구분하지 않았다. 해명은 언제나 한 발 늦었다.\n" +
      "광고가 내려가고 방송이 끊겼다. 마지막까지 남아 있던 팬 카페도 닫혔다.\n" +
      "{name}은 아무것도 묻지 않고 활동 중단 공지를 받아들였다.\n" +
      "그가 잘못한 일과 잘못하지 않은 일이 이제는 구분되지 않았다.",
    condition: () => false,
  },

  // --- 36개월차 판정 (순서대로 첫 매치) ---------------------------------------
  {
    id: "partner_secret",
    title: "평생의 파트너",
    grade: "S",
    summary: "둘이 함께 새 회사를 세웠다.",
    hint: "숫자만으로는 닿을 수 없는 자리. 서로를 끝까지 믿었다면.",
    text:
      "3년 계약이 끝나던 날, {name}은 재계약서 대신 사업자등록증 신청서를 내밀었다.\n" +
      "\"매니저님이랑 하고 싶어요. 회사 이름은 같이 정해요.\"\n" +
      "작은 사무실을 얻었다. 책상 두 개와 연습실 하나로 시작하는 회사였다.\n" +
      "간판을 다는 날 {name}은 사다리 위에서 오래 웃었다. 3년 전 골목의 그 건물과 닮은 골목이었다.",
    condition: (s) =>
      s.career.debuted &&
      s.idol.social.bond >= ENDING_PARTNER_MIN_BOND &&
      s.idol.social.fans >= ENDING_PARTNER_MIN_FANS,
  },
  {
    id: "world_star",
    title: "월드 스타",
    grade: "S",
    summary: "언어가 다른 무대에서도 이름이 먼저 불렸다.",
    hint: "전 세계가 이름을 부르는 자리. 압도적인 팬과 실력이 필요하다.",
    text:
      "여섯 개 대륙의 공연장이 같은 이름을 불렀다. 자막 없이도 떼창이 돌아왔다.\n" +
      "{name}은 무대 위에서 처음으로 한국어가 아닌 인사를 했고, 관객은 한국어로 답했다.\n" +
      "3년 전 마포 골목의 연습실 사진이 다큐멘터리의 첫 장면으로 쓰였다.\n" +
      "\"저 사진, 아직도 부끄러워요.\" {name}은 그렇게 말하면서도 지우지 않았다.",
    condition: (s) =>
      s.idol.social.fans >= ENDING_WORLD_STAR_MIN_FANS && coreAverage(s) >= ENDING_WORLD_STAR_MIN_CORE_AVG,
  },
  {
    id: "national_idol",
    title: "국민 아이돌",
    grade: "S",
    summary: "온 가족이 이름을 아는 아이돌이 되었다.",
    hint: "실력만으로는 부족하다. 예능과 호감도 함께 필요하다.",
    text:
      "명절 특집에도, 저녁 뉴스 끝자락에도 {name}의 얼굴이 나왔다. 이름을 모르는 세대가 없었다.\n" +
      "광고 계약이 줄을 섰지만 {name}은 아무 제안이나 받지 않았다.\n" +
      "\"오래 하고 싶어서요. 저 아직 스물한 살이에요.\"\n" +
      "연말 무대에서 그는 3년 전 첫 버스킹 곡을 다시 불렀다. 이번에는 관객이 다 알고 있었다.",
    condition: (s) =>
      s.idol.social.fans >= ENDING_NATIONAL_MIN_FANS &&
      s.idol.skills.variety >= ENDING_NATIONAL_MIN_VARIETY &&
      s.idol.social.reputation >= ENDING_NATIONAL_MIN_REPUTATION,
  },
  {
    id: "top_idol",
    title: "톱 아이돌",
    grade: "A",
    summary: "업계가 인정하는 정상급 아이돌이 되었다.",
    hint: "백만 명이 넘는 팬을 모으면.",
    text:
      "음악방송 대기실에서 {name}은 이제 가장 안쪽 방을 쓴다. 신인들이 복도에서 인사를 하고 지나간다.\n" +
      "매년 나오는 앨범은 발매 당일 차트 상위권에 올랐다.\n" +
      "\"저 아직도 첫 무대 영상 봐요. 그때 손 떨리는 거 다 보이는데.\"\n" +
      "그렇게 말하면서 {name}은 다음 컴백 회의 자료를 넘겼다. 3년이 지나 있었다.",
    condition: (s) => s.idol.social.fans >= ENDING_TOP_IDOL_MIN_FANS,
  },
  {
    id: "actor",
    title: "배우 전향",
    grade: "A",
    summary: "무대에서 카메라 앞으로 자리를 옮겼다.",
    hint: "연기력을 끝까지 밀어붙이면 다른 길이 열린다.",
    text:
      "드라마 마지막 회 시청률이 자체 최고를 찍었다. 기사 제목에는 아이돌 출신이라는 말이 더 이상 붙지 않았다.\n" +
      "{name}은 다음 작품 대본을 들고 사무실에 왔다. 형광펜 자국이 빼곡했다.\n" +
      "\"노래는 안 그만둘 거예요. 그냥, 하고 싶은 게 하나 더 생긴 거예요.\"\n" +
      "시상식에서 신인상을 받은 날, 그는 무대 인사에서 매니저 이름을 먼저 불렀다.",
    condition: (s) =>
      s.idol.skills.acting >= ENDING_ACTOR_MIN_ACTING && s.idol.social.fans >= ENDING_ACTOR_MIN_FANS,
  },
  {
    id: "variety_star",
    title: "예능 대세",
    grade: "A",
    summary: "말과 순발력으로 자리를 만들었다.",
    hint: "예능감을 극한까지 끌어올리면.",
    text:
      "고정 프로그램이 세 개가 됐다. 편집실에서 {name}의 리액션은 늘 두 번씩 쓰였다.\n" +
      "음악 활동이 줄어든 걸 아쉬워하는 팬도 있었지만, 그는 매주 다른 얼굴로 나타났다.\n" +
      "\"무대에서 못 보여준 걸 여기서 보여주는 거예요. 저 이거 잘해요.\"\n" +
      "연말 방송 연예대상 신인상 후보에 그의 이름이 올랐다.",
    condition: (s) => s.idol.skills.variety >= ENDING_VARIETY_MIN,
  },
  {
    id: "solo_vocalist",
    title: "솔로 보컬리스트",
    grade: "A",
    summary: "목소리 하나로 남는 가수가 되었다.",
    hint: "보컬을 최고 수준까지 끌어올리면.",
    text:
      "편곡을 비우고 목소리만 남긴 앨범이었다. 화려한 무대도 안무도 없었다.\n" +
      "그런데도 공연장은 매번 매진됐고, 관객은 노래가 끝나고도 한참 앉아 있었다.\n" +
      "\"3년 전에 고음 안 나온다고 울었던 거 기억나세요?\" {name}이 웃으며 물었다.\n" +
      "기억한다고 답했다. 그날 목이 갈라지던 소리까지 전부.",
    condition: (s) => s.idol.skills.vocal >= ENDING_VOCAL_MIN,
  },
  {
    id: "performance_king",
    title: "퍼포먼스 킹",
    grade: "A",
    summary: "무대 위 몸짓으로 기준을 만들었다.",
    hint: "댄스를 최고 수준까지 끌어올리면.",
    text:
      "안무 영상 하나가 천만 조회를 넘겼다. 다른 팀들이 그의 동선을 교본처럼 따라 했다.\n" +
      "발목에는 오래된 테이핑 자국이 남아 있다. {name}은 그걸 훈장처럼 여겼다.\n" +
      "\"무대에서 제일 크게 움직이는 사람이 되고 싶었어요. 그건 된 것 같아요.\"\n" +
      "다음 투어의 안무는 그가 직접 짜기로 했다.",
    condition: (s) => s.idol.skills.dance >= ENDING_DANCE_MIN,
  },
  {
    id: "hiphop_artist",
    title: "힙합 아티스트",
    grade: "A",
    summary: "아이돌이라는 수식을 벗고 자기 이름으로 남았다.",
    hint: "랩을 끝까지 밀어붙이면.",
    text:
      "정규 앨범 열두 곡의 가사를 전부 직접 썼다. 회사는 반대했고 {name}은 물러서지 않았다.\n" +
      "평단의 반응이 먼저 왔고 숫자는 나중에 따라왔다.\n" +
      "\"제가 쓴 문장으로 욕먹는 게, 남이 쓴 문장으로 칭찬받는 것보다 나아요.\"\n" +
      "언더 시절 함께 싸이퍼를 돌던 사람들이 그의 피처링에 이름을 올렸다.",
    condition: (s) => s.idol.skills.rap >= ENDING_RAP_MIN,
  },
  {
    id: "longrun_idol",
    title: "롱런 아이돌",
    grade: "B",
    summary: "크게 터지지는 않았지만 꾸준히 무대에 남았다.",
    hint: "데뷔해서 자기 팬을 지켜내면.",
    text:
      "대형 히트는 없었다. 대신 매년 앨범이 나왔고 매년 같은 얼굴들이 공연장에 왔다.\n" +
      "{name}은 팬들의 이름을 대부분 외웠다. 팬사인회에서 안부부터 물었다.\n" +
      "\"오래 하는 게 제일 어려운 거래요. 저 그거 하고 있는 거죠?\"\n" +
      "3년째 되는 날, 첫 팬레터를 보낸 사람이 다시 편지를 보내왔다.",
    condition: (s) => s.career.debuted && s.idol.social.fans >= ENDING_LONGRUN_MIN_FANS,
  },
  {
    id: "indie_musician",
    title: "인디 뮤지션",
    grade: "B",
    summary: "큰 무대는 아니어도 계속 노래하기로 했다.",
    hint: "데뷔했지만 팬이 적거나, 데뷔하지 못해도 실력이 남아 있다면.",
    text:
      "회사와의 계약이 끝나고 {name}은 소극장 공연을 시작했다. 좌석은 백 석이 채 안 됐다.\n" +
      "직접 만든 곡을 직접 부르고 직접 굿즈를 포장했다.\n" +
      "\"돈은 안 돼요. 근데 이게 제 노래인 건 확실해요.\"\n" +
      "공연이 끝나면 관객 한 명 한 명과 인사를 했다. 3년 전 버스킹 때와 같은 방식이었다.",
    condition: (s) =>
      (s.career.debuted && s.idol.social.fans < ENDING_LONGRUN_MIN_FANS) ||
      (!s.career.debuted &&
        (s.idol.skills.vocal >= ENDING_INDIE_MIN_SKILL || s.idol.skills.rap >= ENDING_INDIE_MIN_SKILL)),
  },
  {
    id: "ordinary_life",
    title: "평범한 행복",
    grade: "C",
    summary: "무대를 떠나 보통의 하루로 돌아갔다.",
    hint: "어떤 길에도 닿지 못했을 때의 조용한 결말.",
    text:
      "{name}은 3년을 채우고 회사를 나갔다. 실패라고 부르기에는 배운 것이 많았다.\n" +
      "복학 신청서를 내고 아르바이트를 구했다. 노래는 취미로 남기기로 했다.\n" +
      "\"그래도 그때가 제일 재밌었어요. 진짜로요.\"\n" +
      "가끔 노래방에서 연습했던 곡을 부른다고 했다. 점수는 늘 잘 나온다고 한다.",
    condition: () => true,
  },
] satisfies EndingDef[];

export const ENDINGS: EndingDef[] = RAW;

const BY_ID = new Map<EndingId, EndingDef>(ENDINGS.map((e) => [e.id, e]));

export function getEnding(id: EndingId): EndingDef {
  const found = BY_ID.get(id);
  if (!found) throw new Error(`알 수 없는 엔딩: ${id}`);
  return found;
}
