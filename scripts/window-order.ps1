param([Parameter(Mandatory=$true)][long]$Notch, [Parameter(Mandatory=$true)][long]$Other, [switch]$NoShell)
$ErrorActionPreference = 'Stop'
Add-Type @'
using System;
using System.Runtime.InteropServices;
public static class WindowOrder {
 [DllImport("user32.dll")] public static extern IntPtr GetWindow(IntPtr window, uint command);
 [DllImport("user32.dll")] public static extern IntPtr GetForegroundWindow();
 [DllImport("user32.dll")] public static extern int GetWindowLong(IntPtr window, int index);
 [DllImport("user32.dll")] public static extern bool IsWindow(IntPtr window);
 [DllImport("user32.dll", CharSet=CharSet.Unicode)] public static extern IntPtr FindWindow(string className, string name);
 [DllImport("user32.dll")] public static extern IntPtr SetThreadDpiAwarenessContext(IntPtr context);
 [StructLayout(LayoutKind.Sequential)] public struct Rect {public int left,top,right,bottom;}
 [DllImport("user32.dll")] public static extern bool GetWindowRect(IntPtr window, out Rect rect);
}
'@
if (-not [WindowOrder]::IsWindow([IntPtr]$Notch) -or -not [WindowOrder]::IsWindow([IntPtr]$Other)) { throw 'A fixture window has closed.' }
$found=$false
$cursor=[WindowOrder]::GetWindow([IntPtr]$Other,3)
for($i=0;$i -lt 10000 -and $cursor -ne [IntPtr]::Zero;$i++) {
 if($cursor.ToInt64() -eq $Notch){$found=$true;break}
 $cursor=[WindowOrder]::GetWindow($cursor,3)
}
$taskbar=[WindowOrder]::FindWindow('Shell_TrayWnd',$null)
if($taskbar -eq [IntPtr]::Zero -and -not $NoShell){throw 'Windows taskbar was not found.'}
$taskbarAbove=$false
$cursor=[WindowOrder]::GetWindow([IntPtr]$Notch,3)
for($i=0;$i -lt 10000 -and $cursor -ne [IntPtr]::Zero;$i++){
 if($cursor -eq $taskbar){$taskbarAbove=$true;break}
 $cursor=[WindowOrder]::GetWindow($cursor,3)
}
$oldDpi=[WindowOrder]::SetThreadDpiAwarenessContext([IntPtr](-4))
$notchRect=[WindowOrder+Rect]::new();$barRect=[WindowOrder+Rect]::new()
try{
 if(-not [WindowOrder]::GetWindowRect([IntPtr]$Notch,[ref]$notchRect)){throw 'Window bounds could not be read.'}
 if($taskbar -ne [IntPtr]::Zero -and -not [WindowOrder]::GetWindowRect($taskbar,[ref]$barRect)){throw 'Taskbar bounds could not be read.'}
}finally{[void][WindowOrder]::SetThreadDpiAwarenessContext($oldDpi)}
$intersects=$notchRect.left -lt $barRect.right -and $notchRect.right -gt $barRect.left -and $notchRect.top -lt $barRect.bottom -and $notchRect.bottom -gt $barRect.top
Add-Type -AssemblyName UIAutomationClient
Add-Type -AssemblyName UIAutomationTypes
$buttons=$null
if($taskbar -ne [IntPtr]::Zero){
 $bar=[System.Windows.Automation.AutomationElement]::FromHandle($taskbar)
 $condition=[System.Windows.Automation.PropertyCondition]::new([System.Windows.Automation.AutomationElement]::AutomationIdProperty,'Appid: tech.sapphire.windows')
 $buttons=$bar.FindAll([System.Windows.Automation.TreeScope]::Descendants,$condition).Count
}
@{notchAboveFixture=$found;topmost=([WindowOrder]::GetWindowLong([IntPtr]$Notch,-20) -band 8) -ne 0;foreground=[WindowOrder]::GetForegroundWindow().ToInt64().ToString();taskbarAvailable=$taskbar -ne [IntPtr]::Zero;taskbarAboveNotch=$taskbarAbove;intersectsTaskbar=$intersects;taskbarButtons=$buttons} | ConvertTo-Json -Compress
