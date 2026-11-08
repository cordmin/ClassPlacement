// 기초 편성 작업 화면: 학생 보드와 그룹 표시.

/* ═══════════════════════════════════════════════════════
   TABLE RENDERERS
═══════════════════════════════════════════════════════ */
function toggleDrop(mode) {
  document.querySelectorAll(".group-drop").forEach(d =>
    d.classList.toggle("open", d.id === `${mode}Drop` && !d.classList.contains("open")));
}

function closeCtxMenu() {
  document.getElementById("ctxMenu").classList.remove("show");
  document.body.classList.remove("sel-dim");
}

// 여러 명을 골랐으면 어디를 눌러도 고른 학생 전체가 대상
// 아니면 우클릭한 학생이 대상 (고른 학생 1명을 눌러도 같음)
function openCtxMenu(e, key) {
  e.preventDefault();
  document.querySelector(".row-tip")?.remove();
  const multi = S.selectedRows.size >= 2;
  if (!multi && !S.selectedRows.has(key)) {
    S.selectedRows.clear();
    S.selectedRows.add(key);
    document.querySelectorAll("#setupBoard .class-student").forEach(el => el.classList.toggle("selected", el.dataset.key === key));
  }
  const menu = document.getElementById("ctxMenu");
  menu.classList.add("show");
  menu.style.left = Math.min(e.clientX, innerWidth - menu.offsetWidth - 8) + "px";
  menu.style.top  = Math.min(e.clientY, innerHeight - menu.offsetHeight - 8) + "px";
  document.body.classList.toggle("sel-dim", multi);
}

document.addEventListener("contextmenu", e => {
  if (e.target.closest("#setupBoard .class-student")) return; // 학생 줄은 자체 처리
  closeCtxMenu();
  const onSetup = document.getElementById("page-setup").classList.contains("active");
  if (onSetup && S.selectedRows.size >= 2 && !e.target.closest(".modal-overlay-bg")) openCtxMenu(e);
});

// ESC: 고른 학생 전부 취소 (창이 떠 있을 때는 그대로 둠)
document.addEventListener("keydown", e => {
  if (e.key !== "Escape" || document.querySelector(".modal-overlay-bg.show")) return;
  closeCtxMenu();
  S.selectedRows.clear();
  document.querySelectorAll("#setupBoard .class-student.selected").forEach(el => el.classList.remove("selected"));
});

// 선택지가 떠 있을 때 바깥을 누르면 선택지만 닫고, 그 클릭은 버림 (다른 학생이 눌리지 않게)
document.addEventListener("click", e => {
  const menu = document.getElementById("ctxMenu");
  if (!menu.classList.contains("show") || menu.contains(e.target)) return;
  closeCtxMenu();
  e.stopPropagation();
  e.preventDefault();
}, true);

// 빈 곳을 누르면 접기 (패널 안과 확인 창을 누를 때는 그대로 둠)
document.addEventListener("click", e => {
  closeCtxMenu();
  if (e.target.closest(".group-drop, .modal-overlay-bg")) return;
  document.querySelectorAll(".group-drop.open").forEach(d => d.classList.remove("open"));
});

function renderSetup() {
  renderSetupBoard();
  renderGroupPanel("sep");
  renderGroupPanel("join");
  renderGroupPanel("homonym");
}

function clearGroupLit() {
  document.querySelectorAll(".group-lit").forEach(el => {
    el.classList.remove("group-lit");
    el.style.boxShadow = "";
  });
  document.getElementById("groupTips").innerHTML = "";
}

// 학생 줄 오른쪽 위에 정보 말풍선을 띄움
function showRowTip(el, text) {
  const tip = document.createElement("div");
  tip.className = "row-tip";
  tip.textContent = text;
  document.getElementById("groupTips").appendChild(tip);
  const w = tip.offsetWidth, h = tip.offsetHeight;
  tip.insertAdjacentHTML("beforeend", `<svg width="${w}" height="${h}"><path fill="#FFFFFF" stroke="#64748B" stroke-width="1.5" stroke-linejoin="round" d="M8 0H${w - 8}a8 8 0 0 1 8 8V${h - 8}a8 8 0 0 1-8 8H22L3 ${h + 12}L9 ${h}H8a8 8 0 0 1-8-8V8a8 8 0 0 1 8-8Z"/></svg>`);
  const r = el.querySelector(".student-num + span").getBoundingClientRect(); // 이름 기준
  tip.style.left = Math.min(r.right - 3, innerWidth - w - 8) + "px";
  tip.style.top = Math.max(8, el.getBoundingClientRect().top - tip.offsetHeight - 6) + "px";
}

