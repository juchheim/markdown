# Auto-updater — Planning

## Overview

Add **in-app auto-updates** for the Windows **NSIS installer** build of Markdown. On each cold start of a packaged app, the main process checks GitHub Releases for a newer version. If one exists, it downloads in the background and prompts the user to restart when the update is ready.

This is intentionally a **v1, Windows-only, unsigned** slice: no macOS/Linux updater, no code signing, no renderer UI beyond a native dialog at install time.

## Goals

- Check for updates automatically when the app starts (packaged Windows NSIS only).
- Download updates from **GitHub Releases** (same repo as source: `juchheim/markdown`).
- Install on user confirmation via `quitAndInstall()` after download completes.
- Document release/publish workflow for maintainers.

## Non-goals (this phase)

| Item | Reason |
| --- | --- |
| macOS / Linux auto-update | Requires signing/notarization or distro-specific packaging |
| Code signing (Authenticode) | Deferred; SmartScreen may warn on unsigned installers |
| Portable `.exe` auto-update | `electron-updater` targets NSIS-installed apps, not portable builds |
| Renderer “Check for updates” menu | Can add later via IPC; startup check is enough for v1 |
| Silent / forced updates | User must confirm restart |
| Delta / staged rollouts | Full installer download only |
| Custom update server | GitHub provider is sufficient |

## User experience

1. User installs **Markdown Setup x.y.z.exe** (NSIS).
2. User launches the app → main process checks GitHub (non-blocking).
3. If already on latest version → no UI.
4. If a newer release exists → download runs in background (`autoDownload`).
5. When download finishes → native dialog: **Restart now** / **Later**.
6. **Restart now** → app quits and NSIS updater applies the new version.

Errors (no network, bad release assets, etc.) are logged to the main process console only; no error dialog in v1.

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│  Main process                                               │
│  setupAutoUpdater(win)  ← only if packaged + win32 + NSIS   │
│    electron-updater.autoUpdater                             │
│      → GET GitHub Releases API / latest.yml                 │
│      → download Markdown Setup {version}.exe                │
│      → dialog → quitAndInstall()                            │
└─────────────────────────────────────────────────────────────┘

GitHub Release (tag v1.0.1)
  ├── latest.yml          ← metadata (electron-builder)
  └── Markdown Setup 1.0.1.exe
```

### When the updater runs

| Condition | Updater |
| --- | --- |
| `npm run dev` (`!app.isPackaged`) | Off |
| macOS / Linux packaged build | Off |
| Windows portable (`PORTABLE_EXECUTABLE_DIR` set) | Off |
| Windows NSIS installed build | On, check at startup |

### Dependencies

- **`electron-updater`** — pairs with `electron-builder` publish metadata.
- **`electron-builder` `publish`** — embeds update feed URL in the built app (`app-update.yml`).

## Release model

- **Version source of truth:** `version` in root `package.json` (semver).
- **Git tag:** `v{version}` (e.g. `v1.0.1`) must match package version for clarity.
- **Artifacts:** CI or maintainer runs `electron-builder --publish always` with `GH_TOKEN`.
- **Channel:** default `latest` (no beta channel in v1).

## Risks and mitigations

| Risk | Mitigation |
| --- | --- |
| Unsigned installer blocked by SmartScreen | Document for users; add Authenticode later |
| Portable users expect updates | Document that only NSIS build auto-updates |
| Forgotten `latest.yml` on release | Always publish via `electron-builder --publish`, not manual EXE-only upload |
| Version not bumped | Release checklist in IMPLEMENTATION.md |
| Dev machine checks updates | Guard with `app.isPackaged` |

## Success criteria

- [ ] Packaged NSIS app on Windows calls `checkForUpdates` once per startup.
- [ ] Publishing a higher semver to GitHub Releases updates a test install after restart prompt.
- [ ] Dev mode and portable build never call the updater.
- [ ] PLANNING + IMPLEMENTATION docs exist under `docs/planning/updater/`.

## Future work

- Code signing + optional macOS updater.
- Menu item “Check for updates…” with IPC status in toolbar.
- GitHub Actions workflow on `v*` tags (template in IMPLEMENTATION.md).
- Differential updates (electron-updater supports when enabled in builder).

## References

- [electron-updater](https://www.electron.build/auto-update)
- [electron-builder publish — GitHub](https://www.electron.build/configuration/publish#githuboptions)
- App packaging: root `electron-builder.yml`, `README.md`
