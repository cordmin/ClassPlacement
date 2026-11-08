// 수동 학급 편성 화면: 학생·학급 끌어 옮기기, 되돌리기.

/* ═══════════════════════════════════════════════════════
   MANUAL BOARD RENDER
═══════════════════════════════════════════════════════ */
let _classGap = null;
let _classDrag = null;

// 놓을 틈(0~학급 수)에 빈칸을 넣어 뒤쪽 반들이 비켜서게 함. 틈이 바뀔 때만 움직여서 떨리지 않음
function setClassGap(gap) {
  if (gap === _classGap) return;
  _classGap = gap;
  const inner = document.getElementById("boardInner");
  inner.querySelectorAll(".class-gap-spacer").forEach(sp => {
    sp.classList.remove("open");
    setTimeout(() => sp.remove(), 200);
  });
  if (gap === null) return;
  const sp = document.createElement("div");
  sp.className = "class-gap-spacer";
  inner.insertBefore(sp, inner.querySelectorAll(".class-card")[gap] || null);
  requestAnimationFrame(() => sp.classList.add("open"));
}

// 학급 카드 끌기: 브라우저 기본 끌기는 반투명이라, 또렷한 복사본을 직접 마우스에 붙여 움직임
function startClassDrag(e, card, src) {
  if (e.button !== 0) return;
  e.preventDefault(); // 끄는 동안 글자가 파랗게 선택되지 않게
  document.querySelectorAll(".class-ghost").forEach(g => g.remove()); // 혹시 남은 복사본 정리
  card.classList.add("lifted");
  _classDrag = { card, src, x0: e.clientX, y0: e.clientY, ghost: null };
}

document.addEventListener("mousemove", e => {
  const d = _classDrag;
  if (!d) return;
  if (!d.ghost) {
    if (Math.hypot(e.clientX - d.x0, e.clientY - d.y0) < 5) return; // 살짝 떨린 클릭은 끌기 아님
    const r = d.card.getBoundingClientRect();
    d.card.classList.remove("lifted");
    const g = d.card.cloneNode(true);
    g.querySelectorAll("[id]").forEach(el => el.removeAttribute("id"));
    g.className = "class-card class-ghost";
    g.style.cssText = `position:fixed; left:${r.left}px; top:${r.top}px; width:${r.width}px; height:${r.height}px;`;
    document.body.appendChild(g);
    g.querySelector(".class-list").scrollTop = d.card.querySelector(".class-list").scrollTop;
    d.ghost = g; d.left = r.left; d.top = r.top;
    // 비켜선 카드 위치로 틈을 다시 재면 왔다 갔다 하므로, 처음 자리의 가운데 값으로만 잼
    d.lefts = [];
    d.mids = [...document.querySelectorAll("#boardInner .class-card")].map(c => {
      const b = c.getBoundingClientRect();
      d.lefts.push(b.left);
      c.style.flex = `0 0 ${b.width}px`; // 빈칸이 생겨도 카드가 찌그러지지 않고 옆으로 밀리게
      return b.left + b.width / 2;
    });
    d.card.style.opacity = "0.4";
    document.body.classList.add("class-dragging");
  }
  d.ghost.style.left = d.left + e.clientX - d.x0 + "px";
  d.ghost.style.top  = d.top  + e.clientY - d.y0 + "px";
  const gap = d.mids.filter(m => e.clientX > m).length;
  // 제자리(자기 왼쪽·오른쪽 틈)는 아무도 비켜서지 않고 놓아도 아무 일 없음
  setClassGap(gap === d.src || gap === d.src + 1 ? null : gap);
});

document.addEventListener("mouseup", () => {
  const d = _classDrag;
  if (!d) return;
  _classDrag = null;
  d.card.classList.remove("lifted");
  if (!d.ghost) return;
  const gap = _classGap;
  document.body.classList.remove("class-dragging");
  if (gap !== null) { dropClassCard(d, gap); return; }
  setClassGap(null);
  document.querySelectorAll("#boardInner .class-card").forEach(c => c.style.flex = "");
  // 제자리에 놓으면 복사본이 원래 자리로 내려앉고 끝
  d.ghost.style.transition = "left 0.18s ease, top 0.18s ease, transform 0.18s ease";
  d.ghost.style.left = d.left + "px";
  d.ghost.style.top = d.top + "px";
  d.ghost.style.transform = "none";
  setTimeout(() => { d.ghost.remove(); d.card.style.opacity = "1"; }, 180);
});

