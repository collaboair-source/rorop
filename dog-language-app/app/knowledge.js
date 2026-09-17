/* BarkLens 지식 베이스 — 몸짓 단서, 근거 논문. (docs/02_리서치_논문정리.md 와 동기화) */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) { module.exports = factory(); }
  else { root.BarkKnowledge = factory(); }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  /* 몸짓 단서: valence(-1 부정 ~ +1 긍정), arousal(0 차분 ~ 1 각성), tags */
  const BODY_CUES = [
    // 꼬리
    { id: 'tail-right', group: '꼬리', label: '오른쪽으로 치우쳐 흔듦', desc: '개 기준 오른쪽(보는 사람 기준 왼쪽) 진폭이 더 큼', valence: 0.6, arousal: 0.4, tags: ['approach'], ev: 'Quaranta 2007; Ren 2022' },
    { id: 'tail-left', group: '꼬리', label: '왼쪽으로 치우쳐 흔듦', desc: '낯선 개·위협 대상 앞에서 나타나는 회피 동기', valence: -0.5, arousal: 0.4, tags: ['withdraw'], ev: 'Quaranta 2007; Siniscalchi 2013' },
    { id: 'tail-high-fast', group: '꼬리', label: '높이 세우고 짧고 빠르게 흔듦', desc: '높은 각성. 친근함이 아니라 경계일 수 있음', valence: -0.2, arousal: 0.85, tags: ['alert'], ev: 'Siniscalchi 2018' },
    { id: 'tail-wide', group: '꼬리', label: '엉덩이까지 넓고 느긋하게 흔듦', desc: '친화·반가움', valence: 0.85, arousal: 0.45, tags: ['approach'], ev: 'Siniscalchi 2018' },
    { id: 'tail-tuck', group: '꼬리', label: '꼬리 내리거나 다리 사이로 말림', desc: '두려움·복종', valence: -0.75, arousal: 0.35, tags: ['fear'], ev: 'Siniscalchi 2018' },
    { id: 'tail-stiff', group: '꼬리', label: '수평으로 경직·정지', desc: '긴장하며 상황을 평가 중', valence: -0.4, arousal: 0.65, tags: ['alert'], ev: 'Siniscalchi 2018' },
    // 귀
    { id: 'ear-adductor', group: '귀', label: '귀를 앞쪽으로 모음 (Ears adductor)', desc: '긍정적 기대(간식·놀이 기다림)에서 더 자주', valence: 0.5, arousal: 0.45, tags: ['approach'], ev: 'Bremhorst 2019, 2022' },
    { id: 'ear-flat', group: '귀', label: '귀를 뒤로 납작하게 (Ears flattener)', desc: '좌절·불안·유화', valence: -0.5, arousal: 0.35, tags: ['stress'], ev: 'Bremhorst 2019, 2022' },
    { id: 'ear-down', group: '귀', label: '귀가 아래로 처짐', desc: '불확실·스트레스 상황에서 증가', valence: -0.3, arousal: 0.1, tags: ['stress'], ev: 'Pedretti 2024' },
    // 얼굴·입
    { id: 'nose-lick', group: '얼굴 · 입', label: '코·입술 핥기', desc: '좌절 또는 긴장 완화 신호(카밍 시그널)', valence: -0.4, arousal: 0.25, tags: ['stress', 'calming'], ev: 'Bremhorst 2019; Mariti 2017; Pedretti 2024' },
    { id: 'yawn', group: '얼굴 · 입', label: '졸리지 않은데 하품', desc: '스트레스 완화 신호', valence: -0.3, arousal: 0.05, tags: ['calming'], ev: 'Mariti 2017' },
    { id: 'blink', group: '얼굴 · 입', label: '잦은 눈 깜빡임', desc: '좌절 조건에서 증가', valence: -0.3, arousal: 0.15, tags: ['stress'], ev: 'Bremhorst 2019' },
    { id: 'mouth-relaxed', group: '얼굴 · 입', label: '입 살짝 벌리고 혀 느슨', desc: '편안함', valence: 0.5, arousal: 0.2, tags: ['approach'], ev: 'Siniscalchi 2018' },
    { id: 'mouth-tense', group: '얼굴 · 입', label: '입 꾹 다물고 입술 앞으로', desc: '경계·공격 준비', valence: -0.55, arousal: 0.65, tags: ['threat'], ev: 'Siniscalchi 2018' },
    { id: 'teeth', group: '얼굴 · 입', label: '이빨 드러냄 + 으르렁', desc: '명확한 위협 신호', valence: -0.9, arousal: 0.9, tags: ['threat'], ev: 'Siniscalchi 2018; Faragó 2017' },
    { id: 'pant', group: '얼굴 · 입', label: '덥지 않은데 헐떡임', desc: '스트레스·불확실', valence: -0.4, arousal: 0.55, tags: ['stress'], ev: 'Pedretti 2024' },
    { id: 'whale-eye', group: '얼굴 · 입', label: '흰자 보이는 곁눈질(고래눈)', desc: '불안·회피', valence: -0.6, arousal: 0.6, tags: ['fear'], ev: 'Siniscalchi 2018' },
    { id: 'brow', group: '얼굴 · 입', label: '눈썹 안쪽 올림("강아지 눈", AU101)', desc: '사람을 향한 소통 표정', valence: 0.3, arousal: 0.1, tags: ['approach'], ev: 'Waller 2013; Kaminski 2019' },
    // 몸·자세
    { id: 'play-bow', group: '몸 · 자세', label: '플레이 바우 (앞다리 낮추고 엉덩이 들기)', desc: '놀이 초대', valence: 0.9, arousal: 0.7, tags: ['play'], ev: 'Siniscalchi 2018' },
    { id: 'crouch', group: '몸 · 자세', label: '몸 낮추고 웅크림', desc: '두려움', valence: -0.7, arousal: 0.45, tags: ['fear'], ev: 'Siniscalchi 2018' },
    { id: 'stiff-forward', group: '몸 · 자세', label: '앞으로 기운 경직 자세, 털 세움', desc: '위협·경계', valence: -0.7, arousal: 0.9, tags: ['threat'], ev: 'Siniscalchi 2018' },
    { id: 'head-turn', group: '몸 · 자세', label: '고개 돌리기 · 시선 피하기', desc: '카밍 시그널: 갈등 완화', valence: -0.2, arousal: 0.05, tags: ['calming'], ev: 'Mariti 2017' },
    { id: 'sniff', group: '몸 · 자세', label: '갑자기 바닥 냄새 맡기', desc: '카밍 시그널 · 전위 행동', valence: -0.15, arousal: 0.0, tags: ['calming'], ev: 'Mariti 2017' },
    { id: 'shake-off', group: '몸 · 자세', label: '물 털듯 몸 흔들기', desc: '긴장 해소', valence: 0.15, arousal: 0.0, tags: ['calming'], ev: 'Siniscalchi 2018' },
    { id: 'freeze', group: '몸 · 자세', label: '얼어붙기(정지)', desc: '긴장·경고. 다음 행동 직전', valence: -0.6, arousal: 0.7, tags: ['threat', 'fear'], ev: 'Mariti 2017' }
  ];

  function assessCues(ids) {
    const sel = BODY_CUES.filter(c => ids.includes(c.id));
    if (!sel.length) return null;
    const v = sel.reduce((a, c) => a + c.valence, 0) / sel.length;
    const a = sel.reduce((a, c) => a + c.arousal, 0) / sel.length;
    const tags = new Set(); sel.forEach(c => c.tags.forEach(t => tags.add(t)));
    let state, tone;
    if (v > 0.15 && a > 0.5) { state = '놀이 · 흥분 (긍정 · 높은 각성)'; tone = 'good'; }
    else if (v > 0.15) { state = '편안 · 친화 (긍정 · 낮은 각성)'; tone = 'good'; }
    else if (v < -0.15 && a > 0.5) { state = tags.has('threat') ? '경계 · 위협 (부정 · 높은 각성)' : '두려움 · 좌절 (부정 · 높은 각성)'; tone = 'bad'; }
    else if (v < -0.15) { state = '불편 · 스트레스 (부정 · 낮은 각성)'; tone = 'warn'; }
    else { state = '중립 · 판단 보류'; tone = 'neutral'; }
    const notes = [];
    if (tags.has('calming')) notes.push('카밍 시그널이 보입니다. 상황을 누그러뜨릴 시간을 주고 압박을 줄이세요.');
    if (tags.has('threat')) notes.push('위협 신호입니다. 자극과 거리를 두고 개를 만지거나 몰아세우지 마세요.');
    if (tags.has('fear')) notes.push('두려움 신호입니다. 도망갈 수 있는 공간을 확보하고 강제로 노출시키지 마세요.');
    if (tags.has('approach') && tags.has('withdraw')) notes.push('접근과 회피 신호가 섞여 있습니다(양가 상태). 천천히 관찰하세요.');
    if (sel.length < 2) notes.push('단서가 하나뿐입니다. 표정·꼬리·자세를 함께 보면 정확도가 올라갑니다 (Bremhorst 2022: 단일 표정만으로는 진단 불가).');
    return { valence: v, arousal: a, state, tone, notes, selected: sel };
  }

  /* 근거 논문 (DOI 링크). group: bark | growl | body | ai | brain */
  const PAPERS = [
    { g: 'bark', a: 'Yin S.', y: 2002, t: 'A new perspective on barking in dogs', j: 'J Comp Psychol 116:189', doi: '10.1037/0735-7036.116.2.189',
      i: '짖음은 맥락(방해·고립·놀이)에 따라 음향이 달라지는 "등급 신호". 방해 짖음은 더 거칠고 낮으며 긴 연속으로 나옴.', u: '경계 규칙(낮음·거침·빠름)' },
    { g: 'bark', a: 'Yin S., McCowan B.', y: 2004, t: 'Barking in domestic dogs: context specificity and individual identification', j: 'Anim Behav 68:343', doi: '10.1016/j.anbehav.2003.07.016',
      i: '10마리 4,672회 짖음 분석. 방해=거칠고 낮고 변조 적음, 고립·놀이=맑고 높고 변조 많음. 개체 식별도 가능.', u: '음색·변조 축, 개체별 기준선' },
    { g: 'bark', a: 'Pongrácz P. 외', y: 2005, t: 'Human listeners are able to classify dog barks recorded in different situations', j: 'J Comp Psychol 119:136', doi: '10.1037/0735-7036.119.2.136',
      i: '사람은 6가지 상황의 짖음을 우연 수준 이상으로 분류. 감정 평가는 최고·기본주파수와 짖음 간격에 상관.', u: '3축 지문(음높이·리듬)' },
    { g: 'bark', a: 'Pongrácz P. 외', y: 2006, t: 'Acoustic parameters of dog barks carry emotional information for humans', j: 'Appl Anim Behav Sci 100:228', doi: '10.1016/j.applanim.2005.12.004',
      i: '낮고 빠른 짖음=공격적, 높고 간격 긴 짖음=두려움·절망, 높고 빠른 짖음=놀이·기쁨으로 평가. 거친 음색=공격적.', u: '맥락 목표값 표의 핵심 근거' },
    { g: 'bark', a: 'Molnár C. 외', y: 2008, t: 'Classification of dog barks: a machine learning approach', j: 'Anim Cogn 11:389', doi: '10.1007/s10071-007-0129-9',
      i: '6,000회 이상 짖음을 기계학습으로 분류: 상황 43%, 개체 52% (우연 수준 크게 상회).', u: 'ML 로드맵의 기준선' },
    { g: 'bark', a: 'Molnár C. 외', y: 2009, t: 'Dogs discriminate between barks: the effect of context and identity of the caller', j: 'Behav Processes 82:198', doi: '10.1016/j.beproc.2009.06.011',
      i: '개도 다른 개의 짖음에서 상황(낯선 사람 vs 혼자)과 개체를 구분.', u: '짖음이 정보를 담는다는 근거' },
    { g: 'bark', a: 'Pongrácz P. 외', y: 2010, t: 'Barking in family dogs: an ethological approach (review)', j: 'Vet J 183:141', doi: '10.1016/j.tvjl.2008.12.010',
      i: '짖음은 주파수·음색·리듬의 폭이 넓고 맥락 의존적. 사람에게 내부 상태 정보를 줌.', u: '제품 포지셔닝("번역"이 아니라 "상태 읽기")' },
    { g: 'bark', a: 'Molnár C. 외', y: 2010, t: 'Seeing with ears: sightless humans’ perception of dog bark', j: 'Q J Exp Psychol 63:1004', doi: '10.1080/17470210903168243',
      i: '선천적 시각장애인도 짖음의 상황을 정확히 분류. 시각 경험 없이도 통하는 구조적 규칙이 존재.', u: '규칙 기반 엔진의 타당성' },
    { g: 'bark', a: 'Faragó T. 외', y: 2014, t: 'Humans rely on the same rules to assess emotional valence and intensity in conspecific and dog vocalizations', j: 'Biol Lett 10:20130926', doi: '10.1098/rsbl.2013.0926',
      i: '짧은 소리일수록 긍정적, 높은 소리일수록 강렬하게 평가. 사람 목소리와 같은 규칙.', u: '길이 근거 문장' },
    { g: 'bark', a: 'Larrañaga A. 외', y: 2015, t: 'Comparing supervised learning methods for classifying sex, age, context and individual Mudi dogs from barking', j: 'Anim Cogn 18:405', doi: '10.1007/s10071-014-0811-7',
      i: 'kNN + 특징 선택: 성별 85.1%, 나이 80.3%, 상황(7) 55.5%, 개체(8) 67.6%.', u: '달성 가능한 정확도 기준' },
    { g: 'bark', a: 'Gómez-Armenta J.R. 외', y: 2024, t: 'Automatic classification of dog barking using deep learning', j: 'Behav Processes 218:105028', doi: '10.1016/j.beproc.2024.105028',
      i: '113마리 19,643회 짖음. 딥러닝으로 개체·품종·나이·성별·상황 분류, 기존 결과 상회.', u: '딥러닝 로드맵' },
    { g: 'bark', a: 'Abzaliev A., Pérez-Espinosa H., Mihalcea R.', y: 2024, t: 'Towards Dog Bark Decoding: Leveraging Human Speech Processing for Automated Bark Classification', j: 'LREC-COLING 2024 (arXiv:2404.18739)', doi: '10.48550/arXiv.2404.18739',
      i: '사람 음성으로 사전학습한 Wav2Vec2가 개 소리 전용 모델보다 개체·품종·성별·상황 분류에서 우수.', u: '모델 v1 = 음성 파운데이션 모델 전이학습' },
    { g: 'bark', a: 'Pongrácz P. 외', y: 2024, t: 'Alarm or emotion? Intranasal oxytocin helps determine information conveyed by dog barks', j: 'BMC Ecol Evol 24:8', doi: '10.1186/s12862-024-02198-2',
      i: '경계 짖음(높고 거침)은 아기 울음처럼 주의를 끄는 구조. 낮은 F0는 공격성으로 지각.', u: '경계/두려움 구분 축' },
    { g: 'bark', a: 'Riede T. 외', y: 2001, t: 'The harmonic-to-noise ratio applied to dog barks', j: 'J Acoust Soc Am 110:2191', doi: '10.1121/1.1398052',
      i: '짖음의 조화 성분 대 잡음 비율(HNR)이 개 상태 평가에 유용한 지표.', u: '음색(조화도) 축 정의' },
    { g: 'growl', a: 'Riede T., Fitch T.', y: 1999, t: 'Vocal tract length and acoustics of vocalization in the domestic dog', j: 'J Exp Biol 202:2859', doi: '10.1242/jeb.202.20.2859',
      i: '성도 길이 ↔ 체중 ↔ 포먼트 분산. 소리가 몸집 정보를 담음.', u: '견종 크기별 기준 음역' },
    { g: 'growl', a: 'Taylor A.M., Reby D., McComb K.', y: 2008, t: 'Human listeners attend to size information in domestic dog growls', j: 'J Acoust Soc Am 123:2903', doi: '10.1121/1.2896962',
      i: '사람은 으르렁의 포먼트·F0로 개 크기를 추정. 포먼트가 더 정확한 단서.', u: '크기 보정' },
    { g: 'growl', a: 'Faragó T. 외', y: 2010, t: '“The bone is mine”: affective and referential aspects of dog growls', j: 'Anim Behav 79:917', doi: '10.1016/j.anbehav.2010.01.005',
      i: '음식 지키기 으르렁은 다른 개를 실제로 물러서게 함. 으르렁이 맥락(지시적) 정보를 담음.', u: '으르렁 = 경계 우선 가중' },
    { g: 'growl', a: 'Bálint A. 외', y: 2016, t: 'Threat-level-dependent manipulation of signaled body size: dog growls', j: 'Anim Cogn 19:1115', doi: '10.1007/s10071-016-1019-9',
      i: '위협 수준에 따라 개가 으르렁의 F0·포먼트를 동적으로 조절.', u: '상황별 변동성 고려' },
    { g: 'growl', a: 'Faragó T. 외', y: 2017, t: 'Dog growls express various contextual and affective content for human listeners', j: 'R Soc Open Sci 4:170134', doi: '10.1098/rsos.170134',
      i: '사람은 음식 지키기·위협·놀이 으르렁의 맥락을 우연 이상으로 맞춤. 짧고 느리게 박동하는 으르렁=놀이.', u: '놀이 으르렁 예외 처리' },
    { g: 'growl', a: 'Sibiryakova O.V. 외', y: 2020, t: 'Polyphony of domestic dog whines and vocal cues to body size', j: 'Curr Zool 67:165', doi: '10.1093/cz/zoaa042',
      i: '낑낑은 최대 3개의 독립 기본주파수(저 0.24–2.13 kHz, 고 2.95–10.46 kHz, 초고 9.99–23.26 kHz). 모두 체중과 음의 상관.', u: '48 kHz 이상 샘플링 권장, 낑낑 분류' },
    { g: 'growl', a: 'Lenkei R. 외', y: 2021, t: 'Separation-related behavior of dogs shows association with their reactions to everyday situations', j: 'Sci Rep 11:19207', doi: '10.1038/s41598-021-98526-3',
      i: '분리 상황에서 낑낑=두려움 성향, 짖음=좌절·요구 성향과 연관.', u: '낑낑 → 외로움/두려움 가중' },
    { g: 'body', a: 'Quaranta A., Siniscalchi M., Vallortigara G.', y: 2007, t: 'Asymmetric tail-wagging responses by dogs to different emotive stimuli', j: 'Curr Biol 17:R199', doi: '10.1016/j.cub.2007.02.008',
      i: '보호자를 보면 오른쪽, 낯선 우세한 개를 보면 왼쪽으로 치우쳐 흔듦.', u: '꼬리 좌우 단서' },
    { g: 'body', a: 'Siniscalchi M. 외', y: 2013, t: 'Seeing left- or right-asymmetric tail wagging produces different emotional responses in dogs', j: 'Curr Biol 23:2279', doi: '10.1016/j.cub.2013.09.027',
      i: '개는 다른 개의 왼쪽 편향 흔들기를 보면 심박·불안이 증가. 비대칭이 실제 신호로 작동.', u: '꼬리 좌우 단서' },
    { g: 'body', a: 'Ren W. 외', y: 2022, t: 'Left-right asymmetry and attractor-like dynamics of dog’s tail wagging during dog-human interactions', j: 'iScience 25:104747', doi: '10.1016/j.isci.2022.104747',
      i: '딥러닝 꼬리 추적: 3일간 친숙해질수록 오른쪽 편향 증가. 개체별 고유 패턴.', u: '카메라 기반 꼬리 추적 로드맵' },
    { g: 'body', a: 'Waller B.M. 외', y: 2013, t: 'Paedomorphic facial expressions give dogs a selective advantage', j: 'PLoS ONE 8:e82686', doi: '10.1371/journal.pone.0082686',
      i: 'DogFACS 도입. 눈썹 안쪽 올림(AU101)이 많은 개가 더 빨리 입양됨.', u: '표정 단서 체계' },
    { g: 'body', a: 'Kaminski J. 외', y: 2019, t: 'Evolution of facial muscle anatomy in dogs', j: 'PNAS 116:14677', doi: '10.1073/pnas.1820653116',
      i: '개는 늑대에 없는 눈썹 근육(LAOM)을 진화시켜 사람 향한 표정을 만듦.', u: '사람-개 소통 근거' },
    { g: 'body', a: 'Bremhorst A. 외', y: 2019, t: 'Differences in facial expressions during positive anticipation and frustration in dogs awaiting a reward', j: 'Sci Rep 9:19312', doi: '10.1038/s41598-019-55714-6',
      i: '귀 앞으로 모음=긍정 기대, 눈 깜빡임·입 벌림·코 핥기·귀 납작=좌절.', u: '귀·입 단서' },
    { g: 'body', a: 'Bremhorst A. 외', y: 2022, t: 'Evaluating the accuracy of facial expressions as emotion indicators across contexts in dogs', j: 'Anim Cogn 25:121', doi: '10.1007/s10071-021-01532-1',
      i: '재현됨. 그러나 단일 표정만으로는 감정을 신뢰성 있게 진단할 수 없음 → 조합 필요.', u: '멀티모달·조합 판단 원칙' },
    { g: 'body', a: 'Caeiro C. 외', y: 2017, t: 'Dogs and humans respond to emotionally competent stimuli by producing different facial actions', j: 'Sci Rep 7:15525', doi: '10.1038/s41598-017-15091-4',
      i: '개는 자극 종류별로 구별되는 표정을 짓지만 사람과 같은 표정은 아님. 의인화 금지.', u: '해석 문구 가이드' },
    { g: 'body', a: 'Pedretti G. 외', y: 2024, t: 'Intra and interspecific audience effect on domestic dogs’ behavioural displays and facial expressions', j: 'Sci Rep 14:9546', doi: '10.1038/s41598-024-58757-6',
      i: '불확실한 상황에서 코 핥기·입술 닦기·귀 처짐·헐떡임·낑낑이 증가(전위 행동).', u: '스트레스 단서' },
    { g: 'body', a: 'Mariti C. 외', y: 2017, t: 'Analysis of the intraspecific visual communication in the domestic dog: calming signals', j: 'J Vet Behav 18:49', doi: '10.1016/j.jveb.2016.12.009',
      i: '카밍 시그널(고개 돌리기·코 핥기·정지 등)이 나온 뒤 공격적 상호작용이 줄어듦.', u: '카밍 시그널 단서' },
    { g: 'body', a: 'Siniscalchi M. 외', y: 2018, t: 'Communication in Dogs (review)', j: 'Animals 8:131', doi: '10.3390/ani8080131',
      i: '시각·청각·후각 신호 전체 레퍼토리 정리. 꼬리 높이·자세·입 모양의 의미.', u: '몸짓 카드 기본 텍스트' },
    { g: 'ai', a: 'Boneh-Shitrit T. 외', y: 2022, t: 'Explainable automated recognition of emotional states from canine facial expressions', j: 'Sci Rep 12:22611', doi: '10.1038/s41598-022-27079-w',
      i: '래브라도 29마리: DogFACS 기반 71% vs 딥러닝 89% (긍정 기대 vs 좌절).', u: '카메라 모듈 로드맵' },
    { g: 'ai', a: 'Martvel G. 외', y: 2025, t: 'Dog facial landmarks detection and its applications for facial analysis (DogFLW)', j: 'Sci Rep 15:21886', doi: '10.1038/s41598-025-07040-3',
      i: '3,732장, 46개 얼굴 랜드마크 데이터셋. 표정 자동 분석 파이프라인.', u: '카메라 모듈 데이터셋' },
    { g: 'ai', a: 'Bhave A. 외', y: 2024, t: 'Unsupervised Canine Emotion Recognition Using Momentum Contrast', j: 'Sensors 24:7324', doi: '10.3390/s24227324',
      i: '2,184장·7감정. 지도학습 ResNet50 74.3%.', u: '이미지 기반 기준선' },
    { g: 'ai', a: 'Górski K. 외', y: 2026, t: 'The Complexity of Communication in Mammals: multimodal applications (review)', j: 'Animals 16:265', doi: '10.3390/ani16020265',
      i: '동물-컴퓨터 상호작용(ACI) 기술로 감정·행동의 객관적 모니터링이 가능해지는 흐름.', u: '시장·기술 트렌드' },
    { g: 'brain', a: 'Andics A. 외', y: 2014, t: 'Voice-sensitive regions in the dog and human brain are revealed by comparative fMRI', j: 'Curr Biol 24:574', doi: '10.1016/j.cub.2014.01.058',
      i: '개 뇌에도 목소리 전담 영역이 있고, 감정가(valence) 처리 방식이 사람과 유사.', u: '상호 이해의 생물학적 근거' },
    { g: 'brain', a: 'Bálint A. 외', y: 2022, t: 'Dog and human neural sensitivity to voicelikeness: a comparative fMRI study', j: 'NeuroImage 265:119791', doi: '10.1016/j.neuroimage.2022.119791',
      i: 'F0와 소리 길이가 개·사람 모두의 감정가 민감 영역을 조절.', u: '음높이·길이 축의 타당성' },
    { g: 'brain', a: 'Siniscalchi M., Quaranta A., Rogers L.J.', y: 2008, t: 'Hemispheric specialization in dogs for processing different acoustic stimuli', j: 'PLoS ONE 3:e3349', doi: '10.1371/journal.pone.0003349',
      i: '개는 같은 종 소리를 좌뇌로, 강한 감정(두려움)을 담은 소리는 우뇌로 처리.', u: '배경 지식' }
  ];
  const PAPER_GROUPS = { bark: '짖음의 음향과 맥락', growl: '으르렁 · 낑낑 · 몸집 정보', body: '표정 · 꼬리 · 자세', ai: 'AI · 데이터셋', brain: '뇌와 지각' };

  const DATASETS = [
    { n: 'Barkopedia (UT Arlington, IJCAI 2025 챌린지)', d: 'YouTube·Reddit 수집. 소리 검출, 감정(각성·정서가), 품종(29,347클립), 성별·나이 등 8개 과제. Hugging Face 공개.' },
    { n: 'EmotionalCanines (ACM MM 2025)', d: '허스키·시바 1,400 짖음 시퀀스에 연속 각성·정서가 라벨.' },
    { n: 'Abzaliev 외 2024 (멕시코)', d: '8,034 발성, 14가지 소리 유형(정상·공격·두려움·놀이·보호자 상호작용 등). 치와와·푸들·슈나우저 등.' },
    { n: 'Gómez-Armenta 외 2024', d: '113마리 19,643 짖음. 개체·품종·나이·성별·상황 라벨.' },
    { n: 'AudioSet / YAMNet 클래스 70–75', d: 'Bark, Yip, Howl, Bow-wow, Growling, Whimper(dog). TF.js·TFLite로 온디바이스 "개 소리 검출"에 바로 사용 가능.' },
    { n: 'DogFLW (2025)', d: '3,732장 얼굴 랜드마크 46점. 표정 분석용.' }
  ];

  return { BODY_CUES, assessCues, PAPERS, PAPER_GROUPS, DATASETS };
});
