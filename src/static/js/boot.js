// 켤 때 자료 불러오기. 맨 마지막에 읽는다.

/* ═══════════════════════════════════════════════════════
   INIT
═══════════════════════════════════════════════════════ */
async function init() {
  mountResizeHandles();
  const r = await api("/api/init");
  S.sepData     = r.sep_data  || [];
  S.joinData    = r.join_data || [];
  S.studentList = r.student_list || [];
  
  const detectedClasses = detectDefaultClasses();
  S.numClasses = (r.num_classes && r.num_classes > 0) ? r.num_classes : detectedClasses;
  document.getElementById("modalNumClasses").value = S.numClasses;
  
  renderSetup();

  if (r.result && r.result.classes && r.result.classes.length > 0) {
    applyResult(r.result);
  }

  document.getElementById("appVersion").textContent = `v${r.version}`;
  tourHidden = !!r.settings.hideTour;
  if (!tourHidden) startTour();
  checkUpdate();
}
init();
