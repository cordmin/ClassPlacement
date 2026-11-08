// 설치 화면과 앱이 같은 방침 파일을 사용한다. 외부 접속 없이 읽을 수 있다.
async function openPrivacy() {
  const dialog = document.getElementById("privacyDialog");
  const body = document.getElementById("privacyBody");
  if (!dialog.open) dialog.showModal();
  if (body.dataset.loaded) return;
  body.textContent = "개인정보 처리방침을 불러오는 중…";
  try {
    const response = await fetch("/privacy.txt");
    if (!response.ok) throw new Error("방침 파일을 읽지 못했습니다.");
    body.textContent = await response.text();
    body.dataset.loaded = "true";
  } catch {
    body.textContent = "방침을 불러오지 못했습니다. 창을 닫고 다시 열어 주세요. 설치 폴더의 개인정보처리방침.txt에서도 확인할 수 있습니다.";
  }
}

document.getElementById("privacyDialog").addEventListener("keydown", e => e.stopPropagation());
