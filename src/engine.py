"""배정 엔진: 자동 편성 알고리즘, 학생 찾기, 동명이인 그룹, 결과 정리.

화면이나 파일과 상관없이 돌아가서 시험(tests/)에서 바로 부를 수 있다.
"""
import copy
import time
from statistics import mean, stdev

import numpy as np
import pandas as pd

HOMONYM_REASON = "동명이인"
MAX_UNDO = 8


def _norm(v):
    """반·번호 비교용 정규화: 숫자면 정수 문자열, 아니면 strip 문자열"""
    s = str(v).strip()
    try:
        return str(int(float(s)))
    except (ValueError, TypeError):
        return s


def same_student(a, b):
    """반·번호·이름이 모두 같으면 같은 학생"""
    return (_norm(a.get("반", "")) == _norm(b.get("반", "")) and _norm(a.get("번호", "")) == _norm(b.get("번호", ""))
            and str(a.get("이름", "")).strip() == str(b.get("이름", "")).strip())


def student_frame(records):
    """명단을 DataFrame 으로. 엑셀에서 반·번호가 숫자로 읽혀도 글자로 맞춘다."""
    df = pd.DataFrame(records)
    df["반"] = df["반"].astype(str)
    df["번호"] = df["번호"].astype(str)
    return df


def match_student(all_s, rec):
    """
    (반, 번호, 이름) 복합키로 학생 행을 찾아 반환.
    복합키 정보가 없을 때만 이름 단독 fallback(동명이인 주의).
    """
    ban, bun = _norm(rec.get("반", "")), _norm(rec.get("번호", ""))
    name = str(rec.get("이름", "")).strip()
    mask = all_s["이름"].astype(str).str.strip() == name
    if ban and bun:
        mask &= (all_s["반"].astype(str).map(_norm) == ban) & (all_s["번호"].astype(str).map(_norm) == bun)
    else:
        print(f"[경고] '{name}' 복합키 없음 → 이름 단독 매칭 (동명이인 주의)")
    return all_s[mask]


def sync_homonym_groups(sep_data, student_list):
    """동명이인을 분리 그룹으로 자동 등록. 명단이 바뀌어도 맞도록 자동 그룹은 매번 새로 만든다."""
    groups = [s for s in sep_data if s.get("분리사유") != HOMONYM_REASON]
    by_name = {}
    for s in student_list:
        if pd.notna(s.get("이름")):
            by_name.setdefault(str(s["이름"]).strip(), []).append(s)
    g = max((int(s["그룹"]) for s in groups if str(s.get("그룹")).isdigit()), default=0)
    for members in by_name.values():
        if len(members) > 1:
            g += 1
            groups += [{**s, "그룹": str(g), "분리사유": HOMONYM_REASON} for s in members]
    return groups


def infer_op(before, after):
    """두 반 배치를 비교해 학생 1명 이동 / 학급 1개 자리 옮김을 알아냄. 모르면 None."""
    uid = lambda s: (str(s.get("반", "")), str(s.get("번호", "")), s.get("이름"))
    sets = lambda cd: [frozenset(uid(s) for s in c) for c in cd]
    b, a = sets(before), sets(after)
    if len(b) != len(a):
        return None
    where = lambda cs: {u: i for i, c in enumerate(cs) for u in c}
    wb, wa = where(b), where(a)
    moved = [u for u in wb if wa.get(u) != wb[u]]
    if len(moved) == 1:
        u = moved[0]
        return {"type": "move", "name": u[2], "from": wb[u] + 1, "to": wa[u] + 1}
    for i in range(len(b)):          # 학급 하나를 빼서 다른 자리에 넣은 경우
        for j in range(len(a)):
            if i != j and b[i] == a[j] and b[:i] + b[i+1:] == a[:j] + a[j+1:]:
                return {"type": "reorder", "from": i + 1, "to": j + 1}
    return None


