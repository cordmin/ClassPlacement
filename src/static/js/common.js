// 화면 상태(S), 서버 호출, 로딩·알림, 페이지 이동.

/* ═══════════════════════════════════════════════════════
   APP STATE
═══════════════════════════════════════════════════════ */
const S = {
  selectedRows: new Set(),
  sepData:      [],
  joinData:     [],
  studentList:  [],
  classData:    [],
  fullResult:   [],
  currentFilter:"1반",
  manualSelected: null,
  numClasses: 6,
};

function detectDefaultClasses() {
  if (!S.studentList || S.studentList.length === 0) return 6;
  let maxClass = 0;
  S.studentList.forEach(s => {
    if (s && s["반"] !== undefined && s["반"] !== null) {
      const val = String(s["반"]).replace(/[^0-9]/g, '');
      const num = parseInt(val, 10);
      if (!isNaN(num) && num > maxClass) {
        maxClass = num;
      }
    }
  });
  return maxClass > 0 ? maxClass : 6;
}


/* ═══════════════════════════════════════════════════════
   API HELPER
═══════════════════════════════════════════════════════ */
async function api(url, method="GET", body=null) {
  const opts = { method, headers: {"Content-Type":"application/json"} };
  if (body) opts.body = JSON.stringify(body);
  const r = await fetch(url, opts);
  return r.json();
}

/* ═══════════════════════════════════════════════════════
   LOADING / TOAST
═══════════════════════════════════════════════════════ */
function showLoading(msg="처리 중...") {
  document.getElementById("loadingMsg").textContent = msg;
  document.getElementById("loading").classList.add("show");
}
function hideLoading() { document.getElementById("loading").classList.remove("show"); }

function toast(msg, type="success") {
  const el = document.createElement("div");
  el.className = `toast ${type}`;
  const icon = type === 'success' ? 'check-circle' : (type === 'error' ? 'alert-circle' : 'info');
  el.innerHTML = `<svg width="18" height="18"><use href="#i-${icon}"/></svg><span>${msg}</span>`;
  document.getElementById("toast-area").appendChild(el);
  setTimeout(() => el.remove(), 3100);
}


/* ═══════════════════════════════════════════════════════
   NAVIGATION
═══════════════════════════════════════════════════════ */
function navigate(page) {
  if ((page === 'manual' || page === 'result' || page === 'verify') && S.classData.length === 0) {
    toast("자동 학급 편성을 먼저 실행하세요!", "error"); return;
  }
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
  document.getElementById(`page-${page}`).classList.add('active');
  document.getElementById(`nav-${page}`).classList.add('active');

  if (page === 'verify') {
    runVerify();
  }
}
