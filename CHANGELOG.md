# Changelog

## 1.2.0 — 2026-10-26

- Labeled daily navigation and grouped All tools picker, preserving all 15 tools.
- Appearance-first Settings with five sections, all ten themes, honest connection states and installed version links.
- Readable surfaces, consistent spacing, solid contrast/transparency fallbacks and clearer action/error copy.
- 100 ms feedback, 160 ms content transitions, 180 ms theme settling; stale morph completions and redundant native bounds/shape calls are ignored.
- Manual launch shows the app; Windows startup stays quiet. A durable appearance introduction preserves existing data and theme choices.
- Clipboard clear confirmation and useful empty-search feedback. Notes save failures explicitly retain the editor text without promising unconfirmed recovery.
- Added disposable legacy-profile launch tests, widget failure/cancellation fixtures, navigation/focus coverage and visible-window measurements.

See [1.2 verification and limits](docs/VERIFICATION-1.2.md).

## 1.1.0 — V1 public release — 2026-10-26

First public release of this Windows adaptation. Earlier 1.0.x packages were local builds; 1.1.0 preserves upgrade ordering.

- Windows x64 installer and extracted-folder ZIP with SHA-256 checksums.
- Ten appearance choices, Windows theme matching, contrast-safe custom accents, and reduced motion.
- Notes/recovery drafts, opt-in clipboard history, file shelf, calendar import, focus tools, and native Windows integration.
- Fixed-size hover feedback, consistent press feedback, pointer-cancel recovery, and keyboard focus handling.
- Native window lifecycle, tray recovery, always-on-top repair, persistence rollback, and helper cleanup.
- Public documentation, issue/PR templates, private security reporting, and Windows CI.

Known limits: unsigned x64 binaries, no automatic updater, no Store listing. Clean-machine installation, physical multi-monitor/sleep testing, and real provider/hardware coverage remain incomplete. See [verification](docs/VERIFICATION.md) and [features](docs/FEATURES.md).