function renderBoard(classes) {
  const inner = document.getElementById("boardInner");
  inner.innerHTML = '';
  
  clearGroupLit();
  // 기초 편성 작업 판과 같은 LED 등 (분리 빨강, 동명 초록, 통합 파랑)
  const { badges: leds, sepKeys, homonymKeys, labels, mates } = groupInfo();

  classes.forEach((names, i) => {
    const ci = i+1;
    const card = document.createElement("div");
    card.className = "class-card";
    card.dataset.classIdx = ci;

    card.innerHTML = `
      <div class="class-card-header draggable-hdr" data-ci="${ci}">
        <span class="class-name">${ci}반</span>
        <span class="class-count">${names.length}명</span>
      </div>
      <div class="class-list" id="cls-${ci}"></div>
    `;
    inner.appendChild(card);

    const hdr = card.querySelector(".class-card-header");
    hdr.addEventListener("mousedown", e => startClassDrag(e, card, i));

    const listEl = card.querySelector(`#cls-${ci}`);
    names.sort().forEach((name, idx) => {
      const st = S.fullResult.find(r => r["이름"] === name && r["배정학급"] === `${ci}반`);
      let extraClass = "", badge = "", oKey = null;
      if (st) {
        oKey = `${st.기존반}|${st.기존번호}|${st.이름}`;
        if (leds[oKey]) {
          extraClass = sepKeys.has(oKey) ? "is-sep" : homonymKeys.has(oKey) ? "is-homonym" : "is-join";
          badge = `<div class="setup-badges">${leds[oKey].join("")}</div>`;
        }
      }

      const el = document.createElement("div");
      el.className = `class-student ${extraClass}`;
      el.dataset.name = name;
      el.dataset.class = ci;
      el.innerHTML = `
        <div style="display:flex; align-items:center; gap:8px;">
          <span class="student-num">${idx+1}</span>
          <span style="font-weight:${badge ? '700' : '500'}">${name}</span>
        </div>
        ${badge}
      `;

      if (oKey) {
        el.dataset.key = oKey;
        el.dataset.label = `${ci}반 ${name}`;
        const tipText = [`${st.성별} · 성적 ${st.성적}`, `기존 ${st.기존반}반 ${st.기존번호}번`, ...(labels[oKey] || [])].join("\n");
        el.onmouseenter = () => {
          if (_stuDrag?.ghost || _classDrag) return; // 끄는 중에는 안 띄움
          showRowTip(el, tipText);
          if (mates[oKey]) showGroupLit(el, mates[oKey]);
        };
        el.onmouseleave = clearGroupLit;
      }
      el.addEventListener("mousedown", e => { clearGroupLit(); startStudentDrag(e, el, name, ci); });
      el.onclick = () => { if (!_stuJustDragged) onBoardClick(name, ci); };
      listEl.appendChild(el);
    });
  });
}