// 가려진 학생이 있는 쪽 끝에 말풍선으로 명단을 띄움
function addGroupTip(side, els, board) {
  const tip = document.createElement("div");
  tip.className = `group-tip ${side}`;
  tip.textContent = els.map(el => {
    if (el.dataset.label) return el.dataset.label; // 수동 편성: 지금 배정된 반
    const [ban, , name] = el.dataset.key.split("|");
    return `${ban}반 ${name}`;
  }).join("\n");
  document.getElementById("groupTips").appendChild(tip);

  if (side === "left" || side === "right") {
    tip.style[side] = (side === "left" ? board.left : innerWidth - board.right) + 10 + "px";
    tip.style.top = Math.min(els[0].getBoundingClientRect().top, board.bottom - tip.offsetHeight - 8) + "px";
  } else {
    const l = els[0].closest(".class-list").getBoundingClientRect();
    tip.style.left = l.left + l.width / 2 + "px";
    if (side === "up") tip.style.top = l.top + 8 + "px";
    else tip.style.bottom = innerHeight - l.bottom + 8 + "px";
  }
}

// 커서를 올린 학생과 같은 그룹 학생에게 그룹 색 굵은 테두리를 두름 (groupColors: 학생 → 색 목록)
function showGroupLit(hovered, groupColors) {
  const hoveredList = hovered.closest(".class-list");
  const scroll = hovered.closest(".board-scroll");
  const board = scroll.getBoundingClientRect();
  const hidden = { left: [], right: [], up: [], down: [] };
  scroll.querySelectorAll(".class-student").forEach(el => {
    const colors = groupColors.get(el.dataset.key);
    if (!colors) return;
    el.classList.add("group-lit");
    // 두 그룹에 속하면 테두리를 안쪽으로 겹쳐 두 색 다 보임
    el.style.boxShadow = colors.map((c, i) => `inset 0 0 0 ${3 * (i + 1)}px ${c}`).join(",");
    if (el === hovered) return;
    const list = el.closest(".class-list");
    const l = list.getBoundingClientRect();
    let r = el.getBoundingClientRect();
    // 같은 반 명단을 스크롤하면 커서 밑 학생이 움직이니 말풍선으로 알려 줌
    if (list === hoveredList) {
      if (r.top < l.top) hidden.up.push(el);
      else if (r.bottom > l.bottom) hidden.down.push(el);
      return;
    }
    // 다른 반 명단에서 스크롤에 가려진 학생은 보이게 내림
    if (r.top < l.top) list.scrollTop += r.top - l.top;
    else if (r.bottom > l.bottom) list.scrollTop += r.bottom - l.bottom;
    r = el.getBoundingClientRect();
    if (r.right > board.right) hidden.right.push(el);
    else if (r.left < board.left) hidden.left.push(el);
  });
  Object.entries(hidden).forEach(([side, els]) => { if (els.length) addGroupTip(side, els, board); });
}

// 학생(반|번호|이름)별 LED, 말풍선 그룹 이름, 같은 그룹 학생과 그 색 — 기초 편성·수동 편성 판이 같이 씀
function groupInfo() {
  const badges = {}, labels = {}, mates = {};
  const sepKeys = new Set(), homonymKeys = new Set();
  S.sepData.forEach(s => {
    const key = _makeKey(s);
    const homonym = s["분리사유"] === HOMONYM_REASON;
    (homonym ? homonymKeys : sepKeys).add(key);
    (badges[key] ||= []).push(`<span class="led ${homonym ? "led-homonym" : "led-sep"}"></span>`);
    (labels[key] ||= []).push(homonym ? HOMONYM_REASON : `분리 ${s["그룹"]}그룹`);
  });
  S.joinData.forEach(s => {
    const key = _makeKey(s);
    (badges[key] ||= []).push(`<span class="led led-join"></span>`);
    (labels[key] ||= []).push(`통합 ${s["그룹"]}그룹`);
  });
  // 두 그룹에 속하면 색을 둘 다 합침
  ["sep", "join"].forEach(mode => Object.values(groupsOf(mode)).forEach(({ reason, members }) => {
    const color = `var(--led-${mode === "join" ? "join" : reason === HOMONYM_REASON ? "homonym" : "sep"})`;
    const keys = members.map(_makeKey);
    keys.forEach(k => {
      const m = mates[k] ||= new Map();
      keys.forEach(o => m.set(o, [...(m.get(o) || []), color]));
    });
  }));
  return { badges, sepKeys, homonymKeys, labels, mates };
}

