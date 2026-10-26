# Native dependency notices

These notices accompany the native helper output. They do not replace Sapphire's upstream attribution or repository license.

| Component | Version used for this build | License/notice |
|---|---|---|
| .NET runtime, apphost, WindowsDesktop runtime | 10.0.10 | `dotnet-runtime-LICENSE.txt`, `dotnet-runtime-THIRD-PARTY-NOTICES.txt`, `dotnet-library-LICENSE.txt`, `dotnet-library-ThirdPartyNotices.txt` |
| System.Management, System.CodeDom | Assembly 10.0.0.5 / 10.0.0.0 from PowerShell 7.6.5, hashes locked in `dependency-lock.json` | .NET MIT license plus PowerShell distribution notices |
| Microsoft.Windows.SDK.NET.Ref | 10.0.19041.87 | `Windows-SDK-LICENSE.rtf` from the package's [license URL](https://aka.ms/WinSDKLicenseURL) |
| WinRT.Runtime / C#/WinRT | Shipped inside the pinned Windows SDK package; exact DLL hash in build-manifest.json | `CsWinRT-LICENSE.txt` plus Windows SDK notice |
| NAudio.Core, NAudio.Wasapi | 2.2.1 | `NAudio-LICENSE.txt`, Mark Heath; MIT |
| Build-only Roslyn compiler, PowerShell | Roslyn assembly 5.0.0.0, PowerShell 7.6.5 | `powershell-LICENSE.txt`, `powershell-ThirdPartyNotices.txt`; compiler is not bundled in the application |

The build manifest records SHA-256 hashes for the emitted helper, runtime files, and managed dependencies. The dependency lock records SHA-512 hashes for the NuGet archives and SHA-256 hashes for compiler dependencies. No downloaded executables run before those hashes are checked.

Upstream sources: [.NET runtime 10.0.10](https://github.com/dotnet/runtime/tree/v10.0.10), [NAudio 2.2.1](https://github.com/naudio/NAudio/tree/v2.2.1), [C#/WinRT](https://github.com/microsoft/CsWinRT), [PowerShell 7.6.5](https://github.com/PowerShell/PowerShell/tree/v7.6.5).