// 놓으면: 끌던 카드는 새 자리로 스르륵 내려앉고, 동시에 나머지 반들도 새 자리로 미끄러져 들어감
async function dropClassCard(d, gap) {
  const SLIDE = 280;
  const g = d.ghost;
  const r = await api("/api/reorder_classes", "POST", { src: d.src, tgt: gap });
  if (!r.ok) { // 실패하면 원래 자리로 되돌림
    setClassGap(null);
    g.style.transition = `left ${SLIDE}ms ease, top ${SLIDE}ms ease, transform ${SLIDE}ms ease`;
    g.style.left = d.left + "px"; g.style.top = d.top + "px"; g.style.transform = "none";
    setTimeout(() => { g.remove(); d.card.style.opacity = "1"; }, SLIDE);
    return;
  }
  const newIdx = gap > d.src ? gap - 1 : gap;
  // 지금 보이는 자리(비켜선 자리)를 기억했다가, 다시 그린 뒤 거기서 새 자리로 미끄러지게 함
  const oldLefts = [...document.querySelectorAll("#boardInner .class-card")].map(c => c.getBoundingClientRect().left);
  const order = oldLefts.map((_, k) => k);
  order.splice(newIdx, 0, order.splice(d.src, 1)[0]);
  _classGap = null;
  applyResult(r.result);
  const cards = [...document.querySelectorAll("#boardInner .class-card")];
  const moved = cards[newIdx];
  moved.style.visibility = "hidden"; // 끌던 카드가 내려앉을 때까지 숨김
  cards.forEach((c, j) => {
    if (c === moved) return;
    const dx = oldLefts[order[j]] - c.getBoundingClientRect().left;
    if (!dx) return;
    c.style.transition = "none";
    c.style.transform = `translateX(${dx}px)`;
  });
  const to = moved.getBoundingClientRect();
  moved.offsetWidth; // 위 위치를 먼저 그리게 함
  cards.forEach(c => { c.style.transition = `transform ${SLIDE}ms ease`; c.style.transform = ""; });
  g.style.transition = `left ${SLIDE}ms ease, top ${SLIDE}ms ease, transform ${SLIDE}ms ease, box-shadow ${SLIDE}ms ease`;
  g.style.left = to.left + "px";
  g.style.top = to.top + "px";
  g.style.transform = "none";
  g.style.boxShadow = "var(--shadow-sm)";
  setTimeout(() => {
    moved.style.visibility = "";
    g.remove();
    cards.forEach(c => c.style.transition = "");
  }, SLIDE);
  toast(`${r.src_class}반을 ${r.tgt_class}반 위치로 이동했습니다.`, "info");
}

function onBoardClick(name, ci) {
  if (!S.manualSelected) {
    S.manualSelected = {name, fromClass: ci};
    document.querySelectorAll(".class-student").forEach(el => {
      el.classList.toggle("selected", el.dataset.name===name && Number(el.dataset.class)===ci);
    });
  } else {
    const from = S.manualSelected.fromClass;
    const selName = S.manualSelected.name;
    S.manualSelected = null;
    document.querySelectorAll(".class-student").forEach(el=>el.classList.remove("selected"));
    if (from === ci) return;
    moveStudent(selName, from, ci);
  }
}

async function moveStudent(name, from, to) {
  const r = await api("/api/move_student","POST",{name, from, to});
  if (!r.ok) { toast("오류 발생", "error"); return null; }
  applyResult(r.result);
  return r;
}

