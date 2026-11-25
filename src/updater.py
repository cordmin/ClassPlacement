"""자동 업데이트: GitHub 릴리스에서 새 버전을 찾아 설치 파일을 조용히 실행한다.

releases/latest 는 최신 태그 페이지로 넘어간다. API 를 쓰지 않으므로
학교처럼 여러 PC 가 한 IP 를 쓰는 곳에서도 호출 제한에 걸리지 않는다.
"""
import ctypes
import os
import re
import shutil
import subprocess
import sys
import tempfile
import urllib.request

# 바꿀 성격에 맞게 손으로 올린다 (오류 수정: 끝자리 / 기능 추가: 가운데 / 크게 바뀜: 앞자리).
# GitHub Actions(.github/workflows/release.yml)를 수동 실행하면 이 번호로 릴리스를 만든다.
APP_VERSION = '3.1.6'
UPDATE_REPO = 'cordmin/ClassPlacement'
# 릴리스에 올리는 설치 파일 이름. installer.iss 의 OutputBaseFilename 과 같아야 한다.
SETUP_ASSET = 'ClassPlacementSetup.exe'
# 업데이트 주소에 들어가는 버전 이름에는 경로를 바꾸는 글자(/, \, % 등)를 쓸 수 없다.
SAFE_TAG = re.compile(r'v?\d+(\.\d+)*')


def version_tuple(v):
    return tuple(int(x) for x in v.lstrip('v').split('.'))


def release_notes(text, tag):
    """RELEASE_NOTES.md 에서 그 버전(## v3.1.5) 아래의 '- ' 줄만 꺼낸다."""
    notes, inside = [], False
    for line in text.splitlines():
        if line.startswith('## '):
            inside = line[3:].strip() == tag
        elif inside and line.startswith('- '):
            notes.append(line[2:].strip())
    return notes


def fetch_notes(tag):
    # 릴리스에 올린 그 태그의 RELEASE_NOTES.md 를 읽는다. 못 읽으면 목록 없이 묻는다.
    try:
        url = f'https://raw.githubusercontent.com/{UPDATE_REPO}/{tag}/RELEASE_NOTES.md'
        with urllib.request.urlopen(url, timeout=5) as r:
            return release_notes(r.read().decode('utf-8'), tag)
    except Exception as e:
        print(f"업데이트 내역 확인 실패: {e}")
        return []


def check_update():
    if not getattr(sys, 'frozen', False):
        # 개발 실행: 화면 미리보기용으로 지금 버전의 내역을 보여 준다
        local = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'RELEASE_NOTES.md')
        try:
            notes = release_notes(open(local, encoding='utf-8').read(), f'v{APP_VERSION}')
        except OSError:
            notes = []
        return {"available": False, "status": "development", "notes": notes}
    try:
        with urllib.request.urlopen(f'https://github.com/{UPDATE_REPO}/releases/latest', timeout=5) as r:
            tag = r.geturl().rstrip('/').rsplit('/', 1)[-1]
        if not SAFE_TAG.fullmatch(tag) or version_tuple(tag) <= version_tuple(APP_VERSION):
            return {"available": False, "status": "latest", "version": tag}
        return {"available": True, "version": tag, "current": f"v{APP_VERSION}", "notes": fetch_notes(tag)}
    except Exception as e:   # 오프라인이거나 릴리스가 없으면 조용히 넘어간다
        print(f"업데이트 확인 실패: {e}")
        return {"available": False, "status": "error"}


def start_install(tag, log_dir):
    """설치 파일을 받아 조용히 설치하도록 띄운다. 부른 쪽이 바로 프로그램을 끝내야 한다.
    설치가 끝나면 설치 파일이 프로그램을 다시 켠다 (installer.iss [Run])."""
    if not isinstance(tag, str) or not SAFE_TAG.fullmatch(tag):
        raise ValueError("버전 이름이 올바르지 않습니다.")
    url = f'https://github.com/{UPDATE_REPO}/releases/download/{tag}/{SETUP_ASSET}'
    # PC의 다른 실행과 파일이 겹치지 않게 하고, 연결이 끊기면 재시도할 수 있게 한다.
    download_dir = tempfile.mkdtemp(prefix='ClassPlacement-update-')
    path = os.path.join(download_dir, SETUP_ASSET)
    try:
        with urllib.request.urlopen(url, timeout=30) as response, open(path, 'wb') as target:
            shutil.copyfileobj(response, target)
    except Exception:
        shutil.rmtree(download_dir)
        raise
    env = {**os.environ, 'PYINSTALLER_RESET_ENVIRONMENT': '1'}
    bundle_dir = getattr(sys, '_MEIPASS', None)
    # PyInstaller 의 DLL 검색 경로를 설치 파일에 물려주지 않는다.
    if bundle_dir:
        ctypes.windll.kernel32.SetDllDirectoryW(None)
    try:
        subprocess.Popen([path, '/VERYSILENT', '/SUPPRESSMSGBOXES', '/NORESTART',
                          '/CLOSEAPPLICATIONS', '/FORCECLOSEAPPLICATIONS', '/NORESTARTAPPLICATIONS',
                          f'/LOG={os.path.join(log_dir, "update-install.log")}'],
                         cwd=os.path.dirname(sys.executable), env=env,
                         creationflags=subprocess.DETACHED_PROCESS)
    finally:
        if bundle_dir:
            ctypes.windll.kernel32.SetDllDirectoryW(ctypes.c_wchar_p(bundle_dir))
