"""학급편성 프로그램 — 진입점. 화면 서버(server.py)를 띄우고 테두리 없는 창을 연다.

    engine.py   자동 편성 알고리즘, 동명이인, 결과 정리
    excel.py    양식·명단·결과 엑셀
    store.py    상태와 자동 저장 파일
    updater.py  GitHub 릴리스 자동 업데이트
    server.py   화면이 부르는 API
"""
import threading

import webview
from werkzeug.serving import make_server

import server
from store import load_configs

if __name__ == "__main__":
    load_configs()
    # 빈 포트를 먼저 확보한다. 이전 실행이나 다른 프로그램의 서버에 연결하지 않는다.
    http_server = make_server("127.0.0.1", 0, server.app, threaded=True)
    threading.Thread(target=http_server.serve_forever, daemon=True).start()
    win_w, win_h = 1270, 800
    win_x = win_y = None
    try:
        sc = webview.screens[0]
        win_x, win_y = max(0, (sc.width - win_w) // 2), max(0, (sc.height - win_h) // 2)
    except Exception as e:
        print(f"화면 위치 계산 예외: {e}")

    # frameless: 타이틀바를 index.html 이 직접 그린다. easy_drag=False: 타이틀바만 끌 수 있다.
    server.WINDOW = webview.create_window(
        "학급 편성", f"http://127.0.0.1:{http_server.server_port}/",
        width=win_w, height=win_h, x=win_x, y=win_y,
        min_size=(1270, 800), frameless=True, easy_drag=False,
    )
    server.WINDOW.events.closing += server.on_closing
    try:
        webview.start()
    finally:
        http_server.shutdown()
