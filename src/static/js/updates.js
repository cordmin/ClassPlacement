// 자동 업데이트: 켤 때 GitHub 에 새 버전이 있는지 보고, 있으면 받을지 묻는다.
// [나중에]를 눌러도 타이틀바의 [업데이트] 버튼으로 다시 열 수 있다.
let pendingUpdate = null;

function openAbout() {
  document.getElementById("aboutVersion").textContent = document.getElementById("appVersion").textContent;
  document.getElementById("aboutDialog").showModal();
}

function checkAboutUpdate() {
  document.getElementById("aboutDialog").close();
  checkUpdate(true);
}

document.getElementById("aboutDialog").addEventListener("keydown", e => e.stopPropagation());

async function checkUpdate(manual = false) {
  const btn = document.getElementById("appVersion");
  if (manual) btn.disabled = true;
  const res = await api("/api/update/check").catch(() => ({ status: "error" }));
  btn.disabled = false;
  if (res.available) {
    pendingUpdate = res;
    document.getElementById("btnUpdate").hidden = false;
    document.getElementById("tour").hidden = true;   // 가이드 투어보다 업데이트 질문을 먼저 보인다
    openUpdate();
  } else if (manual && res.status === "development") {
    pendingUpdate = { current: btn.textContent, version: "새 버전", preview: true, notes: res.notes };
    openUpdate();
  } else if (manual) {
    toast({ latest: "현재 최신 버전을 사용하고 있습니다." }[res.status]
          || "업데이트를 확인하지 못했습니다. 인터넷 연결을 확인해 주십시오.", res.status === "error" ? "error" : "info");
  }
}

function setUpdateBusy(busy) {
  document.getElementById("updOk").disabled = document.getElementById("updLater").disabled = busy;
  document.getElementById("updBar").hidden = !busy;
}

function openUpdate() {
  if (!pendingUpdate) return;
  document.getElementById("updFrom").textContent = pendingUpdate.current;
  document.getElementById("updTo").textContent = pendingUpdate.version;
  const notes = (pendingUpdate.notes || []).slice(0, 5);   // 길면 앞의 5개만
  document.getElementById("updNotes").replaceChildren(...notes.map(t => Object.assign(document.createElement("li"), { textContent: t })));
  document.getElementById("updNotesBox").hidden = !notes.length;
  document.getElementById("updMsg").textContent = "작업한 내용은 자동 저장됩니다. 설치가 끝나면 프로그램이 자동 재시작됩니다.";
  document.getElementById("updOk").textContent = "지금 업데이트";
  if (pendingUpdate.preview) {
    document.getElementById("updOk").textContent = "확인";
  }
  document.getElementById("updPreview").hidden = !pendingUpdate.preview;
  setUpdateBusy(false);
  document.getElementById("update-overlay").classList.add("show");
  document.getElementById("updOk").focus();
}

function closeUpdate() {
  document.getElementById("update-overlay").classList.remove("show");
}

document.getElementById("updOk").onclick = async () => {
  if (pendingUpdate?.preview) { closeUpdate(); return; }
  setUpdateBusy(true);
  document.getElementById("updOk").textContent = "받는 중…";
  document.getElementById("updMsg").textContent = "새 버전을 받는 중입니다.\n받기가 끝나면 프로그램이 종료되고, 별도 창에서 설치 진행 상황을 안내합니다.";
  const r = await api("/api/update/install", "POST", { version: pendingUpdate.version }).catch(e => ({ ok: false, msg: e.message }));
  if (r.ok) return;   // 곧 창이 닫힌다
  setUpdateBusy(false);
  document.getElementById("updOk").textContent = "다시 시도";
  document.getElementById("updMsg").textContent = `업데이트를 시작하지 못했습니다.\n${r.msg || ""}`;
};
