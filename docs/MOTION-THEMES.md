# Motion and themes — implementation and verification

Run the current source build with `npm start` from the Sapphire directory. Checks: `npm test`, `npm run build`, then `npm run test:desktop:isolated`. No dependencies were added or upgraded.

The existing `run-sapphire.bat` launcher prefers installed/packaged builds. Those binaries and the portable archive were not replaced by this work. Use `npm start` to review these changes.

## Audit and repairs

The current app uses React 18, Framer Motion 11, Tailwind 3 and Electron 42. The audit covered all renderer components, CSS transitions, pointer handlers, polling/subscription cleanup, settings persistence and native resize callers. The pre-change unit baseline was 39 passing tests. A snapshot of the incoming working files is retained in `.test-output/motion-theme-baseline`; the working tree already contained extensive unrelated changes.

| Before | After | Why |
| --- | --- | --- |
| Idle hover multiplied width and height by 1.1 and requested native resizing. | Hover changes the idle surface color within fixed bounds. The existing 300 ms mouse dwell still opens the island. | Removes hover-driven geometry changes and cumulative resize interactions while retaining deliberate opening. |
| Hover timers could survive window blur; touch could arm the mouse dwell. | Clear the timer on leave, blur and cancellation; arm dwell only for a mouse. | Prevents delayed opening after the interaction has ended. |
| Exit views set `pointerEvents: none` without explicitly restoring it on reentry. | Enter/visible targets explicitly use `pointerEvents: auto`. | Makes interrupted open/close reversals deterministic. |
| Only four button classes had pressed feedback, including disabled controls. | Shared 0.98 press scale on enabled controls, with a resting scale of exactly 1 and restoration on pointer exit. | Makes buttons, icons, theme cards and widget cards consistent without moving their layout. |
| Springs and fades used separate inline timings; some reduced-motion content still faded. | Shared 120 ms feedback, 160 ms content easing, a damped island spring and 180 ms theme settling. Reduced motion sets component transition durations to zero and disables CSS feedback motion. | Establishes one small motion vocabulary and honors OS and app preferences. |
| CSS and widgets assumed black surfaces and translucent white text. | Semantic palette tokens cover the shell, all widgets, controls, statuses, selections and scrollbars. | Supports actual light themes and readable dark themes. |
| Frontend and desktop accent defaults differed. | Shared appearance defaults and validation. | Keeps reload, import and restart behavior consistent. |
| A nested drag-leave cleared shelf highlighting; cancelled selection could keep drawing. | Ignore drag-leave into a descendant; clear selection on pointer cancellation/lost capture and reject secondary presses. | Prevents flicker and stale drag state. |
| Pointer exit could auto-collapse while a keyboard user still focused a control. | Keep the panel open while it has visible keyboard focus and the document is focused. Collapse-button and Escape actions restore focus to the idle opener. | Keeps keyboard navigation usable. |

The main morph still animates shell width/height to preserve its shape and avoid scaling text. Expanded content keeps a fixed size inside that shell. Native growth is requested at the start and shrinking at completion; pointer feedback no longer changes native bounds. Content entrances use opacity and transform. No perpetual decorative animation, new pointer loop, indiscriminate `will-change`, cursor-following effect or dependency was introduced. Existing camera mirroring remains intact.

## Theme behavior

Ten choices: **Midnight Obsidian, OLED Black, Graphite, Warm Amber, Arctic Light, Paper, Forest, Ocean, Crimson, Custom Accent**.

Each palette specifies surface, panel, input, hover, primary/muted text, border, control boundary and accent colors. Status colors adapt to light/dark appearance. The custom option retains the chosen fill and derives readable accent text/focus and black/white fill labels. The tests require at least 4.5:1 for text/status/accent text on each major surface, and 3:1 for the strong input boundary against its field.

Settings includes palette previews, a selected checkmark, a Windows-theme switch, a validated hex/color-picker form and a reduced-motion choice. “Match Windows” resolves to Arctic Light or Midnight Obsidian without replacing the saved system selection. System reduced motion always wins. Changes persist through the existing settings store and backup format.

Invalid appearance preferences fall back independently of geometry, hotkey, always-on-top and other settings. Legacy settings with an existing accent migrate to Custom Accent. The renderer waits for desktop hydration before showing its surface to avoid flashing the wrong startup palette.

Theme tokens change together, rather than interpolating through potentially unreadable light/dark colors. A short opacity settling animation provides feedback; it is cancelled on replacement/unmount and skipped with reduced motion. Theme changes do not remount widgets or reset unrelated data.

## Executed verification

Verification date: 2026-10-26, Asia/Baghdad.

