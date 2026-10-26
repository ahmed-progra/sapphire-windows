# Sapphire Windows helper

This helper runs as an unelevated child of Electron. It accepts UTF-8 newline-delimited JSON on stdin and writes JSON responses and events to stdout. Closing stdin ends the process and stops foreground-window tracking.

```json
{"id":1,"method":"battery.get","params":{}}
```

Responses are `{ "id": 1, "result": ... }` or `{ "id": 1, "error": { "code": "...", "message": "..." } }`. IDs must be nonnegative integers, `params` must be an object, input is limited to 64 KiB/depth 16, and methods are allowlisted. No command executes a shell, loads user code, starts another process, installs a driver, or elevates privileges.

The existing 100 ms Snap Zones observer also emits `{ "event": "foreground-changed" }` once when another visible application becomes foreground. This event has no request ID or window metadata. Electron can reassert its own topmost policy without activating its window; hidden, suspended, minimized and modal-dialog states suppress that action.

## Build

The project pins .NET SDK **10.0.402** in `global.json`. Use that SDK or place its Windows x64 distribution in the repository's ignored `.tools/dotnet` directory. Official SDK download: `https://builds.dotnet.microsoft.com/dotnet/Sdk/10.0.402/dotnet-sdk-10.0.402-win-x64.zip`.

SDK ZIP SHA-512: `ae4fd528cb7e9f6af6aaf7de36715a69f761f183744f1bb3025d19f5a92447090ec561410e46266c1d10a63781ed6f3de771760bc76c876d87daabc367b898cd`.

Run `powershell -NoProfile -File scripts/build-native.ps1` from the repository root. With the pinned SDK present it restores, builds, runs the validation self-test, and publishes a self-contained `native/publish/win-x64/Sapphire.Native.exe`. Package versions are exact. The first SDK restore creates `packages.lock.json`; subsequent SDK restores use `--locked-mode`. This SDK path has not been run on the current machine because no SDK is installed.

The verified local build uses `native/build-with-roslyn.ps1` automatically when SDK 10.0.402 is absent. The wrapper launches PowerShell 7 when invoked through Windows PowerShell. This fallback requires the existing PowerShell **7.6.5** distribution (Roslyn assembly **5.0.0.0**) and installed **.NET 10.0.10 + WindowsDesktop 10.0.10** runtime files. Compiler, System.Management and System.CodeDom hashes must match `dependency-lock.json`; it downloads only the four exact NuGet packages recorded there, verifies their SHA-512 hashes, compiles using Roslyn, binds the official Microsoft apphost, and copies the complete runtime into the output folder. It makes no global toolchain changes. End users run the bundled helper without installing .NET or PowerShell. The fallback's tested dependency lock is `dependency-lock.json`, distinct from the SDK-generated NuGet lockfile.

Fallback builds emit `build-manifest.json` containing compiler/runtime versions and SHA-256 hashes for dependencies, source files, output binaries and licenses. Redistributable notices are copied to `publish/win-x64/licenses/`; see [the notice index](licenses/README.md). The fallback emits CS1701 reference-unification warnings because the Windows SDK projection targets .NET 8/9 while the bundled runtime is .NET 10; the relevant WinRT calls passed the runtime probes below.

Launch with `Sapphire.Native.exe --parent-pid=<Electron main PID>`. This binds the Hello owner window and excludes the notch from snapping. The helper remembers the last foreground window outside itself and Electron; `snap.apply` does not accept arbitrary window handles.

## Commands

| Method | Parameters / result |
|---|---|
| `native.capabilities` | Direct map of `media`, `audio`, `snap`, `brightness`, `battery`, `bluetooth`, `hello`, `notifications` to `{available,reason?}`. Probes real APIs. |
| `media.get` | Current Windows media-session metadata or `null`; timeline in seconds, media-control flags, thumbnail data URL when obtainable. `volume` is the actual default output's 0–100 volume or `null`, and `volumeSource` is `system-output`. No lyrics are invented. |
| `media.control` | `action`: `toggle`, `play`, `pause`, `next`, `previous`, `seek`; seek also needs `position` in seconds relative to the current timeline start. Converts to Windows' absolute timestamp and rejects positions outside the timeline or provider's current seek range. Reports unsupported/rejected controls. |
| `audio.get` | `{sessions,devices}`; volumes and peaks are 0–1. Device/session IDs are opaque Core Audio identifiers. |
| `audio.volume` | Session `id`, `volume` 0–1, optional `muted` boolean. Reads back resulting volume/mute. |
| `audio.deviceVolume` | Output `id`, `volume` 0–1, optional `muted`; reads back values. |
| `snap.apply` | `layout`: `left`, `right`, `maximize`, `center`, `top-left`, `top-right`, `bottom-left`, `bottom-right`. Uses the target monitor's work area and physical pixels. Confirms observed bounds and reports constraints/errors. |
| `brightness.get` / `brightness.set` | Windows WMI-supported active displays only; set needs `value` 0–100. Result `{available:true,value}`. Unsupported displays return an error. |
| `battery.get` | `{percent:number|null,charging:boolean,available:boolean}` from `GetSystemPowerStatus`. A desktop without a reported battery returns `available:false`. |
| `bluetooth.list` | Paired Classic/LE device metadata and actual connected state. `battery` is `null`: Windows exposes no documented universal AssociationEndpoint battery property. No scanning, pairing, connection changes or invented battery values. |
| `hello.availability` | `{available,status,reason,faceEnrolled,faceReason,biometricsDisabledByPolicy}`. Facial enrollment and policy can be unknown (`null`); generic availability can be PIN and does not prove face hardware support. |
| `hello.verify` | `windowHandle`: decimal HWND string belonging to the Electron parent. Returns `{verified,status}` from the OS authentication dialog; cancellation is not success. |
| `notifications.access` | Explicitly requests notification-listener consent on an STA Windows UI thread. Only call after a user asks to enable notification access. Returns `{allowed,status}`. |
| `notifications.list` | Reads up to 100 current toast notifications only after access is already allowed; returns `id`, `app`, `title`, `body`, ISO `timestamp`. It never requests permission automatically. |

