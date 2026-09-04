/**
 * 이벤트 39종 — GDD 9.2 표 그대로 (E01~E33, E35~E40. E34 는 엔진 규칙 "평판 ≤ 10 → 즉시 엔딩"으로 대체).
 *
 * 톤: 하람은 반존대("매니저님, …"), 나레이션은 담백한 3인칭. 서사 텍스트에 이모지 금지.
 * 트리거 표현에 없는 조건(E04 의 "보컬 < 40", E19 의 "평판 < 60 ×1.5")은 engine/events.ts 의
 * EXTRA_GUARDS / EXTRA_CHANCE_MUL 이 balance.ts 상수로 처리한다.
 */

import type { GameEventDef } from "../types";

const RAW = [
  // =========================================================================
  // 연습생 기간
  // =========================================================================
  {
    id: "first_evaluation",
    title: "첫 월말 평가",
    text:
      "연습실 거울 앞에 대표와 트레이너가 앉았다. 하람은 준비한 곡을 끝까지 불렀지만 마지막 소절에서 숨이 먼저 무너졌다.\n" +
      "\"매니저님, 저 아직 많이 부족하죠.\"",
    emotion: "sad",
    bg: "practice_room",
    trigger: { kind: "fixed_month", month: 3 },
    priority: 100,
    choices: [
      {
        id: "honest",
        label: "부족한 부분을 솔직하게 짚어준다",
        effects: { bond: 3, stress: 5 },
        resultText: "하람은 지적받은 것을 하나씩 수첩에 적었다. 부끄러움보다 오기가 앞서는 얼굴이었다.",
      },
      {
        id: "confidence",
        label: "잘한 부분을 강조하며 밀어붙인다",
        effects: { reputation: 2, stress: 3 },
        resultText: "대표는 짧게 웃으며 배짱은 있다고 했다. 하람의 어깨가 조금 펴졌다.",
      },
    ],
  },
  {
    id: "dorm_roommate",
    title: "숙소 룸메이트 갈등",
    text:
      "3층 숙소에서 소리가 났다. 새벽까지 연습하고 들어오는 하람과 일찍 자는 다른 연습생의 생활이 계속 어긋난 모양이다.\n" +
      "\"매니저님, 제가 뭘 잘못한 건 아닌데요. 그냥 좀 불편해서요.\"",
    emotion: "tired",
    bg: "dorm",
    trigger: { kind: "random", chance: 0.08, once: true, when: { minMonth: 2, maxMonth: 8 } },
    choices: [
      {
        id: "mediate",
        label: "둘을 앉혀 놓고 규칙을 정한다",
        effects: { bond: 2, stress: -5 },
        resultText: "샤워 순서와 소등 시간을 종이에 적어 냉장고에 붙였다. 사소한 규칙 하나로 방의 공기가 달라졌다.",
      },
      {
        id: "swap_room",
        label: "방을 바꿔준다",
        effects: { money: -10, stress: -10 },
        resultText: "이사 비용이 조금 들었지만 하람은 처음으로 알람 없이 아침까지 잤다.",
      },
      {
        id: "ignore",
        label: "연습생끼리 알아서 풀게 둔다",
        effects: { stress: 10 },
        resultText: "그 주 내내 숙소는 조용했다. 좋은 의미의 조용함은 아니었다.",
      },
    ],
  },
  {
    id: "street_cast_offer",
    title: "타 기획사의 유혹",
    text:
      "연습실 앞에서 낯선 남자가 하람에게 명함을 건넸다. 이름만 대면 아는 대형 기획사였다.\n" +
      "\"매니저님, 저 이거 어떻게 해야 돼요.\"",
    emotion: "neutral",
    bg: "practice_room",
    trigger: {
      kind: "conditional",
      chance: 0.05,
      once: true,
      when: { minSkills: { visual: 50 }, debuted: false },
    },
    choices: [
      {
        id: "hold",
        label: "같이 가자고 붙잡는다",
        effects: { bond: 5 },
        resultText: "명함은 그날 저녁 쓰레기통으로 갔다. 하람은 아무 말도 하지 않고 연습실로 돌아갔다.",
      },
      {
        id: "let_choose",
        label: "본인 선택에 맡긴다",
        hint: "호감도 판정",
        effects: {},
        resultText: "하람은 며칠을 말없이 보냈다.",
        check: {
          stat: "bond",
          min: 30,
          success: {
            text: "\"저는 여기 남을게요. 매니저님이랑 시작한 거라서요.\"",
            effects: { bond: 3 },
          },
          failure: {
            text: "결국 남기로 했지만, 그 주 내내 하람의 대답은 짧았다.",
            effects: { stress: 10, bond: -5 },
          },
        },
      },
    ],
  },
  {
    id: "vocal_crack",
    title: "고음이 안 나와요",
    text:
      "같은 구간에서 세 번 연속 목이 갈라졌다. 하람은 마이크를 내려놓고 한참 물만 마셨다.\n" +
      "\"매니저님, 오늘 목이 좀 이상해요.\"",
    emotion: "tired",
    bg: "practice_room",
    trigger: {
      kind: "conditional",
      chance: 0.15,
      when: { activityId: ["lesson_vocal", "practice_vocal"] },
    },
    choices: [
      {
        id: "push",
        label: "될 때까지 더 잡아본다",
        effects: { skills: { vocal: 3 }, stamina: -10 },
        resultText: "밤 열한 시에 겨우 한 번 제대로 나왔다. 하람은 그 한 번을 몇 번이고 다시 들었다.",
      },
      {
        id: "stop",
        label: "오늘은 여기까지 하자고 한다",
        effects: { stress: -5, bond: 1 },
        resultText: "목을 아끼는 것도 실력이라는 말에 하람은 순순히 가방을 챙겼다.",
      },
    ],
  },
  {
    id: "dance_injury",
    title: "발목 부상",
    text: "점프 후 착지에서 발목이 꺾였다. 하람은 웃으며 일어섰지만 발을 딛는 자세가 어색했다.",
    emotion: "tired",
    bg: "practice_room",
    trigger: {
      kind: "conditional",
      chance: 0.3,
      when: { activityId: ["lesson_dance", "practice_dance"], maxStamina: 24 },
    },
    priority: 40,
    choices: [
      {
        id: "hospital",
        label: "바로 병원에 데려간다",
        effects: { money: -30, injured: false, stress: 3 },
        resultText: "인대는 무사했다. 이 주만 조심하면 된다는 진단을 받고 나오는 길에 하람은 미안하다고 했다.",
      },
      {
        id: "endure",
        label: "테이핑만 하고 연습을 이어간다",
        effects: { injured: true, stress: 10, skills: { dance: 2 } },
        resultText: "그날 안무는 완성됐다. 대신 하람은 계단을 내려갈 때마다 난간을 잡았다.",
      },
    ],
  },
  {
    id: "rap_cypher",
    title: "언더 싸이퍼 초대",
    text:
      "홍대 클럽에서 싸이퍼 무대 제안이 왔다. 회사와는 무관한 자리다.\n" +
      "\"매니저님, 저 이거 해도 돼요? 진짜 하고 싶어요.\"",
    emotion: "excited",
    bg: "recording_studio",
    trigger: {
      kind: "conditional",
      chance: 0.06,
      cooldownMonths: 4,
      when: { minSkills: { rap: 40 }, debuted: false },
    },
    choices: [
      {
        id: "join",
        label: "무대에 올린다",
        effects: { skills: { rap: 4 }, fans: 500, reputation: -2, stress: 5 },
        resultText: "그날 영상은 조회수 몇만을 찍었다. 회사에는 다음 날 아침에 설명해야 했다.",
      },
      {
        id: "decline",
        label: "지금은 회사 일정에 집중하자고 한다",
        effects: { bond: 1 },
        resultText: "하람은 아쉬워했지만 알겠다고 했다. 대신 그날 연습은 평소보다 길었다.",
      },
    ],
  },
  {
    id: "sns_viral",
    title: "영상이 떴다",
    text:
      "새벽에 올린 짧은 영상이 알고리즘을 탔다. 아침에 확인하니 조회수 앞자리가 바뀌어 있었다.\n" +
      "\"매니저님, 이거 제 계정 맞아요?\"",
    emotion: "excited",
    bg: "dorm",
    trigger: { kind: "conditional", chance: 0.12, cooldownMonths: 3, when: { activityId: "sns_content" } },
    choices: [
      {
        id: "followup",
        label: "바로 후속 콘텐츠를 찍는다",
        effects: { fansPct: 0.5, fansMin: 1000, skills: { variety: 2 }, stamina: -10 },
        resultText: "이틀 만에 세 편을 올렸다. 유입은 확실히 늘었고, 하람의 눈 밑도 확실히 어두워졌다.",
      },
      {
        id: "watch",
        label: "무리하지 않고 지켜본다",
        effects: { fansPct: 0.3, fansMin: 600 },
        resultText: "며칠에 걸쳐 천천히 숫자가 올랐다. 하람은 댓글을 한 줄씩 읽으며 웃었다.",
      },
    ],
  },
  {
    id: "sns_hate",
    title: "악플",
    text:
      "댓글 창에 외모를 두고 비꼬는 말이 줄지어 달렸다. 하람은 아무렇지 않은 척 휴대폰을 뒤집어 놓았다.\n" +
      "\"괜찮아요. 이런 거 다 있는 거잖아요.\"",
    emotion: "sad",
    bg: "dorm",
    trigger: { kind: "conditional", chance: 0.1, cooldownMonths: 2, when: { activityId: "sns_content" } },
    choices: [
      {
        id: "ignore",
        label: "신경 쓰지 말라고 한다",
        effects: { stress: 8 },
        resultText: "하람은 알겠다고 했다. 그날 밤 댓글 창을 몇 번이나 다시 열었는지는 아무도 모른다.",
      },
      {
        id: "talk",
        label: "사무실에 앉혀 놓고 끝까지 들어준다",
        effects: { bond: 3, stress: 2 },
        resultText: "한 시간을 이야기했다. 나갈 때 하람은 처음으로 먼저 인사를 했다.",
      },
      {
        id: "reply",
        label: "직접 반박 글을 올리게 둔다",
        effects: { reputation: -5, stress: -5 },
        resultText: "속은 시원했지만 그 글은 캡처되어 더 멀리 퍼졌다.",
      },
    ],
  },
  {
    id: "birthday",
    title: "하람의 생일",
    text: "달력에 표시해 둔 날이다. 하람은 아무 말도 하지 않지만 오늘이 무슨 날인지는 서로 알고 있다.",
    emotion: "happy",
    bg: "dorm",
    trigger: { kind: "fixed_month", month: [7, 19, 31] },
    priority: 100,
    choices: [
      {
        id: "cake",
        label: "작은 케이크를 사 간다",
        effects: { money: -5, bond: 5 },
        resultText: "초 두 개를 꽂고 연습실 불을 껐다. 하람은 소원을 말하지 않았다.",
      },
      {
        id: "party",
        label: "연습생들을 모아 파티를 연다",
        effects: { money: -30, bond: 8, stress: -10 },
        resultText: "치킨 세 마리와 노래방 두 시간. 하람이 그렇게 크게 웃는 건 처음 봤다.",
      },
      {
        id: "skip",
        label: "일정이 빠듯해 그냥 지나간다",
        effects: { bond: -5 },
        resultText: "하람은 괜찮다고 했다. 그날 저녁 숙소로 돌아가는 뒷모습이 유난히 작아 보였다.",
      },
    ],
  },
  {
    id: "homesick",
    title: "향수병",
    text:
      "새벽 두 시, 비상계단에서 통화하는 하람을 봤다. 목소리는 밝았고 눈은 그렇지 않았다.\n" +
      "\"엄마, 저 밥 잘 먹어요. 진짜예요.\"",
    emotion: "sad",
    bg: "dorm",
    trigger: {
      kind: "conditional",
      chance: 0.08,
      cooldownMonths: 6,
      when: { minStress: 50, debuted: false },
    },
    choices: [
      {
        id: "send_home",
        label: "삼 일만 집에 다녀오라고 한다",
        effects: { money: -20, stamina: 20, stress: -25, bond: 4 },
        resultText: "돌아온 하람의 가방에는 반찬통이 가득했다. 얼굴색이 눈에 띄게 밝아졌다.",
      },
      {
        id: "comfort",
        label: "옆에 앉아 이야기를 들어준다",
        effects: { stress: -8, bond: 2 },
        resultText: "새벽 네 시까지 별 얘기 아닌 이야기를 했다. 하람은 그제야 방으로 올라갔다.",
      },
    ],
  },
  {
    id: "survival_show_offer",
    title: "서바이벌 프로그램 섭외",
    text:
      "방송사에서 연습생 서바이벌 출연 제안이 왔다. 잘하면 이름을 알리고, 못하면 편집으로 남는다.\n" +
      "\"매니저님이 하라고 하면 할게요.\"",
    emotion: "determined",
    bg: "variety_studio",
    trigger: {
      kind: "random",
      chance: 0.1,
      once: true,
      when: { minMonth: 8, maxMonth: 14, debuted: false },
    },
    choices: [
      {
        id: "join",
        label: "출연시킨다",
        effects: {
          fansByCoreAverage: { base: 20000, perAvg: 500 },
          stress: 15,
          stamina: -30,
          reputation: 3,
        },
        resultText: "두 달간 합숙과 촬영이 이어졌다. 순위는 중위권이었지만 하람의 이름을 검색하는 사람이 생겼다.",
      },
      {
        id: "decline",
        label: "지금은 실력을 더 쌓자고 한다",
        effects: { bond: 2 },
        resultText: "하람은 방송을 보지 않았다. 대신 그 시간에 연습실 불을 켰다.",
      },
    ],
  },
  {
    id: "company_crisis",
    title: "회사 자금난",
    text:
      "대표가 사무실 문을 닫고 말했다. 올해 정산이 예상보다 나빠 연습생 지원금을 줄여야 한다고 한다.\n" +
      "하람에게는 아직 말하지 않았다.",
    emotion: "neutral",
    bg: "office",
    trigger: { kind: "fixed_month", month: 10 },
    priority: 100,
    choices: [
      {
        id: "self_fund",
        label: "당분간 사비로 메운다",
        effects: { money: -100, bond: 5 },
        resultText: "하람은 어디선가 이야기를 들은 모양이었다. 그 뒤로 레슨에 한 번도 늦지 않았다.",
      },
      {
        id: "accept_cut",
        label: "지원 삭감을 받아들인다",
        effects: { supportCutMonths: 3, stress: 5 },
        resultText: "석 달 동안 지원금이 절반으로 줄었다. 식비부터 아껴야 했다.",
      },
    ],
  },
  {
    id: "trainee_rival",
    title: "라이벌 연습생",
    text:
      "새로 들어온 연습생이 첫날부터 트레이너의 칭찬을 받았다. 하람은 아무 말 없이 그 애의 연습을 끝까지 봤다.\n" +
      "\"매니저님, 저 사람 진짜 잘하네요.\"",
    emotion: "determined",
    bg: "practice_room",
    trigger: { kind: "random", chance: 0.06, once: true, when: { minMonth: 4, maxMonth: 20 } },
    choices: [
      {
        id: "compete",
        label: "이겨보자고 부추긴다",
        effects: { trainingBoostMonths: 2, stress: 5 },
        resultText: "두 달 동안 하람의 연습 시간이 눈에 띄게 늘었다. 잠은 그만큼 줄었다.",
      },
      {
        id: "cooperate",
        label: "같이 연습하게 붙여준다",
        effects: { bond: 2, skills: { variety: 2 } },
        resultText: "둘은 금세 친해졌다. 서로의 약점을 지적해 주는 사이가 됐다.",
      },
    ],
  },
  {
    id: "debut_deadline_notice",
    title: "회사의 최후통첩",
    text:
      "대표가 계약서를 책상 위에 올렸다. 24개월차까지 데뷔하지 못하면 계약은 거기서 끝난다는 조항이었다.\n" +
      "\"알고 있었어요. 괜찮아요, 매니저님.\"",
    emotion: "determined",
    bg: "office",
    trigger: { kind: "fixed_month", month: 18, when: { debuted: false } },
    priority: 110,
    choices: [
      {
        id: "accept",
        label: "남은 시간을 어떻게 쓸지 함께 정한다",
        effects: { stress: 10, trainingBoostMonths: 3 },
        resultText: "벽에 남은 달을 적었다. 그날부터 연습실 불은 마지막에 꺼졌다.",
      },
    ],
  },
  {
    id: "first_fan_letter",
    title: "첫 팬레터",
    text:
      "회사 주소로 손편지가 왔다. 버스킹 영상을 보고 썼다는, 삐뚤빼뚤한 글씨의 편지였다.\n" +
      "\"매니저님, 이거 저한테 온 거 맞죠?\"",
    emotion: "happy",
    bg: "office",
    trigger: { kind: "conditional", once: true, when: { minFans: 1000 } },
    priority: 60,
    choices: [
      {
        id: "read_together",
        label: "같이 소리 내어 읽는다",
        effects: { bond: 3, stress: -5 },
        resultText: "하람은 편지를 접어 지갑에 넣었다. 그 뒤로도 그 지갑에서 나오지 않았다.",
      },
    ],
  },
  {
    id: "rival_debut",
    title: "라이벌이 먼저 데뷔",
    text:
      "같이 오디션을 봤던 연습생이 다른 회사에서 데뷔했다. 티저 영상이 하루 종일 타임라인에 떴다.\n" +
      "\"잘됐네요. 진짜로요.\"",
    emotion: "sad",
    bg: "dorm",
    trigger: { kind: "fixed_month", month: 14, when: { debuted: false } },
    priority: 100,
    choices: [
      {
        id: "burn",
        label: "그 마음을 연습으로 돌린다",
        effects: { trainingBoostMonths: 2, stress: 10 },
        resultText: "하람은 그 영상을 한 번만 보고 껐다. 그리고 새벽까지 연습실에 있었다.",
      },
      {
        id: "congratulate",
        label: "축하 연락을 보내게 한다",
        effects: { bond: 3, stress: 3 },
        resultText: "짧은 메시지 하나를 보내고 나서야 하람의 얼굴이 풀렸다. 부러움은 부러움대로 두기로 했다.",
      },
    ],
  },
  {
    id: "talent_discovery",
    title: "숨은 재능",
    text:
      "트레이너가 수업이 끝나고 남아 말했다. 하람에게는 다른 연습생에게 없는 게 하나 있다고, 그걸 밀어야 한다고 한다.",
    emotion: "excited",
    bg: "practice_room",
    trigger: { kind: "random", chance: 0.04, once: true, when: { debuted: false } },
    choices: [
      {
        id: "focus",
        label: "그쪽을 집중적으로 파게 한다",
        effects: { bestTalentSkill: 5 },
        resultText: "가장 잘하는 것을 더 잘하게 만드는 한 주였다. 하람의 무기가 조금 더 뚜렷해졌다.",
      },
    ],
  },
  {
    id: "trainer_praise",
    title: "트레이너의 칭찬",
    text:
      "수업을 마치고 트레이너가 지나가듯 말했다. 이 정도면 이제 무대에 세워도 되겠다고.\n" +
      "\"매니저님, 저 방금 들으셨어요?\"",
    emotion: "happy",
    bg: "practice_room",
    trigger: { kind: "conditional", once: true, when: { anySkills: { vocal: 60, dance: 60, rap: 60 } } },
    priority: 60,
    choices: [
      {
        id: "share",
        label: "그 말을 오래 기억하라고 한다",
        effects: { bond: 2, stress: -5, reputation: 2 },
        resultText: "하람은 그날 저녁 내내 기분이 좋았다. 회사 안에서도 그 이야기가 돌았다.",
      },
    ],
  },

  // =========================================================================
  // 데뷔 이후
  // =========================================================================
  {
    id: "debut_stage_nerves",
    title: "첫 무대 공포",
    text:
      "쇼케이스 무대에 오르기 십 분 전, 하람의 손이 눈에 띄게 떨렸다.\n" +
      "\"매니저님, 저 지금 도망가고 싶어요.\"",
    emotion: "sad",
    bg: "stage_music_show",
    trigger: { kind: "conditional", once: true, when: { flag: "just_debuted" } },
    priority: 60,
    choices: [
      {
        id: "encourage",
        label: "어깨를 잡고 삼 년을 상기시킨다",
        effects: { bond: 3, stress: -5 },
        resultText: "하람은 숨을 크게 한 번 쉬고 무대로 걸어 나갔다. 첫 소절은 흔들렸고 두 번째부터는 아니었다.",
      },
      {
        id: "push",
        label: "지금 무너지면 끝이라고 말한다",
        effects: { stress: 10, skills: { variety: 2 } },
        resultText: "하람은 이를 악물고 무대를 끝냈다. 내려와서는 한참 말을 하지 않았다.",
      },
    ],
  },
  {
    id: "first_music_show",
    title: "첫 음악방송",
    text:
      "대기실 복도에서 오래 활동한 선배 그룹과 마주쳤다. 하람은 인사할 타이밍을 놓치고 굳어버렸다.",
    emotion: "neutral",
    bg: "stage_music_show",
    trigger: { kind: "conditional", once: true, when: { activityId: "music_show" } },
    priority: 60,
    choices: [
      {
        id: "greet",
        label: "복도 끝까지 따라가 인사하게 한다",
        effects: { reputation: 3, fans: 2000, flags: { first_music_show_done: true } },
        resultText: "선배들이 하람의 이름을 물었다. 그 뒤로 스태프들의 태도가 조금 달라졌다.",
      },
      {
        id: "freeze",
        label: "그냥 지나가게 둔다",
        effects: { stress: 5, skills: { variety: 2 }, flags: { first_music_show_done: true } },
        resultText: "하람은 대기실로 돌아와 인사말을 혼자 연습했다. 다음번에는 놓치지 않겠다고 했다.",
      },
    ],
  },
  {
    id: "hater_rumor",
    title: "루머 유포",
    text:
      "커뮤니티에 근거 없는 글이 올라왔다. 출처는 없고 조회수만 빠르게 올라간다.\n" +
      "\"이거 저 아닌데요. 진짜 아닌데요.\"",
    emotion: "sad",
    bg: "office",
    cg: "scandal_news",
    trigger: { kind: "random", chance: 0.06, cooldownMonths: 4, scandal: true, when: { debuted: true } },
    choices: [
      {
        id: "legal",
        label: "법무 대응을 진행한다",
        effects: { money: -50, reputation: 3 },
        resultText: "공식 계정에 대응 공지가 올라갔다. 글은 며칠 만에 지워졌다.",
      },
      {
        id: "silence",
        label: "대응하지 않는다",
        effects: { reputation: -5, stress: 5 },
        resultText: "언급하지 않는 동안 이야기는 사실처럼 굳어갔다.",
      },
      {
        id: "live",
        label: "해명 라이브를 켠다",
        hint: "예능감 판정",
        effects: {},
        resultText: "하람이 직접 카메라 앞에 앉았다.",
        check: {
          stat: "variety",
          min: 50,
          success: {
            text: "농담을 섞어 담백하게 설명했다. 클립이 돌면서 오히려 호감이 붙었다.",
            effects: { reputation: 5, fansPct: 0.03 },
          },
          failure: {
            text: "말이 꼬였고 표정이 굳었다. 편집된 클립만 남았다.",
            effects: { reputation: -3, stress: 8 },
          },
        },
      },
    ],
  },
  {
    id: "dating_rumor",
    title: "열애설",
    text:
      "카페에서 찍힌 사진 한 장이 퍼졌다. 얼굴은 반쯤 가려졌지만 이어링과 눈 밑 점이 선명하다.\n" +
      "\"매니저님, 저 어떻게 해요.\"",
    emotion: "sad",
    bg: "cafe",
    cg: "scandal_news",
    trigger: { kind: "random", chance: 0.03, cooldownMonths: 6, scandal: true, when: { debuted: true } },
    choices: [
      {
        id: "deny",
        label: "사실무근으로 부인한다",
        effects: { reputation: -3, fansPct: -0.05 },
        resultText: "공식 입장이 나갔다. 믿는 사람과 믿지 않는 사람이 반씩 남았다.",
      },
      {
        id: "admit",
        label: "인정하고 사과문을 낸다",
        effects: { reputation: -15, fansPct: -0.2, bond: 5, stress: -10 },
        resultText: "숫자는 크게 빠졌다. 대신 하람은 오랜만에 편하게 잤다.",
      },
      {
        id: "silence",
        label: "아무 말도 하지 않는다",
        effects: { reputation: -8, stress: 10 },
        resultText: "침묵이 길어질수록 추측이 자라났다. 하람은 하루에도 몇 번씩 검색창을 열었다.",
      },
    ],
  },
  {
    id: "drama_offer",
    title: "드라마 조연 제안",
    text:
      "웹드라마 조연 캐스팅 제안이 왔다. 분량은 많지 않지만 대사가 있는 역할이다.\n" +
      "\"저 연기 배웠던 거, 써먹어도 될까요?\"",
    emotion: "excited",
    bg: "photo_studio",
    trigger: {
      kind: "conditional",
      chance: 0.08,
      once: true,
      when: { minSkills: { acting: 50 }, debuted: true },
    },
    choices: [
      {
        id: "accept",
        label: "촬영 일정을 잡는다",
        effects: { money: 300, skills: { acting: 8 }, fans: 50000, stamina: -30, stress: 15 },
        resultText: "한 달 반의 밤샘 촬영이었다. 방영 후 하람의 이름 옆에 배우라는 단어가 붙기 시작했다.",
      },
      {
        id: "decline",
        label: "음악 활동에 집중한다",
        effects: { bond: 2 },
        resultText: "대본은 돌려보냈다. 하람은 아쉬워했지만 다음이 있을 거라고 했다.",
      },
    ],
  },
  {
    id: "cf_offer",
    title: "광고 제안",
    text: "음료 브랜드에서 모델 제안이 왔다. 조건도 나쁘지 않고 노출도 크다.",
    emotion: "happy",
    bg: "photo_studio",
    trigger: {
      kind: "conditional",
      chance: 0.08,
      once: true,
      when: { minSkills: { visual: 65 }, minFans: 100000 },
    },
    choices: [
      {
        id: "accept",
        label: "계약한다",
        effects: { money: 500, fans: 20000, reputation: 2 },
        resultText: "지하철 스크린도어에 하람의 얼굴이 걸렸다. 그 앞에서 사진을 찍는 사람들이 생겼다.",
      },
      {
        id: "decline",
        label: "이미지와 맞지 않아 거절한다",
        effects: { bond: 2, reputation: 1 },
        resultText: "돈은 놓쳤지만 하람은 오히려 안심한 얼굴이었다. 아무거나 찍지 않는다는 인상이 남았다.",
      },
    ],
  },
  {
    id: "variety_regular",
    title: "예능 고정 제안",
    text:
      "주간 예능 고정 멤버 자리가 비었다. 반년짜리 계약이고 매주 촬영이 있다.\n" +
      "\"재밌을 것 같긴 한데, 연습 시간이 줄겠죠?\"",
    emotion: "neutral",
    bg: "variety_studio",
    trigger: {
      kind: "conditional",
      chance: 0.08,
      once: true,
      when: { minSkills: { variety: 60 }, minFans: 50000 },
    },
    choices: [
      {
        id: "accept",
        label: "고정으로 들어간다",
        effects: { varietyRegularMonths: 6 },
        resultText: "여섯 달 동안 매주 촬영이 잡혔다. 얼굴은 확실히 알려지고 체력은 확실히 깎인다.",
      },
      {
        id: "decline",
        label: "무대에 집중하기로 한다",
        effects: { stress: -3 },
        resultText: "일정표가 다시 단순해졌다. 하람은 그편이 낫다고 했다.",
      },
    ],
  },
  {
    id: "stage_accident",
    title: "무대 사고",
    text: "생방송 중 안무 동선에서 하람이 미끄러졌다. 바로 일어나 남은 절반을 끝냈지만 카메라는 이미 다 담았다.",
    emotion: "sad",
    bg: "stage_music_show",
    trigger: {
      kind: "conditional",
      chance: 0.2,
      cooldownMonths: 3,
      when: { activityId: "music_show", maxStamina: 29 },
    },
    priority: 40,
    choices: [
      {
        id: "apology",
        label: "정중한 사과문을 올린다",
        effects: { reputation: 1, stress: 5 },
        resultText: "성실하다는 반응이 대부분이었다. 하람은 그날 밤 영상을 스무 번쯤 돌려봤다.",
      },
      {
        id: "humor",
        label: "유머로 넘기게 한다",
        hint: "예능감 판정",
        effects: {},
        resultText: "하람이 직접 그 장면을 짚었다.",
        check: {
          stat: "variety",
          min: 40,
          success: {
            text: "\"제가 무대를 좀 아꼈어요.\" 짧은 한 마디가 밈이 되어 퍼졌다.",
            effects: { fans: 5000, reputation: 3 },
          },
          failure: {
            text: "농담이 어색하게 미끄러졌다. 클립은 다른 의미로 돌았다.",
            effects: { reputation: -3, stress: 5 },
          },
        },
      },
    ],
  },
  {
    id: "overseas_fanmeet",
    title: "해외 팬미팅",
    text:
      "일본과 동남아를 도는 팬미팅 투어 제안이 왔다. 3주 일정이고 이동이 대부분이다.\n" +
      "\"제 노래를 거기서도 듣는다고요?\"",
    emotion: "excited",
    bg: "airport",
    trigger: { kind: "conditional", chance: 0.06, once: true, when: { minFans: 300000 } },
    choices: [
      {
        id: "go",
        label: "투어를 돈다",
        effects: { money: 400, fans: 50000, stamina: -35, stress: 10 },
        resultText: "공항과 호텔과 무대만 반복된 3주였다. 돌아오는 비행기에서 하람은 내내 잤다.",
      },
      {
        id: "stay",
        label: "국내 일정에 집중한다",
        effects: { fans: 5000, bond: 1 },
        resultText: "해외 팬들에게는 영상 편지를 보냈다. 국내 스케줄은 그만큼 촘촘해졌다.",
      },
    ],
  },
  {
    id: "anti_cafe",
    title: "안티 카페",
    text: "회원 수 천 명대의 안티 카페가 생겼다. 오래된 사진과 잘라낸 발언이 정리되어 올라와 있다.",
    emotion: "sad",
    bg: "office",
    trigger: {
      kind: "conditional",
      chance: 0.06,
      cooldownMonths: 5,
      scandal: true,
      when: { maxReputation: 40, minFans: 100000 },
    },
    choices: [
      {
        id: "letter",
        label: "팬들에게 직접 편지를 쓰게 한다",
        effects: { reputation: 5, bond: 2 },
        resultText: "긴 글 하나가 올라왔다. 변명은 없었고 앞으로의 이야기만 있었다.",
      },
      {
        id: "ignore",
        label: "보지 말라고 하고 넘어간다",
        effects: { stress: 5 },
        resultText: "보지 말라고 했지만 하람은 이미 다 읽은 뒤였다.",
      },
    ],
  },
  {
    id: "self_produce",
    title: "자작곡 도전",
    text:
      "하람이 작업 파일 하나를 들려줬다. 완성도는 거칠지만 방향은 분명하다.\n" +
      "\"다음 타이틀, 제가 써보면 안 될까요?\"",
    emotion: "determined",
    bg: "recording_studio",
    trigger: {
      kind: "conditional",
      chance: 0.06,
      once: true,
      when: { anySkills: { rap: 70, vocal: 70 }, debuted: true },
    },
    choices: [
      {
        id: "try",
        label: "다음 타이틀곡을 맡긴다",
        effects: { flags: { self_produced: true }, stress: 10, bond: 4 },
        resultText: "작업실에서 나오지 않는 날이 늘었다. 잘 되면 크게 되고, 아니면 그만큼 크게 무너진다.",
      },
      {
        id: "company_song",
        label: "이번엔 회사 곡으로 간다",
        effects: { stress: -3 },
        resultText: "하람은 파일을 저장해 두겠다고 했다. 언젠가는 쓰겠다는 뜻이었다.",
      },
    ],
  },
  {
    id: "slump",
    title: "슬럼프 고백",
    text:
      "차 안에서 하람이 창밖을 보며 말했다.\n" +
      "\"매니저님, 요즘 무대가 무서워요. 올라가기 전에 자꾸 손이 차가워져요.\"",
    emotion: "sad",
    bg: "office",
    trigger: { kind: "conditional", chance: 0.15, cooldownMonths: 6, when: { minStress: 80, debuted: true } },
    priority: 50,
    choices: [
      {
        id: "break",
        label: "활동을 멈추고 휴식기를 선언한다",
        effects: { fansPct: -0.1, stress: -40, bond: 8, fullStamina: true },
        resultText: "공백은 숫자로 돌아왔다. 대신 다시 나온 하람의 눈은 예전 같았다.",
      },
      {
        id: "endure",
        label: "지금 멈추면 안 된다고 설득한다",
        effects: { stress: 10, allSkills: -2 },
        resultText: "일정은 그대로 굴러갔다. 무대의 밀도는 눈에 띄게 떨어졌다.",
      },
    ],
  },
  {
    id: "world_tour_offer",
    title: "월드투어",
    text: "해외 프로모터가 8개 도시 투어를 제안했다. 규모도 조건도 지금까지와 다른 단위다.",
    emotion: "excited",
    bg: "concert_arena",
    cg: "world_tour",
    trigger: { kind: "conditional", chance: 0.06, once: true, when: { minFans: 1500000 } },
    choices: [
      {
        id: "go",
        label: "투어를 확정한다",
        effects: { money: 2000, fans: 400000, stamina: -40, stress: 20, flags: { cg_world_tour: true } },
        resultText: "여덟 도시의 함성이 전부 하람의 이름이었다. 마지막 공연에서 하람은 무대 위에서 한참 서 있었다.",
      },
      {
        id: "stay",
        label: "국내 활동에 집중한다",
        effects: { fans: 100000 },
        resultText: "투어는 다음으로 미뤘다. 대신 국내 무대의 완성도를 끝까지 끌어올렸다.",
      },
    ],
  },
  {
    id: "bond_confession",
    title: "진심",
    text:
      "정산 서류를 정리하던 새벽, 하람이 사무실 문을 열고 들어왔다.\n" +
      "\"매니저님 없었으면 저 여기 없었어요. 그 말은 꼭 하고 싶었어요.\"",
    emotion: "happy",
    bg: "office",
    cg: "bond_promise",
    trigger: { kind: "conditional", once: true, when: { minBond: 80, debuted: true } },
    priority: 60,
    choices: [
      {
        id: "answer",
        label: "끝까지 같이 가자고 답한다",
        effects: { bond: 10, stress: -10, flags: { cg_bond_promise: true } },
        resultText: "그날 이후 하람은 무대에서 종종 카메라가 아닌 쪽을 봤다. 그쪽에는 늘 매니저가 서 있었다.",
      },
    ],
  },
  {
    id: "charity",
    title: "기부·봉사 제안",
    text: "소아병동에서 작은 공연 요청이 왔다. 비공개 일정이고 촬영도 없다.",
    emotion: "neutral",
    bg: "hospital",
    trigger: { kind: "conditional", chance: 0.05, cooldownMonths: 6, when: { maxReputation: 69, debuted: true } },
    choices: [
      {
        id: "join",
        label: "일정을 비우고 다녀온다",
        effects: { money: -100, reputation: 10, fans: 5000, bond: 2 },
        resultText: "기사 한 줄 나가지 않은 일정이었다. 그런데도 그날 이야기는 어디선가 퍼져 돌아왔다.",
      },
      {
        id: "decline",
        label: "일정상 어렵다고 답한다",
        effects: { stress: -2 },
        resultText: "대신 후원금만 보냈다. 하람은 다음에는 꼭 가겠다고 했다.",
      },
    ],
  },
  {
    id: "dance_cover_viral",
    title: "댄스 커버 화제",
    text: "연습실에서 찍은 커버 영상이 챌린지로 번졌다. 다른 팀들이 하람의 동작을 따라 찍기 시작했다.",
    emotion: "excited",
    bg: "practice_room",
    trigger: {
      kind: "conditional",
      chance: 0.1,
      cooldownMonths: 3,
      when: { activityId: "sns_content", minSkills: { dance: 60 } },
    },
    choices: [
      {
        id: "ride",
        label: "흐름을 타고 계속 올린다",
        effects: { fansTimesPhaseMul: 3000, skills: { variety: 1 } },
        resultText: "일주일 동안 태그에 하람의 이름이 붙은 영상이 수백 개 올라왔다.",
      },
    ],
  },
  {
    id: "manager_burnout",
    title: "매니저인 나도",
    text:
      "밴 운전석에서 잠깐 눈을 붙였다가 눈을 뜨니 하람이 담요를 덮어놓고 있었다.\n" +
      "\"매니저님도 사람이잖아요. 저만 힘든 거 아니잖아요.\"",
    emotion: "neutral",
    bg: "office",
    trigger: { kind: "fixed_month", month: 20 },
    priority: 100,
    choices: [
      {
        id: "accept",
        label: "솔직하게 힘들다고 말한다",
        effects: { bond: 6 },
        resultText: "그날 이후 하람은 이동 중에 먼저 말을 걸지 않았다. 대신 커피를 두 잔 사 왔다.",
      },
      {
        id: "pretend",
        label: "괜찮다고 웃어넘긴다",
        effects: { bond: 1 },
        resultText: "하람은 더 묻지 않았다. 담요는 그날부터 조수석에 항상 놓여 있었다.",
      },
    ],
  },

  // =========================================================================
  // 공통 / 위기
  // =========================================================================
  {
    id: "stress_break",
    title: "한계",
    text:
      "연습실 바닥에 앉은 하람이 고개를 들지 않은 채 말했다.\n" +
      "\"매니저님, 저 그만두고 싶어요. 진심이에요.\"",
    emotion: "sad",
    bg: "practice_room",
    cg: "burnout_night",
    trigger: { kind: "conditional", forced: true },
    priority: 900,
    choices: [
      {
        id: "hold",
        label: "붙잡는다",
        hint: "호감도 판정",
        effects: {},
        resultText: "한참 동안 아무 말도 하지 않았다.",
        check: {
          stat: "bond",
          min: 40,
          success: {
            text: "하람은 결국 고개를 끄덕였다. 한 달을 통째로 비우고 처음부터 다시 시작하기로 했다.",
            effects: { setStress: 50, allSkills: -3, fullStamina: true },
          },
          failure: {
            text: "하람은 짐을 쌌다. 연습실 열쇠는 책상 위에 놓여 있었다.",
            effects: {},
            endingId: "burnout_leave",
          },
        },
      },
      {
        id: "release",
        label: "놓아준다",
        effects: {},
        resultText: "붙잡을 자격이 있는지 알 수 없었다. 하람은 인사를 하고 문을 닫았다.",
        endingId: "burnout_leave",
      },
    ],
  },
  {
    id: "stamina_collapse",
    title: "쓰러짐",
    text: "연습 도중 하람이 그대로 주저앉았다. 얼굴이 창백했고 대답이 늦었다.",
    emotion: "tired",
    bg: "practice_room",
    trigger: { kind: "conditional", forced: true },
    priority: 950,
    choices: [
      {
        id: "hospital",
        label: "응급실로 데려간다",
        effects: { money: -50, setStamina: 60, stress: -10 },
        resultText: "탈진과 영양 불균형이라는 진단이 나왔다. 링거를 맞는 내내 하람은 죄송하다는 말만 했다.",
      },
      {
        id: "endure",
        label: "숙소에서 재운다",
        effects: { injured: true, stress: 15, setStamina: 30 },
        resultText: "다음 날 하람은 아무렇지 않은 척 연습실에 나왔다. 몸은 아무렇지 않지 않았다.",
      },
    ],
  },
  {
    id: "money_crisis",
    title: "생활고",
    text:
      "이번 달 통장이 비었다. 하람의 밥값과 교통비를 계산하다 손이 멈췄다.\n" +
      "\"매니저님, 저 컵라면 좋아해요. 진짜로요.\"",
    emotion: "tired",
    bg: "convenience_store",
    trigger: {
      kind: "conditional",
      atMonthEnd: true,
      cooldownMonths: 4,
      when: { flag: "low_money", debuted: false },
    },
    priority: 80,
    choices: [
      {
        id: "advance",
        label: "회사에서 가불을 받는다",
        effects: { money: 100, debtMonths: 4 },
        resultText: "넉 달에 걸쳐 갚는 조건이었다. 당장 이번 달은 넘길 수 있게 됐다.",
      },
      {
        id: "endure",
        label: "알바를 더 넣어 버틴다",
        effects: { stress: 5, bond: 1 },
        resultText: "하람은 야간 알바 하나를 더 잡았다. 연습 시간이 줄었지만 아무 말도 하지 않았다.",
      },
    ],
  },
  {
    id: "gift",
    title: "선물",
    text: "문득 하람에게 뭐라도 해주고 싶어졌다. 대단한 건 아니어도 좋을 것 같았다.",
    emotion: "happy",
    bg: "office",
    trigger: { kind: "fixed_month", month: [6, 12, 18, 24, 30] },
    priority: 100,
    choices: [
      {
        id: "shoes",
        label: "새 운동화를 사준다",
        effects: { money: -30, bond: 4 },
        resultText: "하람은 상자를 열어보고 한참 말이 없었다. 다음 날부터 그 신발만 신었다.",
      },
      {
        id: "letter",
        label: "짧은 손편지를 쓴다",
        effects: { bond: 2, stress: -3 },
        resultText: "연습실 사물함에 접어 넣어두었다. 저녁에 하람에게서 답장이 왔다.",
      },
      {
        id: "later",
        label: "다음에 제대로 챙겨주기로 한다",
        effects: {},
        resultText: "오늘은 그냥 지나갔다. 다음이 있을 거라고 생각했다.",
      },
    ],
  },
] satisfies GameEventDef[];

export const EVENTS: GameEventDef[] = RAW;

const BY_ID = new Map<string, GameEventDef>(EVENTS.map((e) => [e.id, e]));

export function findEvent(id: string): GameEventDef | null {
  return BY_ID.get(id) ?? null;
}

export function getEvent(id: string): GameEventDef {
  const found = BY_ID.get(id);
  if (!found) throw new Error(`알 수 없는 이벤트: ${id}`);
  return found;
}

/** 엔진 규칙이 강제로 띄우는 이벤트 id */
export const FORCED_EVENT_STRESS_BREAK = "stress_break";
export const FORCED_EVENT_STAMINA_COLLAPSE = "stamina_collapse";
export const MONTH_END_EVENT_MONEY_CRISIS = "money_crisis";
