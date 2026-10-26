$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
Set-Location -LiteralPath $projectRoot
$installedExe = Join-Path $env:LOCALAPPDATA 'Programs\Sapphire\Sapphire.exe'
if (-not (Test-Path -LiteralPath $installedExe)) { $installedExe = Join-Path $projectRoot 'release\win-unpacked\Sapphire.exe' }
if (Test-Path -LiteralPath $installedExe) {
    Start-Process -FilePath $installedExe -WorkingDirectory (Split-Path -Parent $installedExe) -WindowStyle Hidden
    exit 0
}
if (-not (Test-Path -LiteralPath (Join-Path $projectRoot 'node_modules\electron'))) { throw 'Run npm ci in this folder first.' }
if (-not (Test-Path -LiteralPath (Join-Path $projectRoot 'dist-electron\desktop.mjs'))) {
    & npm.cmd run build
    if ($LASTEXITCODE -ne 0) { throw 'Sapphire build failed.' }
}
& npm.cmd start
exit $LASTEXITCODE
