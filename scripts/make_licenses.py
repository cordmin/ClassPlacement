"""프로그램에 들어가는 오픈소스의 라이선스 안내문(src/static/licenses.txt)을 만든다.

라이브러리를 더하거나 버전을 올린 뒤 한 번 실행한다:  .venv\\Scripts\\python.exe scripts/make_licenses.py
설치판 exe 에 실제로 묶이는 것(requirements.txt 의 실행용 패키지와 그 의존성)만 모은다.
"""
from importlib.metadata import distribution
from pathlib import Path
import re
import sys
import urllib.request

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "src" / "static" / "licenses.txt"
RUNTIME = ["Flask", "pandas", "openpyxl", "pywebview"]   # 앱이 직접 쓰는 패키지
LICENSE_FILE = re.compile(r"(LICEN[CS]E|COPYING|NOTICE)", re.I)
LINE = "=" * 72


def collect():
    seen = {}

    def walk(name):
        try:
            dist = distribution(name)
        except Exception:
            return
        key = dist.metadata["Name"]
        if key in seen:
            return
        seen[key] = dist
        for req in dist.requires or []:
            if "extra ==" in req or ("sys_platform" in req and "win32" not in req):
                continue   # 선택 기능용이거나 윈도우가 아닌 곳에서만 쓰는 패키지
            walk(re.split(r"[ ;<>=!\[~(]", req, 1)[0])

    for name in RUNTIME:
        walk(name)
    return sorted(seen.values(), key=lambda d: d.metadata["Name"].lower())


def license_name(dist):
    m = dist.metadata
    if m.get("License-Expression"):
        return m["License-Expression"]
    found = [c.split("::")[-1].strip() for c in m.get_all("Classifier") or [] if c.startswith("License ::")]
    return ", ".join(found) or (m.get("License") or "").splitlines()[0] if (found or m.get("License")) else "MIT"


def texts(dist):
    files = [f for f in dist.files or [] if ".dist-info" in str(f) and LICENSE_FILE.search(f.name)]
    return [Path(f.locate()).read_text(encoding="utf-8", errors="replace").strip() for f in files]


def fetch(url):
    with urllib.request.urlopen(url, timeout=15) as r:
        return r.read().decode("utf-8").strip()


def section(title, url, license, bodies):
    head = f"{LINE}\n{title}\n{url}\n라이선스: {license}\n{LINE}"
    return "\n\n".join([head, *bodies]) if bodies else head


def main():
    dists = collect()
    others = [
        ("Python " + sys.version.split()[0], "https://www.python.org", "PSF-2.0",
         [(Path(sys.base_prefix) / "LICENSE.txt").read_text(encoding="utf-8", errors="replace").strip()]),
        ("PyInstaller 부트로더 (exe 실행 부분)", "https://pyinstaller.org", "GPL-2.0 (실행 파일 배포를 허용하는 예외 조항 포함)",
         texts(distribution("pyinstaller"))),
        ("Microsoft Edge WebView2 SDK (pywebview 에 포함)", "https://www.nuget.org/packages/Microsoft.Web.WebView2",
         "BSD-3-Clause 형식, Copyright (C) Microsoft Corporation", []),
        ("Lucide 아이콘", "https://lucide.dev", "ISC",
         [fetch("https://raw.githubusercontent.com/lucide-icons/lucide/main/LICENSE")]),
        ("Pretendard 글꼴 (실행할 때 인터넷에서 불러옴)", "https://github.com/orioncactus/pretendard", "SIL OFL 1.1",
         [fetch("https://raw.githubusercontent.com/orioncactus/pretendard/main/LICENSE")]),
    ]
    rows = [(d.metadata["Name"] + " " + d.version, license_name(d)) for d in dists]
    rows += [(t, l) for t, _, l, _ in others]

    parts = ["\n".join([
        "학급 편성 프로그램 오픈소스 라이선스 안내",
        "",
        "이 프로그램은 아래 오픈소스 소프트웨어를 사용합니다.",
        "각 소프트웨어의 저작권은 해당 저작권자에게 있으며, 아래 라이선스 조건에 따라 사용합니다.",
        "",
        *[f"- {n}: {l}" for n, l in rows],
    ])]
    for d in dists:
        m = d.metadata
        links = {k.strip().lower(): v.strip() for k, v in (u.split(",", 1) for u in m.get_all("Project-URL") or [])}
        url = m.get("Home-page") or next((links[k] for k in ("source", "source code", "repository", "homepage") if k in links), "")
        parts.append(section(f"{m['Name']} {d.version}", url, license_name(d), texts(d)))
    parts += [section(*o) for o in others]
    OUT.write_text("\n\n".join(parts) + "\n", encoding="utf-8", newline="\n")
    print(f"{OUT} ({OUT.stat().st_size // 1024} KB, {len(rows)}개)")


if __name__ == "__main__":
    main()
