"""화면(static/)이 부르는 API. 실제 일은 engine / excel / store / updater 가 한다."""
import copy
import os
import sys
import threading
import time
import traceback
from datetime import datetime

import pandas as pd
import webview
from flask import Flask, jsonify, request, send_from_directory

import excel
import updater
from engine import (HOMONYM_REASON, assign, build_result, match_student, push_history, same_student,
                    student_frame, sync_homonym_groups)
from store import DATA_DIR, SETTINGS, STATE, load_configs, read_json, save_configs, write_json

BASE = getattr(sys, "_MEIPASS", os.path.dirname(os.path.abspath(__file__)))
app = Flask(__name__, static_folder=os.path.join(BASE, "static"), static_url_path="")

WINDOW = None          # main.py 가 만든 창
XLSX = ("Excel 파일 (*.xlsx)",)


def ask_open():
    r = WINDOW.create_file_dialog(webview.FileDialog.OPEN, file_types=XLSX)
    return r[0] if r else None


def ask_save(filename):
    r = WINDOW.create_file_dialog(webview.FileDialog.SAVE, save_filename=filename, file_types=XLSX)
    return (r if isinstance(r, str) else r[0]) if r else None


def sync_homonyms():
    STATE["sep_data"] = sync_homonym_groups(STATE["sep_data"], STATE["student_list"])


def result_response(**extra):
    res = build_result(STATE)
    save_configs()
    return jsonify({"ok": True, "result": res, **extra})


@app.route("/")
def index():
    return send_from_directory(app.static_folder, "index.html")


@app.route("/api/init")
def api_init():
    load_configs()
    return jsonify({
        "sep_data":     STATE["sep_data"],
        "join_data":    STATE["join_data"],
        "student_list": STATE["student_list"],
        "num_classes":  STATE["num_classes"],
        "filename":     os.path.basename(STATE["file_path"]) if STATE["file_path"] else "",
        "result":       build_result(STATE) if STATE["class_data"] else None,
        "version":      updater.APP_VERSION,
        "settings":     read_json(SETTINGS, {}),
    })


@app.route("/api/settings", methods=["POST"])
def api_settings():
    write_json(SETTINGS, {**read_json(SETTINGS, {}), **request.json})
    return jsonify({"ok": True})


# ── 엑셀 ──────────────────────────────────────────────────

@app.route("/api/load_excel", methods=["POST"])
def api_load_excel():
    path = ask_open()
    if not path:
        return jsonify({"ok": False, "msg": "파일을 선택하지 않았습니다."})
    try:
        df = excel.read_students(path)
        STATE.update(file_path=path, student_list=df.to_dict(orient="records"),
                     class_data=[], full_result=[], history=[], initial=[], dirty=False)
        sync_homonyms()
        save_configs()
        return jsonify({"ok": True, "data": STATE["student_list"], "sep_data": STATE["sep_data"], "filename": os.path.basename(path)})
    except Exception as e:
        return jsonify({"ok": False, "msg": str(e)})


@app.route("/api/download_template", methods=["POST"])
def api_download_template():
    path = ask_save("학생기초자료_양식.xlsx")
    if not path:
        return jsonify({"ok": False, "msg": "취소되었습니다."})
    try:
        excel.write_template(path)
        return jsonify({"ok": True, "path": path})
    except Exception as e:
        return jsonify({"ok": False, "msg": str(e)})


@app.route("/api/save_excel", methods=["POST"])
def api_save_excel():
    # 저장 창에 지금 날짜·시간으로 이름을 미리 채움 (예: 학급편성결과261108.16시21분.xlsx)
    path = ask_save(f"학급편성결과{datetime.now():%y%m%d.%H시%M분}.xlsx")
    if not path:
        return jsonify({"ok": False, "msg": "취소되었습니다."})
    try:
        stats = build_result(STATE)["stats"]
        excel.write_result(path, STATE["full_result"], stats, STATE["num_classes"])
        # 저장했으면 되돌리기 기록은 버린다 (저장한 상태가 새 출발점)
        STATE.update(history=[], dirty=False)
        save_configs()
        return jsonify({"ok": True, "path": path})
    except Exception as e:
        return jsonify({"ok": False, "msg": str(e)})


# ── 배정 ──────────────────────────────────────────────────

