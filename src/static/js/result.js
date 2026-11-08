// 학급 편성 결과와 검증 화면.

/* ═══════════════════════════════════════════════════════
   RESULT PAGE RENDER
═══════════════════════════════════════════════════════ */
function renderResultPage(result) {
  const stats = result.stats;
  if (stats.length > 0) {
    const totals = {총원:0, 남:0, 여:0};
    stats.forEach(s => { totals.총원+=s.총원; totals.남+=s.남; totals.여+=s.여; });
    const avgArr = stats.map(s=>s.평균);
    const avgAll = avgArr.length > 0 ? (avgArr.reduce((a,b)=>a+b,0)/avgArr.length) : 0;

    const thStyle = "background:#F8FAFC;color:var(--text-main);font-weight:700;white-space:nowrap;width:72px;text-align:center;";
    const sumStyle = "font-weight:700;background:#F8FAFC;";

    const rowClasses = `<tr>
      <th style="${thStyle}">학급</th>
      ${stats.map(s => `<td style="font-weight:700;background:#F8FAFC;color:var(--brand);">${s.학급}</td>`).join('')}
      <td style="${sumStyle}color:var(--text-main);">합계</td>
    </tr>`;

    const rowTotal = `<tr>
      <th style="${thStyle}">총원</th>
      ${stats.map(s => `<td>${s.총원}명</td>`).join('')}
      <td style="${sumStyle}">${totals.총원}명</td>
    </tr>`;

    const rowMale = `<tr>
      <th style="${thStyle}">남학생</th>
      ${stats.map(s => `<td>${s.남}명</td>`).join('')}
      <td style="${sumStyle}">${totals.남}명</td>
    </tr>`;

    const rowFemale = `<tr>
      <th style="${thStyle}">여학생</th>
      ${stats.map(s => `<td>${s.여}명</td>`).join('')}
      <td style="${sumStyle}">${totals.여}명</td>
    </tr>`;

    const rowAvg = `<tr>
      <th style="${thStyle}">성적 평균</th>
      ${stats.map(s => `<td style="font-weight:600;">${s.평균}</td>`).join('')}
      <td style="${sumStyle}">${(Math.round(avgAll*10)/10)}</td>
    </tr>`;

    // 전체 평균보다 높으면 빨강 ▲, 낮으면 파랑 ▼
    const rowDiff = `<tr>
      <th style="${thStyle}">성적 편차</th>
      ${stats.map(s => {
        const diff = s.평균 - avgAll;
        return diff >= 0
          ? `<td style="color:var(--accent-coral);font-weight:600;">▲${diff.toFixed(1)}</td>`
          : `<td style="color:var(--accent-blue);font-weight:600;">▼${Math.abs(diff).toFixed(1)}</td>`;
      }).join('')}
      <td style="${sumStyle}"></td>
    </tr>`;

    document.getElementById("classStatsBody").innerHTML = rowClasses + rowTotal + rowMale + rowFemale + rowAvg + rowDiff;
  }

  const filterBar = document.getElementById("filterBar");
  filterBar.innerHTML = '<span style="font-size:12px;font-weight:700;color:var(--text-sub);">학급 선택:</span>';
  const classLabels = stats.map(s => s.학급);
  if (!classLabels.includes(S.currentFilter)) {
    S.currentFilter = classLabels[0] || "1반";
  }
  classLabels.forEach(label => {
    const btn = document.createElement("button");
    btn.className = "filter-btn" + (label===S.currentFilter?" active":"");
    btn.textContent = label;
    btn.onclick = () => selectResultClass(label);
    filterBar.appendChild(btn);
  });

  renderClassMatrix(result.list, classLabels);
  renderResultTable(result.list);
}

function selectResultClass(label) {
  S.currentFilter = label;
  renderResultTable(S.fullResult);
  document.querySelectorAll("#filterBar .filter-btn").forEach(b => b.classList.toggle("active", b.textContent === label));
}

