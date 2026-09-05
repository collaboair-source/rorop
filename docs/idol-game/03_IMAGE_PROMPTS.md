# 이미지 생성 프롬프트 v2 (GPT 이미지 생성용)

- 문서 버전: 2.0 (2026-09-05) — UI 재설계(`04_UI_REDESIGN.md`)에 맞춰 스타일·구도·작업 순서를 전면 개정
- 사용법: 프롬프트를 GPT(이미지 생성)에 그대로 붙여 넣고, 결과 PNG 를 지정 경로·파일명으로 `public/idol/` 에 넣는다. 파일이 없으면 게임은 실루엣 폴백을 쓰므로 순서와 무관하게 하나씩 채워도 된다.
- 총 58장. **아이돌 초상 18장이 게임의 얼굴**이다. 여기에 시간을 가장 많이 쓴다.

---

## 0. 가장 중요한 것: 하람이 매번 같은 사람이어야 한다

이미지 생성기는 같은 프롬프트를 줘도 얼굴이 조금씩 달라진다. 이 게임에서는 18장의 초상이 한 인물의 3년이므로 얼굴이 흔들리면 "내 애가 크는 느낌"이 깨진다. 그래서 순서가 중요하다.

1. **캐릭터 시트 1장을 먼저 만든다** (1-1). 마음에 드는 결과가 나올 때까지 여기서만 반복한다. 얼굴이 결정되면 저장한다.
2. 이후 모든 인물 이미지는 **그 시트를 첨부**하고 프롬프트 첫 줄에 `Use the attached image as the exact same person. Keep face, hair, mole, earring identical.` 를 붙인다.
3. 표정 6종은 **한 장의 3×2 표정 시트**로 뽑는다 (1-2). 한 이미지 안에서는 얼굴이 훨씬 일관되게 나온다. 그다음 GPT 에 "각 칸을 1024×1536 투명 배경 PNG 로 하나씩 출력해 줘"라고 하거나 직접 잘라 저장한다.
4. 배경 15장은 인물이 없어 참조가 필요 없다. 이벤트 CG·엔딩은 다시 시트를 첨부한다.

**합격 체크리스트** (하나라도 틀리면 다시): 왼쪽 눈 밑 점 / 왼쪽 귀 은색 링 이어링 / 웃을 때 왼쪽 볼 보조개 / 검은 머리 / 글자·워터마크 없음 / 손가락 이상 없음 / 얼굴이 잘리지 않음 / 투명 배경 가장자리가 깨끗함.

---

## 1. 공통 블록 (복사해서 프롬프트 앞에 붙인다)

### [STYLE] 스타일
```
Art style: polished semi-realistic digital illustration in the style of premium K-pop idol mobile game splash art.
Semi-realistic proportions, soft airbrushed skin with a subtle blush, glossy hair with individually rendered strands,
clean sharp facial features, high-end idol photoshoot lighting: soft key light plus a coral (#FF6B8A) rim light and a faint lilac fill.
Not flat anime, not chibi, not a photograph. Crisp edges, no painterly smudging on the face.
No text, no letters, no logos, no watermark, no signature.
```

### [HARAM] 캐릭터 바이블
```
Character "Haram" (서하람): Korean male K-pop idol, 18–21 years old, 178cm, slim athletic build, long neck, straight shoulders.
Face: oval face with a sharp jawline, straight nose, soft "puppy-like" dark brown almond eyes with double eyelids,
a small beauty mark just under the LEFT eye, a single dimple on the LEFT cheek when smiling, fair skin with a warm undertone,
natural pink lips. Hair: soft black hair, curtain bangs parted slightly off-center, a few strands falling over the brows.
One thin silver hoop earring on the LEFT ear. Gentle, slightly shy baseline expression.
```

### [OUTFIT] 단계별 의상

| stage | 의상 |
|---|---|
| `trainee` | `oversized black hoodie with the hood down, a small white towel around the neck, hair slightly messy from practice` |
| `rookie` | `crisp white oxford shirt with the top button open, layered thin silver chain necklaces, black slacks, an in-ear monitor with a cable behind the left ear, hair styled with light volume` |
| `star` | `black velvet tailored suit with subtle crystal embroidery on the lapels, black silk shirt, hair swept back with a few loose strands, two silver earrings on the left ear, confident polished look` |

### [PORTRAIT] 초상 구도 (18장 공통 — 구도가 같아야 게임의 초상 자리에 똑같이 들어간다)
```
Composition: waist-up portrait, body turned slightly three-quarter, face toward the viewer, eyes looking at the camera.
Top of the head about 8% below the top edge, waist at the bottom edge, centered horizontally.
Transparent background (PNG with alpha), clean cut-out edges. Size 1024x1536.
```

---

## 2. 초상 18장 (`public/idol/char/{stage}_{emotion}.png`) — P0

