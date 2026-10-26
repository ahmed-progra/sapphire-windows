# Release verification

## V1 / 1.1.0

The public release is built from its tagged source. Local automated checks and hosted CI are separate evidence; the release notes record final results and hashes.

| Check | Scope |
| --- | --- |
| Node tests | Storage validation/recovery, native protocol inputs, provider fixtures, appearance/contrast |
| Production build | TypeScript, renderer assets, Electron main/preload |
| Native build | Pinned inputs, helper self-test, bundled runtime |
| Packaged smoke | Private desktop/profile, first launch/restart, 15 widgets, themes, motion/input, lifecycle, helper cleanup |
| Package inspection | Version, native resources, security fuses, notices, hashes |

```powershell
powershell -NoProfile -File scripts/test-desktop.ps1 -Executable release/win-unpacked/Sapphire.exe
```

Inspect `.test-output/desktop-<timestamp>/result.json` for explicit pass/fail and exit codes. Failure-injection logs are intentional; the final report must pass. Keep full logs local because diagnostics may include device context.

The previous source candidate passed 44 Node tests, production compilation, and both desktop smoke phases on 2026-10-26. That historical result does not qualify a new package; V1 is checked again before publication.

## Remaining manual checks

- Clean Windows installation/uninstall and minimum OS qualification.
- Physical taskbar/Alt+Tab, sleep/wake, monitor hot-plug, mixed DPI.
- Long-duration ordinary-use stability.
- Real Spotify OAuth, Gemini voice, finance/sports access, third-party media players.
- Actual camera/microphone, biometric verification, permission revocation, Bluetooth transitions, display-brightness changes.
- Code signing: this release is unsigned.

Private-desktop automation does not prove these conditions.
