$ErrorActionPreference = 'Stop'
$Root = Join-Path $env:USERPROFILE '.dodaios'
$Py = Join-Path $Root '.venv\Scripts\python.exe'
$PatchManager = Join-Path $Root 'ja_patches\apply_ja_patches.py'

Write-Host '===== JA WINDOWS UPDATE ====='
Write-Host 'CHANNEL=stable'
Write-Host 'PLATFORM=windows'
Write-Host 'VERSION=0.1.0'

if (-not (Test-Path $Py)) {
    throw "Python do JA nao encontrado: $Py"
}

if (-not (Test-Path $PatchManager)) {
    throw "Patch manager do JA nao encontrado: $PatchManager"
}

& $Py $PatchManager
if ($LASTEXITCODE -ne 0) {
    throw 'Healthcheck/patch manager retornou erro.'
}

Write-Host 'JA_WINDOWS_UPDATE=OK'