## Dependencies and platform boundaries

- NAudio.Wasapi/Core 2.2.1 supply documented Core Audio COM interop. The SDK project pins System.Management 10.0.0. The verified fallback instead uses PowerShell's hash-locked System.Management assembly 10.0.0.5 and System.CodeDom 10.0.0.0; exact file versions are included in its manifest.
- Media uses Windows GSMTC. An MSIX package must declare `globalMediaControl`; applications without media-session support do not appear. [Microsoft media-session API](https://learn.microsoft.com/en-us/uwp/api/windows.media.control.globalsystemmediatransportcontrolssessionmanager).
- Bluetooth package permissions and radio presence affect available device information. Battery Service reads and radio power controls are not implemented. The paired-device query uses Microsoft's documented `System.Devices.Aep.IsConnected` and `System.Devices.Aep.IsPaired` properties.
- Hello is Windows user verification (PIN/biometrics as configured), not webcam face recognition or replacement Windows login. [Desktop Hello interop](https://learn.microsoft.com/en-us/uwp/api/windows.security.credentials.ui.userconsentverifier).
- Per-app EQ, simultaneous multi-device output, universal battery charge limits, Apple XDR boost and secure-lock-screen overlays are outside standard APIs and are not implemented here.
- Notification access is queried before reading. Installed packages should declare `userNotificationListener`; the helper reports the actual OS access result and only invokes its permission request from `notifications.access`. A successful read in this development context does not validate an installed application's permission identity.
- No clean VM or installed-package validation has been performed. The current development machine is not an isolated Windows VM, so local build evidence does not satisfy that release gate.

## Verified checks on 2026-10-25

Run `node native/test-protocol.cjs` after building. Logs summarize results without exposing media titles, notification content, Bluetooth names or identifiers.

- **15 pure validation checks:** JSON request shape, typed/ranged volume, snap allowlist, missing ID, negative monitor origins, work area, odd pixel geometry and media seek ranges.
- **9 owned-window checks:** all eight snap layouts position a hidden fixture window; it remains hidden and foreground focus is preserved. Personal application windows are never touched by this fixture.
- **2 owned audio checks:** create an actual silent WASAPI session, change only that process's session volume/mute, read them back, restore values and stop playback. Master/device volume is untouched.
- **17 protocol checks:** invalid commands/parameters and missing sessions/devices return errors; subsequent read-only requests still work; EOF exits cleanly. `DOTNET_ROOT` was deliberately pointed at a nonexistent path and the process reported loading its local bundled CoreLib.
- **10 owned SMTC checks:** `pwsh -NoProfile -File native/build-with-roslyn.ps1 -MediaFixture` compiles a separate test executable in `native/test-output/media/` without touching production publish. It registers a real Windows SMTC session on an owned hidden window and verifies metadata, timeline, pause, play, seek and delivered transport events through `MediaServices`. Its timeline starts at 15 seconds: a relative seek to 37 must reach the provider at absolute 52. Three positions beyond the timeline or provider's seek range must fail before sending an OS command. The same nonzero-start fixture failed before the offset fix and passed afterward. The service binds directly to the unique fixture session, so it cannot control a personal session even if Windows changes the active player. The fixture disables its controls and destroys its window on exit; it emits no audio.
- Real read probes returned one audio output, live battery/brightness telemetry, two paired Bluetooth devices, Windows Hello availability, and already-authorized notification access. The media session was absent and correctly returned `null`.

Still unverified: interoperability with third-party media players and their supported controls; real Hello verification/cancellation; permission denial/revocation in an installed package; device/master-volume mutations; display brightness changes; elevated/constrained external-window behavior; hardware removal; multi-monitor mixed-DPI runtime behavior; clean Windows VM installation. These are runtime acceptance gates, not success claims.
