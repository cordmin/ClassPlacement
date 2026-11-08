// 테두리 없는 창: 최소화·최대화·닫기, 가장자리 끌어 크기 바꾸기.

/* ═══════════════════════════════════════════════════════
   WINDOW CONTROLS
═══════════════════════════════════════════════════════ */
async function winMinimize() {
  await api("/api/window/minimize", "POST");
}
async function winToggleMaximize() {
  await api("/api/window/toggle_maximize", "POST");
}
async function winClose() {
  const overlay = document.getElementById("close-overlay");
  if (overlay.classList.contains("show")) return;
  const st = await api("/api/close_state");
  if (!st.dirty) { await api("/api/window/close", "POST"); return; }
  overlay.classList.add("show");
  document.getElementById("closeCancelBtn").focus();
}
async function finishClose(save) {
  const overlay = document.getElementById("close-overlay");
  if (save) {
    overlay.classList.remove("show");
    if (!(await saveExcel())) return;  // 저장 창을 닫았거나 실패하면 종료하지 않음
  }
  await api("/api/window/close", "POST");
}
function cancelClose() {
  document.getElementById("close-overlay").classList.remove("show");
}
function onTitlebarDblClick(e) {
  if (e.target.closest('.titlebar-controls') || e.target.closest('button')) return;
  winToggleMaximize();
}

/* ═══════════════════════════════════════════════════════
   FRAMELESS WINDOW RESIZING
═══════════════════════════════════════════════════════ */
const MIN_W = 1270, MIN_H = 800;
function mountResizeHandles() {
  const T = 6;
  const edges = [
    ['n',  { top: 0, left: T, right: T, height: T, cursor: 'ns-resize' }],
    ['s',  { bottom: 0, left: T, right: T, height: T, cursor: 'ns-resize' }],
    ['w',  { left: 0, top: T, bottom: T, width: T, cursor: 'ew-resize' }],
    ['e',  { right: 0, top: T, bottom: T, width: T, cursor: 'ew-resize' }],
    ['nw', { top: 0, left: 0, width: T*2, height: T*2, cursor: 'nwse-resize' }],
    ['ne', { top: 0, right: 0, width: T*2, height: T*2, cursor: 'nesw-resize' }],
    ['sw', { bottom: 0, left: 0, width: T*2, height: T*2, cursor: 'nesw-resize' }],
    ['se', { bottom: 0, right: 0, width: T*2, height: T*2, cursor: 'nwse-resize' }],
  ];
  edges.forEach(([dir, style]) => {
    const el = document.createElement('div');
    el.style.position = 'fixed';
    el.style.zIndex = '99999';
    Object.entries(style).forEach(([k, v]) => el.style[k] = typeof v === 'number' ? v + 'px' : v);
    el.addEventListener('mousedown', (e) => startResize(dir, e));
    document.body.appendChild(el);
  });
}

function startResize(dir, e) {
  e.preventDefault();
  const sx = e.screenX, sy = e.screenY;
  api("/api/window/get_bounds", "POST").then(b => {
    const { x, y, w, h } = b;
    const onMove = (ev) => {
      let nx = x, ny = y, nw = w, nh = h;
      let dx = ev.screenX - sx, dy = ev.screenY - sy;
      if (dir.includes('e')) { const m = Math.max(0, w - MIN_W); if (dx < -m) dx = -m; nw = w + dx; }
      if (dir.includes('s')) { const m = Math.max(0, h - MIN_H); if (dy < -m) dy = -m; nh = h + dy; }
      if (dir.includes('w')) { const m = Math.max(0, w - MIN_W); if (dx > m) dx = m; nw = w - dx; nx = x + dx; }
      if (dir.includes('n')) { const m = Math.max(0, h - MIN_H); if (dy > m) dy = m; nh = h - dy; ny = y + dy; }
      api("/api/window/set_bounds", "POST", { x: Math.round(nx), y: Math.round(ny), w: Math.round(nw), h: Math.round(nh) });
    };
    const onUp = () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  });
}