/* 학생 끌기: 학급 카드처럼 또렷한 복사본을 마우스에 붙여 움직이고, 놓으면 새 반 자리로 내려앉음 */
let _stuDrag = null, _stuJustDragged = false;
function startStudentDrag(e, el, name, from) {
  if (e.button !== 0) return;
  e.preventDefault(); // 글자가 파랗게 선택되지 않게
  document.querySelectorAll(".student-ghost").forEach(g => g.remove());
  el.classList.add("row-lifted");
  _stuDrag = { el, name, from, x0: e.clientX, y0: e.clientY, ghost: null, to: null };
}
function _stuTargetAt(x, y) {
  return [...document.querySelectorAll("#boardInner .class-card")].find(c => {
    const r = c.getBoundingClientRect();
    return x >= r.left && x <= r.right && y >= r.top && y <= r.bottom;
  });
}
document.addEventListener("mousemove", e => {
  const d = _stuDrag;
  if (!d) return;
  if (!d.ghost) {
    if (Math.hypot(e.clientX - d.x0, e.clientY - d.y0) < 5) return;
    const r = d.el.getBoundingClientRect();
    d.el.classList.remove("row-lifted");
    const g = d.el.cloneNode(true);
    g.className = d.el.className + " student-ghost";
    g.classList.remove("selected", "row-lifted");
    g.style.cssText = `position:fixed; left:${r.left}px; top:${r.top}px; width:${r.width}px;`;
    document.body.appendChild(g);
    d.ghost = g; d.left = r.left; d.top = r.top;
    d.el.style.opacity = "0.4";
    document.body.classList.add("class-dragging");
  }
  d.ghost.style.left = d.left + e.clientX - d.x0 + "px";
  d.ghost.style.top  = d.top  + e.clientY - d.y0 + "px";
  const card = _stuTargetAt(e.clientX, e.clientY);
  const to = card && Number(card.dataset.classIdx) !== d.from ? card : null;
  if (to !== d.to) {
    d.to?.classList.remove("drop-target");
    to?.classList.add("drop-target");
    d.to = to;
  }
});
document.addEventListener("mouseup", async () => {
  const d = _stuDrag;
  if (!d) return;
  _stuDrag = null;
  d.el.classList.remove("row-lifted");
  if (!d.ghost) return;
  _stuJustDragged = true;
  setTimeout(() => _stuJustDragged = false, 0); // 놓을 때 생기는 클릭은 선택으로 치지 않음
  document.body.classList.remove("class-dragging");
  d.to?.classList.remove("drop-target");
  const SLIDE = 260, g = d.ghost;
  g.style.transition = `left ${SLIDE}ms ease, top ${SLIDE}ms ease, transform ${SLIDE}ms ease, box-shadow ${SLIDE}ms ease`;
  const land = (x, y, after) => {
    g.style.left = x + "px"; g.style.top = y + "px";
    g.style.transform = "none"; g.style.boxShadow = "none";
    setTimeout(() => { g.remove(); after?.(); }, SLIDE);
  };
  const to = d.to ? Number(d.to.dataset.classIdx) : null;
  const r = to ? await moveStudent(d.name, d.from, to) : null;
  if (!r) { land(d.left, d.top, () => d.el.style.opacity = "1"); return; } // 제자리로 돌아감
  // 새 반 목록에서 그 학생 줄을 찾아 그 자리로 내려앉힘
  const row = document.querySelector(`#boardInner .class-student[data-class="${to}"][data-name="${CSS.escape(d.name)}"]`);
  if (!row) { g.remove(); return; }
  row.scrollIntoView({ block: "nearest" });
  row.style.visibility = "hidden";
  const rr = row.getBoundingClientRect();
  land(rr.left, rr.top, () => row.style.visibility = "");
});

/* ── 되돌리기 + 이동 기록 ── */
const undoIsOpen = () => document.getElementById("undoSplit").classList.contains("open");
function closeUndoPanel() { document.getElementById("undoSplit").classList.remove("open"); undoPreview(0); }
function toggleUndoPanel(e) {
  e.stopPropagation();
  if (undoIsOpen()) { closeUndoPanel(); return; }
  renderUndo(); // 'n분 전'을 새로 계산
  document.getElementById("undoSplit").classList.add("open");
}
document.addEventListener("click", e => { if (undoIsOpen() && !e.target.closest("#undoSplit")) closeUndoPanel(); });
document.addEventListener("keydown", e => { if (e.key === "Escape" && undoIsOpen()) closeUndoPanel(); });

function _undoAgo(t) {
  if (!t) return "";
  const s = Date.now() / 1000 - t;
  return s < 60 ? "방금" : s < 3600 ? `${Math.floor(s / 60)}분 전` : `${Math.floor(s / 3600)}시간 전`;
}
function renderUndo() {
  const h = S.undo || [];
  document.getElementById("undoCnt").textContent = h.length || "";
  document.getElementById("undoMainBtn").disabled = document.getElementById("undoMoreBtn").disabled = !h.length;
  if (!h.length && undoIsOpen()) closeUndoPanel();
  document.querySelector(".undo-reset").disabled = !S.canReset;
  const arrow = (a, b) => `<span class="undo-arrow">${a} <svg width="11" height="11"><use href="#i-arrow-right"/></svg> ${b}</span>`;
  document.getElementById("undoRows").innerHTML = [...h].reverse().map((u, i) => {
    const op = u.op;
    const [icon, main] = !op ? ["i-user-move", "<b>이전 이동</b>"]
      : op.type === "move" ? ["i-user-move", `<b>${op.name}</b>${arrow(op.from + "반", op.to + "반")}`]
      : ["i-swap", `<b>${op.from}반</b> 자리 옮김${arrow(op.from + "번째", op.to + "번째")}`];
    return `<div class="undo-row" data-k="${i + 1}" onmouseenter="undoPreview(${i + 1})" onclick="undoMove(${i + 1})">
      <div class="no">${i + 1}</div><div class="ic"><svg width="15" height="15"><use href="#${icon}"/></svg></div>
      <div class="tx"><div>${main}</div><div class="when">${_undoAgo(u.t)}</div></div><div class="go">이 작업까지 취소하기</div></div>`;
  }).join("");
}