@app.route("/api/assign", methods=["POST"])
def api_assign():
    if STATE["file_path"] and os.path.exists(STATE["file_path"]):
        all_s = excel.read_students(STATE["file_path"])
    elif STATE["student_list"]:
        all_s = pd.DataFrame(STATE["student_list"])
    else:
        return jsonify({"ok": False, "msg": "엑셀 파일을 먼저 로드하세요."})
    try:
        n = int(request.json.get("num_classes", 0))
        if n <= 0:
            return jsonify({"ok": False, "msg": "학급 수를 입력하세요."})
        score_gap = float(request.json.get("score_gap", 15))
        all_s = all_s.sort_values("성적", ascending=False)
        all_s["반"] = all_s["반"].astype(str)
        all_s["번호"] = all_s["번호"].astype(str)
        classes = assign(all_s, n, STATE["sep_data"], STATE["join_data"], score_gap)
        STATE.update(num_classes=n, score_gap=score_gap, score_rate=request.json.get("score_rate"),
                     class_data=classes, history=[], initial=copy.deepcopy(classes), dirty=True)
        return result_response()
    except Exception as e:
        traceback.print_exc()
        return jsonify({"ok": False, "msg": str(e)})


@app.route("/api/move_student", methods=["POST"])
def api_move_student():
    data = request.json
    name, f_idx, t_idx = data["name"], data["from"] - 1, data["to"] - 1
    if f_idx != t_idx:
        push_history(STATE, {"type": "move", "name": name, "from": f_idx + 1, "to": t_idx + 1})
        s_obj = next((s for s in STATE["class_data"][f_idx] if s["이름"] == name), None)
        if s_obj:
            STATE["class_data"][f_idx].remove(s_obj)
            STATE["class_data"][t_idx].append(s_obj)
    return result_response()


@app.route("/api/reorder_classes", methods=["POST"])
def api_reorder_classes():
    src_idx, tgt_idx = request.json.get("src", 0), request.json.get("tgt", 0)
    cd = STATE["class_data"]
    if 0 <= src_idx < len(cd) and 0 <= tgt_idx <= len(cd):
        insert_pos = tgt_idx - 1 if src_idx < tgt_idx else tgt_idx
        if src_idx != insert_pos:
            push_history(STATE, {"type": "reorder", "from": src_idx + 1, "to": insert_pos + 1})
            cd.insert(insert_pos, cd.pop(src_idx))
    return result_response(src_class=src_idx + 1, tgt_class=min(tgt_idx + 1, len(cd)))


@app.route("/api/undo", methods=["POST"])
def api_undo():
    """최근 이동 count개를 한 번에 되돌림"""
    count = min(int((request.get_json(silent=True) or {}).get("count", 1)), len(STATE["history"]))
    if count > 0:
        STATE["class_data"] = STATE["history"][-count]["data"]
        del STATE["history"][-count:]
        STATE["dirty"] = True
    return result_response(undone=count > 0, remaining=len(STATE["history"]))


@app.route("/api/reset_assign", methods=["POST"])
def api_reset_assign():
    """처음 자동 배정 결과로 초기화"""
    if not STATE["initial"]:
        return jsonify({"ok": False, "msg": "처음 배정 결과가 없어요. 자동 배정을 다시 해 주세요."})
    STATE.update(class_data=copy.deepcopy(STATE["initial"]), history=[], dirty=True)
    return result_response()


# ── 분리·통합 그룹 ────────────────────────────────────────

def add_member(key, rec, duplicate):
    """복합키(반,번호,이름)로 정확히 1명만 찾아질 때만 추가. 동명이인이면 후보 목록을 돌려준다."""
    if not STATE["student_list"]:
        return {"ok": False, "msg": "학생 명단이 로드되지 않았습니다."}
    matched = match_student(student_frame(STATE["student_list"]), rec)
    if len(matched) == 0:
        return {"ok": False, "msg": f"'{rec.get('이름')}' 학생을 찾을 수 없습니다."}
    if len(matched) > 1:
        return {"ok": False, "duplicate": True, "candidates": matched.to_dict(orient="records"),
                "msg": f"'{rec.get('이름')}' 이름의 학생이 {len(matched)}명 존재합니다. 반·번호 정보로 정확한 학생을 선택해 주세요."}
    if any(duplicate(s) for s in STATE[key]):
        return None
    STATE[key].append(rec)
    return {"ok": True}


def remove_member(key, rec, same_group):
    STATE[key] = [s for s in STATE[key] if not (same_student(s, rec) and (not same_group or str(s.get("그룹")) == str(rec.get("그룹"))))]


