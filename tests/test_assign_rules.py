"""자동 배정 규칙 확인: python tests/test_assign_rules.py"""
import os, sys, tempfile
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "src"))
import store
store.save_configs = lambda: None  # 진짜 자료 파일을 건드리지 않는다
import server as A

A.STATE.update(file_path=None, sep_data=[], join_data=[], student_list=[
    {"반": b, "번호": n, "이름": f"학생{b}-{n}", "성별": "여" if (b * n) % 5 < 2 else "남", "성적": 1000 - (b * 37 + n * 11) % 400}
    for b in range(1, 5) for n in range(1, 31)])
c = A.app.test_client()

def run(**opt):
    r = c.post("/api/assign", json={"num_classes": 4, **opt}).json
    assert r["ok"], r
    s = r["result"]["stats"]
    return max(x["총원"] for x in s) - min(x["총원"] for x in s), \
           max(x["평균"] for x in s) - min(x["평균"] for x in s), \
           max(x["남"] for x in s) - min(x["남"] for x in s)

size, score, gender = run()                    # 값을 안 주면 평균 차이 15점 목표
assert size <= 1 and score <= 15.1
assert gender <= 1, "성별 균형은 항상 맞춰야 함"
off = run(score_gap=0)
tight = run(score_gap=5)
assert tight[1] <= 5.1, tight
print("ok", {"기본": (size, score, gender), "성적 보정 끔": off, "5점": tight})
