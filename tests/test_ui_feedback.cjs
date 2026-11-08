// node tests/test_ui_feedback.cjs
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const elements = new Map(), notices = [], requests = [];
function element(id) {
  if (!elements.has(id)) elements.set(id, {
    textContent: '', innerHTML: '', disabled: false, hidden: false,
    classList: { add() {}, remove() {} }, focus() {},
    addEventListener() {}, showModal() { this.open = true; }, close() { this.open = false; },
  });
  return elements.get(id);
}
const context = vm.createContext({
  document: { getElementById: element },
  toast: (...args) => notices.push(args),
  api: async url => { requests.push(url); return { status: 'development' }; },
  HOMONYM_REASON: '동명이인',
  S: {
    classData: [['가상학생']], studentList: [{ 반: '1', 번호: '1', 이름: '가상학생' }],
    fullResult: [{ 기존반: '1', 기존번호: '1', 이름: '가상학생', 배정학급: '1반' }],
    stats: [{ 학급: '1반', 총원: 1, 남: 1, 여: 0, 평균: 80 }],
    sepData: [], joinData: [], scoreGap: 5,
  },
});
for (const name of ['result.js', 'updates.js']) {
  vm.runInContext(fs.readFileSync(path.join(__dirname, '../src/static/js', name), 'utf8'), context);
}

(async () => {
  context.runVerify();
  assert.equal(notices.length, 0, 'Entering the page should not show a recheck toast');
  assert.match(element('vfHead').innerHTML, /통과 7개/);
  // Change the actual input: a recheck must recompute, not just display a toast.
  context.S.fullResult = [];
  context.runVerify(true);
  assert.match(element('vfHead').innerHTML, /검토 1개/);
  assert.equal(notices.at(-1)[0], '다시 검사를 완료하였습니다');

  element('appVersion').textContent = 'v3.1.2';
  await context.checkUpdate(true);
  assert.equal(element('updTo').textContent, '새 버전');
  assert.equal(element('updPreview').hidden, false);
  await element('updOk').onclick();
  assert.deepEqual(requests, ['/api/update/check'], 'Preview must never call the install endpoint');
  console.log('Recheck recomputes results and development preview never installs: OK');
})().catch(error => { console.error(error); process.exitCode = 1; });
