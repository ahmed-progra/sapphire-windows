param([switch]$TestOnly)
$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
$sdk = Join-Path $projectRoot '.tools\dotnet\dotnet.exe'
if (-not (Test-Path -LiteralPath $sdk)) { $sdkCommand = Get-Command dotnet -ErrorAction SilentlyContinue; $sdk = if ($sdkCommand) { $sdkCommand.Source } else { $null } }
if (-not $sdk -or (-not (Test-Path -LiteralPath (Join-Path $projectRoot '.tools\dotnet\sdk\10.0.402')) -and -not ((& $sdk --list-sdks) -match '^10\.0\.402 '))) {
    $fallback = Join-Path $projectRoot 'native\build-with-roslyn.ps1'
    if ($PSVersionTable.PSEdition -eq 'Core') { & $fallback -TestOnly:$TestOnly }
    else {
        $pwsh = Get-Command pwsh -ErrorAction SilentlyContinue
        if (-not $pwsh) { throw 'SDK 10.0.402 is absent. The fallback needs PowerShell 7.6.5 (pwsh.exe) on PATH; Windows PowerShell cannot load Roslyn 5.' }
        $arguments = @('-NoProfile', '-File', $fallback)
        if ($TestOnly) { $arguments += '-TestOnly' }
        & $pwsh.Source @arguments
    }
    exit $LASTEXITCODE
}
$env:DOTNET_CLI_TELEMETRY_OPTOUT = '1'
$env:DOTNET_NOLOGO = '1'
$env:DOTNET_CLI_HOME = Join-Path $projectRoot '.tools\dotnet-home'
$env:NUGET_PACKAGES = Join-Path $projectRoot '.tools\nuget-packages'
Push-Location (Join-Path $projectRoot 'native')
try {
    if (Test-Path -LiteralPath 'packages.lock.json') { & $sdk restore --locked-mode }
    else { & $sdk restore --use-lock-file }
    if ($LASTEXITCODE -ne 0) { throw 'Native dependency restore failed.' }
    & $sdk build -c Release --no-restore
    if ($LASTEXITCODE -ne 0) { throw 'Native build failed.' }
    & (Join-Path $projectRoot 'native\bin\Release\net10.0-windows10.0.19041.0\win-x64\Sapphire.Native.exe') --self-test
    if ($LASTEXITCODE -ne 0) { throw 'Native self-test failed.' }
    if (-not $TestOnly) {
        & $sdk publish -c Release --no-restore -o (Join-Path $projectRoot 'native\publish\win-x64')
        if ($LASTEXITCODE -ne 0) { throw 'Native publish failed.' }
    }
}
finally { Pop-Location }
