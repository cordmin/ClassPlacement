// 가이드 투어: 일하는 순서대로 버튼을 하나씩 밝히고 옆에 설명 카드를 띄운다.
// '다시 보지 않기'는 settings.json 의 hideTour 에 둔다 (/api/settings).
const TOUR_STEPS = [
  { el: '.sidebar-icon-btn[onclick^="downloadTemplate"]', title: "1. 양식 내려받기", text: "엑셀 양식을 받아 반·번호·이름·성별·성적을 채웁니다." },
  { el: '.sidebar-icon-btn[onclick^="loadExcel"]',        title: "2. 명단 불러오기", text: "채운 엑셀을 불러옵니다. 이름이 같은 학생은 저절로 동명 그룹으로 묶여 다른 반에 들어갑니다." },
  { el: "#nav-setup",  title: "3. 기초 편성 작업", text: "학생을 좌클릭으로 고르고 우클릭으로 분리 그룹(다른 반)이나 통합 그룹(같은 반)을 만듭니다." },
  { el: "#nav-auto",   title: "4. 자동 학급 편성", text: "학급 수와 반별 성적 차이를 정하면 인원·성별·성적을 고르게 맞춰 반을 나눕니다." },
  { el: "#nav-manual", title: "5. 수동 학급 편성", text: "학생이나 학급을 끌어서 옮깁니다. 잘못 옮겼으면 실행취소로 돌아갈 수 있습니다." },
  { el: "#nav-result", title: "6. 학급 편성 결과", text: "반별 명단과 성적 통계, 반마다 어느 반 학생이 왔는지 확인합니다." },
  { el: "#nav-verify", title: "7. 학급 편성 검증", text: "그룹·인원·성별·성적 규칙을 잘 지켰는지 검사하고, 고칠 방법을 알려 줍니다." },
  { el: '.sidebar-icon-btn[onclick^="saveExcel"]',        title: "8. 결과 저장", text: "편성 결과를 엑셀로 저장합니다. 반별 시트와 통계 시트가 함께 만들어집니다." },
  { el: "#btnHelp",    title: "9. 사용 안내 다시 보기", text: "? 를 누르면 이 가이드 투어를 처음부터 다시 볼 수 있습니다." },
  { el: "#appVersion", title: "10. 프로그램 정보·업데이트", text: "제목 옆 버전 번호를 누르면 제작자 정보와 개인정보 처리방침을 볼 수 있습니다. 업데이트 확인 버튼으로 새 버전도 확인할 수 있습니다." },
];
let tourIndex = 0;
let tourHidden = false;   // 켤 때 boot.js 가 설정에서 읽어 둔다
const $t = id => document.getElementById(id);

function placeTour() {
  const step = TOUR_STEPS[tourIndex];
  const r = document.querySelector(step.el).getBoundingClientRect();
  const pad = 4, card = $t("tourCard");
  Object.assign($t("tourSpot").style, { left: `${r.left - pad}px`, top: `${r.top - pad}px`, width: `${r.width + pad * 2}px`, height: `${r.height + pad * 2}px` });
  $t("tourTitle").textContent = step.title;
  $t("tourText").textContent = step.text;
  $t("tourStep").textContent = `${tourIndex + 1} / ${TOUR_STEPS.length}`;
  $t("tourPrev").classList.toggle("invisible", tourIndex === 0);
  $t("tourNext").textContent = tourIndex === TOUR_STEPS.length - 1 ? "시작하기" : "다음";
  // 오른쪽에 붙이고, 화면 밖으로 나가면 아래로 내려 오른쪽 끝을 맞춘다 (타이틀바 버튼).
  let left = r.right + 16, top = r.top - 8;
  if (left + card.offsetWidth > innerWidth - 8) { left = r.right - card.offsetWidth; top = r.bottom + 14; }
  card.style.left = `${Math.max(8, left)}px`;
  card.style.top = `${Math.max(46, Math.min(top, innerHeight - card.offsetHeight - 8))}px`;
}

function startTour() {
  tourIndex = 0;
  $t("tourHide").checked = tourHidden;
  $t("tour").hidden = false;
  placeTour();
  $t("tourNext").focus();
}

function closeTour() {
  $t("tour").hidden = true;
  tourHidden = $t("tourHide").checked;
  api("/api/settings", "POST", { hideTour: tourHidden });
}

function moveTour(delta) {
  tourIndex += delta;
  if (tourIndex >= TOUR_STEPS.length) closeTour();
  else placeTour();
}

$t("tourNext").onclick = () => moveTour(1);
$t("tourPrev").onclick = () => moveTour(-1);
$t("tourSkip").onclick = closeTour;
$t("tour").addEventListener("keydown", e => {
  e.stopPropagation();   // 다른 화면의 Esc·방향키 처리와 겹치지 않게
  if (e.key === "Escape") { e.preventDefault(); closeTour(); }
  else if (e.key === "ArrowRight") moveTour(1);
  else if (e.key === "ArrowLeft" && tourIndex > 0) moveTour(-1);
});
window.addEventListener("resize", () => { if (!$t("tour").hidden) placeTour(); });