### 1-1. 캐릭터 시트 (참조용, 게임에는 안 씀) — 여기서 얼굴을 확정한다
```
[STYLE] [HARAM]
Character reference sheet on a plain light-gray background: large front-facing bust portrait in the center,
three-quarter view and left profile on the sides, and a small full-body standing pose in the trainee outfit
(oversized black hoodie, gray sweatpants, white sneakers). Neutral calm expression in every view. Same face in every view.
Size 1536x1024.
```

### 1-2. 표정 시트 (단계마다 1장, 총 3장 → 잘라서 18장)
```
[STYLE] [HARAM]
Use the attached image as the exact same person. Keep face, hair, mole, earring identical.
A 3x2 grid expression sheet of Haram wearing {OUTFIT}, six waist-up portraits with identical framing and scale, plain white background:
1) neutral — calm, lips closed, looking at the viewer
2) happy — bright warm smile showing the left dimple, eyes slightly crescent
3) tired — exhausted, half-closed eyes, faint dark circles, a bead of sweat at the temple, shoulders slightly slumped
4) sad — downcast eyes, brows slightly drawn, lips pressed, glistening eyes
5) excited — wide sparkling eyes, open-mouth grin, leaning slightly forward
6) determined — intense focused gaze straight at the viewer, brows set, small confident smirk
Size 1536x1024.
```
그다음:
```
Now output panel {n} only as a standalone waist-up portrait: [PORTRAIT] — same outfit, same expression, transparent background.
```
파일명 순서: `neutral`, `happy`, `tired`, `sad`, `excited`, `determined`.

### 1-3. 한 장씩 뽑을 때 (시트 방식이 잘 안 되면)
```
[STYLE] [HARAM]
Use the attached image as the exact same person. Keep face, hair, mole, earring identical.
[PORTRAIT]
Wearing {OUTFIT}. Expression: {표정 프롬프트}.
```

우선순위: `trainee_neutral` → `rookie_neutral` → `star_neutral` (이 3장만 있어도 게임의 인상이 완전히 달라진다) → 나머지 15장.

---

## 3. 배경 15장 (`public/idol/bg/{id}.png`, 1536×1024) — P1

공통 접두:
```
[STYLE] Empty background scene with no people, wide establishing shot, cinematic depth, soft haze.
Lighting accents in coral (#FF6B8A) and soft lilac where lights appear. Size 1536x1024.
```

| id | 장면 |
|---|---|
| `practice_room` | `a K-pop dance practice room with a full mirror wall, light wooden floor, a portable speaker, water bottles, late-evening fluorescent light` |
| `dorm` | `a small trainee dorm bedroom, bunk bed, desk lamp, posters without text, laundry on a chair, warm night lamp light` |
| `office` | `a small entertainment agency office, whiteboard with blank schedule grid, laptops, a couch, a window onto a Seoul alley, daylight` |
| `cafe` | `a cozy Seoul cafe seen from behind the counter, espresso machine, pastries in a glass case, morning light` |
| `convenience_store` | `a Korean convenience store interior at night, bright shelves, glass fridge doors, checkout counter` |
| `park_busking` | `a Hongdae street busking spot at dusk, small crowd silhouettes at a distance, string lights, a portable amp on the pavement` |
| `stage_music_show` | `a Korean music show TV stage seen from the wings, LED screens with abstract light, coral and lilac spotlight beams, haze` |
| `fansign` | `a fan-signing venue with a long white table, blank banners, glowing coral light sticks, rows of chairs` |
| `variety_studio` | `a colorful TV variety show studio set with quirky props, studio lights, cameras, bright and fun` |
| `airport` | `an airport departure hall with tall windows, morning light, rolling suitcases, planes outside` |
| `award_stage` | `a grand year-end award ceremony stage, golden confetti falling, a huge chandelier of lights, dramatic` |
| `hospital` | `a quiet hospital room, a bed, an IV stand, pale blue curtains, soft morning light` |
| `concert_arena` | `a packed stadium at night seen from the stage, an ocean of coral light sticks, fireworks, wide angle` |
| `recording_studio` | `a music recording studio with a mixing console, a vocal booth behind glass, warm dim light` |
| `photo_studio` | `a fashion photo studio with a seamless white backdrop, softboxes, a clothing rack, clean and bright` |

---

## 4. 이벤트 CG 8장 (`public/idol/cg/{id}.png`, 1536×1024) — P2
공통 접두: `[STYLE] [HARAM] Use the attached image as the exact same person. Keep face, hair, mole, earring identical. Cinematic illustration, Size 1536x1024.`

| id | 장면 |
|---|---|
| `debut_showcase` | `Haram in the rookie outfit at center stage of a small showcase hall, holding a microphone, nervous but shining, the first spotlight on him, a small crowd of fans below` |
| `first_win` | `Haram in the rookie outfit on a music show stage holding a first-place trophy with both hands, crying and laughing at once, confetti, coral and lilac lights` |
| `award_grand_prize` | `Haram in the star outfit on a grand award stage holding a large crystal trophy, golden confetti, the crowd standing, dramatic low angle` |
| `scandal_news` | `Haram in a hoodie and cap sitting alone in a dark dorm room, phone glow on his face, dozens of blurred notification bubbles floating (no readable text), heavy mood` |
| `burnout_night` | `Haram sitting on the practice room floor late at night, back against the mirror, towel over his head, exhausted, one dim ceiling light` |
| `world_tour` | `Haram in the star outfit on a stadium stage at night, arms wide open toward an ocean of coral light sticks, fireworks, ecstatic` |
| `bond_promise` | `Haram and a manager figure seen from behind (face not visible, black staff jacket) sitting side by side on a rooftop at sunset over Seoul, sharing canned coffee, warm and calm` |
| `comeback_stage` | `Haram mid-dance on a music show stage in a sleek new outfit, sharp pose, motion energy, LED screens with abstract light (no text)` |

