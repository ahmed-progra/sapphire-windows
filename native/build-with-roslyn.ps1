param([switch]$TestOnly, [switch]$MediaFixture)
$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
$packageRoot = Join-Path $projectRoot '.tools\native-packages'
$publishRoot = if ($MediaFixture) { Join-Path $PSScriptRoot 'test-output\media' } else { Join-Path $PSScriptRoot 'publish\win-x64' }
$dotnetRoot = Join-Path $env:ProgramFiles 'dotnet'
$runtimeVersion = '10.0.10'
$coreRoot = Join-Path $dotnetRoot ('shared\Microsoft.NETCore.App\' + $runtimeVersion)
$desktopRoot = Join-Path $dotnetRoot ('shared\Microsoft.WindowsDesktop.App\' + $runtimeVersion)
if ($PSVersionTable.PSEdition -ne 'Core' -or -not (Test-Path -LiteralPath (Join-Path $PSHOME 'Microsoft.CodeAnalysis.CSharp.dll'))) { throw 'The SDK-less fallback requires PowerShell 7 with bundled Roslyn. Install SDK 10.0.402 for the normal build.' }
if (-not (Test-Path -LiteralPath $coreRoot) -or -not (Test-Path -LiteralPath $desktopRoot)) { throw 'The SDK-less fallback requires the pinned .NET/WindowsDesktop 10.0.10 runtimes.' }
$dependencyLock = Get-Content -LiteralPath (Join-Path $PSScriptRoot 'dependency-lock.json') -Raw | ConvertFrom-Json
New-Item -ItemType Directory -Path $packageRoot -Force | Out-Null
foreach ($package in $dependencyLock.packages) {
    $archivePath = Join-Path $packageRoot ($package.id + '.' + $package.version + '.nupkg')
    if (-not (Test-Path -LiteralPath $archivePath)) {
        $uri = 'https://api.nuget.org/v3-flatcontainer/' + $package.id + '/' + $package.version + '/' + $package.id + '.' + $package.version + '.nupkg'
        Write-Output ('Downloading pinned native dependency: ' + $package.id + ' ' + $package.version)
        Invoke-WebRequest -Uri $uri -OutFile $archivePath -TimeoutSec 600 -ErrorAction Stop
    }
    $actual = [Convert]::ToBase64String([Convert]::FromHexString((Get-FileHash -LiteralPath $archivePath -Algorithm SHA512).Hash))
    if ($actual -ne $package.sha512) { throw ('Package content hash mismatch: ' + $package.id) }
    $extractedPath = Join-Path $packageRoot ($package.id + '.' + $package.version)
    if (-not (Test-Path -LiteralPath $extractedPath)) { Expand-Archive -LiteralPath $archivePath -DestinationPath $extractedPath }
}
foreach ($assembly in $dependencyLock.installedAssemblies.PSObject.Properties) {
    if ((Get-FileHash -LiteralPath (Join-Path $PSHOME $assembly.Name) -Algorithm SHA256).Hash.ToLowerInvariant() -ne $assembly.Value) { throw ('Installed compiler/runtime dependency hash mismatch: ' + $assembly.Name) }
}
[Reflection.Assembly]::LoadFrom((Join-Path $PSHOME 'Microsoft.CodeAnalysis.dll')) | Out-Null
$compiler = [Reflection.Assembly]::LoadFrom((Join-Path $PSHOME 'Microsoft.CodeAnalysis.CSharp.dll'))
if ($compiler.GetName().Version.ToString() -ne '5.0.0.0') { throw 'The fallback requires the pinned Roslyn 5.0.0.0 compiler.' }
$projectionRoot = Join-Path $packageRoot 'microsoft.windows.sdk.net.ref.10.0.19041.87'
$sdkProjection = Get-ChildItem -LiteralPath $projectionRoot -Recurse -Filter 'Microsoft.Windows.SDK.NET.dll' | Where-Object FullName -Match 'net8\.0' | Select-Object -First 1
if (-not $sdkProjection) { $sdkProjection = Get-ChildItem -LiteralPath $projectionRoot -Recurse -Filter 'Microsoft.Windows.SDK.NET.dll' | Select-Object -First 1 }
$winrtRuntime = Get-ChildItem -LiteralPath $projectionRoot -Recurse -Filter 'WinRT.Runtime.dll' | Where-Object FullName -Match 'net8\.0' | Select-Object -First 1
if (-not $winrtRuntime) { $winrtRuntime = Get-ChildItem -LiteralPath $projectionRoot -Recurse -Filter 'WinRT.Runtime.dll' | Select-Object -First 1 }
$wasapi = Join-Path $packageRoot 'naudio.wasapi.2.2.1\lib\netstandard2.0\NAudio.Wasapi.dll'
$audioCore = Join-Path $packageRoot 'naudio.core.2.2.1\lib\netstandard2.0\NAudio.Core.dll'
$management = Join-Path $PSHOME 'System.Management.dll'
$codeDom = Join-Path $PSHOME 'System.CodeDom.dll'
$dependencies = @($sdkProjection.FullName,$winrtRuntime.FullName,$wasapi,$audioCore,$management,$codeDom)
foreach ($dependency in $dependencies) { if (-not $dependency -or -not (Test-Path -LiteralPath $dependency)) { throw ('Missing fallback dependency: ' + $dependency) } }
New-Item -ItemType Directory -Path $publishRoot -Force | Out-Null
$references = [Collections.Generic.List[Microsoft.CodeAnalysis.MetadataReference]]::new()
$allReferences = @((Get-ChildItem -LiteralPath $coreRoot -Filter '*.dll').FullName) + @((Get-ChildItem -LiteralPath $desktopRoot -Filter '*.dll').FullName) + $dependencies
$referencePaths = @{}
foreach ($path in $allReferences) { $referencePaths[[IO.Path]::GetFileName($path)] = $path }
foreach ($path in $referencePaths.Values) {
    try { [Reflection.AssemblyName]::GetAssemblyName($path) | Out-Null; $references.Add([Microsoft.CodeAnalysis.MetadataReference]::CreateFromFile($path)) }
    catch [BadImageFormatException] { }
}
$parseOptions = [Microsoft.CodeAnalysis.CSharp.CSharpParseOptions]::Default.WithLanguageVersion([Microsoft.CodeAnalysis.CSharp.LanguageVersion]::CSharp14)
$trees = [Collections.Generic.List[Microsoft.CodeAnalysis.SyntaxTree]]::new()
foreach ($file in (Get-ChildItem -LiteralPath $PSScriptRoot -Filter '*.cs')) { $trees.Add([Microsoft.CodeAnalysis.CSharp.CSharpSyntaxTree]::ParseText((Get-Content -LiteralPath $file.FullName -Raw),$parseOptions,$file.FullName,[Text.Encoding]::UTF8)) }
if ($MediaFixture) { $fixtureSource = Join-Path $PSScriptRoot 'tests\MediaFixture.cs'; $trees.Add([Microsoft.CodeAnalysis.CSharp.CSharpSyntaxTree]::ParseText((Get-Content -LiteralPath $fixtureSource -Raw),$parseOptions,$fixtureSource,[Text.Encoding]::UTF8)) }
$trees.Add([Microsoft.CodeAnalysis.CSharp.CSharpSyntaxTree]::ParseText('global using System; global using System.Collections.Generic; global using System.IO; global using System.Linq; global using System.Threading; global using System.Threading.Tasks;',$parseOptions))
$options = [Microsoft.CodeAnalysis.CSharp.CSharpCompilationOptions]::new([Microsoft.CodeAnalysis.OutputKind]::ConsoleApplication).WithOptimizationLevel([Microsoft.CodeAnalysis.OptimizationLevel]::Release).WithNullableContextOptions([Microsoft.CodeAnalysis.NullableContextOptions]::Enable)
if ($MediaFixture) { $options = $options.WithMainTypeName('Sapphire.Native.Tests.MediaFixture'); }
$compilation = [Microsoft.CodeAnalysis.CSharp.CSharpCompilation]::Create('Sapphire.Native',$trees.ToArray(),$references.ToArray(),$options)
$assemblyPath = Join-Path $publishRoot 'Sapphire.Native.dll'
$stream = [IO.File]::Create($assemblyPath)
try { $result = $compilation.Emit($stream) } finally { $stream.Dispose() }
$result.Diagnostics | Where-Object Severity -In @('Error','Warning') | ForEach-Object { $_.ToString() } | Select-Object -Unique
if (-not $result.Success) { throw 'Native Roslyn compilation failed.' }
foreach ($root in @($coreRoot,$desktopRoot)) { Get-ChildItem -LiteralPath $root -File | ForEach-Object { Copy-Item -LiteralPath $_.FullName -Destination $publishRoot -Force } }
foreach ($dependency in $dependencies) { Copy-Item -LiteralPath $dependency -Destination $publishRoot -Force }
Copy-Item -LiteralPath (Join-Path $dotnetRoot ('host\fxr\' + $runtimeVersion + '\hostfxr.dll')) -Destination $publishRoot -Force
$licenseRoot = Join-Path $publishRoot 'licenses'
New-Item -ItemType Directory -Path $licenseRoot -Force | Out-Null
Get-ChildItem -LiteralPath (Join-Path $PSScriptRoot 'licenses') -File | ForEach-Object { Copy-Item -LiteralPath $_.FullName -Destination $licenseRoot -Force }
$runtimeConfig = @{runtimeOptions=@{tfm='net10.0';includedFrameworks=@(@{name='Microsoft.NETCore.App';version=$runtimeVersion},@{name='Microsoft.WindowsDesktop.App';version=$runtimeVersion});configProperties=@{'System.Runtime.Serialization.EnableUnsafeBinaryFormatterSerialization'=$false}}}
$runtimeConfig | ConvertTo-Json -Depth 6 | Set-Content -LiteralPath (Join-Path $publishRoot 'Sapphire.Native.runtimeconfig.json') -Encoding utf8
$template = Join-Path $packageRoot 'microsoft.netcore.app.host.win-x64.10.0.10\runtimes\win-x64\native\apphost.exe'
$apphost = [IO.File]::ReadAllBytes($template)
$placeholder = [Text.Encoding]::UTF8.GetBytes('c3ab8ff13720e8ad9047dd39466b3c8974e592c2fa383d4a3960714caef0c4f2')
$replacement = [Text.Encoding]::UTF8.GetBytes('Sapphire.Native.dll')
$found = -1
for ($offset=0; $offset -le $apphost.Length-$placeholder.Length; $offset++) { if ($apphost[$offset] -ne $placeholder[0]) { continue }; $match=$true; for ($j=1;$j -lt $placeholder.Length;$j++) { if ($apphost[$offset+$j] -ne $placeholder[$j]) { $match=$false; break } }; if ($match) { $found=$offset; break } }
if ($found -lt 0) { throw 'Microsoft apphost template binding placeholder is absent.' }
[Array]::Clear($apphost,$found,$placeholder.Length)
[Array]::Copy($replacement,0,$apphost,$found,$replacement.Length)
$executable = Join-Path $publishRoot 'Sapphire.Native.exe'
[IO.File]::WriteAllBytes($executable,$apphost)
$manifest = @{mode='installed-roslyn-runtime';compilerVersion=$compiler.GetName().Version.ToString();powerShellVersion=$PSVersionTable.PSVersion.ToString();runtimeVersion=$runtimeVersion;target='net10.0-windows10.0.19041.0/win-x64';compilerSha256=(Get-FileHash -LiteralPath $compiler.Location -Algorithm SHA256).Hash;dependencies=@($dependencies | ForEach-Object { @{name=[IO.Path]::GetFileName($_);fileVersion=[Diagnostics.FileVersionInfo]::GetVersionInfo($_).FileVersion;sha256=(Get-FileHash -LiteralPath $_ -Algorithm SHA256).Hash} });outputFiles=@(Get-ChildItem -LiteralPath $publishRoot -File | Where-Object Extension -In @('.dll','.exe','.json') | Where-Object Name -NE 'build-manifest.json' | Sort-Object Name | ForEach-Object { @{name=$_.Name;sha256=(Get-FileHash -LiteralPath $_.FullName -Algorithm SHA256).Hash} });sourceFiles=@(Get-ChildItem -LiteralPath $PSScriptRoot -File | Where-Object Extension -In @('.cs','.csproj','.ps1','.json') | Sort-Object Name | ForEach-Object { @{name=$_.Name;sha256=(Get-FileHash -LiteralPath $_.FullName -Algorithm SHA256).Hash} });licenses=@(Get-ChildItem -LiteralPath $licenseRoot -File | Sort-Object Name | ForEach-Object { @{name=$_.Name;sha256=(Get-FileHash -LiteralPath $_.FullName -Algorithm SHA256).Hash} })}
$manifest | ConvertTo-Json -Depth 6 | Set-Content -LiteralPath (Join-Path $publishRoot 'build-manifest.json') -Encoding utf8
& $executable --self-test
if ($LASTEXITCODE -ne 0) { throw 'Native self-test failed.' }
Write-Output ('Self-contained native helper: ' + $executable)
