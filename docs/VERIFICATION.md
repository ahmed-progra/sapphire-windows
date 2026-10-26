# Release verification

Current release: [1.2.0 verification and tool audit](VERIFICATION-1.2.md). The 1.1.0 results below are historical.

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

V1 was checked on 2026-10-26:

- **44 Node tests passed**, zero failures; production TypeScript/renderer build passed.
- The pinned fallback native build passed 15 validation checks. The protocol suite passed 9 owned-window checks, 2 owned silent-audio checks, and 17 protocol checks, with clean helper shutdown.
- The **packaged 1.1.0 app** passed initial and restart smoke phases, both exit code 0, in a private Windows desktop/profile. The suite covers all 15 widgets, ten themes, motion, input, persistence, lifecycle, recovery, and helper cleanup.
- Packaged version, required scripts/notices, native helper hash, personal-data exclusions, and five security fuses passed inspection. The ZIP executable, app archive, and native helper matched the tested unpacked directory byte-for-byte.
- Gitleaks **8.30.1** found no secrets in the public source snapshot. The runtime `npm audit --omit=dev` reported zero vulnerabilities. The full build-tool audit reported three moderate findings through Tailwind/PostCSS selector parsing; resolving those through npm's suggested fix requires a major Tailwind upgrade. No high or critical findings were reported. Audits are point-in-time checks, not security guarantees.
- [Windows CI](https://github.com/ahmed-progra/sapphire-windows/actions/runs/40291042939) passed fresh dependency installation, tests, production build, and the standard **.NET SDK 10.0.402** native build. Local release binaries use the separately documented pinned fallback build.

See the release's `SHA256SUMS.txt` for final installer and ZIP identities. Generated logs and private machine diagnostics are deliberately excluded from source control.

## Remaining manual checks

- Clean Windows installation/uninstall and minimum OS qualification.
- Physical taskbar/Alt+Tab, sleep/wake, monitor hot-plug, mixed DPI.
- Long-duration ordinary-use stability.
- Real Spotify OAuth, Gemini voice, finance/sports access, third-party media players.
- Actual camera/microphone, biometric verification, permission revocation, Bluetooth transitions, display-brightness changes.
- Code signing: this release is unsigned.

Private-desktop automation does not prove these conditions.