def assign(all_s, n, sep_data, join_data, score_gap):
    """자동 편성. all_s 는 성적 높은 순으로 정렬된 명단, score_gap 은 반 평균 차이 목표(0이면 보정 안 함)."""
    classes = [[] for _ in range(n)]
    def uid(s_dict): return (str(s_dict.get("반", "")), str(s_dict.get("번호", "")))
    assigned, fixed = set(), set()

    def class_of(key):
        for i, c in enumerate(classes):
            if any(uid(s) == key for s in c):
                return i
        return None

    def by_group(data):
        df = pd.DataFrame(data)
        if df.empty or "그룹" not in df.columns:
            return []
        return [g.to_dict(orient="records") for _, g in df.groupby("그룹")]

    # 이름 → [uid, ...] 중 2명 이상인 이름만 (동명이인)
    name_to_uids = {}
    for s in all_s.itertuples(index=False):
        d = s._asdict()
        name_to_uids.setdefault(str(d.get("이름", "")).strip(), []).append(uid(d))
    duplicate_names = {nm: keys for nm, keys in name_to_uids.items() if len(keys) > 1}

    # ── 1. 통합 배정: 같은 그룹을 인원이 가장 적은 반에 통째로 ──
    for records in by_group(join_data):
        c_idx = int(np.argmin([len(c) for c in classes]))
        for rec in records:
            matched = match_student(all_s, rec)
            if len(matched) != 1:   # 정확히 1명이 아니면 건너뜀 (동명이인 오염 방지)
                print(f"[통합] '{rec.get('이름')}' 매칭 {len(matched)}명 → 건너뜀 (복합키 확인 필요)")
                continue
            d = next(matched.itertuples(index=False))._asdict(); key = uid(d)
            if key not in assigned:
                classes[c_idx].append(d)
                assigned.add(key); fixed.add(key)

    # ── 2. 분리 배정: 같은 그룹 학생은 서로 다른 반에 (한 학생이 여러 그룹에 들 수 있음) ──
    sep_groups = by_group(sep_data)
    groups = [[uid(r) for r in records] for records in sep_groups]
    for records in sep_groups:
        for rec in records:
            matched = match_student(all_s, rec)
            if len(matched) != 1:
                print(f"[분리] '{rec.get('이름')}' 매칭 {len(matched)}명 → 건너뜀 (복합키 확인 필요)")
                continue
            d = matched.iloc[0].to_dict(); key = uid(d)
            if key not in assigned:
                forbidden = {class_of(k) for g in groups if key in g for k in g}
                lens = [len(c) for c in classes]
                sorted_idxs = sorted(range(n), key=lambda i: lens[i])
                c_idx = next((i for i in sorted_idxs if i not in forbidden), sorted_idxs[0])
                classes[c_idx].append(d)
                assigned.add(key); fixed.add(key)

    # ── 3. 일반 배정: 성적순, 인원이 적은 반부터. 동명이인은 서로 다른 반 ──
    name_assigned_classes = {nm: {c for c in map(class_of, keys) if c is not None}
                             for nm, keys in duplicate_names.items()}
    for s in all_s.itertuples(index=False):
        d = s._asdict(); key = uid(d)
        if key in assigned:
            continue
        gender = d.get("성별", "")
        if gender not in ("남", "여"):
            continue
        name = str(d.get("이름", "")).strip()
        lens = [len(c) for c in classes]
        same = [sum(1 for x in c if x.get("성별") == gender) for c in classes]   # 인원이 같으면 같은 성별이 적은 반
        sorted_idxs = sorted(range(n), key=lambda i: (lens[i], same[i]))
        if name in duplicate_names:
            forbidden = name_assigned_classes[name]
            c_idx = next((i for i in sorted_idxs if i not in forbidden), sorted_idxs[0])
            forbidden.add(c_idx)
        else:
            c_idx = sorted_idxs[0]
        classes[c_idx].append(d); assigned.add(key)

    # ── 4. 인원 보정: 차이가 1명 이하가 될 때까지 ──
    for _ in range(1000):
        lens = [len(c) for c in classes]
        if max(lens) - min(lens) <= 1:
            break
        ma, mi = int(np.argmax(lens)), int(np.argmin(lens))
        movable = [s for s in classes[ma] if uid(s) not in fixed]
        if not movable:
            break
        classes[mi].append(classes[ma].pop(classes[ma].index(movable[0])))

    # ── 5. 성적 보정: 같은 성별끼리 바꿔 평균 차이를 줄임 ──
    for _ in range(300 if score_gap > 0 else 0):
        avgs = [mean([s["성적"] for s in c]) if c else 0 for c in classes]
        if max(avgs) - min(avgs) <= score_gap:
            break
        ma, mi = int(np.argmax(avgs)), int(np.argmin(avgs))
        for g in ("남", "여"):
            h_s = next((s for s in classes[ma] if uid(s) not in fixed and s["성별"] == g and s["성적"] > avgs[ma]), None)
            l_s = next((s for s in classes[mi] if uid(s) not in fixed and s["성별"] == g and s["성적"] < avgs[mi]), None)
            if h_s and l_s:
                classes[ma].remove(h_s); classes[mi].append(h_s)
                classes[mi].remove(l_s); classes[ma].append(l_s)
                break
    return classes


def build_result(state):
    """class_data → 화면에 보낼 결과. 반 안은 이름순으로 정렬하고 full_result 도 새로 만든다."""
    classes = state["class_data"]
    res_list, stats = [], []
    for i, c in enumerate(classes, 1):
        c_sorted = sorted(c, key=lambda x: x["이름"])
        classes[i-1] = c_sorted
        m_c = sum(1 for s in c_sorted if s["성별"] == "남")
        sc = [s["성적"] for s in c_sorted]
        stats.append({
            "학급": f"{i}반", "총원": len(c_sorted), "남": m_c, "여": len(c_sorted) - m_c,
            "평균": round(mean(sc), 1) if sc else 0,
            "표준편차": round(stdev(sc), 1) if len(sc) > 1 else 0,
        })
        for num, s in enumerate(c_sorted, 1):
            res_list.append({"배정학급": f"{i}반", "번호": num, "이름": s["이름"], "성별": s["성별"], "성적": s["성적"],
                             "기존반": str(s.get("반", "")), "기존번호": str(s.get("번호", ""))})
    state["full_result"] = res_list
    names = lambda cd: [[s["이름"] for s in c] for c in cd]
    undo = [{"op": h["op"], "t": h["t"], "classes": names(h["data"])} for h in state["history"]]
    return {"stats": stats, "list": res_list, "classes": names(classes),
            "undo": undo, "can_reset": bool(state.get("initial")),
            "score_gap": state.get("score_gap"), "score_rate": state.get("score_rate")}


def push_history(state, op):
    """이동하기 직전에 부름: 지금 상태를 기록하고 최근 MAX_UNDO개만 남긴다."""
    state["history"] = (state["history"] + [{"data": copy.deepcopy(state["class_data"]), "op": op, "t": time.time()}])[-MAX_UNDO:]
    state["dirty"] = True
