# 학급 편성

학생 명단을 엑셀로 불러와 인원·성별·성적과 분리·통합 그룹을 고려해 학급을 편성하는 Windows 프로그램입니다.

## 설치 및 사용

[최신 릴리스](https://github.com/cordmin/ClassPlacement/releases/latest)에서 `ClassPlacementSetup.exe`를 받아 설치합니다.
처음 실행하면 10단계 사용 안내가 나오며, 상단 `?` 버튼으로 다시 볼 수 있습니다.
양식을 내려받아 명단을 작성한 뒤 불러오기 → 기초 편성 → 자동 편성 → 수동 조정 → 검증 → 결과 저장 순서로 사용합니다.

설치판은 시작할 때 새 버전을 확인하고, 사용자가 동의하면 설치 후 다시 실행합니다.
상단 버전 번호를 누르면 개발자 정보와 업데이트 확인 버튼을 볼 수 있습니다. 인터넷에 연결되지 않아도 편성 기능은 사용할 수 있습니다.
자동 저장 자료는 `%APPDATA%\학급편성`에 남습니다. 업데이트 전에도 따로 저장할 수 있습니다.
기존 단독 실행 파일에서 사용하던 자료는 새 설치판으로 자동 이동하지 않으므로, 처음에는 기존 명단 엑셀을 다시 불러와 주세요.

## 개발

[개인정보 처리방침](src/static/privacy.txt)은 앱의 사이드바 아래와 설치 화면에서도 확인할 수 있습니다. 이 파일을 수정하면 앱·설치 안내에 함께 반영됩니다.

Python 3.12와 Windows에서 다음 명령으로 실행합니다.

```powershell
python -m pip install -r requirements.txt
python src/main.py
```

개발 실행의 자동 저장 자료는 `.local-data/`에 저장합니다. 이 폴더는 Git과 공유용 소스 ZIP에서 제외됩니다.
불러오기 창은 `src/resources/학생기초자료(예시).xlsx`가 있는 폴더를 먼저 보여 줍니다.

```powershell
python tests/test_assign_rules.py
python tests/test_homonym.py
python tests/test_release.py
node tests/test_ui_feedback.cjs
```

## 배포

소스를 올리는 것만으로는 배포되지 않습니다. 승인된 배포에 한해 `src/updater.py`의 `APP_VERSION`과
`RELEASE_NOTES.md`를 갱신하고 GitHub Actions의 `release`를 수동 실행합니다.
테스트 → 실행 파일 → 설치 파일·소스 ZIP → GitHub 릴리스 순서로 진행합니다.
이미 배포한 버전은 덮어쓰지 않습니다. 설치 파일 이름과 AppId는 업데이트 호환을 위해 유지합니다.

직접 빌드하려면 Python 3.12, Node.js, Inno Setup 6을 설치하고 프로젝트 루트에서 실행합니다.

```powershell
python -m venv .venv
.venv\Scripts\python -m pip install -r requirements.txt
.\scripts\build.ps1
```

빌드 스크립트는 `.venv`의 Python을 우선 사용하며, 없으면 `python`을 사용합니다.
컴파일러 위치를 찾지 못하면 `-Iscc "C:\경로\ISCC.exe"`로 지정할 수 있습니다.
완성된 설치 파일은 `release/ClassPlacementSetup.exe`, 중간 파일은 `.build/`에 생성됩니다.

공유용 소스 ZIP은 변경 사항을 커밋한 뒤 `git archive`로 만듭니다. 폴더 전체를 압축하지 마세요.
이 방식은 `.git` 기록, `.local-data`, 가상환경과 빌드 결과를 포함하지 않습니다.

```powershell
git archive --format=zip --prefix=ClassPlacement/ -o release/ClassPlacement-source.zip HEAD
```

## 폴더 구성

```text
src/                  프로그램 코드
  static/assets/      현재 사용하는 ICO·PNG·SVG 로고
  static/css/         화면 스타일
  static/js/          화면 기능
  static/privacy.txt  앱·설치 화면에서 함께 쓰는 개인정보 처리방침
  resources/          공유 가능한 예시 엑셀
packaging/            PyInstaller·Inno Setup 설정
scripts/build.ps1     테스트 및 설치 파일 빌드
tests/                편성·저장·화면 동작 테스트
.github/workflows/    수동 배포 설정
release/              공유할 설치 파일·소스 ZIP (Git 제외)
.build/               빌드 중간 파일 (Git 제외)
.local-data/          이 컴퓨터의 작업 자료 (공유 제외)
.venv/                개발 환경 (공유 제외)
```
