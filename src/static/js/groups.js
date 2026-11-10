// 분리·통합 그룹: 사유 입력 창, 그룹 고르기, 우클릭 메뉴, 추가·삭제.

/* ═══════════════════════════════════════════════════════
   GROUPS & MODALS
═══════════════════════════════════════════════════════ */
let _groupSelectResolve = null;

const HOMONYM_REASON = "동명이인";

function groupsOf(mode) {
  const rKey = mode === "sep" ? "분리사유" : "통합사유";
  const map = {};
  (mode === "sep" ? S.sepData : S.joinData).forEach(s => {
    const g = String(s["그룹"]);
    if (!map[g]) map[g] = { reason: s[rKey] || "", members: [] };
    map[g].members.push(s);
  });
  return map;
}

function openGroupSelect(mode, names) {
  const label  = mode === "sep" ? "분리"     : "통합";
  const groupMap = groupsOf(mode);
  Object.keys(groupMap).forEach(g => { if (groupMap[g].reason === HOMONYM_REASON) delete groupMap[g]; });

  const groupNums = Object.keys(groupMap).sort((a,b) => Number(a)-Number(b));

  if (!groupNums.length) {
    toast(`아직 ${label} 그룹이 없습니다. 먼저 그룹을 추가하세요.`, "error");
    return Promise.resolve(null);
  }

  document.getElementById("groupSelectTitle").textContent = `${names} 학생을 합류시킬 ${label} 그룹을 선택하세요`;

  const list = document.getElementById("groupSelectList");
  list.innerHTML = "";
  const apply = document.getElementById("groupSelectApply");
  apply.style.display = "none";
  let picked = null;
  apply.onclick = () => _groupSelectResolve({ tg: picked, reason: groupMap[picked].reason });

  groupNums.forEach(g => {
    const info = groupMap[g];
    const item = document.createElement("div");
    item.className = "group-opt";
    item.style.cssText = "display:flex;align-items:center;justify-content:space-between;flex-shrink:0;padding:12px 16px;border-radius:6px;border:1px solid var(--line-dark);background:var(--card-bg);cursor:pointer;gap:12px;";
    item.innerHTML = `
      <div style="min-width:0;">
        <div style="display:flex;align-items:center;gap:10px;">
          <span style="font-size:0.8125rem;font-weight:800;color:var(--brand);">${g}그룹</span>
          <span style="font-size:0.75rem;color:var(--text-sub);font-weight:600;">${info.reason || "사유 없음"}</span>
        </div>
        <div style="font-size:0.75rem;color:var(--text-sub);margin-top:4px;">${info.members.map(m => `${m["반"]}반 ${m["이름"]}`).join(", ")}</div>
      </div>
      <span style="font-size:0.6875rem;font-weight:700;padding:2px 10px;border-radius:20px;background:var(--surface-bg);color:var(--brand);">${info.members.length}명</span>
    `;
    item.onclick = () => {
      picked = g;
      list.querySelectorAll(".group-opt").forEach(o => o.classList.toggle("selected", o === item));
      apply.style.display = "";
    };
    list.appendChild(item);
  });

  document.getElementById("group-select-overlay").classList.add("show");
  return new Promise(res => {
    _groupSelectResolve = (val) => {
      document.getElementById("group-select-overlay").classList.remove("show");
      res(val);
    };
  });
}

const REASON_OPTIONS = {
  sep:  ["학교폭력", "교우관계", "운동선수", "특수교육"],
  join: ["교우관계", "또래도우미", "쌍둥이"],
};

let _modalResolve = null;
let _selectedChip = null;

function openModal(title, mode="sep") {
  _selectedChip = null;
  document.getElementById("modalTitle").textContent = title;
  const inp = document.getElementById("modalInput");
  const other = document.getElementById("modalOther");
  inp.value = "";
  other.classList.remove("active");

  const pick = (btn, label) => {
    document.querySelectorAll("#modal-overlay .reason-chip").forEach(b => b.classList.toggle("active", b === btn));
    _selectedChip = label;
    if (label === "기타") inp.focus();
    else inp.value = "";
  };
  other.onclick = () => pick(other, "기타");
  // 입력란을 바로 눌러도 기타가 골라짐
  inp.onfocus = () => { if (_selectedChip !== "기타") pick(other, "기타"); };

  const chips = document.getElementById("modalChips");
  chips.innerHTML = "";
  REASON_OPTIONS[mode].forEach(label => {
    const btn = document.createElement("button");
    btn.className = "reason-chip";
    btn.textContent = label;
    btn.onclick = () => pick(btn, label);
    chips.appendChild(btn);
  });

  document.getElementById("modal-overlay").classList.add("show");
  return new Promise(res => { _modalResolve = res; });
}

