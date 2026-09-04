# 이미지 생성 프롬프트 (GPT 이미지 생성용)

- 문서 버전: 1.0
- 사용법: 아래 프롬프트를 GPT(이미지 생성)에 그대로 붙여 넣고, 생성된 PNG를 지정된 경로·파일명으로 `public/idol/` 아래에 넣으면 게임이 자동으로 표시한다. 파일이 없으면 게임은 그라데이션 폴백을 쓰므로 순서와 상관없이 하나씩 채워도 된다.
- 총 58장. **P0(5장)** 부터 만들고, 여유가 되면 P1, P2 순으로.

---

## 0. 공통 규칙

### 0.1 스타일 가이드 (모든 프롬프트 앞에 붙임)
```
Style: 2D Korean webtoon / K-pop idol illustration, clean crisp lineart, soft cel shading with subtle gradients,
pastel neon accent lighting (lavender #A78BFA and mint #5EEAD4 rim light), cinematic but clean composition,
high detail on face and hair, muted dark-navy ambient tones. No text, no letters, no logos, no watermark, no signature.
```

### 0.2 캐릭터 시트 (하람의 고정 외형 — 캐릭터가 나오는 모든 프롬프트에 붙임)
```
Character "Haram": Korean male K-pop idol trainee, 18–21 years old, 178cm, slim athletic build.
Soft black hair with light bangs falling over the forehead, dark brown almond eyes, a small beauty mark under the LEFT eye,
one silver hoop earring on the LEFT ear, a single dimple on the left cheek when smiling, clear fair skin, gentle but sharp features.
Always the same face and hairstyle across images.
```

### 0.3 일관성 팁
1. 먼저 **1-1 캐릭터 시트**를 생성하고 마음에 드는 결과를 저장한다.
2. 이후 포트레이트·CG·엔딩 프롬프트에는 그 이미지를 첨부하고 문장 앞에 `Use the attached reference image for the character's face and hair. Keep them identical.` 를 붙인다.
3. 배경(2절)은 캐릭터가 없으니 참조 이미지가 필요 없다.
4. 크기가 안 맞으면 코드가 `object-fit: cover`로 잘라 쓰므로 비율만 맞추면 된다.

### 0.4 규격 요약

| 종류 | 크기(px) | 배경 | 경로 |
|---|---|---|---|
| 포트레이트 | 1024×1536 (2:3) | 투명 | `public/idol/char/{stage}_{emotion}.png` |
| 배경 | 1536×1024 (3:2) | — | `public/idol/bg/{id}.png` |
| 이벤트 CG | 1536×1024 (3:2) | — | `public/idol/cg/{id}.png` |
| 엔딩 일러스트 | 1536×1024 (3:2) | — | `public/idol/ending/{id}.png` |
| 타이틀 키비주얼 | 1536×1024 (3:2) | — | `public/idol/ui/title_key_visual.png` |
| 로고 | 1024×1024 | 투명 | `public/idol/ui/logo.png` |

---

## 1. 캐릭터 포트레이트 (18장)

### 1-1. 캐릭터 시트 (참조용, 게임에는 쓰지 않음) — P0
```
[스타일 가이드] [캐릭터 시트]
Character reference sheet on a plain light-gray background: front-facing bust portrait in the center, left profile and 3/4 view on the sides,
plus a small full-body standing pose in black hoodie and gray sweatpants. Neutral calm expression. Same face in every view.
Size 1536x1024.
```

### 1-2. 포트레이트 세트
파일명: `{stage}_{emotion}.png`. stage 3종 × emotion 6종.

**단계별 의상**

| stage | 의상 프롬프트 |
|---|---|
| `trainee` (P0 neutral) | `wearing an oversized black hoodie with a small towel around the neck, in a mirrored dance practice room, soft fluorescent lighting` |
| `rookie` (P0 neutral) | `wearing a white oxford shirt with silver chain accessories and an ear monitor, first stage outfit, stage spotlight with lavender and mint rim light` |
| `star` (P0 neutral) | `wearing a black velvet suit with subtle sparkle embroidery, styled hair swept back, two silver earrings on the left ear, glamorous concert lighting with light bokeh` |

**감정별 표정**

| emotion | 표정 프롬프트 |
|---|---|
| `neutral` | `calm neutral expression, looking at the viewer, lips closed` |
| `happy` | `bright warm smile showing the left dimple, eyes slightly crescent-shaped` |
| `tired` | `exhausted expression, half-closed eyes, faint dark circles, sweat on temple, slightly slumped shoulders` |
| `sad` | `downcast eyes, slightly furrowed brows, lips pressed, subtle glistening eyes, melancholic` |
| `excited` | `wide sparkling eyes, open-mouth grin, energetic, leaning slightly forward` |
| `determined` | `intense focused gaze straight at the viewer, brows set, small confident smirk` |

