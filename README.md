# Rorop HQ — 나만의 비서 · 업무 사령부

창업가 한 사람을 위한 업무 관리 슈퍼 앱입니다. Claude.ai에 쌓인 사업 대화를 가져와
**사업(venture) → 할 일(task) → 체크리스트**로 구조화하고, 모든 항목에 코멘트를 남기며,
Claude 기반 **AI 비서**가 브리핑·조언·할 일 제안을 합니다.

기존 모듈인 **디자인 리비전 관리**(`/dashboard`, `/projects/...`)도 그대로 포함되어 있습니다.

## 화면

| 경로 | 내용 |
| --- | --- |
| `/hq` | 사령부: 오늘의 브리핑, 기한 지남/오늘/진행 중 할 일, 사업 현황, 최근 코멘트 |
| `/hq/ventures` | 사업 목록·생성, 상세(개요, 할 일, 코멘트, 연결된 자료) |
| `/hq/tasks` | 전체 할 일(검색·필터), 상세(체크리스트, 코멘트, 비서 조언) |
| `/hq/secretary` | AI 비서와 대화, 제안된 할 일을 한 번에 등록 |
| `/hq/import` | Claude 데이터 내보내기(`conversations.json`, `projects.json`) 업로드 또는 텍스트 붙여넣기 → AI 분석 → 사업/할 일 자동 생성 |
| `/hq/knowledge/:id` | 가져온 자료 상세: 요약, 비서의 관찰, 도출된 할 일, 원문 |

## 실행

```bash
npm install
cp .env.example .env.local   # 값 채우기
npm run dev                  # http://localhost:3000
```

첫 접속 시 `/register`에서 계정을 만들면 `/hq`로 이동합니다.

### 환경변수

| 변수 | 설명 |
| --- | --- |
| `ANTHROPIC_API_KEY` | AI 비서 활성화에 필요. 없으면 비서 기능만 꺼지고 나머지는 동작합니다. |
| `HQ_AI_ENABLED` | `1`로 두면 API 키 환경변수 없이도 AI를 켭니다 (`ant auth login` 프로필 등 SDK가 스스로 인증을 찾는 경우) |
| `SECRETARY_MODEL` | 기본 `claude-opus-5` |
| `JWT_SECRET` | 로그인 토큰 서명 키 (운영에서는 반드시 설정) |
| `RORO_DATA_DIR` | 데이터 저장 폴더. 기본 `./data` (`data/store.json`) |
| `TZ` | 서버 기본 시간대(예: `Asia/Seoul`). 브라우저가 `hq_tz` 쿠키로 자기 시간대를 보내므로 보통은 없어도 "오늘" 계산이 맞습니다. |

### Claude 대화 가져오기

1. claude.ai → 설정 → 개인정보(Privacy) → **데이터 내보내기(Export data)**
2. 이메일로 받은 zip을 풀어 `conversations.json` / `projects.json`을 `/hq/import`에 업로드
3. 가져올 대화를 선택 → "가져오기" → 각 자료에서 **✦ 분석** (또는 일괄 분석)
4. 비서가 요약·소속 사업·남은 할 일·관찰을 정리하고, 사업과 할 일을 자동 등록합니다

파일은 브라우저에서 파싱되며 선택한 항목만 서버로 전송됩니다.

## 구조

```
src/lib/db.ts              JSON 파일 저장소 (data/store.json, 원자적 쓰기)
src/lib/hq/types.ts        도메인 타입 + API 응답 타입
src/lib/hq/service.ts      사업/할 일/코멘트/자료 도메인 로직
src/lib/hq/secretary.ts    Claude 호출 (분석, 대화, 브리핑, 조언) — @anthropic-ai/sdk
src/lib/hq/claude-export.ts Claude 내보내기 파서 (브라우저/서버 공용)
src/app/api/hq/**          REST 라우트
src/app/hq/**              화면
src/components/hq/**       UI 킷, 사이드바, 체크리스트, 코멘트 스레드
db/schema.sql              PostgreSQL 전환 시 참고용 스키마
tests/                     파서·포맷 단위 테스트 (node --test)
```

## 검증

```bash
npm run typecheck        # tsc
npm run lint             # eslint (next/core-web-vitals + typescript)
npm test                 # 파서·포맷 단위 테스트
npm run build

# 서버를 띄운 뒤 (npm run dev 또는 npm start)
BASE=http://localhost:3000 node scripts/smoke-api.mjs   # API 전 구간 스모크
BASE=http://localhost:3000 node scripts/e2e-ui.mjs      # 브라우저 시나리오 (playwright 필요: npm i --no-save playwright)
BASE=http://localhost:3000 node scripts/screenshots.mjs # 데스크톱/모바일 스크린샷
```

브라우저 스크립트의 뒤로가기 검사는 `next dev`에서는 개발 서버 특성(HMR 소켓으로 bfcache 비활성)으로 실패할 수 있으며, `npm start`(프로덕션)에서는 통과합니다.
