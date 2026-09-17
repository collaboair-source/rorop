# rorop

Next.js 16 앱. 두 기능이 들어 있습니다.

1. **Design Revision Manager** — 디자이너/클라이언트 간 디자인 수정 관리 (기존 MVP)
2. **지원사업 크롤러 + AI 매칭/가이드** — 기업마당(비즈인포)과 K-Startup 공고를 매주 수집해 내 사업과의 적합도를 점수화하고, Claude 가 "어떻게 지원할지" 가이드를 만들어 줍니다.

## 빠른 시작

```bash
npm install
cp .env.example .env      # 키를 채운다 (아래 참고)
npm run dev               # http://localhost:3000
```

회원가입 → 로그인 → 상단 **지원사업** 메뉴.

1. **내 사업 프로필** (`/support/profile`) 을 먼저 채웁니다. 기본값은 이 저장소(디자인 SaaS) 기준으로 넣어 둔 예시이므로 실제 사업 내용으로 바꾸세요.
2. **지원사업** (`/support`) 에서 **지금 크롤링** 을 누르거나 터미널에서 `npm run crawl` 을 실행합니다.
3. 목록은 규칙 기반 매칭 점수순으로 정렬됩니다. 공고를 열고 **AI 분석 실행** 을 누르면 적합도·요건 체크·끼워 맞추기 각도·새로 갖출 요건·사업계획서 가이드가 생성됩니다.

## 환경 변수

| 변수 | 필수 | 설명 |
|---|---|---|
| `BIZINFO_API_KEY` | 권장 | 기업마당 Open API 인증키. bizinfo.go.kr 로그인 → 마이페이지 → Open API 인증키 신청 (무료). 없으면 목록 HTML 을 파싱하는데 레이아웃이 바뀌면 깨질 수 있음. |
| `DATA_GO_KR_SERVICE_KEY` | 권장 | 공공데이터포털에서 **창업진흥원_K-Startup 창업지원사업 공고 정보** 활용신청 후 받는 서비스키. 인코딩/디코딩 키 둘 다 됨. 없으면 HTML 파싱. |
| `ANTHROPIC_API_KEY` | AI 기능 | Claude API 키. 없으면 규칙 점수만 동작하고 AI 분석 버튼은 비활성. |
| `SUPPORT_AI_MODEL` | 선택 | 기본 `claude-opus-5`. |
| `SUPPORT_AI_AUTO_ANALYZE_TOP_N` | 선택 | 크롤링 직후 신규 공고 중 점수 상위 N건을 자동 AI 분석. 기본 0. |
| `CRON_SECRET` | 스케줄 실행 | 스케줄러가 `/api/support/crawl` 을 호출할 때 `Authorization: Bearer <값>` 으로 인증. Vercel Cron 은 자동으로 붙여 줌. |
| `NOTIFY_WEBHOOK_URL` | 선택 | Slack / Discord Incoming Webhook. 크롤링 후 신규 매칭 상위 공고 요약을 보냄. |
| `APP_URL` | 선택 | 알림 링크에 쓸 배포 주소. |
| `SUPPORT_DATA_DIR` | 선택 | 데이터 JSON 저장 폴더. 기본 `./data`. |

## 매주 자동 실행

세 가지 중 편한 걸 고르면 됩니다.

**A. Vercel Cron** — `vercel.json` 에 매주 월요일 00:00 UTC(09:00 KST) 로 등록되어 있음. Vercel 프로젝트 환경변수에 `CRON_SECRET` 을 넣으면 끝. 서버리스는 파일시스템이 읽기 전용이라 `SUPPORT_DATA_DIR=/tmp/rorop` 처럼 잡거나, 운영에서는 `db/schema.sql` 의 테이블로 옮기는 걸 권장.

**B. 서버 crontab**

```
0 9 * * 1 cd /path/to/rorop && npm run crawl >> logs/crawl.log 2>&1
```

**C. 외부 스케줄러 (GitHub Actions, cron-job.org 등)** — 배포된 앱에 요청:

```
curl -X POST https://<앱주소>/api/support/crawl -H "Authorization: Bearer $CRON_SECRET"
```

