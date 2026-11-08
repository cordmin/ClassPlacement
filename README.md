# 학급 편성

학생 명단을 엑셀로 불러와 인원·성별·성적과 분리·통합 그룹을 고려해 학급을 편성하는 Windows 프로그램입니다.

## 설치 및 사용

[최신 릴리스](https://github.com/cordmin/ClassPlacement/releases/latest)에서 `ClassPlacementSetup.exe`를 받아 설치합니다.
처음 실행하면 9단계 사용 안내가 나오며, 상단 `?` 버튼으로 다시 볼 수 있습니다.
양식을 내려받아 명단을 작성한 뒤 불러오기 → 기초 편성 → 자동 편성 → 수동 조정 → 검증 → 결과 저장 순서로 사용합니다.

설치판은 시작할 때 새 버전을 확인하고, 사용자가 동의하면 설치 후 다시 실행합니다.
상단 버전 번호를 눌러 직접 확인할 수도 있습니다. 인터넷에 연결되지 않아도 편성 기능은 사용할 수 있습니다.
자동 저장 자료는 `%APPDATA%\학급편성`에 남습니다. 업데이트 전에도 따로 저장할 수 있습니다.
기존 단독 실행 파일에서 사용하던 자료는 새 설치판으로 자동 이동하지 않으므로, 처음에는 기존 명단 엑셀을 다시 불러와 주세요.

## 개발

[개인정보 처리방침](src/static/privacy.txt)은 앱의 사이드바 아래와 설치 화면에서도 확인할 수 있습니다. 이 파일을 수정하면 앱·설치 안내에 함께 반영됩니다.

Python 3.12와 Windows에서 다음 명령으로 실행합니다.

```powershell
python -m pip install -r requirements.txt
python src/main.py
```

개발 실행은 프로젝트 루트에 자료를 저장합니다. 학생 명단과 자동 저장 파일은 Git에서 제외되어 있습니다.

```powershell
python tests/test_assign_rules.py
python tests/test_homonym.py
python tests/test_release.py
```

## 배포

`src/updater.py`의 `APP_VERSION`을 올리고 `RELEASE_NOTES.md`를 작성한 뒤 `main`에 올립니다.
GitHub Actions가 테스트 → 실행 파일 생성 → Inno Setup 설치 파일 생성 → 버전 태그와 릴리스 게시를 수행합니다.
같은 버전이 이미 배포되어 있으면 덮어쓰지 않고 중단합니다.
설치 파일의 이름과 AppId는 자동 업데이트 호환을 위해 유지합니다.

직접 빌드하려면 Inno Setup 6을 설치한 뒤 `src`에서 실행합니다.

```powershell
pyinstaller 학급편성.spec
iscc /DMyAppVersion=3.1.0 installer.iss
```
