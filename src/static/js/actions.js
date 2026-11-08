// 양식 내려받기, 명단 불러오기, 자동 편성 창, 결과 저장.

async function resetAll() {
  if (!await openConfirm(
    "새 작업을 시작할까요?\n\n현재 명단·그룹·편성 결과를 초기화합니다.",
    "전체 초기화", "전체 초기화")) return;
  showLoading("전체 초기화 중…");
  try {
    const r = await api("/api/reset_all", "POST");
    if (!r.ok) throw new Error(r.msg);
    window.location.reload();
  } catch (e) {
    hideLoading();
    toast(e.message || "전체 초기화를 완료하지 못했습니다.", "error");
  }
}

/* ═══════════════════════════════════════════════════════
   ACTIONS (내려받기, 불러오기, 자동배정, 결과저장)
═══════════════════════════════════════════════════════ */
async function downloadTemplate() {
  showLoading("양식 파일 생성 중...");
  const r = await api("/api/download_template", "POST");
  hideLoading();
  if (r.ok) {
    toast("양식 다운로드 완료! ✅", "success");
  } else {
    toast(r.msg, "error");
  }
}

async function loadExcel() {
  showLoading("파일 로드 중...");
  const r = await api("/api/load_excel", "POST");
  hideLoading();
  if (!r.ok) { toast(r.msg, "error"); return; }
  S.studentList = r.data;
  S.sepData = r.sep_data;
  S.selectedRows.clear();
  renderSetup();
  const detected = detectDefaultClasses();
  S.numClasses = detected;
  document.getElementById("modalNumClasses").value = detected;
  toast("엑셀 파일을 불러왔습니다.", "success");
}

function openAssignModal() {
  if (!S.studentList || S.studentList.length === 0) {
    toast("학생 명단을 먼저 불러오세요!", "error"); return;
  }
  const detected = detectDefaultClasses();
  S.numClasses = detected;
  document.getElementById("modalNumClasses").value = detected;
  updateScoreLabel();
  document.getElementById("assign-modal-overlay").classList.add("show");
}
function stepClasses(d) {
  const input = document.getElementById("modalNumClasses");
  input.value = Math.min(30, Math.max(1, (parseInt(input.value) || 1) + d));
}

// 성적 단위가 달라도 뜻이 같도록 학생 성적의 퍼진 정도(표준편차)로 목표 점수를 계산
const SCORE_STEPS = [0.02, 0.05, 0.1, 0.2];
// 지금 불러온 학생들의 성적으로 계산: 표준편차 × 고른 단계 비율
function scoreStats() {
  const xs = S.studentList.map(s => Number(s["성적"])).filter(n => !isNaN(n));
  const avg = xs.reduce((a, b) => a + b, 0) / xs.length;
  const sd = Math.sqrt(xs.reduce((a, b) => a + (b - avg) ** 2, 0) / xs.length);
  const rate = SCORE_STEPS[document.getElementById("ruleScore").value];
  return { n: xs.length, avg, sd, rate, gap: sd * rate };
}
function scoreGap() { return scoreStats().gap; }
function setScoreStep(i) {
  document.getElementById("ruleScore").value = i;
  updateScoreLabel();
}
function updateScoreLabel() {
  const { n, sd, rate, gap } = scoreStats();
  const gapText = gap < 10 ? gap.toFixed(1) : Math.round(gap);
  document.getElementById("scoreValue").textContent = `약 ${gapText}점 이내`;
  document.getElementById("scoreTip").innerHTML =
    `불러온 학생 ${n}명의 성적으로 계산했어요.<br>표준편차 ${sd.toFixed(1)}점 × ${Math.round(rate * 100)}% = <b>약 ${gapText}점</b><br>`
    + `<span class="muted">가장 높은 반과 낮은 반의 평균 차이를 이 안으로 맞춰요.</span>`;
  const step = Number(document.getElementById("ruleScore").value);
  [...document.getElementById("scoreTicks").children].forEach((el, i) => {
    el.classList.toggle("on", i === step);
    el.setAttribute("role", "radio");
    el.setAttribute("aria-checked", i === step);
  });
}
function closeAssignModal() {
  document.getElementById("assign-modal-overlay").classList.remove("show");
}
async function confirmAssign() {
  const num = parseInt(document.getElementById("modalNumClasses").value || "0");
  if (num <= 0 || isNaN(num)) {
    toast("올바른 학급 수를 입력하세요.", "error"); return;
  }
  S.numClasses = num;
  closeAssignModal();
  runAssign(num, { score_gap: scoreGap(), score_rate: scoreStats().rate });
}

async function runAssign(n, rules) {
  showLoading("배정 엔진 실행 중...");
  const r = await api("/api/assign", "POST", { num_classes: n, ...rules });
  hideLoading();
  if (!r.ok) { toast("오류: " + r.msg, "error"); return; }
  applyResult(r.result);
  toast("학급 배정이 완벽하게 완료되었습니다! ✅", "success");
  navigate("manual");
}

async function saveExcel() {
  if (!S.fullResult.length) { toast("저장할 배정 결과가 없습니다.", "error"); return; }
  showLoading("결과 저장 중...");
  const r = await api("/api/save_excel", "POST");
  hideLoading();
  toast(r.ok ? "저장 완료! ✅" : r.msg, r.ok ? "success" : "error");
  return r.ok;
}

function applyResult(result) {
  S.fullResult  = result.list;
  S.classData   = result.classes;
  S.undo        = result.undo || [];
  S.stats       = result.stats || [];
  S.scoreGap    = result.score_gap || null;
  S.scoreRate   = result.score_rate || null;
  S.canReset    = !!result.can_reset;
  renderBoard(result.classes);
  renderUndo();
  renderResultPage(result);
}
