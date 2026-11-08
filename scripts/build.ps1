param([string]$Python = '', [string]$Iscc = '')

$ErrorActionPreference = 'Stop'
$env:PYTHONUTF8 = '1'
$root = Split-Path -Parent $PSScriptRoot
if (-not $Python) {
    $Python = Join-Path $root '.venv/Scripts/python.exe'
    if (-not (Test-Path -LiteralPath $Python)) { $Python = (Get-Command python).Source }
}
if (-not $Iscc) {
    $compiler = Get-Command iscc -ErrorAction SilentlyContinue
    if ($compiler) { $Iscc = $compiler.Source }
    foreach ($candidate in @(
        "$env:LOCALAPPDATA/Programs/Inno Setup 6/ISCC.exe",
        "$env:LOCALAPPDATA/Programs/Inno Setup 7/ISCC.exe",
        "${env:ProgramFiles(x86)}/Inno Setup 6/ISCC.exe",
        "$env:ProgramFiles/Inno Setup 7/ISCC.exe"
    )) {
        if (-not $Iscc -and (Test-Path -LiteralPath $candidate)) { $Iscc = $candidate }
    }
}
if (-not $Iscc) { throw 'Inno Setup을 설치하거나 -Iscc로 ISCC.exe 경로를 지정해 주세요.' }

Push-Location $root
try {
    foreach ($test in @('test_assign_rules.py', 'test_homonym.py', 'test_release.py')) {
        & $Python "tests/$test"
        if ($LASTEXITCODE -ne 0) { throw "테스트 실패: $test" }
    }
    node tests/test_ui_feedback.cjs
    if ($LASTEXITCODE -ne 0) { throw '화면 동작 테스트 실패' }

    & $Python -m PyInstaller --noconfirm --clean --distpath .build/dist --workpath .build/work packaging/ClassPlacement.spec
    if ($LASTEXITCODE -ne 0) { throw '실행 파일 빌드 실패' }

    $version = & $Python -c "import sys; sys.path.insert(0, 'src'); import updater; print(updater.APP_VERSION)"
    if ($LASTEXITCODE -ne 0) { throw '버전 확인 실패' }
    & $Iscc "/DMyAppVersion=$version" packaging/installer.iss
    if ($LASTEXITCODE -ne 0) { throw '설치 파일 빌드 실패' }
    Write-Output "완료: release/ClassPlacementSetup.exe (v$version)"
} finally {
    Pop-Location
}