function renderSetupBoard() {
  const inner = document.getElementById("setupBoard");
  const scrollTops = [...inner.querySelectorAll(".class-list")].map(el => el.scrollTop);
  clearGroupLit();
  inner.innerHTML = "";
  if (!S.studentList.length) {
    inner.innerHTML = `<div class="empty-state" style="flex:1;"><svg width="32" height="32"><use href="#i-users"/></svg><p>왼쪽 위 불러오기 버튼으로 학생 명단을 불러오세요.</p></div>`;
    return;
  }

  const { badges, sepKeys, homonymKeys, labels, mates } = groupInfo();

  const byClass = new Map();
  const numeric = (a, b) => String(a).localeCompare(String(b), undefined, { numeric: true });
  [...S.studentList]
    .sort((a, b) => numeric(a["반"], b["반"]) || numeric(a["번호"], b["번호"]))
    .forEach(s => {
      if (!byClass.has(s["반"])) byClass.set(s["반"], []);
      byClass.get(s["반"]).push(s);
    });

  [...byClass].forEach(([ban, students], i) => {
    const card = document.createElement("div");
    card.className = "class-card";
    card.innerHTML = `
      <div class="class-card-header">
        <span class="class-name">${ban}반</span>
        <span class="class-count">${students.length}명</span>
      </div>
      <div class="class-list"></div>
    `;
    const list = card.querySelector(".class-list");
    students.forEach(s => {
      const key = _makeKey(s);
      const b = badges[key];
      const el = document.createElement("div");
      el.className = "class-student" + (S.selectedRows.has(key) ? " selected" : "")
        + (sepKeys.has(key) ? " is-sep" : homonymKeys.has(key) ? " is-homonym" : b ? " is-join" : "");
      el.dataset.key = key;
      el.innerHTML = `
        <div style="display:flex; align-items:center; gap:6px; flex-shrink:0;">
          <span class="student-num">${s["번호"]}</span>
          <span style="font-weight:${b ? 700 : 500}; white-space:nowrap;">${s["이름"]}</span>
        </div>
        <div class="setup-badges">${(b || []).join("")}</div>
      `;
      const tipText = [`${s["성별"]} · 성적 ${s["성적"]}`, ...(labels[key] || [])].join("\n");
      el.onmouseenter = () => {
        showRowTip(el, tipText);
        if (mates[key]) showGroupLit(el, mates[key]);
      };
      el.onmouseleave = clearGroupLit;
      el.oncontextmenu = e => openCtxMenu(e, key);
      el.onclick = () => {
        if (!S.selectedRows.delete(key)) S.selectedRows.add(key);
        el.classList.toggle("selected", S.selectedRows.has(key));
      };
      list.appendChild(el);
    });
    inner.appendChild(card);
    list.scrollTop = scrollTops[i] || 0;
  });
}

function renderGroupPanel(mode) {
  const panel = document.getElementById(`${mode}Panel`);
  // 동명 그룹은 분리 자료 안에 있지만 화면에서는 따로 보여 주고 건드릴 수 없음
  const locked = mode === "homonym";
  const groups = groupsOf(locked ? "sep" : mode);
  const nums = Object.keys(groups)
    .filter(g => mode === "join" || locked === (groups[g].reason === HOMONYM_REASON))
    .sort((a, b) => Number(a) - Number(b));
  panel.innerHTML = "";
  if (!nums.length) {
    panel.innerHTML = `<div class="empty-state" style="padding:24px;"><p>아직 그룹이 없습니다.</p></div>`;
    return;
  }
  nums.forEach((g, i) => {
    const { reason, members } = groups[g];
    const row = document.createElement("div");
    row.className = "group-row";
    row.innerHTML = `<div class="group-row-head"><strong>${locked ? i + 1 : g}</strong><span>${reason || "사유 없음"}</span></div><div class="group-chips"></div>`;
    if (!locked) {
      const reset = document.createElement("button");
      reset.className = "btn-sm group-reset";
      reset.textContent = "초기화";
      reset.onclick = () => resetGroup(mode, g);
      row.querySelector(".group-row-head").appendChild(reset);
    }
    members.forEach(s => {
      const chip = document.createElement("span");
      chip.className = "group-chip";
      chip.textContent = `${s["반"]}반 ${s["이름"]}`;
      chip.title = `${s["반"]}반 ${s["번호"]}번`;
      if (!locked) {
        const btn = document.createElement("button");
        btn.title = "그룹에서 빼기";
        btn.innerHTML = `<svg width="12" height="12"><use href="#i-x"/></svg>`;
        btn.onclick = () => deleteLogic(mode, s);
        chip.appendChild(btn);
      }
      row.querySelector(".group-chips").appendChild(chip);
    });
    panel.appendChild(row);
  });
}