function closeModal(ok) {
  document.getElementById("modal-overlay").classList.remove("show");
  if (!_modalResolve) return;
  if (!ok) { _modalResolve(null); return; }
  if (!_selectedChip) { toast("사유를 선택하세요.", "error"); document.getElementById("modal-overlay").classList.add("show"); return; }
  if (_selectedChip === "기타") {
    const val = document.getElementById("modalInput").value.trim();
    if (!val) { toast("기타 사유를 입력하세요.", "error"); document.getElementById("modal-overlay").classList.add("show"); return; }
    _modalResolve(val);
  } else {
    _modalResolve(_selectedChip);
  }
}

let _confirmResolve = null;
function openConfirm(msg, title = "확인 메시지", okText = "확인") {
  document.getElementById("confirm-overlay").classList.toggle("reset-confirm", title === "전체 초기화");
  document.getElementById("confirmTitle").textContent = title;
  document.getElementById("confirmOkBtn").textContent = okText;
  document.getElementById("confirmMsg").textContent = msg;
  document.getElementById("confirm-overlay").classList.add("show");
  document.getElementById("confirmCancelBtn").focus();
  return new Promise(res => { _confirmResolve = (ok) => {
    document.getElementById("confirm-overlay").classList.remove("show");
    res(ok);
  }; });
}


/* ═══════════════════════════════════════════════════════
   SEP / JOIN LOGIC
═══════════════════════════════════════════════════════ */
async function addLogic(mode, isNew) {
  const selKeys = [...S.selectedRows];
  if (!selKeys.length) { toast("학생을 먼저 선택하세요.", "error"); return; }

  const data = mode==="sep" ? S.sepData : S.joinData;
  const rKey = mode==="sep" ? "분리사유" : "통합사유";
  const endpoint = mode==="sep" ? "/api/sep_data/add" : "/api/join_data/add";
  const students = S.studentList.filter(s => selKeys.includes(_makeKey(s)));
  let tg, reason;

  if (isNew) {
    reason = await openModal("사유를 입력하세요", mode);
    if (reason === null) return;
    // 동명 그룹 번호는 서버가 새 분리 그룹 뒤로 다시 매김
    const groups = data.filter(d=>d[rKey]!==HOMONYM_REASON).map(d=>Number(d["그룹"])).filter(n=>!isNaN(n));
    tg = groups.length ? String(Math.max(...groups)+1) : "1";
  } else {
    const names = students.map(s => `${s["반"]}반 ${s["이름"]}`).join(", ");
    const selected = await openGroupSelect(mode, names);
    if (!selected) return;
    tg     = selected.tg;
    reason = selected.reason;
  }

  let added = 0, skipped = 0;
  for (const s of students) {
    const payload = {...s, 그룹: tg, [rKey]: reason};
    const r = await api(endpoint, "POST", payload);
    if (r.ok) {
      added++;
      if (mode==="sep") S.sepData = r.sep_data;
      else              S.joinData = r.join_data;
    } else {
      skipped++;
      toast(r.msg, "error");
    }
  }

  if (added)   toast(`${added}명 추가 완료`, "success");
  if (skipped) toast(`${skipped}명 추가 실패 (중복 또는 오류)`, "info");

  S.selectedRows.clear();
  renderSetup();
}

function _makeKey(s) {
  return `${s["반"]}|${s["번호"]}|${s["이름"]}`;
}

async function deleteLogic(mode, target) {
  if (!await openConfirm(`${target["이름"]} 학생을 ${target["그룹"]}그룹에서 뺄까요?`)) return;

  const rmEndpoint = mode==="sep" ? "/api/sep_data/remove" : "/api/join_data/remove";
  const r = await api(rmEndpoint, "POST", {반: target["반"], 번호: target["번호"], 이름: target["이름"], 그룹: target["그룹"]});
  if (r.ok) {
    if (mode==="sep") S.sepData  = r.sep_data;
    else              S.joinData = r.join_data;
    renderSetup();
    toast("삭제 완료", "info");
  } else {
    toast("삭제 실패: " + r.msg, "error");
  }
}

async function resetGroup(mode, g) {
  if (!await openConfirm(`${g}그룹을 초기화할까요?`)) return;
  const rest = (mode === "sep" ? S.sepData : S.joinData).filter(s => String(s["그룹"]) !== String(g));
  if (mode === "sep") {
    S.sepData = (await api("/api/sep_data", "POST", rest)).sep_data;
  } else {
    await api("/api/join_data", "POST", rest);
    S.joinData = rest;
  }
  renderSetup();
  toast(`${g}그룹 초기화 완료`, "info");
}