---

## 5. 엔딩 15장 (`public/idol/ending/{id}.png`, 1536×1024) — P2
공통 접두: `[STYLE] [HARAM] Use the attached image as the exact same person. Keep face, hair, mole, earring identical. Epilogue illustration, painterly light, emotional, Size 1536x1024.`

| id | 제목 | 장면 |
|---|---|---|
| `world_star` | 월드 스타 | `Haram (21) in a designer black suit on a massive world-tour stadium stage, a foreign metropolis skyline behind, fireworks, tens of thousands of coral light sticks` |
| `national_idol` | 국민 아이돌 | `Haram smiling warmly on a busy Seoul street, people of all ages taking photos, a giant billboard of him (no text) on a building, daytime` |
| `top_idol` | 톱 아이돌 | `Haram in the star outfit bowing deeply on a concert stage, holding a bouquet, coral light sticks, gratitude` |
| `actor` | 배우 전향 | `Haram on a film set in a period drama costume, cameras and crew around, golden-hour light, focused actor's gaze` |
| `variety_star` | 예능 대세 | `Haram laughing hard on a colorful variety show set, a comedic prop hat, other hosts blurred and laughing, fun lighting` |
| `solo_vocalist` | 솔로 보컬리스트 | `Haram singing alone at a grand piano in a dim concert hall, one warm spotlight, eyes closed, ballad mood` |
| `performance_king` | 퍼포먼스 킹 | `Haram frozen in a powerful dance pose center stage, a crew of dancers in silhouette behind, strobe light, sweat glistening` |
| `hiphop_artist` | 힙합 아티스트 | `Haram in streetwear and a chain, headphones around his neck, on a small underground club stage, red and coral neon, raw energy` |
| `partner_secret` | 평생의 파트너 | `Haram (21) and a manager figure seen from behind hanging a small blank company sign on an office door together, morning light, hopeful` |
| `longrun_idol` | 롱런 아이돌 | `Haram in a cozy fan meeting hall with a small devoted crowd, signing an album, warm and content, anniversary balloons (no text)` |
| `indie_musician` | 인디 뮤지션 | `Haram with an acoustic guitar performing in a small Hongdae live cafe, string lights, an intimate crowd of twenty, warm` |
| `ordinary_life` | 평범한 행복 | `Haram in casual clothes walking along a Han River park at sunset with a backpack, relaxed smile, city lights beginning to glow` |
| `contract_terminated` | 계약 종료 | `Haram carrying a cardboard box out of a small agency building at dusk, looking back once, rain beginning to fall` |
| `burnout_leave` | 떠나간 별 | `an empty practice room at night, a towel and a water bottle left on the floor by the mirror, one light on, no people` |
| `scandal_fall` | 스캔들의 늪 | `Haram in a cap and mask walking away through a crowd of photographers with flashing cameras, motion blur, cold blue tone` |

---

## 6. 타이틀 2장 — P0

### `public/idol/ui/title_key_visual.png` (1024×1536, 세로)
```
[STYLE] [HARAM] Use the attached image as the exact same person. Keep face, hair, mole, earring identical.
Vertical key visual: Haram in the trainee black hoodie standing in a dark practice room, looking up toward a single beam of coral light
falling from above, tiny floating light particles like stars, hopeful and dreamy. Leave the upper 30% of the image quieter and darker
so a title can sit there. No text. Size 1024x1536.
```

### `public/idol/ui/logo.png` (1024×1024, 투명)
```
Minimal emblem logo for a K-pop idol raising game: a single five-pointed star with a soft glow, coral (#FF6B8A) to soft lilac gradient
with a thin holographic edge, a tiny sparkle at one tip. Flat vector style, centered, transparent background PNG. No text. Size 1024x1024.
```

---

## 7. 체크리스트

| 우선순위 | 파일 | 장수 |
|---|---|---|
| P0 | 캐릭터 시트(참조), `char/trainee_neutral`, `char/rookie_neutral`, `char/star_neutral`, `ui/title_key_visual`, `ui/logo` | 5 (+참조 1) |
| P1 | 나머지 초상 15장, 배경 15장 | 30 |
| P2 | 이벤트 CG 8장, 엔딩 15장 | 23 |

파일을 넣은 뒤 브라우저 새로고침만 하면 된다. 단일 HTML(웹 링크) 버전은 `npm run build:standalone` 을 다시 돌려 게시해야 반영된다.