**조합 프롬프트 템플릿** (18번 반복)
```
[스타일 가이드] [캐릭터 시트]
Use the attached reference image for the character's face and hair. Keep them identical.
Bust-up portrait (head to mid-chest), facing the viewer, centered, {의상 프롬프트}, {표정 프롬프트}.
Transparent background (PNG with alpha). Size 1024x1536.
```

우선순위: P0 = `trainee_neutral`, `rookie_neutral`, `star_neutral`. P1 = 나머지 15장.

---

## 2. 배경 (15장) — P1
파일명: `public/idol/bg/{id}.png`, 1536×1024, 캐릭터 없음.

공통 접두: `[스타일 가이드] Empty background scene with no people, wide shot, painterly webtoon background, depth and atmosphere. Size 1536x1024.`

| id | 장면 프롬프트 |
|---|---|
| `practice_room` | `a K-pop dance practice room with a full mirror wall, wooden floor, portable speaker, water bottles, evening fluorescent light` |
| `dorm` | `a small idol trainee dorm bedroom with a bunk bed, a desk lamp, posters, laundry on a chair, warm night lamp light` |
| `office` | `a small entertainment agency office, whiteboard with schedules, laptops, a couch, a window with Seoul alley view, daylight` |
| `cafe` | `a cozy Seoul cafe interior behind the counter, espresso machine, pastries in a glass case, morning light` |
| `convenience_store` | `a Korean convenience store interior at night, bright shelves, glass fridge doors, checkout counter` |
| `park_busking` | `a Hongdae street busking spot at dusk, small crowd silhouettes in the distance, string lights, portable amp on the pavement` |
| `stage_music_show` | `a Korean music show TV stage, LED screens, lavender and mint spotlight beams, haze, empty stage view from the wings` |
| `fansign` | `a fan signing event venue with a long white table, banners without text, light sticks glowing, rows of chairs` |
| `variety_studio` | `a colorful TV variety show studio set with quirky props, studio lights, cameras, bright and fun` |
| `airport` | `an airport departure hall with big windows, morning light, rolling suitcases, planes visible outside` |
| `award_stage` | `a grand year-end award ceremony stage, golden confetti falling, huge chandelier lights, dramatic` |
| `hospital` | `a quiet hospital room with a bed, IV stand, pale blue curtains, soft morning light` |
| `concert_arena` | `a packed stadium concert at night seen from the stage, ocean of lavender light sticks, pyrotechnics, wide angle` |
| `recording_studio` | `a music recording studio with a mixing console, a vocal booth behind glass, warm dim light` |
| `photo_studio` | `a fashion photo studio with a seamless white backdrop, softboxes, clothing rack, clean and bright` |

---

## 3. 이벤트 CG (8장) — P2
파일명: `public/idol/cg/{id}.png`, 1536×1024. 캐릭터 시트 + 참조 이미지 사용.

공통 접두: `[스타일 가이드] [캐릭터 시트] Use the attached reference image for the character's face and hair. Keep them identical. Cinematic illustration, Size 1536x1024.`

| id | 장면 프롬프트 |
|---|---|
| `debut_showcase` | `Haram in the rookie white-shirt stage outfit, standing at center stage of a small showcase hall, holding a microphone, nervous but shining, first spotlight hitting him, small crowd of fans in front` |
| `first_win` | `Haram in the rookie outfit on a music show stage, holding a first-place trophy with both hands, crying and laughing at the same time, confetti falling, lavender and mint lights` |
| `award_grand_prize` | `Haram in the black velvet suit on a grand award stage, holding a large crystal trophy, golden confetti, the crowd standing, dramatic low angle` |
| `scandal_news` | `Haram in a hoodie and cap sitting alone in a dark dorm room, phone screen glowing on his face, dozens of blurred notification bubbles floating (no readable text), heavy mood` |
| `burnout_night` | `Haram sitting on the practice room floor late at night, back against the mirror, towel over his head, exhausted, one dim ceiling light, quiet` |
| `world_tour` | `Haram in the star outfit on a huge stadium stage at night, arms wide open toward an ocean of lavender light sticks, fireworks, ecstatic` |
| `bond_promise` | `Haram and a manager figure seen from behind (manager's face not visible, wearing a black staff jacket) sitting side by side on the rooftop of a small building at sunset over Seoul, sharing canned coffee, warm and calm` |
| `comeback_stage` | `Haram mid-dance on a music show stage in a new sleek outfit, sharp pose, motion energy, LED screens with abstract light patterns (no text)` |

