# -*- mode: python ; coding: utf-8 -*-
# src 폴더에서: pyinstaller 학급편성.spec  →  dist\학급편성프로그램.exe
import os

a = Analysis(
    [os.path.join(SPECPATH, 'main.py')],
    pathex=[SPECPATH],
    datas=[(os.path.join(SPECPATH, 'static'), 'static')],
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
    icon=os.path.join(SPECPATH, 'icon.ico'),
)