@app.route("/api/sep_data", methods=["POST"])
def api_sep_data():
    STATE["sep_data"] = request.json
    sync_homonyms(); save_configs()
    return jsonify({"ok": True, "sep_data": STATE["sep_data"]})


@app.route("/api/sep_data/add", methods=["POST"])
def api_sep_data_add():
    rec = request.json
    r = add_member("sep_data", rec, lambda s: same_student(s, rec) and str(s.get("그룹")) == str(rec.get("그룹"))
                   and s.get("분리사유") != HOMONYM_REASON)
    if r is None:
        return jsonify({"ok": False, "msg": "이미 이 분리 그룹에 들어 있는 학생입니다."})
    if r["ok"]:
        sync_homonyms(); save_configs()   # 동명 그룹 번호를 새 분리 그룹 뒤로 다시 매김
        r["sep_data"] = STATE["sep_data"]
    return jsonify(r)


@app.route("/api/sep_data/remove", methods=["POST"])
def api_sep_data_remove():
    remove_member("sep_data", request.json, same_group=True)
    save_configs()
    return jsonify({"ok": True, "sep_data": STATE["sep_data"]})


@app.route("/api/join_data", methods=["POST"])
def api_join_data():
    STATE["join_data"] = request.json; save_configs()
    return jsonify({"ok": True})


@app.route("/api/join_data/add", methods=["POST"])
def api_join_data_add():
    rec = request.json
    r = add_member("join_data", rec, lambda s: same_student(s, rec))
    if r is None:
        return jsonify({"ok": False, "msg": "이미 통합 그룹에 추가된 학생입니다."})
    if r["ok"]:
        save_configs()
        r["join_data"] = STATE["join_data"]
    return jsonify(r)


@app.route("/api/join_data/remove", methods=["POST"])
def api_join_data_remove():
    remove_member("join_data", request.json, same_group=False)
    save_configs()
    return jsonify({"ok": True, "join_data": STATE["join_data"]})


# ── 창 ────────────────────────────────────────────────────

ALLOW_CLOSE = False


def quit_app():
    """창을 닫고 프로세스를 끝낸다. destroy()를 Flask 스레드에서 부르면 프로세스가 남는 webview 버그 대응."""
    global ALLOW_CLOSE
    ALLOW_CLOSE = True
    try:
        WINDOW.destroy()
    except Exception:
        pass
    threading.Thread(target=lambda: (time.sleep(0.3), os._exit(0)), daemon=True).start()


def on_closing():
    """Alt+F4·작업 표시줄 닫기: 바로 닫지 않고 화면의 저장 확인 창으로 넘긴다."""
    if ALLOW_CLOSE:
        return
    # 닫기 이벤트 안에서 JS 응답을 기다리면 화면이 멈추므로 따로 실행
    threading.Thread(target=lambda: WINDOW.evaluate_js("winClose(); true"), daemon=True).start()
    return False


@app.route("/api/close_state")
def api_close_state():
    return jsonify({"dirty": bool(STATE["dirty"]) and bool(STATE["class_data"])})


@app.route("/api/window/<action>", methods=["POST"])
def api_window(action):
    if action == "minimize":
        WINDOW.minimize()
    elif action == "toggle_maximize":
        WINDOW._maximized = not getattr(WINDOW, "_maximized", False)
        WINDOW.maximize() if WINDOW._maximized else WINDOW.restore()
    elif action == "close":
        quit_app()
    elif action == "get_bounds":
        return jsonify({"x": WINDOW.x, "y": WINDOW.y, "w": WINDOW.width, "h": WINDOW.height})
    elif action == "set_bounds":
        b = request.json
        WINDOW.move(max(-50, int(b["x"])), max(0, int(b["y"])))
        WINDOW.resize(int(b["w"]), int(b["h"]))
        WINDOW._maximized = False
    return jsonify({"ok": True})


# ── 업데이트 ──────────────────────────────────────────────

@app.route("/api/update/check")
def api_update_check():
    return jsonify(updater.check_update())


@app.route("/api/update/install", methods=["POST"])
def api_update_install():
    try:
        save_configs()
        updater.start_install(request.json.get("version"), DATA_DIR)
    except Exception as e:
        traceback.print_exc()
        return jsonify({"ok": False, "msg": str(e)})
    quit_app()
    return jsonify({"ok": True})
