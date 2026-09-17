// 크롤러 테스트용 픽스처. 실제 사이트 응답 구조(공개 API 명세 및 페이지 레이아웃)를 본떴다.

export const BIZINFO_API_ITEM = {
  pblancId: "PBLN_000000000098765",
  pblancNm: "2026년 초기창업패키지 (예비창업자 및 창업 3년 이내 기업) 모집 공고",
  jrsdInsttNm: "중소벤처기업부",
  excInsttNm: "창업진흥원",
  reqstBeginEndDe: "20260901 ~ 20260930",
  pblancUrl: "/web/lay1/bbs/S1T122C128/AS/74/view.do?pblancId=PBLN_000000000098765",
  bsnsSumryCn: "<p>유망 창업아이템을 보유한 <b>예비창업자</b> 및 창업 3년 이내 기업의 사업화 지원</p><br>○ 지원내용 : 사업화자금 최대 1억원&nbsp;멘토링",
  trgetNm: "예비창업자, 창업 3년 이내 기업",
  pldirSportRealmLclasCodeNm: "창업",
  pldirSportRealmMlsfcCodeNm: "사업화",
  hashtags: "전국,창업,사업화,SaaS",
  creatPnttm: "2026-08-28 10:12:00",
  printFileNm: "공고문.hwp",
  printFlpthNm: "/cmm/fms/FileDown.do?atchFileId=FILE_001&fileSn=0",
  inqireCo: "1234",
  refrncNm: "창업진흥원 창업지원부 044-000-0000",
  reqstMthPapersCn: "K-Startup 누리집(www.k-startup.go.kr) 온라인 접수",
};

export const BIZINFO_API_RESPONSE = JSON.stringify({ jsonArray: [BIZINFO_API_ITEM, { pblancId: "", pblancNm: "" }] });

export const BIZINFO_LIST_HTML = `
<html><body>
<table class="table_Type_1">
<thead><tr><th>분야</th><th>지원사업명</th><th>신청기간</th><th>소관부처</th><th>사업수행기관</th><th>등록일</th><th>조회</th></tr></thead>
<tbody>
<tr>
  <td>기술</td>
  <td class="txt_l"><a href="/web/lay1/bbs/S1T122C128/AS/74/view.do?pblancId=PBLN_000000000011111&amp;page=1">서울시 중소기업 AI 기술개발 지원사업 공고</a></td>
  <td>2026-09-10 ~ 2026-10-10</td>
  <td>서울특별시</td>
  <td>서울산업진흥원</td>
  <td>2026-09-09</td>
  <td>321</td>
</tr>
<tr>
  <td>수출</td>
  <td class="txt_l"><a href="/web/lay1/bbs/S1T122C128/AS/74/view.do?pblancId=PBLN_000000000022222">2026년 해외 전시회 참가 지원</a></td>
  <td>2026-09-01 ~ 예산 소진시까지</td>
  <td>산업통상자원부</td>
  <td>KOTRA</td>
  <td>2026-09-01</td>
  <td>88</td>
</tr>
</tbody></table>
</body></html>`;

export const BIZINFO_DETAIL_HTML = `
<html><body><div class="view_cont">
<h4>사업개요</h4><p>서울 소재 중소기업의 AI 기술개발 과제를 지원합니다.</p>
<h4>지원대상</h4><p>서울 소재 창업 7년 이내 중소기업</p>
<h4>지원제외대상</h4><p>휴·폐업 기업, 국세 체납 기업</p>
<h4>신청기간</h4><p>2026-09-10 ~ 2026-10-10</p>
<h4>신청방법</h4><p>온라인 접수</p>
<h4>문의처</h4><p>서울산업진흥원 02-000-0000</p>
</div></body></html>`;

export const KSTARTUP_API_ITEM = {
  pbanc_sn: "175001",
  intg_pbanc_biz_nm: "2026년 예비창업패키지",
  biz_pbanc_nm: "2026년 예비창업패키지 (일반분야) 예비창업자 모집 공고",
  pbanc_ctnt: "혁신적인 기술창업 아이디어를 보유한 예비창업자의 성공 창업을 지원",
  supt_biz_clsfc: "사업화",
  aply_trgt: "예비창업자",
  aply_trgt_ctnt: "공고일 기준 사업자등록을 하지 않은 예비창업자",
  aply_excl_trgt_ctnt: "사업자 등록 이력이 있는 자",
  biz_enyy: "예비창업자",
  biz_trgt_age: "만 20세 이상 ~ 만 39세 이하",
  supt_regin: "전국",
  pbanc_rcpt_bgng_dt: "20260901",
  pbanc_rcpt_end_dt: "20260925",
  pbanc_ntrp_nm: "창업진흥원",
  sprv_inst: "공공기관",
  biz_prch_dprt_nm: "예비창업부",
  prch_cnpl_no: "044-000-0001",
  detl_pg_url: "https://www.k-startup.go.kr/web/contents/bizpbanc-ongoing.do?schM=view&pbancSn=175001",
  biz_gdnc_url: "https://www.k-startup.go.kr/guide/175001",
  aply_mthd_onli_rcpt_istc: "K-Startup 누리집 온라인 접수",
  rcrt_prgs_yn: "Y",
  prfn_matr: "여성, 장애인 가점",
};

export const KSTARTUP_API_ITEM_CLOSED = { ...KSTARTUP_API_ITEM, pbanc_sn: "175000", biz_pbanc_nm: "지난 공고", pbanc_rcpt_end_dt: "20260101", rcrt_prgs_yn: "N" };

export const KSTARTUP_LIST_HTML = `
<html><body>
<ul class="list">
<li>
  <div class="middle"><p class="tit">2026년 서울창업허브 입주기업 모집</p></div>
  <div class="bottom">
    <span class="list">기관명 : 서울경제진흥원</span>
    <span class="list">접수기간 : 2026-09-15 ~ 2026-09-30</span>
    <span class="list">지역 : 서울</span>
    <span class="list">대상 : 창업 7년 이내 기업</span>
  </div>
  <a href="javascript:go_view('bizpbanc-ongoing.do?schM=view&pbancSn=175100')">상세보기</a>
</li>
<li>
  <div class="middle"><p class="tit">글로벌 진출 스타트업 액셀러레이팅</p></div>
  <div class="bottom"><span class="list">기관명 : 창업진흥원</span><span class="list">접수기간 : 2026-09-01 ~ 2026-10-15</span><span class="list">지역 : 전국</span></div>
  <a href="/web/contents/bizpbanc-ongoing.do?schM=view&pbancSn=175101">상세보기</a>
</li>
</ul>
</body></html>`;

export const KSTARTUP_DETAIL_HTML = `
<html><body>
<dl><dt>사업개요</dt><dd>서울창업허브 입주 공간 및 보육 프로그램 제공</dd>
<dt>신청대상</dt><dd>서울 소재 창업 7년 이내 기업 (SaaS, 플랫폼 우대)</dd>
<dt>제외대상</dt><dd>타 공공 보육공간 입주 기업</dd>
<dt>접수기간</dt><dd>2026-09-15 ~ 2026-09-30</dd>
<dt>신청방법</dt><dd>온라인 접수</dd></dl>
</body></html>`;