// 최근 k개를 되돌리면 판이 어떻게 바뀌는지: 자리가 바뀌는 반 카드, 다른 반으로 돌아가는 학생
function undoDiff(k) {
  const h = S.undo || [];
  if (!k || k > h.length) return { cards: [], students: [] };
  const tgt = h[h.length - k].classes.map(a => new Set(a)), cur = S.classData;
  // 지금 반마다 학생 대부분이 되돌린 뒤 가 있을 반 (반 자리 옮김을 알아내려고)
  const f = cur.map((names, i) => {
    let best = i, bestN = -1;
    tgt.forEach((t, j) => { const c = names.filter(n => t.has(n)).length; if (c > bestN) { best = j; bestN = c; } });
    return best;
  });
  const cards = [], students = [];
  cur.forEach((names, i) => {
    if (f[i] !== i) cards.push(i);
    names.forEach(n => {
      if (tgt[f[i]].has(n)) return; // 반째로 같이 움직이면 학생 표시는 안 함
      // 동명이인이 있어도 맞게: 이 이름이 있어야 하는데 지금은 없는 반을 고름
      const j = tgt.findIndex((t, j) => t.has(n) && !cur.some((c, i2) => f[i2] === j && c.includes(n)));
      students.push([i, n, j >= 0 ? j : tgt.findIndex(t => t.has(n))]);
    });
  });
  return { cards, students };
}
const _undoStuEl = (i, n) => document.querySelector(`#boardInner .class-student[data-class="${i + 1}"][data-name="${CSS.escape(n)}"]`);
function undoPreview(k) {
  document.querySelectorAll("#boardInner .undo-mark").forEach(el => el.classList.remove("undo-mark"));
  document.querySelectorAll("#boardInner .undo-back").forEach(el => el.remove());
  document.querySelectorAll("#boardInner .undo-card-mark").forEach(el => el.classList.remove("undo-card-mark"));
  document.querySelectorAll("#undoRows .undo-row").forEach(r => r.classList.toggle("mark", Number(r.dataset.k) <= k));
  const d = undoDiff(k);
  d.cards.forEach(i => document.querySelector(`#boardInner .class-card[data-class-idx="${i + 1}"]`)?.classList.add("undo-card-mark"));
  d.students.forEach(([i, n, j]) => {
    const el = _undoStuEl(i, n);
    if (!el) return;
    el.classList.add("undo-mark");
    el.insertAdjacentHTML("beforeend", `<span class="undo-back">${j + 1}반으로</span>`);
  });
}

async function undoMove(k = 1) {
  const moved = undoDiff(k).students;
  closeUndoPanel();
  showLoading("되돌리는 중...");
  const r = await api("/api/undo", "POST", { count: k });
  hideLoading();
  if (!r.undone) { toast("되돌릴 이동이 없어요. (저장하면 이동 기록이 지워져요)", "info"); return; }
  applyResult(r.result);
  moved.forEach(([, n, j]) => _undoStuEl(j, n)?.classList.add("undo-flash"));
  toast(k === 1 ? "이동 1개를 되돌렸어요" : `이동 ${k}개를 한 번에 되돌렸어요`, "info");
}

async function resetAssign() {
  closeUndoPanel();
  if (!(await openConfirm("이동 기록을 모두 지우고\n처음 자동 배정 결과로 되돌릴까요?"))) return;
  const r = await api("/api/reset_assign", "POST");
  if (!r.ok) { toast(r.msg, "error"); return; }
  applyResult(r.result);
  toast("처음 배정결과로 초기화했어요", "info");
}