| Check | Result |
| --- | --- |
| `npm test` | **44 passed, 0 failed.** Includes five new appearance tests covering all palettes, custom color extremes, migration/fallback, system appearance and backup round trips. |
| `npm run build` | **Passed.** TypeScript renderer and Electron compilation plus Vite production bundle. |
| `npm run test:desktop:isolated` | **Passed initial and real process restart, exit 0 for both.** Final report: `.test-output/desktop-20261026-103103/result.json`. |
| Theme/navigation matrix in Electron | **10 themes × 15 widgets.** Verified selection, rendered surface/input colors, stable native bounds and preserved always-on-top. |
| Mouse tests in Electron | **12 short hover/exit cycles.** No unwanted expansion or native size change; tab, theme, shape and button scales returned to 1. |
| Framer morph test | Rapid reversal remained clickable, centered and without overshoot. 130 sampled frames in normal mode; **p95 interval about 16.6 ms**. Reduced mode opened immediately. |
| Keyboard in Electron | Tab arrows and Escape, focus restoration, and visible keyboard focus preventing timed collapse passed. |
| Persistence | Theme, custom accent and reduced-motion preferences survived a real process restart. Existing always-on-top preference/re-enable checks also passed. |
| Existing desktop regression suite | Startup/hide, three close/reopen cycles, minimize/restore, second instance, normal/maximized/fullscreen stacking, competing topmost repair, tray failure, simulated display reconnect, storage failure rollback, bounded renderer recovery and native-helper recovery passed. |
| Live Playwright browser | Selected all ten themes; applied a black custom accent and reloaded; verified readable derived focus color. Tested live OS light/dark and reduced-motion changes, preserved a note across theme changes, and checked no horizontal overflow at 420 px. |
| Real pointer press/exit in Playwright | Theme card, shape card, glass button, snap card and calendar icon: pressed scale 0.98, release outside and ten rapid crossings per type restored exact original measured width/height and scale 1. |
| Keyboard in Playwright | Home/End navigation, visible focus ring, Escape focus restoration, Enter reopening and reduced mode passed. |
| Search cancellation | Generated screen fixture, real pointer drag followed by `pointercancel`: selection cleared and later pointer movement did not resume drawing. No personal screen capture or provider call was used. |
| Bootstrap failure | Injected a bootstrap failure in an isolated browser page; the error stayed visible and stale cached notes remained unavailable for editing. |
| Whitespace review | `git diff --check` passed. Reviewed changes against the incoming file snapshot, rather than treating unrelated working-tree changes as this task's diff. |

The smoke logs intentionally contain errors from failure-injection checks. The final reports explicitly verify recovery. The appearance test and navigation test reported no renderer errors.

The offscreen timing measurement is not a physical-display FPS guarantee. Physical taskbar interaction is unavailable on the isolated desktop; the test reports this rather than passing it. Windows Computer Use failed to initialize twice with “failed to write kernel assets … os error 3,” so no visible-desktop manual pass is claimed. Authentication dialogs, live provider accounts, physical media/audio/camera controls and a 24-hour hardware soak were not exercised for this change. Native OS dialogs retain Windows styling. No standalone lint command is configured.

## Files changed by this task

New files:

- `electron/appearance.mjs` — shared palette/defaults, normalization and contrast-safe accent derivation.
- `electron/appearance.d.mts` — shared appearance declarations.
- `src/services/motion.ts` — timing, easing and spring definitions.
- `tests/appearance.test.mjs` — appearance regression checks.
- `docs/MOTION-THEMES.md` — this report.

Updated files:

- `src/components/IslandContainer.tsx` — cursor repair, motion, theme application, OS subscriptions, startup hydration and focus behavior.
- `src/components/widgets/SettingsWidget.tsx` — theme previews/selection, custom accent, system appearance and reduced-motion controls.
- `src/index.css` — semantic shell/control styling and shared interaction states.
- `src/services/storageService.ts` and `src/types/index.ts` — appearance persistence and types.
- `electron/core.mjs` — shared defaults and appearance normalization at the desktop boundary.
- `electron/desktop.mjs` — appearance/restart smoke integration; production window policy remains unchanged.
- `scripts/motion-smoke.mjs` — actual renderer, native-bounds, theme matrix, system preference and keyboard regressions.
- `tailwind.config.js` — semantic token utilities; removed unused looping-animation definitions.
- `src/components/widgets/AudioMixerWidget.tsx`
- `src/components/widgets/BlipAgentWidget.tsx`
- `src/components/widgets/CalendarWidget.tsx`
- `src/components/widgets/ClipboardWidget.tsx`
- `src/components/widgets/FaceIDWidget.tsx`
- `src/components/widgets/FileShelfWidget.tsx`
- `src/components/widgets/FinanceSportsWidget.tsx`
- `src/components/widgets/FocusCaffeinateWidget.tsx`
- `src/components/widgets/MediaWidget.tsx`
- `src/components/widgets/NotesWidget.tsx`
- `src/components/widgets/SearchWidget.tsx`
- `src/components/widgets/ShortcutControls.tsx`
- `src/components/widgets/SnapZonesWidget.tsx`
- `src/components/widgets/SystemWidget.tsx`
- `src/components/widgets/WeatherWidget.tsx`

The widget edits primarily replace hardcoded visual colors; Shelf and Search also receive the pointer fixes described above. No changes to provider contracts, credentials, storage keys, note recovery or native window policy were required. No commit or push was made.
