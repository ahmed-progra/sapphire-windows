# Sapphire 1.2.0 verification

Checks were run on Windows 11 x64 on 2026-10-26. Test profiles and fixtures are disposable. Provider fixtures are not evidence of real account access, and browser zoom is not evidence of physical monitor hot-plug or mixed DPI.

## Reproduce

```powershell
npm ci
npm test
npm run build
npm run test:widgets
npm run build:native
node native/test-protocol.cjs
npm run test:desktop:isolated
node_modules/.bin/electron.cmd scripts/test-launch.mjs legacy-102
node_modules/.bin/electron.cmd scripts/test-launch.mjs legacy-102 --restart
node_modules/.bin/electron.cmd scripts/test-launch.mjs legacy-110
node_modules/.bin/electron.cmd scripts/test-launch.mjs legacy-110 --restart
node_modules/.bin/electron.cmd scripts/test-launch.mjs startup --startup
npm run test:visible
node scripts/package.mjs release
powershell -NoProfile -File scripts/test-desktop.ps1 -Executable release/win-unpacked/Sapphire.exe
```

Build the native helper before starting native tests; Windows locks its loaded DLL. Run visible measurements with other builds/tests finished. `ELECTRON_RUN_AS_NODE` must be unset for Electron checks. The scripts assert their results and return nonzero on failure. Injected failures are expected log entries, not failed acceptance checks.

## Results

- **45 unit tests passed**, zero failures. Storage/recovery, import rollback, provider contracts, deadlines, calendar parsing, contrast and native input validation are covered.
- Production TypeScript/renderer/main/preload build passed. The pinned local native build passed 15 self-checks; native protocol verification passed 9 owned-window, 2 owned silent-audio and 17 protocol checks, with clean shutdown. It did not change the user's master volume.
- Source desktop initial/restart phases passed with exit code 0. All 15 widgets and ten themes were exercised (150 combinations), along with system theme changes, reduced motion, hover cancellation, release outside controls, rapid morph reversals, focus restoration, native bounds, topmost repair, tray recovery, renderer crashes, protected credential storage and helper cleanup.
- Twenty identical placement requests produced **zero additional native bounds or shape calls**. Topmost policy repair remains active.
- Synthetic renderer fixtures passed 12 groups of interaction checks, including failure/cancellation/persistence. Audio polling stops after leaving Audio. Navigation remains reachable at 100%, 125%, 150% and 200% renderer zoom. Forced colors, increased contrast and reduced transparency use solid surfaces.
- Disposable legacy 1.0.2/1.1.0-shaped profiles preserved Unicode notes, custom/preset theme choices and desktop settings. Manual launch was visible, the introduction persisted only after Continue, restart did not repeat it, and `--startup` stayed hidden. These are profile migration checks, not clean-VM installer tests.

Packaged acceptance, final CI, package hashes and the local installed upgrade are recorded in the release notes after completion.

## Visible-window frame pacing

`scripts/measure-visible.mjs` uses an ordinary visible, focused Electron window, a disposable profile, and 20 identical expand → switch Music/Notes → collapse sequences. The OS motion preference is overridden only in that test window so normal animation is measured. A separate idle sample calibrates the observed display interval; offscreen smoke timings are excluded.

| Run | Measured idle interval | p95 | Maximum interval | p95 target | Long tasks >50 ms |
| --- | ---: | ---: | ---: | ---: | ---: |
| Initial 1.1.0 baseline | 6.9 ms | 7.2 ms | 7.4 ms | 10.35 ms | 0 |
| Initial 1.2 candidate | 8.0 ms | 8.3 ms | 24.8 ms | 12.0 ms | 0 |
| Later 1.2 run | 16.4 ms | 16.7 ms | **81.9 ms** | 24.6 ms | 0 |
| Matched repeat: 1.1.0 | 16.4 ms | 16.7 ms | 32.7 ms | 24.6 ms | 0 |
| Matched repeat: 1.2.0 | 16.4 ms | 16.8 ms | 18.6 ms | 24.6 ms | 0 |

Windows reported a 144 Hz display, but observed Chromium pacing varied between runs. No claim of a fixed 144 fps or a measured p95 speedup is made. The matched repeat met both targets. The earlier 81.9 ms gap missed the 50 ms frame-gap target despite no JavaScript long task; its exact cause was not established. The probe now records the interaction phase, focus and visibility for every >50 ms gap and fails on frame gaps as well as long tasks. The miss did not recur in the matched repeat. Short tests do not establish long-duration smoothness.

## Tool audit

