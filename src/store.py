"""프로그램 상태(STATE)와 자동 저장 파일.

설치판은 사용자 폴더(%APPDATA%\\학급편성)에, 개발할 때는 프로젝트 폴더에 저장한다.
업데이트·재설치를 해도 자료가 남는다.
"""
import json
import os
import sys
import tempfile

from engine import MAX_UNDO, infer_op, sync_homonym_groups

if getattr(sys, "frozen", False):
    DATA_DIR = os.path.join(os.environ.get("APPDATA", "."), "학급편성")
else:
    DATA_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
os.makedirs(DATA_DIR, exist_ok=True)

CONFIG_SEP     = os.path.join(DATA_DIR, "sep_config.json")
CONFIG_JOIN    = os.path.join(DATA_DIR, "join_config.json")
CONFIG_STUDENT = os.path.join(DATA_DIR, "student_cache.json")
CONFIG_ASSIGN  = os.path.join(DATA_DIR, "assign_result_cache.json")
SETTINGS       = os.path.join(DATA_DIR, "settings.json")   # 화면 설정 (가이드 투어 다시 보지 않기 등)

STATE = {
    "file_path":   None,
    "num_classes": 0,
    "class_data":  [],     # 반별 학생 목록
    "history":     [],     # [{data: 이동 전 class_data, op: 무슨 이동, t: 시각}] 최근 MAX_UNDO개
    "initial":     [],     # 자동 배정 직후 class_data (처음 배정결과로 초기화용)
    "dirty":       False,  # 마지막 엑셀 저장 뒤 편성 결과가 바뀌었는지
    "score_gap":   None,   # 자동 편성에서 고른 반 평균 차이 기준(점). 검증도 이 값을 씀
    "score_rate":  None,   # 그 기준을 고른 단계 (표준편차의 몇 배: 0.05 = 5%)
    "sep_data":    [],     # [{반,번호,이름,성별,성적,그룹,분리사유}]
    "join_data":   [],     # [{반,번호,이름,성별,성적,그룹,통합사유}]
    "full_result": [],     # 배정 결과 레코드
    "student_list": [],    # 원본 명단
}
ASSIGN_KEYS = ("num_classes", "class_data", "full_result", "history", "initial", "dirty", "score_gap", "score_rate")


def read_json(path, default=None):
    try:
        with open(path, encoding="utf-8") as f:
            return json.load(f)
    except (OSError, ValueError):
        return default


def write_json(path, data):
    # 저장 중 오류가 나도 이전 파일은 남겨 둔다.
    fd, temp_path = tempfile.mkstemp(dir=os.path.dirname(path), suffix=".tmp")
    try:
        with os.fdopen(fd, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
        os.replace(temp_path, path)
    finally:
        if os.path.exists(temp_path):
            os.remove(temp_path)


def save_configs():
    try:
        write_json(CONFIG_SEP, STATE["sep_data"])
        write_json(CONFIG_JOIN, STATE["join_data"])
        if STATE["student_list"]:
            write_json(CONFIG_STUDENT, {"file_path": STATE["file_path"], "student_list": STATE["student_list"]})
        if STATE["class_data"]:
            write_json(CONFIG_ASSIGN, {k: STATE[k] for k in ASSIGN_KEYS})
        elif os.path.exists(CONFIG_ASSIGN):
            os.remove(CONFIG_ASSIGN)
    except Exception as e:
        print("[Save Config Exception]", e)
        raise


def load_configs():
    STATE["sep_data"] = read_json(CONFIG_SEP, STATE["sep_data"])
    STATE["join_data"] = read_json(CONFIG_JOIN, STATE["join_data"])
    c = read_json(CONFIG_STUDENT)
    if c:
        STATE["student_list"] = c.get("student_list", [])
        STATE["file_path"] = c.get("file_path")
    c = read_json(CONFIG_ASSIGN)
    if c:
        for k in ASSIGN_KEYS:
            STATE[k] = c.get(k, STATE[k])
        # 옛 기록(스냅숏만 있는 목록)은 앞뒤 모습을 비교해 무슨 이동이었는지 알아냄
        hist = STATE["history"][-MAX_UNDO:]
        for k, h in enumerate(hist):
            if not isinstance(h, dict):
                after = hist[k + 1] if k + 1 < len(hist) else STATE["class_data"]
                after = after["data"] if isinstance(after, dict) else after
                hist[k] = {"data": h, "op": infer_op(h, after), "t": 0}
        STATE["history"] = hist
    STATE["sep_data"] = sync_homonym_groups(STATE["sep_data"], STATE["student_list"])
