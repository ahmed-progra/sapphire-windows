# Installing Sapphire

## Downloads

Use [this repository's latest release](https://github.com/ahmed-progra/sapphire-windows/releases/latest).

| File | Purpose |
| --- | --- |
| `Sapphire-1.1.0-win-x64-Setup.exe` | Recommended installer with Start menu and desktop shortcuts |
| `Sapphire-1.1.0-win-x64.zip` | Extract everything, then open `Sapphire.exe` |
| `SHA256SUMS.txt` | Hashes for the published binaries |
| GitHub source archives | Exact tagged source for rebuilding |

Windows 11 x64 is recommended. The native minimum target is Windows 10 build 19041; minimum-version and clean-VM acceptance are pending. No ARM64/x86, Linux, or macOS packages are provided. Runtimes are bundled; users need no SDK or Node.js.

The ZIP uses the ordinary Windows profile for settings. It does not keep all data beside the executable and is not a self-contained USB profile.

## Verify and launch

```powershell
Get-FileHash .\Sapphire-1.1.0-win-x64-Setup.exe -Algorithm SHA256
```

Compare with the matching entry in `SHA256SUMS.txt`. Binaries are **unsigned**, so Windows may display a publisher warning. Confirm the source and hash before deciding whether to run the file. Do not disable antivirus or SmartScreen.

Install or extract completely, then launch. Sapphire starts in the tray (including hidden notification icons). Click the tray icon or press **Ctrl+Shift+S** to show it. If another app owns the shortcut, change it in Settings. Hover or click to expand.

Close/minimize hides the panel. **Quit** in the tray menu exits. Startup with Windows is off until enabled in Settings.

## Updates and removal

Export data from Settings before upgrading. Quit the running copy, then install the new version into the same directory. For ZIP updates, extract to a new folder and launch after quitting the old instance. There is no automatic updater.

The application uses Electron's Windows user-data folder (`%APPDATA%\sapphire-windows` with the current application name). Ordinary data lives in `sapphire-data.json`, credentials separately in `credentials.json`. Preserve the entire profile before maintenance; never attach it to public bug reports.

Use Windows **Settings → Apps → Installed apps → Sapphire → Uninstall**, or delete the ZIP's extracted folder after quitting. Profile data may remain; deleting the profile permanently deletes its data and credentials.

## Troubleshooting

| Symptom | Check |
| --- | --- |
| No visible window | Tray/hidden icons → Show; startup is intentionally hidden |
| Shortcut fails | Another application may own it; change it in Settings |
| Native feature unavailable | Use Electron, preserve the full directory, check hardware and Windows permissions |
| Network feature fails | Location, key, account entitlement, connection, and visible provider error |
| Notes cannot save | Preserve the recovery draft and resolve storage errors before retrying |
| Wrong monitor/position | Re-select the display and report resolution/scaling |

Report app/Windows versions, architecture, steps, and redacted errors/screenshots. Do not share profiles or credentials.