CLI 옵션:

```bash
npm run crawl -- --dry-run            # 저장하지 않고 수집·점수만 출력 (파서 점검)
npm run crawl -- --sources=kstartup   # 특정 소스만
npm run crawl -- --analyze=5          # 신규 상위 5건 AI 분석
npm run crawl -- --no-notify
```

## 동작 방식

```
크롤러 (bizinfo / kstartup)  →  정규화(SupportProgram)  →  JSON 저장소(신규/변경 감지)
        ↓
규칙 기반 점수 (키워드·관심분야·지역·사업경력·청년/여성·인증·마감)  →  목록 정렬/필터
        ↓
Claude 분석 (요청 시 또는 크롤링 후 상위 N건)  →  적합도 / 요건 체크 / 각도 / 확보할 요건 / 가이드
        ↓
웹훅 주간 요약
```

- **크롤러**: 각 소스는 공식 API 를 먼저 시도하고 실패하거나 키가 없으면 목록 HTML → 상세 HTML 순으로 파싱합니다. 파서는 라벨("사업개요", "지원대상" …) 기반이라 레이아웃 변화에 어느 정도 견디지만, 사이트 개편 시 `src/lib/support/crawlers/*.ts` 의 URL/필드명을 손봐야 할 수 있습니다. `npm run crawl -- --dry-run` 으로 확인하세요.
- **규칙 점수** (`src/lib/support/matching.ts`): 30점에서 시작해 근거별로 가감합니다. 지역 불일치, 예비창업자 전용, 사업경력 초과, 청년/여성 전용 등 명백한 결격은 `hard_blockers` 로 표시하고 35점 이하로 묶습니다. 근거는 상세 화면 오른쪽에 표시됩니다.
- **AI 분석** (`src/lib/support/ai.ts`): Claude 구조화 출력(zod)으로 다음을 받습니다.
  - `eligibility` — 공고 요건별 충족/미충족/불명확
  - `direct_angles` — 지금 사업 그대로 어필할 포인트
  - `stretch_angles` — 사업을 재해석·확장해 요건 안에 끼워 넣는 각도 + 위험도 (허위 기재는 제안하지 않음)
  - `requirements_to_acquire` — 새로 갖추면 자격이 생기는 요건과 확보 방법·비용·기간 (벤처확인, 연구소 설립, 여성기업확인 등)
  - `application_guide` — 마감 역산 일정, 서류, 사업계획서 목차별 포인트, 핵심 메시지, 평가 지표 대응
  - 프로필의 **끼워 맞추기 허용 정도** 에 따라 제안 강도가 달라집니다.
  - 프로필을 바꾸면 기존 분석에 "이전 프로필 기준" 경고가 뜹니다.
- **직접 추가**: 크롤러가 놓친 공고(다른 사이트 포함)는 목록 화면의 **직접 추가** 로 붙여 넣으면 같은 점수·AI 가이드를 받을 수 있습니다.

## 테스트

```bash
npm test          # 파서·매칭·저장소·크롤링 파이프라인 (픽스처 기반, 네트워크 불필요)
npm run typecheck
npm run build
```

## 주요 파일

```
src/lib/support/
  types.ts              공용 타입
  store.ts              JSON 파일 저장소 (공고/프로필/분석/로그)
  profile-default.ts    기본 프로필 + 선택지
  crawlers/bizinfo.ts   기업마당 API + HTML
  crawlers/kstartup.ts  K-Startup API + HTML
  crawlers/index.ts     크롤링 파이프라인 (수집→저장→점수→AI→알림→로그)
  matching.ts           규칙 기반 점수
  ai.ts                 Claude 분석 + 마크다운 출력
  notify.ts             웹훅 요약
  service.ts            검색/정렬 조회
src/app/api/support/    programs, programs/[id], programs/[id]/analyze, profile, crawl, crawl/status
src/app/support/        목록 · 상세(AI 가이드) · 프로필 화면
scripts/crawl.ts        CLI
vercel.json             주간 크론
db/schema.sql           PostgreSQL 이전용 스키마
```
