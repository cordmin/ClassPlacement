# -*- mode: python ; coding: utf-8 -*-
# 프로젝트 루트에서 scripts/build.ps1로 빌드한다.
import os

SRC = os.path.join(os.path.dirname(SPECPATH), 'src')
a = Analysis(
    [os.path.join(SRC, 'main.py')],
    pathex=[SRC],
    datas=[(os.path.join(SRC, 'static'), 'static'),
           (os.path.join(SRC, 'resources'), 'resources')],
    # 쓰지 않는 큰 모듈은 빼서 용량을 줄인다
    excludes=['tkinter', '_tkinter', 'matplotlib', 'scipy', 'PIL', 'PyQt5', 'PyQt6', 'PySide2', 'PySide6',
              'IPython', 'jupyter', 'notebook', 'pytest', 'sphinx', 'docutils', 'pandas.tests', 'numpy.tests', 'numpy.f2py'],
    optimize=1,  # assert만 제거 — optimize=2는 numpy add_docstring 크래시 유발
)
pyz = PYZ(a.pure)

exe = EXE(
    pyz,
    a.scripts,
    a.binaries,
    a.datas,
    [],
    name='학급편성프로그램',
    upx=True,
    console=False,
    icon=os.path.join(SRC, 'static', 'assets', 'app.ico'),
)
