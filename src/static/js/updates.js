// 자동 업데이트: 켤 때 GitHub 에 새 버전이 있는지 보고, 있으면 받을지 묻는다.
// [나중에]를 눌러도 타이틀바의 [업데이트] 버튼으로 다시 열 수 있다.
let pendingUpdate = null;

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
  } else if (manual) {
    toast({ latest: "지금 최신 버전을 쓰고 있어요.",
            development: "개발 중에는 업데이트를 확인하지 않아요." }[res.status]
          || "업데이트를 확인하지 못했어요. 인터넷 연결을 확인해 주세요.", res.status === "error" ? "error" : "info");
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
  document.getElementById("updMsg").textContent = "새 버전이 나왔어요. 지금 업데이트할까요?\n작업한 내용은 그대로 남아요.";
  document.getElementById("updOk").textContent = "업데이트";
  setUpdateBusy(false);
  document.getElementById("update-overlay").classList.add("show");
  document.getElementById("updOk").focus();
}

function closeUpdate() {
  document.getElementById("update-overlay").classList.remove("show");
}

document.getElementById("updOk").onclick = async () => {
  setUpdateBusy(true);
  document.getElementById("updOk").textContent = "받는 중…";
  document.getElementById("updMsg").textContent = "새 버전을 받고 있어요.\n받기가 끝나면 프로그램이 닫히고, 설치가 끝나면 다시 열려요.";
  const r = await api("/api/update/install", "POST", { version: pendingUpdate.version }).catch(e => ({ ok: false, msg: e.message }));
  if (r.ok) return;   // 곧 창이 닫힌다
  setUpdateBusy(false);
  document.getElementById("updOk").textContent = "다시 시도";
  document.getElementById("updMsg").textContent = `업데이트를 시작하지 못했어요.\n${r.msg || ""}`;
};
