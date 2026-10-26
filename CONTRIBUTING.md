# Contributing

Keep issues and pull requests focused. Include the user-visible problem, reproduction steps, and checks you ran. Never attach profiles, credentials, private notification contents, or unredacted screenshots.

## Environment

Use Windows x64, Node.js **24.16.0** (`.node-version`), and .NET SDK **10.0.402** (`native/global.json`). `npm ci` uses the committed JavaScript lockfile. `npm run build:native` builds and self-tests the helper. The SDK route creates a NuGet lockfile on first restore if absent and uses locked restores afterward; review that lockfile when updating dependencies.

The alternative hash-checked build uses PowerShell 7.6.5 and .NET/WindowsDesktop 10.0.10. See [native/README.md](native/README.md). This is the local V1 packaging path.

```powershell
npm ci
npm run build:native
npm test
npm run build
npm run dev
```

## Architecture

| Directory | Responsibility |
| --- | --- |
| `src/` | React widgets and accessible interactions |
| `electron/` | Main process, preload bridge, storage, providers, themes |
| `native/` | Unelevated C# helper for supported Windows APIs |
| `tests/` | Regression tests with synthetic data |
| `scripts/` | Build, packaging, desktop verification |
| `docs/` | User guides and verification boundaries |

Keep privileged operations behind the validated preload/IPC allowlist. Preserve input bounds, storage rollback, visible errors, opt-in capture, reduced motion, and keyboard access. Never fabricate device or provider success. The renderer remains sandboxed with Node integration disabled.

## Verification

1. Run `npm test` and `npm run build`.
2. For native changes, rebuild and run `node native/test-protocol.cjs` on a suitable Windows test machine. Owned audio/window fixtures do not replace hardware acceptance.
3. For desktop changes, run `npm run test:desktop:isolated`. It uses a private desktop and profile; inspect the final `result.json`.
4. For packaging changes, build both outputs and smoke-test `release/win-unpacked/Sapphire.exe` through `scripts/test-desktop.ps1 -Executable ...`.
5. Update relevant documentation and add a focused regression check for behavior changes.

CI checks JavaScript tests, renderer compilation, and the standard SDK build on Windows. Physical monitor, microphone, biometric, and real provider-account checks remain separate. Contributions use the repository's [AGPL-3.0 license](LICENSE); preserve attribution.