// 배정반(세로) x 기존반(가로): 칸마다 그 기존반에서 온 학생 수, 0명인 칸만 회색
function renderClassMatrix(list, classLabels) {
  const num = v => Number(String(v).replace(/[^0-9.]/g, ""));
  const origs = [...new Set(list.map(r => String(r["기존반"])))].sort((a, b) => num(a) - num(b));
  const cnt = {};
  list.forEach(r => { const k = r["배정학급"] + "|" + r["기존반"]; cnt[k] = (cnt[k] || 0) + 1; });
  const table = document.getElementById("classMatrix");
  table.innerHTML =
    `<tbody><tr class="mh"><th class="corner"><span class="top">기존</span><span class="bot">신규</span></th>${origs.map(o => `<th>${o}반</th>`).join("")}<th class="totc">합계</th></tr>` +
    classLabels.map(c => `<tr data-c="${c}"><th>${c}</th>${origs.map(o => {
      const n = cnt[c + "|" + o] || 0;
      return n ? `<td>${n}</td>` : `<td class="zero"></td>`;
    }).join("")}<td class="tot">${list.filter(r => r["배정학급"] === c).length}</td></tr>`).join("") + "</tbody>";
  table.querySelectorAll("tr[data-c]").forEach(tr => tr.onclick = () => selectResultClass(tr.dataset.c));
  table.style.setProperty("--rows", classLabels.length + 1); // 머리 줄 포함 모든 줄 높이를 똑같이
}

function renderResultTable(list) {
  const filtered = list.filter(r => r["배정학급"] === S.currentFilter);
  document.getElementById("resultHead").innerHTML = ["배정반", "번호", "이름", "성별", "성적", "기존반"].map(c => `<th>${c}</th>`).join("");
  document.getElementById("resultBody").innerHTML = filtered.map(r => `<tr>
    <td>${r["배정학급"]}</td><td>${r["번호"]}</td><td class="rd-name">${r["이름"]}</td>
    <td><span class="rd-gender ${r["성별"] === "남" ? "m" : "f"}">${r["성별"]}</span></td>
    <td>${r["성적"]}</td><td>${r["기존반"]}반</td></tr>`).join("");
  document.getElementById("resultCount").textContent = `${S.currentFilter} · ${filtered.length}명`;
  document.querySelectorAll("#classMatrix tr[data-c]").forEach(tr => tr.classList.toggle("sel", tr.dataset.c === S.currentFilter));
}


/* ═══════════════════════════════════════════════════════
   VERIFY ENGINE
═══════════════════════════════════════════════════════ */
// 반·번호를 숫자/글자 상관없이 같게 비교
const _vfNorm = v => { const t = String(v ?? "").trim(); const n = Number(t); return t !== "" && !isNaN(n) ? String(n) : t; };
const _vfKey = s => `${_vfNorm(s["반"])}|${_vfNorm(s["번호"])}|${String(s["이름"]).trim()}`;

