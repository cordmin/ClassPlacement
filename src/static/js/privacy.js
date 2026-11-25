// 개인정보 처리방침·오픈소스 라이선스: 설치 화면과 앱이 같은 글 파일을 사용한다. 외부 접속 없이 읽을 수 있다.
async function openDoc(title, file, installedName) {
  const dialog = document.getElementById("privacyDialog");
  const body = document.getElementById("privacyBody");
  document.getElementById("privacyTitle").textContent = title;
  if (!dialog.open) dialog.showModal();
  if (body.dataset.loaded === file) return;
  delete body.dataset.loaded;
  body.textContent = `${title}을(를) 불러오는 중…`;
  body.scrollTop = 0;
  try {
    const response = await fetch(file);
    if (!response.ok) throw new Error();
    body.textContent = await response.text();
    body.dataset.loaded = file;
  } catch {
    body.textContent = `불러오지 못했습니다. 창을 닫고 다시 열어 주십시오. 설치 폴더의 ${installedName}에서도 확인할 수 있습니다.`;
  }
}
const openPrivacy = () => openDoc("개인정보 처리방침", "/privacy.txt", "개인정보처리방침.txt");
const openLicense = () => openDoc("오픈소스 라이선스", "/licenses.txt", "오픈소스라이선스.txt");

document.getElementById("privacyDialog").addEventListener("keydown", e => e.stopPropagation());
