# Reopen last folder — Planning

## Overview

When the user relaunches Markdown, automatically restore the **last opened project folder** (and optionally the **last active `.md` file**) so they land exactly where they left off. No new settings screen, no “Recent folders” list in v1 — the app should simply feel like it remembers.

This is a **session-restore** feature: persist workspace state locally after a successful folder open, validate it on startup in the main process, and silently reopen or fall back to the current empty state.

## Goals

- On cold start, reopen the last project folder without user action.
- Also reopen the last active `.md` file when it still exists under that folder.
- Persist session data across app restarts and updates (offline, no accounts).
- Validate paths in the **main process** before exposing them to the renderer.
- Fail silently when the folder or file is missing — show the normal empty state, clear stale session data.
- Update persisted session whenever the user opens a folder via the native dialog (**Open Folder** / **Change Folder**).

## Non-goals (this phase)

| Item | Reason |
| --- | --- |
| Recent-folders list UI | Adds chrome; last-folder-only keeps simplicity |
| “Reopen on startup” toggle | Default-on is the expected desktop behavior; settings creep |
| Persist unsaved buffer content | Risky and surprising; disk is source of truth |
| Persist expanded tree nodes / scroll position | Low ROI vs complexity |
| Persist view mode per file | Can add later via localStorage if requested |
| Cross-machine sync | Conflicts with offline-first positioning |
| Open folder via drag-and-drop | Separate feature; shares `openFolderAtPath` IPC when added |

## User experience

### Happy path

1. User opens `~/notes`, edits `journal.md`, saves, quits.
2. User relaunches Markdown.
3. App opens directly to `~/notes` with `journal.md` loaded in the editor — same as if they had never closed.

No toast, no dialog, no extra click.

### First launch

No saved session → current behavior: empty sidebar with **Open Folder**.

### Folder moved or deleted

1. App starts, main process finds saved path invalid.
2. Stale session entry is cleared.
3. User sees empty state (same as first launch).
4. No error dialog — the folder is simply gone.

### Folder exists, last file deleted

1. Folder and tree restore normally.
2. Last file is skipped; no file selected (`activePath: null`).
3. Main area shows the usual “select a file” empty state.

### User picks a different folder

**Change Folder** dialog succeeds → session overwritten with the new root (and cleared active file until user selects one).

### User cancels the folder dialog

Session unchanged — cancel is not a workspace change.

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│  Main process                                                   │
│  session.ts                                                     │
│    readSession()  → Session | null                              │
│    writeSession() → atomic write to userData/session.json       │
│    clearSession()                                               │
│                                                                 │
│  On dialog:openFolder / fs:openFolderAtPath success:            │
│    writeSession({ rootPath })                                   │
│    startWatching(rootPath)                                      │
│                                                                 │
│  session:restore (IPC):                                         │
│    read → validate root exists + readable                       │
│    buildTree(rootPath)                                          │
│    validate activePath (optional) under root, .md, exists       │
│    readFile(activePath) if valid                                │
│    on failure: clearSession() or strip bad activePath           │
└────────────────────────────┬────────────────────────────────────┘
                             │ IPC