// 검사 7개: 전원 배정, 인원·성별·성적 균형, 분리·동명·통합 그룹
function verifyChecks() {
  const list = S.fullResult, stats = S.stats || [];
  const where = {}, seen = {};
  list.forEach(r => {
    const k = `${_vfNorm(r["기존반"])}|${_vfNorm(r["기존번호"])}|${r["이름"]}`;
    seen[k] = (seen[k] || 0) + 1; where[k] = r["배정학급"];
  });
  const missing = S.studentList.filter(s => !where[_vfKey(s)]).map(s => `${s["반"]}반 ${s["이름"]}`);
  const dup = Object.keys(seen).filter(k => seen[k] > 1).map(k => k.split("|")[2]);
  const tot = stats.map(s => s["총원"]), male = stats.map(s => s["남"]), avg = stats.map(s => s["평균"]);
  const spread = a => a.length ? Math.max(...a) - Math.min(...a) : 0;
  const groups = (arr, f) => { const g = {}; arr.filter(f).forEach(s => (g[s["그룹"]] ||= []).push(s)); return Object.values(g); };
  const together = gs => gs.flatMap(m => {
    const c = {}; m.forEach(s => (c[where[_vfKey(s)]] ||= []).push(s["이름"]));
    return Object.entries(c).filter(([, n]) => n.length > 1).map(([w, n]) => ({ w, n }));
  });
  const sepG = groups(S.sepData, s => s["분리사유"] !== HOMONYM_REASON);
  const homG = groups(S.sepData, s => s["분리사유"] === HOMONYM_REASON);
  const joinG = groups(S.joinData, () => true);
  const sepBad = together(sepG), homBad = together(homG);
  const joinBad = joinG.filter(m => new Set(m.map(s => where[_vfKey(s)])).size > 1);
  const minT = Math.min(...tot), bigs = stats.filter(s => s["총원"] - minT > 1).map(s => s["학급"]);
  const hi = stats[avg.indexOf(Math.max(...avg))]?.["학급"], lo = stats[avg.indexOf(Math.min(...avg))]?.["학급"];
  const gap = S.scoreGap, rate = S.scoreRate;
  const gapSrc = rate ? `자동 편성에서 ${Math.round(rate * 100)}% 선택` : "자동 편성에서 고른 기준";
  const checks = [
    { t: "전원 배정", ok: !missing.length && !dup.length,
      note: [missing.length && `빠진 학생: ${missing.join(", ")}`, dup.length && `두 번 들어간 학생: ${dup.join(", ")}`].filter(Boolean).join(" / ") },
    { t: "성별 균형", ok: spread(male) <= 2, note: `반마다 남학생이 ${Math.min(...male)}~${Math.max(...male)}명이에요. 남학생이 많은 반과 적은 반의 학생을 바꿔 보세요.` },
    { t: "분리 그룹", ok: !sepBad.length, note: sepBad.map(b => `${b.n.join("·")}이(가) ${b.w}에 같이 있어요.`).join(" ") },
    { t: "동명이인", ok: !homBad.length, note: homBad.map(b => `${b.n[0]} ${b.n.length}명이 ${b.w}에 같이 있어요.`).join(" ") },
    { t: "통합 그룹", ok: !joinBad.length, note: `${joinBad.length}개 그룹이 여러 반으로 흩어졌어요. 한 반으로 모아 주세요.` },
    { t: "인원 균형", ok: spread(tot) <= 1, note: `반 인원이 ${minT}~${Math.max(...tot)}명이에요. <b>${bigs.join("·")}</b>에서 한 명씩 옮기면 맞춰져요.` },
    !gap
      ? { t: "성적 균형", ok: false, note: "기준이 저장돼 있지 않아요. 자동 학급 편성을 다시 하면 그때 고른 기준으로 검사해요." }
      : { t: "성적 균형", ok: spread(avg) <= gap,
          note: `반 평균 차이가 ${spread(avg).toFixed(1)}점으로 기준 ${gap.toFixed(1)}점(${gapSrc})을 넘어요. <b>${hi}</b>(가장 높음)과 <b>${lo}</b>(가장 낮음)의 같은 성별 학생을 바꿔 보세요.` },
  ];
  const mean = avg.reduce((a, b) => a + b, 0) / (avg.length || 1);
  const rows = stats.map(s => ({ ...s, big: bigs.includes(s["학급"]), diff: s["평균"] - mean }));
  return { checks, rows };
}

function runVerify() {
  if (S.classData.length === 0) return;
  const { checks, rows } = verifyChecks();
  const bad = checks.filter(c => !c.ok), ok = checks.length - bad.length;
  document.getElementById("vfHead").innerHTML =
    `<span class="big ok">통과 ${ok}개</span><span class="big slash">/</span><span class="big ${bad.length ? "bad" : "zero"}">검토 ${bad.length}개</span>` +
    `<span class="bar"><i style="width:${100 * ok / checks.length}%"></i></span>`;
  // 통과한 칸 먼저, 검토가 필요한 칸은 맨 오른쪽
  document.getElementById("vfTiles").innerHTML = [...checks].sort((a, b) => !a.ok - !b.ok).map(c =>
    `<div class="vf-tile ${c.ok ? "" : "bad"}"><svg width="13" height="13"><use href="#${c.ok ? "i-check" : "i-alert-dot"}"/></svg>${c.t}</div>`).join("");
  document.getElementById("vfNotes").innerHTML = bad.map((c, i) =>
    `<div class="vf-note"><span class="no">${i + 1}</span><b>${c.t}</b><span>${c.note}</span></div>`).join("");
  document.getElementById("vfTable").innerHTML =
    `<tr><th>반</th><th>인원</th><th>남</th><th>여</th><th>평균</th><th>전체 평균과의 차이</th></tr>` +
    rows.map(r => `<tr><td>${r["학급"]}</td><td class="${r.big ? "f" : ""}">${r["총원"]}</td><td>${r["남"]}</td><td>${r["여"]}</td><td>${r["평균"]}</td>` +
      `<td class="${r.diff >= 0 ? "up" : "down"}">${r.diff >= 0 ? "▲" : "▼"}${Math.abs(r.diff).toFixed(1)}</td></tr>`).join("");
}
