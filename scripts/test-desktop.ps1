param([string]$Executable)
$ErrorActionPreference = 'Stop'
Set-Location -LiteralPath (Split-Path -Parent $PSScriptRoot)
$testOutput = Join-Path (Get-Location) ('.test-output\desktop-' + (Get-Date -Format 'yyyyMMdd-HHmmss'))
New-Item -ItemType Directory -Path $testOutput | Out-Null
$env:SAPPHIRE_SMOKE_DIR = $testOutput
$env:SAPPHIRE_ISOLATED_DESKTOP = '1'
# Test windows run on a private desktop without switching the user's input desktop.
Add-Type @'
using System;
using System.Runtime.InteropServices;
using System.Text;
public static class SapphireTestDesktop {
 [StructLayout(LayoutKind.Sequential, CharSet=CharSet.Unicode)] public struct StartupInfo {
  public int cb; public string reserved, desktop, title;
  public int x,y,xSize,ySize,xChars,yChars,fill,flags; public short show,reservedSize;
  public IntPtr reservedPointer,input,output,error;
 }
 [StructLayout(LayoutKind.Sequential)] public struct ProcessInfo { public IntPtr process,thread; public uint pid,tid; }
 [DllImport("user32.dll",CharSet=CharSet.Unicode,SetLastError=true)] public static extern IntPtr CreateDesktop(string name,IntPtr device,IntPtr mode,uint flags,uint access,IntPtr attributes);
 [DllImport("user32.dll")] public static extern bool CloseDesktop(IntPtr desktop);
 [DllImport("kernel32.dll",CharSet=CharSet.Unicode,SetLastError=true)] public static extern bool CreateProcess(string app,StringBuilder command,IntPtr pa,IntPtr ta,bool inherit,uint flags,IntPtr environment,string directory,ref StartupInfo startup,out ProcessInfo process);
 [DllImport("kernel32.dll")] public static extern uint WaitForSingleObject(IntPtr handle,uint milliseconds);
 [DllImport("kernel32.dll")] public static extern bool GetExitCodeProcess(IntPtr process,out uint code);
 [DllImport("kernel32.dll")] public static extern bool CloseHandle(IntPtr handle);
}
'@
$desktopName = 'SapphireTest-' + [guid]::NewGuid().ToString('N')
$desktopHandle = [SapphireTestDesktop]::CreateDesktop($desktopName,[IntPtr]::Zero,[IntPtr]::Zero,0,0x01FF,[IntPtr]::Zero)
if($desktopHandle -eq [IntPtr]::Zero){throw "Cannot create isolated test desktop: $([Runtime.InteropServices.Marshal]::GetLastWin32Error())"}
$startup = New-Object SapphireTestDesktop+StartupInfo
$startup.cb = [Runtime.InteropServices.Marshal]::SizeOf($startup)
$startup.desktop = $desktopName
$processInfo = New-Object SapphireTestDesktop+ProcessInfo
$node = (Get-Command node.exe).Source
$runner = Join-Path $PSScriptRoot 'test-desktop.mjs'
$command = '"' + $node + '" "' + $runner + '"'
if($Executable){$command += ' "' + (Resolve-Path -LiteralPath $Executable).Path + '"'}
try {
 if(-not [SapphireTestDesktop]::CreateProcess($node,[Text.StringBuilder]::new($command),[IntPtr]::Zero,[IntPtr]::Zero,$false,0x08000000,[IntPtr]::Zero,(Get-Location).Path,[ref]$startup,[ref]$processInfo)){throw "Cannot start isolated smoke: $([Runtime.InteropServices.Marshal]::GetLastWin32Error())"}
 Write-Output "Isolated Windows desktop tests: $testOutput"
 while([SapphireTestDesktop]::WaitForSingleObject($processInfo.process,1000) -eq 258){}
 $nativeExit=0;[void][SapphireTestDesktop]::GetExitCodeProcess($processInfo.process,[ref]$nativeExit)
 if(Test-Path -LiteralPath (Join-Path $testOutput 'result.json')){Get-Content -LiteralPath (Join-Path $testOutput 'result.json')}
 exit $nativeExit
}finally{
 if($processInfo.thread -ne [IntPtr]::Zero){[void][SapphireTestDesktop]::CloseHandle($processInfo.thread)}
 if($processInfo.process -ne [IntPtr]::Zero){[void][SapphireTestDesktop]::CloseHandle($processInfo.process)}
 [void][SapphireTestDesktop]::CloseDesktop($desktopHandle)
}
