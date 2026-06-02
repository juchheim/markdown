# Auto-updater — Implementation

Step-by-step guide for the Windows NSIS + GitHub Releases updater shipped in this repo.

## Files touched

| File | Role |
| --- | --- |
| `src/main/updater.ts` | `setupAutoUpdater()` — guards, events, startup check, broadcasts status + `updater:restart` IPC |
| `src/main/index.ts` | Calls `setupAutoUpdater()` after window creation |
| `src/preload/index.ts` | `onUpdateStatus()` listener + `restartToUpdate()` bridge |
| `src/renderer/src/types.ts` | `UpdateStatus` type + `Api` additions |
| `src/renderer/src/store.ts` | `updateStatus` state, `setUpdateStatus`, `dismissUpdate`, `restartToUpdate` |
| `src/renderer/src/hooks/useAppLifecycle.ts` | Subscribes to `onUpdateStatus` |
| `src/renderer/src/components/UpdateToast.tsx` | Bottom-left in-app notification |
| `electron-builder.yml` | `publish.provider: github` |
| `package.json` | `electron-updater` dependency; `repository` for feed URL |
| `docs/planning/updater/PLANNING.md` | Product/architecture scope |

## Runtime behavior (`src/main/updater.ts`)

```typescript
// Pseudocode — see actual file for full implementation
export function setupAutoUpdater(): void {
  if (!app.isPackaged) return;
  if (process.platform !== "win32") return;
  if (process.env.PORTABLE_EXECUTABLE_DIR) return;

  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;

  ipcMain.on("updater:restart", () => autoUpdater.quitAndInstall());

  autoUpdater.on("update-available", (info) => {
    // broadcast { state: "available", version } → renderer toast
  });

  autoUpdater.on("update-downloaded", (info) => {
    // broadcast { state: "downloaded", version } → renderer toast
  });

  void autoUpdater.checkForUpdates();
}
```

### Guards explained

- **`app.isPackaged`** — skips `npm run dev` and `npm run preview` unpackaged runs.
- **`process.platform === "win32"`** — Windows-only for this phase.
- **`PORTABLE_EXECUTABLE_DIR`** — electron-builder sets this for portable executables; portable builds are excluded because NSIS updater hooks are not present.

## Build configuration

### `electron-builder.yml`

```yaml
publish:
  provider: github
  owner: juchheim
  repo: markdown
```

This generates `app-update.yml` inside the packaged app pointing at GitHub Releases for `juchheim/markdown`.

### `package.json`

```json
{
  "repository": {
    "type": "git",
    "url": "https://github.com/juchheim/markdown.git"
  },
  "dependencies": {
    "electron-updater": "^6.6.2"
  }
}
```

Keep `version` in sync with git tags when releasing.

## Publishing a release (maintainer)

### Recommended: GitHub Actions (`.github/workflows/release.yml`)

Pushing a tag `v*` on `main` triggers a Windows job that builds the NSIS installer and publishes to [GitHub Releases](https://github.com/juchheim/markdown/releases). The workflow uses the built-in `GITHUB_TOKEN` (`github.token`) — no extra secret is required for a **public** repo.

**Release checklist:**

1. Bump `version` in `package.json` (e.g. `1.0.0` → `1.0.1`).
2. Commit and push to `main`:
   ```bash
   git add package.json
   git commit -m "chore: release v1.0.1"
   git push origin main
   ```
3. Create and push a tag **matching** the version (without `v` in package.json, with `v` on the tag):
   ```bash
   git tag v1.0.1
   git push origin v1.0.1
   ```
4. Open **Actions** → **Release** workflow run; wait for green.
5. Open **Releases** → `v1.0.1` and confirm assets:
   - `Markdown Setup 1.0.1.exe`
   - `latest.yml` (required for auto-update)

Share installs with: `https://github.com/juchheim/markdown/releases/latest` (always points at the newest release).

If the workflow fails the version check, the tag name must equal `package.json` version (e.g. tag `v1.0.1` ↔ `"version": "1.0.1"`).

### Private repo

Add a classic PAT or fine-grained token with **Contents: Read and write** and store it as repository secret `GH_TOKEN`. Change the publish step env to `GH_TOKEN: ${{ secrets.GH_TOKEN }}`.

### Manual fallback (local machine)

```bash
export GH_TOKEN=ghp_...   # PAT with repo scope
npm run dist:publish:win
```

Then create the GitHub release/tag manually if you did not push a tag first.

### Environment variables

| Variable | Purpose |
| --- | --- |
| `GH_TOKEN` / `github.token` | Upload assets + `latest.yml` to GitHub Releases |
| `CSC_*` | Not used in unsigned v1 |

## Verifying locally

1. Install release **N** from NSIS `.exe` on a Windows VM or machine.
2. Publish release **N+1** to GitHub with `latest.yml` + NSIS exe.
3. Launch installed app → wait for download → accept restart dialog.
4. Confirm **About** / window title / `package.json` version reflects **N+1**.

**Negative tests:**

- `npm run dev` → no update HTTP traffic (or no-op).
- Run portable `Markdown 1.0.0.exe` → updater should not run.
- Airplane mode → app starts; error logged, no crash.

## CI workflow

See `.github/workflows/release.yml` — triggers on `push` of tags `v*`, runs on `windows-latest`, publishes NSIS x64 only (matches auto-updater scope; portable is not published by CI).

## Troubleshooting

| Symptom | Likely cause |
| --- | --- |
| `checkForUpdates` never runs | Not packaged, not Windows, or portable build |
| `Update not available` but GitHub has newer tag | Installed version ≥ release; or wrong repo in `publish` |
| Download fails | Missing `latest.yml` on release; or EXE name mismatch |
| `quitAndInstall` does nothing | Not NSIS install path; antivirus locking exe |
| SmartScreen blocks new installer | Expected without code signing |

Enable debug logging temporarily:

```typescript
import { autoUpdater } from "electron-updater";
autoUpdater.logger = console;
```

## npm scripts

| Script | Description |
| --- | --- |
| `npm run dist` | Build + package (no publish) |
| `npm run dist:publish:win` | Build + publish NSIS x64 to GitHub (`GH_TOKEN` required) |

## In-app notification (shipped)

The main process broadcasts `updater:status` to all windows:

- `{ state: "available", version }` — fired when a newer release is found and download starts.
- `{ state: "downloaded", version }` — fired when the installer is downloaded and staged.

The renderer shows a **bottom-left toast** (`UpdateToast.tsx`):

- **Available** → “Update available — version X downloading…” (informational, no actions).
- **Downloaded** → “Update ready · vX. Restart Markdown to finish updating. Closing and reopening also applies it.” with **Restart now** (`restartToUpdate()` → `quitAndInstall()`) and **Later** (dismiss).

Because `autoInstallOnAppQuit = true`, a normal quit/relaunch also applies a downloaded update — the toast simply makes that visible and offers an immediate restart.

### Future UI

“Check for updates” menu/toolbar item: add `ipcMain.handle("updater:check")` → `autoUpdater.checkForUpdates()`, then a manual trigger in the renderer. Keep all download/install logic in the main process.
