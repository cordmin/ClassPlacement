; 프로젝트 루트에서 scripts/build.ps1 실행 → release\ClassPlacementSetup.exe
; 관리자 권한 없이 사용자 폴더에 설치한다. 그래야 자동 업데이트가 확인 창 없이 조용히 설치된다.

#ifndef MyAppVersion
  #define MyAppVersion "0.0.0"
#endif
#define MyAppName "학급 편성"
#define MyAppExe "학급편성프로그램.exe"

[Setup]
; AppId 는 바꾸면 안 된다. 바꾸면 업데이트가 아니라 다른 프로그램으로 따로 설치된다.
AppId={{AED3F54E-BF89-4338-AAFA-95F73852F5FB}
AppName={#MyAppName}
AppVersion={#MyAppVersion}
AppPublisher=이경민
AppSupportURL=https://github.com/cordmin/ClassPlacement
DefaultDirName={autopf}\학급편성
DisableProgramGroupPage=yes
InfoBeforeFile=..\src\static\privacy.txt
PrivilegesRequired=lowest
OutputDir=..\release
; updater.py 의 SETUP_ASSET 과 같아야 한다.
OutputBaseFilename=ClassPlacementSetup
SetupIconFile=..\src\static\assets\app.ico
UninstallDisplayIcon={app}\{#MyAppExe}
Compression=lzma2
SolidCompression=yes
CloseApplications=force
RestartApplications=no
WizardStyle=modern

[Tasks]
Name: "desktopicon"; Description: "바탕화면에 바로가기 만들기"; GroupDescription: "바로가기 설정:"

[Languages]
Name: "korean"; MessagesFile: "compiler:Languages\Korean.isl"

[Files]
Source: "..\.build\dist\{#MyAppExe}"; DestDir: "{app}"; Flags: ignoreversion
Source: "..\src\static\privacy.txt"; DestDir: "{app}"; DestName: "개인정보처리방침.txt"; Flags: ignoreversion
Source: "..\src\resources\학생기초자료(예시).xlsx"; DestDir: "{app}"; Flags: ignoreversion

[Icons]
Name: "{autodesktop}\{#MyAppName}"; Filename: "{app}\{#MyAppExe}"; Tasks: desktopicon
Name: "{autoprograms}\{#MyAppName}"; Filename: "{app}\{#MyAppExe}"

[Run]
; 처음 설치: 마지막 화면의 '실행' 체크. 자동 업데이트(조용한 설치): 끝나면 바로 다시 켠다.
Filename: "{app}\{#MyAppExe}"; WorkingDir: "{app}"; BeforeInstall: PrepareAppRestart; Description: "프로그램 실행"; Flags: nowait postinstall skipifsilent
Filename: "{app}\{#MyAppExe}"; WorkingDir: "{app}"; BeforeInstall: PrepareAppRestart; Flags: nowait skipifnotsilent

[Code]
function SetEnvironmentVariable(lpName, lpValue: string): Boolean;
  external 'SetEnvironmentVariableW@kernel32.dll stdcall';

procedure PrepareAppRestart;
begin
  SetEnvironmentVariable('PYINSTALLER_RESET_ENVIRONMENT', '1');
end;

procedure CurUninstallStepChanged(CurUninstallStep: TUninstallStep);
begin
  if (CurUninstallStep <> usPostUninstall) or UninstallSilent then Exit;
  // 되살릴 수 없으므로 기본 선택은 '아니요'
  if MsgBox('프로그램에 저장된 자료(학생 명단, 그룹, 편성 결과)도 함께 지울까요?' + #13#10 +
      '지운 자료는 되살릴 수 없습니다. 직접 저장한 엑셀 파일은 지워지지 않습니다.',
      mbConfirmation, MB_YESNO or MB_DEFBUTTON2) = IDYES then
    DelTree(ExpandConstant('{userappdata}\학급편성'), True, True, True);
end;