┌────────────────────────────▼────────────────────────────────────┐
│  Renderer (Zustand + useAppLifecycle)                           │
│    mount → restoreLastSession() once                            │
│    openFolder / openFile → main auto-persists (no renderer write)│
└─────────────────────────────────────────────────────────────────┘
```

### Why main-process persistence

| Approach | Verdict |
| --- | --- |
| Renderer `localStorage` (like `mv:sidebarWidth`) | Works for UI prefs; session paths benefit from main-side validation and a single write path |
| `electron-store` dependency | Unnecessary for one small JSON file |
| **JSON in `app.getPath("userData")`** | **Chosen** — standard Electron pattern, easy to inspect/delete, survives renderer reload in dev |

Renderer layout prefs (`mv:sidebarWidth`, `mv:splitRatio`) stay in `localStorage`. Workspace session stays in main `userData`.

### Session file location

```
{userData}/session.json
```

Examples:

- macOS: `~/Library/Application Support/Markdown/session.json`
- Windows: `%APPDATA%/Markdown/session.json`
- Linux: `~/.config/Markdown/session.json`

## Data model

```ts
/** Persisted on disk — versioned for forward-compatible migrations */
type SessionV1 = {
  version: 1;
  rootPath: string;
  activePath: string | null;
  updatedAt: number; // Date.now() — useful for debugging, optional pruning later
};
```

### When session is written

| Event | `rootPath` | `activePath` |
| --- | --- | --- |
| Folder opened (dialog or programmatic) | new path | `null` (reset until file picked) |
| `.md` file opened | unchanged | new path |
| Restore fails (bad root) | — | session cleared |
| Restore fails (bad file only) | kept | set to `null` and saved |

Main process owns all writes — renderer never writes session JSON directly.

## IPC contract

| Channel | Direction | Payload | Returns |
| --- | --- | --- | --- |
| `session:restore` | R→M | none | `RestoreResult \| null` |
| `fs:openFolderAtPath` | R→M | `rootPath: string` | `{ path, tree } \| null` |

```ts
type RestoreResult = {
  path: string;
  tree: FileNode[];
  activePath: string | null;
  activeContent: string | null; // null when no active file
};
```

Existing `dialog:openFolder` unchanged in signature; internally shares `openFolderAtPath` helper and calls `writeSession`.

### Internal main helper (not IPC)

```ts
async function openProjectFolder(
  win: BrowserWindow,
  rootPath: string,
): Promise<{ path: string; tree: FileNode[] } | null>
```

Used by:

- `dialog:openFolder` (after native picker)
- `fs:openFolderAtPath` (restore, future drag-drop)
- `session:restore`

## Renderer integration

### Store refactor

Extract shared folder-application logic:

```ts
applyFolder: (payload: { path: string; tree: FileNode[] }) => void;
restoreLastSession: () => Promise<void>;
```

`openFolder()` (dialog) keeps unsaved-change guard, then calls IPC and `applyFolder`.

`restoreLastSession()`:

- No unsaved guard (fresh launch).
- Calls `session:restore`.
- On result: `applyFolder` + set `activePath` / content if returned.
- On `null`: no-op (empty state).

### Lifecycle hook

In `useAppLifecycle`, run once on mount:

```ts
void useStore.getState().restoreLastSession();
```

Guard with a module-level or ref flag so Strict Mode double-mount in dev does not race (second call no-ops if `rootPath` already set).

## Edge cases

| Case | Behavior |
| --- | --- |
| Saved path is a file, not a directory | Treat as invalid → clear session |
| Saved path exists but `EACCES` | Clear session, empty state |
| `activePath` outside `rootPath` (path traversal / manual edit) | Ignore file, open folder only, rewrite session |
| `activePath` not `.md` | Ignore file |
| Empty folder restored | Tree empty, no file selected — correct |
| User opens app while external tool deletes folder mid-read | Rare; validate with `fs.access` + `stat` before tree build |
| Large folder on restore | Same cost as manual open; acceptable for v1 (lazy tree is separate roadmap item) |
| macOS `activate` creates new window | Each window mount may call restore; skip if `rootPath` already populated |
| Dev: `npm run dev` | Same restore behavior (uses dev `userData`) |

## Risks and mitigations

| Risk | Mitigation |
| --- | --- |
| Stale paths after rename | Silent fallback + clear; user re-opens via dialog |
| Blocking startup on huge tree | Same as today; document lazy loading as follow-up |
| Strict Mode double restore | Skip if session already loaded |
| Session file corruption | Try/catch on read → treat as null, delete bad file |
| Windows vs POSIX paths | Store absolute paths as OS returns them; normalize only for comparisons |

## Success criteria

- [ ] Quit and relaunch reopens last folder without user interaction.
- [ ] Last `.md` file reopens when still present.
- [ ] Missing folder → empty state, no error dialog, session cleared.
- [ ] Missing file only → folder open, no file selected.
- [ ] **Change Folder** updates session for next launch.
- [ ] Cancelled folder dialog does not change session.
- [ ] Session file lives in `userData`, not committed to repo.
- [ ] PLANNING + IMPLEMENTATION docs exist under `docs/planning/reopen-last-folder/`.

## Future work

- **Recent folders** (3–5 entries) in sidebar — reuses `fs:openFolderAtPath`.
- **Drag folder onto window** — same IPC helper.
- Persist **view mode** (`markdown` / `preview` / `split`) in session or localStorage.
- **Clear recent session** menu item (only if recents UI ships).
- Lazy tree loading to speed restore for monorepos.

## References

- Current folder open flow: `src/main/ipc.ts` (`dialog:openFolder`), `src/renderer/src/store.ts` (`openFolder`)
- Layout persistence pattern: `mv:sidebarWidth`, `mv:splitRatio` in `store.ts`
- Updater planning doc structure: `docs/planning/updater/`