The common desktop suite covers mount/unmount, navigation, themes and failure containment for every row. “Fixture” means an explicit simulated response through the real preload and renderer. “Reviewed” means source inspection, not runtime proof. No account, device or cancellation result is inferred from a passing build.

| Tool / internal ID | Normal and empty state | Failure and cancellation | Persistence and cleanup / limits |
| --- | --- | --- | --- |
| Music / `media` | Native session query; no-session UI; Spotify setup UI | Provider/token-refresh failure and disconnect unit tests; lyric revision guard reviewed | Subscriptions and lyric request invalidation reviewed. Real playback, queue and OAuth remain unverified. |
| Audio / `audio` | Native session/device enumeration; owned silent-session volume test; empty UI | Range validation and renderer error containment | Fixture confirms polling stops on unmount. Physical speaker output and device switching unverified. |
| Files / `fileshelf` | Empty shelf, missing-file state and owned file-reference persistence | Picker cancellation and failed reference removal fixtures; dangerous document types rejected | Successful reference removal does not delete originals. Actual external drag/Quick Share transfer unverified. |
| Calendar / `calendar` | ICS fixture import, day rendering and remount | Failed removal preserves event; malformed/recurring inputs rejected | Absolute/UTC/all-day parsing tested. File chooser cancellation returns without mutation; reminder timing across real sleep unverified. |
| Weather / `weather` | Setup UI and actual-sample forecast parser tests | Missing current data rejected; location request cancellation reviewed | Stored location and abort cleanup reviewed. Live network location/forecast acceptance not claimed. |
| Focus / `focus` | Fixture start/pause, persisted deadlines; native awake request/release | Failed start preserves confirmed state | Deadline math covers unmount/suspend/restart; timer listener cleanup reviewed. Real sleep/wake reminder delivery unverified. |
| Notes / `notes` | Save, remount and Unicode migration | Rejected save retains editor; Retry saves latest text; recovery plant/unit coverage | Atomic desktop storage and recovery semantics retained. No durable recovery promise on a failed recovery write. |
| Clipboard / `clipboard` | Opt-in, fixture history and empty search | Keep history cancels clear; failed clear retains history | Successful clear tested; collection remains opt-in. Real sensitive clipboard content is never collected by tests. |
| Snap / `snapzones` | Eight layouts; owned-window native geometry checks | Failed action and successful retry fixtures; protected-window validation | No stored layout state. Actual third-party elevated/fullscreen interactions unverified. |
| Blip / `blip` | Empty/setup UI and provider response fixtures | Missing key error; screen chooser cancellation paths reviewed; tools remain explicit actions | Voice replacement/late-close unit tests and unmount stop reviewed. Real Gemini/microphone sessions unverified. |
| Circle to search / `search` | Capture/selection UI reviewed | Capture cancellation fixture; pointer cancel/lost capture clears drag state | Images are transient. Real capture, cropped-image upload and keyboard alternative through Blip unverified. |
| Markets & sports / `finance` | Quote fixture, season and normalized score tests; empty result copy | Failed refresh keeps prior results; missing data never becomes invented prices | Results are session-only, labeled with fetch/provider timestamps. Real provider accounts unverified. |
| Windows Hello / `faceid` | Native availability query and unavailable fixture | Disabled test button when unavailable; cancellation/denial unit tests never show verified | Windows owns credentials. Real biometric verification not tested; this machine reported no face enrollment and disabled biometrics policy. |
| System / `system` | Native read-only battery/brightness/Bluetooth/notification queries; unavailable fixture UI | Camera late-result/unmount cleanup reviewed; shortcut and native-action validation tested | Shortcut import/persistence covered. Actual camera, microphone, brightness changes, notification permission changes and Bluetooth transitions unverified. |
| Settings / `settings` | Five sections, ten themes, version and release/source links | Failed saves roll back native policy; cancelled export shows no success; keys distinguish saved from verified | Theme/reduced-motion restart, migration, import/export validation and Windows-protected credential fixture pass. No real keys were submitted during testing. |

## Remaining qualification

- Windows Sandbox executable was unavailable; no disposable VM was available. Clean install/uninstall, minimum Windows version and ARM64 are not qualified.
- Physical mixed-DPI monitors, hot-plug, real sleep/wake, screen-reader speech output, long-duration use and the real accounts/hardware listed above remain unverified. Accessible labels and keyboard behavior were inspected/tested, but this is not a full assistive-technology certification.
- Binaries are unsigned. Signing needs a separate certificate. This release publishes Windows x64 NSIS/ZIP; optional MSIX startup arguments were updated but no MSIX release is qualified.
- No new provider, automatic updater, framework migration or dependency was added.