---

## 4. 엔딩 일러스트 (15장) — P2
파일명: `public/idol/ending/{id}.png`, 1536×1024. 캐릭터 시트 + 참조 이미지 사용.

공통 접두: `[스타일 가이드] [캐릭터 시트] Use the attached reference image for the character's face and hair. Keep them identical. Epilogue illustration, painterly and emotional, Size 1536x1024.`

| id | 제목 | 장면 프롬프트 |
|---|---|---|
| `world_star` | 월드 스타 | `Haram (21) in a designer black suit on a massive world-tour stadium stage, city skyline of a foreign metropolis behind, fireworks, tens of thousands of light sticks` |
| `national_idol` | 국민 아이돌 | `Haram smiling warmly on a busy Seoul street, surrounded by people of all ages taking photos, giant billboard of him (no text) on a building, daytime` |
| `top_idol` | 톱 아이돌 | `Haram in the star outfit bowing deeply on a concert stage, holding a bouquet, lavender light sticks, gratitude` |
| `actor` | 배우 전향 | `Haram on a film set in a period drama costume, cameras and crew around, dramatic golden-hour light, focused actor's gaze` |
| `variety_star` | 예능 대세 | `Haram laughing hard on a colorful variety show set, comedic prop hat, other hosts blurred laughing around him, fun lighting` |
| `solo_vocalist` | 솔로 보컬리스트 | `Haram singing alone at a grand piano in a dim concert hall, one warm spotlight, eyes closed, emotional ballad mood` |
| `performance_king` | 퍼포먼스 킹 | `Haram frozen in a powerful dance pose center stage with a crew of dancers in silhouette behind him, strobe light, sweat glistening` |
| `hiphop_artist` | 힙합 아티스트 | `Haram in streetwear and a chain, headphones around his neck, on a small underground club stage, red and mint neon, raw energy` |
| `partner_secret` | 평생의 파트너 | `Haram (21) and a manager figure seen from behind hanging a small new company sign (blank, no text) on an office door together, morning light, hopeful` |
| `longrun_idol` | 롱런 아이돌 | `Haram in a cozy fan meeting hall, small but devoted crowd, signing an album, warm and content, 5th anniversary balloons (no text)` |
| `indie_musician` | 인디 뮤지션 | `Haram with an acoustic guitar performing in a small Hongdae live cafe, string lights, intimate crowd of twenty, warm` |
| `ordinary_life` | 평범한 행복 | `Haram in casual clothes walking along a Han River park at sunset with a backpack, relaxed smile, city lights beginning to glow` |
| `contract_terminated` | 계약 종료 | `Haram carrying a cardboard box out of the small agency building at dusk, looking back once, rain beginning to fall, melancholic` |
| `burnout_leave` | 떠나간 별 | `an empty practice room at night, a towel and a water bottle left on the floor by the mirror, one light on, no people` |
| `scandal_fall` | 스캔들의 늪 | `Haram in a cap and mask walking away through a crowd of photographers with flashing cameras, blurred, cold blue tone` |

---

## 5. 타이틀 (2장) — P0

### 5-1. 타이틀 키비주얼 `public/idol/ui/title_key_visual.png` (1536×1024)
```
[스타일 가이드] [캐릭터 시트] Use the attached reference image for the character's face and hair. Keep them identical.
Key visual: Haram in the trainee black hoodie standing in a dark practice room, looking up toward a single beam of lavender-and-mint light
falling from above, small floating light particles like stars, hopeful and dreamy, space left on the upper third for a title.
No text. Size 1536x1024.
```

### 5-2. 로고 `public/idol/ui/logo.png` (1024×1024, 투명)
```
Minimal emblem logo for a K-pop idol raising game: a single five-pointed star with a soft glow, lavender to mint gradient,
thin elegant outline, a tiny sparkle at one tip. Flat vector style, centered, transparent background PNG. No text. Size 1024x1024.
```

---

## 6. 체크리스트

| 우선순위 | 파일 | 개수 |
|---|---|---|
| P0 | `char/trainee_neutral.png`, `char/rookie_neutral.png`, `char/star_neutral.png`, `ui/title_key_visual.png`, `ui/logo.png` | 5 |
| P1 | 나머지 포트레이트 15장, 배경 15장 | 30 |
| P2 | 이벤트 CG 8장, 엔딩 15장 | 23 |

파일을 넣은 뒤 브라우저 새로고침만 하면 된다(빌드 불필요).
