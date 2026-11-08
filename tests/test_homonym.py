"""동명이인 자동 분리 그룹 확인: python tests/test_homonym.py"""
import os, sys
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "src"))
import store
store.save_configs = lambda: None  # 진짜 자료 파일을 건드리지 않는다
import server as A
from engine import HOMONYM_REASON

def st(ban, bun, name):
    return {"반": ban, "번호": bun, "이름": name, "성별": "남", "성적": 80 + bun}

A.STATE.update(file_path=None, student_list=[st(b, n, f"학생{b}{n}") for b in (1, 2, 3) for n in range(1, 11)])
A.STATE["student_list"] += [st(1, 11, "김철수"), st(2, 11, "김철수"), st(3, 11, "친구")]
bully = {**A.STATE["student_list"][-3], "그룹": "1", "분리사유": "학교폭력"}  # 김철수 한 명은 다른 분리 그룹에도 듦
friend = {**A.STATE["student_list"][-1], "그룹": "1", "분리사유": "학교폭력"}
A.STATE["sep_data"] = [bully, friend]

A.sync_homonyms()
A.sync_homonyms()  # 여러 번 돌려도 그대로여야 함
auto = [s for s in A.STATE["sep_data"] if s["분리사유"] == HOMONYM_REASON]
assert len(auto) == 2 and {s["그룹"] for s in auto} == {"2"}, auto
assert len(A.STATE["sep_data"]) == 4

c = A.app.test_client()
# 초기화해도 동명이인 그룹은 남아야 함
assert len(c.post("/api/sep_data", json=[bully, friend]).json["sep_data"]) == 4
# 새 분리 그룹이 동명 그룹 번호(2)를 쓰면 동명 그룹이 뒤로 밀려야 함 (동명 학생 본인도 추가 가능)
sep = c.post("/api/sep_data/add", json={**A.STATE["student_list"][-2], "그룹": "2", "분리사유": "교우관계"}).json["sep_data"]
assert {s["그룹"] for s in sep if s["분리사유"] == HOMONYM_REASON} == {"3"}, sep
assert [s["그룹"] for s in sep if s["분리사유"] == "교우관계"] == ["2"], sep
# 동명이인 학생도 다른 분리 그룹에 넣을 수 있어야 함
assert c.post("/api/sep_data/add", json={**A.STATE["student_list"][-2], "그룹": "9", "분리사유": "교우관계"}).json["ok"]
assert not c.post("/api/sep_data/add", json={**A.STATE["student_list"][-2], "그룹": "9", "분리사유": "교우관계"}).json["ok"]

for _ in range(3):
    r = c.post("/api/assign", json={"num_classes": 3}).json
    assert r["ok"], r
    names = [[x["이름"] for x in A.STATE["class_data"][i]] for i in range(3)]
    assert all(n.count("김철수") <= 1 for n in names), names
print("ok")
