# Data and privacy

Sapphire requires no Sapphire account. Local tools use the Windows profile; optional network features contact their providers.

- Settings, notes, calendar entries, file references, and opted-in clipboard history are local **unencrypted** files.
- Clipboard capture starts off. Stop/clear it in the app; avoid collecting sensitive text.
- Provider credentials and Spotify tokens use Electron `safeStorage` on Windows. Saving keys fails if protected storage is unavailable.
- Ordinary data exports exclude credentials but contain readable JSON. Protect backups.
- Recovery drafts and bounded lifecycle diagnostics may persist. Redact anything shared publicly.
- The ZIP uses a Windows profile too; it is not a private portable vault.

| Integration | Data sent when used |
| --- | --- |
| Open-Meteo | Location searches and forecast coordinates |
| Spotify | OAuth/account requests and supported media commands |
| Gemini | Prompts, explicitly submitted images, live audio when started |
| Finnhub/API-Sports | Symbols/sport filters and your provider credentials |
| Windows services | Explicit permission requests for supported camera, microphone, notification, and Hello operations |

Screen content uses explicit capture/send actions. Camera and microphone require permission and user action. Third-party terms apply; there is no bundled shared service key. The source includes no analytics or automatic crash-upload service; this does not describe the behavior of Windows or external providers.
