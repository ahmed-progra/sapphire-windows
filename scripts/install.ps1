$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
Set-Location -LiteralPath $projectRoot
$version = (Get-Content -LiteralPath 'package.json' -Raw | ConvertFrom-Json).version
$installer = Join-Path $projectRoot ('release\Sapphire-' + $version + '-win-x64-Setup.exe')
if (-not (Test-Path -LiteralPath $installer)) {
    & npm.cmd run package
    if ($LASTEXITCODE -ne 0) { throw 'Sapphire packaging failed.' }
}
if (-not (Test-Path -LiteralPath $installer)) { throw 'The expected installer was not produced.' }
Start-Process -FilePath $installer -WindowStyle Hidden
