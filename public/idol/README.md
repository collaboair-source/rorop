# 게임 이미지 에셋 폴더

GPT로 생성한 이미지를 아래 경로·파일명으로 넣으면 게임이 자동으로 표시합니다. 파일이 없으면 그라데이션 폴백이 나오므로 순서와 상관없이 하나씩 채워도 됩니다. 프롬프트와 우선순위는 `docs/idol-game/03_IMAGE_PROMPTS.md` 참조.

| 폴더 | 파일명 규칙 | 크기 |
|---|---|---|
| `char/` | `{trainee|rookie|star}_{neutral|happy|tired|sad|excited|determined}.png` (투명 배경) | 1024×1536 |
| `bg/` | `practice_room.png`, `dorm.png`, `office.png`, `cafe.png`, `convenience_store.png`, `park_busking.png`, `stage_music_show.png`, `fansign.png`, `variety_studio.png`, `airport.png`, `award_stage.png`, `hospital.png`, `concert_arena.png`, `recording_studio.png`, `photo_studio.png` | 1536×1024 |
| `cg/` | `debut_showcase.png`, `first_win.png`, `award_grand_prize.png`, `scandal_news.png`, `burnout_night.png`, `world_tour.png`, `bond_promise.png`, `comeback_stage.png` | 1536×1024 |
| `ending/` | 엔딩 id 15개 (`world_star.png` … `scandal_fall.png`) | 1536×1024 |
| `ui/` | `title_key_visual.png`, `logo.png` (투명 배경) | 1536×1024 / 1024×1024 |

먼저 만들 5장(P0): `char/trainee_neutral.png`, `char/rookie_neutral.png`, `char/star_neutral.png`, `ui/title_key_visual.png`, `ui/logo.png`
