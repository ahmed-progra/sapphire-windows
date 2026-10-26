# Features and boundaries

| Feature | V1 behavior | Requirements or limits |
| --- | --- | --- |
| Appearance | Obsidian, OLED, Graphite, Amber, Arctic, Paper, Forest, Ocean, Crimson, Custom | Windows theme matching, reduced motion, custom accent contrast adjustment |
| Notes | Local scratchpad, recovery draft review | No sync or end-to-end encryption |
| Clipboard | Opt-in text history/search/copy/clear | Off by default; not a password vault |
| Calendar | Month view, `.ics` import, running-app reminders | No account sync; complex recurrence/time-zone fidelity limited |
| Focus | Timers, eye breaks, stay-awake toggle | Reminders need the app running; Windows power policy applies |
| Shelf | Local file references, open/reveal, drag | Moved files may become unavailable |
| Media | Compatible Windows media-session controls | Player determines support; no fabricated lyrics |
| Audio | Supported app/output volume | No EQ or simultaneous multi-output routing |
| Snap | Eight layouts for previous external foreground window | Elevated/protected/size-constrained apps may refuse changes |
| System | Battery, supported brightness, paired Bluetooth information | Hardware-dependent; no universal charge limiter/Bluetooth battery estimate |
| Camera/Hello | Explicit camera use and Windows Hello verification | Hardware/setup/permission; no replacement login screen |
| Notifications | Sapphire reminders, explicit Windows notification access | Consent/package identity affects access; other-app ingestion limited |
| Weather | Open-Meteo search and forecasts | Network and selected location; retained data labeled |
| Spotify | Optional account integration | Your client configuration, OAuth, and account access |
| Blip/search | Gemini text, explicit image sends, optional live voice | Your key/access; sent content leaves the device |
| Markets/sports | Finnhub quotes, API-Sports results | Your keys/entitlement; manual refresh/API limits |
| Quick Share | Opens Google's separately installed app | Google owns pairing, consent, transfer, and progress |

See [PARITY.md](PARITY.md) for the detailed implementation map and [VERIFICATION.md](VERIFICATION.md) for actual test scope. Hardware and provider-account behavior remain separate acceptance checks.
