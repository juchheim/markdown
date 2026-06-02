# Reopen last folder — Implementation

Step-by-step guide to ship session restore (last folder + last active file) in Markdown.

## Files touched

| File | Role |
| --- | --- |
| `src/main/session.ts` | **New** — read/write/clear `session.json` in `userData` |
| `src/main/ipc.ts` | Shared `openProjectFolder`; `session:restore`; persist on folder open; persist `activePath` on file read |
| `src/preload/index.ts` | Expose `restoreLastSession()` |
| `src/renderer/src/types.ts` | `RestoreResult` type + `Api.restoreLastSession` |
| `src/renderer/src/store.ts` | `applyFolder`, `restoreLastSession`; refactor `openFolder` |
| `src/renderer/src/hooks/useAppLifecycle.ts` | Call `restoreLastSession()` once on mount |

No new dependencies.

## Step 1 — Session module (`src/main/session.ts`)

```typescript
import { app } from "electron";
import fs from "node:fs";
import path from "node:path";

export type SessionV1 = {
  version: 1;
  rootPath: string;
  activePath: string | null;
  updatedAt: number;
};

const SESSION_FILE = () => path.join(app.getPath("userData"), "session.json");

export async function readSession(): Promise<SessionV1 | null> {
  try {
    const raw = await fs.promises.readFile(SESSION_FILE(), "utf-8");
    const data = JSON.parse(raw) as SessionV1;
    if (data.version !== 1 || typeof data.rootPath !== "string") return null;
    return data;
  } catch {
    return null;
  }
}

export async function writeSession(partial: {
  rootPath: string;
  activePath?: string | null;
}): Promise<void> {
  const prev = await readSession();
  const next: SessionV1 = {
    version: 1,
    rootPath: partial.rootPath,
    activePath:
      partial.activePath !== undefined
        ? partial.activePath
        : (prev?.rootPath === partial.rootPath ? prev.activePath : null),
    updatedAt: Date.now(),
  };
  await fs.promises.mkdir(path.dirname(SESSION_FILE()), { recursive: true });
  const tmp = `${SESSION_FILE()}.tmp`;
  await fs.promises.writeFile(tmp, JSON.stringify(next, null, 2), "utf-8");
  await fs.promises.rename(tmp, SESSION_FILE());
}

export async function clearSession(): Promise<void> {
  try {
    await fs.promises.unlink(SESSION_FILE());
  } catch {
    /* missing file is fine */
  }
}
```

### Notes

- Atomic write via `.tmp` + `rename` avoids half-written JSON on crash.
- `writeSession({ rootPath })` resets `activePath` when the root changes.
- `writeSession({ rootPath, activePath })` updates the open file without changing root.

## Step 2 — Path validation helpers (`src/main/ipc.ts` or `session.ts`)

```typescript
import fs from "node:fs";
import path from "node:path";

async function pathExistsAsDirectory(p: string): Promise<boolean> {
  try {
    const stat = await fs.promises.stat(p);
    return stat.isDirectory();
  } catch {
    return false;
  }
}

function isPathInsideRoot(rootPath: string, filePath: string): boolean {
  const root = path.resolve(rootPath);
  const file = path.resolve(filePath);
  const rel = path.relative(root, file);
  return rel !== "" && !rel.startsWith("..") && !path.isAbsolute(rel);
}

function isMarkdownFile(p: string): boolean {
  return p.toLowerCase().endsWith(".md");
}
```

## Step 3 — Shared folder open (`src/main/ipc.ts`)

Extract logic used by dialog, programmatic open, and restore:

```typescript
async function openProjectFolder(
  win: BrowserWindow,
  rootPath: string,
): Promise<{ path: string; tree: FileNode[] } | null> {
  if (!(await pathExistsAsDirectory(rootPath))) return null;

  const tree = await buildTree(rootPath);
  startWatching(win, rootPath);
  await writeSession({ rootPath, activePath: null });
  return { path: rootPath, tree };
}
```

Update existing handler:

```typescript
ipcMain.handle("dialog:openFolder", async () => {
  const result = await dialog.showOpenDialog(getDialogParent(win), {
    properties: ["openDirectory"],
  });
  if (result.canceled || result.filePaths.length === 0) return null;
  return openProjectFolder(win, result.filePaths[0]);
});

ipcMain.handle("fs:openFolderAtPath", async (_event, rootPath: string) => {
  return openProjectFolder(win, rootPath);
});
```

## Step 4 — Persist active file on open

When the renderer reads a file, update session. Two options — pick **A** (simplest):

### Option A — persist in `fs:readFile` handler (recommended)

Only update session when the path is a valid `.md` under the current session root:

```typescript
ipcMain.handle("fs:readFile", async (_event, filePath: string) => {
  const [content, stat] = await Promise.all([
    fs.promises.readFile(filePath, "utf-8"),
    fs.promises.stat(filePath),
  ]);

  const session = await readSession();
  if (
    session &&
    isMarkdownFile(filePath) &&
    isPathInsideRoot(session.rootPath, filePath)
  ) {
    await writeSession({ rootPath: session.rootPath, activePath: filePath });
  }

  return { content, mtimeMs: stat.mtimeMs };
});
```

### Option B — explicit `session:setActiveFile` IPC

More explicit but extra surface area; skip unless readFile coupling feels wrong.

## Step 5 — Restore handler (`session:restore`)

```typescript
ipcMain.handle("session:restore", async () => {
  const session = await readSession();
  if (!session) return null;

  const opened = await openProjectFolder(win, session.rootPath);
  if (!opened) {
    await clearSession();
    return null;
  }

  let activePath: string | null = null;
  let activeContent: string | null = null;

  if (
    session.activePath &&
    isMarkdownFile(session.activePath) &&
    isPathInsideRoot(session.rootPath, session.activePath)
  ) {
    try {
      activeContent = await fs.promises.readFile(session.activePath, "utf-8");
      activePath = session.activePath;
    } catch {
      await writeSession({ rootPath: session.rootPath, activePath: null });
    }
  }

  return {
    path: opened.path,
    tree: opened.tree,
    activePath,
    activeContent,
  };
});
```

**Important:** `openProjectFolder` currently resets `activePath` to `null`. For restore, either:

1. Add a `persistActivePath: boolean` flag to `openProjectFolder`, or
2. Split “start watching + build tree” from “write session”, and let `session:restore` write session after validating the file.

Recommended refactor:

```typescript
async function loadProjectFolder(
  win: BrowserWindow,
  rootPath: string,
): Promise<{ path: string; tree: FileNode[] } | null> {
  if (!(await pathExistsAsDirectory(rootPath))) return null;
  const tree = await buildTree(rootPath);
  startWatching(win, rootPath);
  return { path: rootPath, tree };
}

async function openProjectFolder(win, rootPath) {
  const loaded = await loadProjectFolder(win, rootPath);
  if (!loaded) return null;
  await writeSession({ rootPath, activePath: null });
  return loaded;
}
```

Then `session:restore` uses `loadProjectFolder`, validates file, and calls `writeSession` once with the final `{ rootPath, activePath }`.

## Step 6 — Preload bridge

```typescript
restoreLastSession: () => ipcRenderer.invoke("session:restore"),
```

Add to `src/renderer/src/types.ts`:

```typescript
export type RestoreResult = {
  path: string;
  tree: FileNode[];
  activePath: string | null;
  activeContent: string | null;
};

// Api
restoreLastSession: () => Promise<RestoreResult | null>;
```

## Step 7 — Store changes (`src/renderer/src/store.ts`)

### Add `applyFolder`

```typescript
applyFolder: (payload: { path: string; tree: FileNode[] }) => {
  set({
    rootPath: payload.path,
    tree: payload.tree,
    activePath: null,
    content: "",
    savedContent: "",
    externalChangePath: null,
  });
},
```

### Refactor `openFolder`

```typescript
openFolder: async () => {
  if ((await resolveUnsaved(get)) === "abort") return;
  // ... dialog IPC unchanged ...
  if (res) get().applyFolder(res);
},
```

### Add `restoreLastSession`

```typescript
restoreLastSession: async () => {
  if (get().rootPath) return; // already loaded (Strict Mode / second window)

  if (!window.api?.restoreLastSession) return;

  try {
    const res = await window.api.restoreLastSession();
    if (!res) return;

    set({
      rootPath: res.path,
      tree: res.tree,
      activePath: res.activePath,
      content: res.activeContent ?? "",
      savedContent: res.activeContent ?? "",
      externalChangePath: null,
    });
  } catch (error) {
    console.error("restoreLastSession failed:", error);
  }
},
```

## Step 8 — Lifecycle hook

```typescript
// useAppLifecycle.ts — inside useEffect, after subscriptions:
void useStore.getState().restoreLastSession();
```

Run after `window.api` is available (same effect as other IPC subscriptions).

Optional UX polish: add `sessionRestoring: boolean` to store and a subtle sidebar spinner while `session:restore` runs on large folders. Not required for v1.

## Step 9 — Register IPC channels

In `registerIpc`, add to the `removeHandler` list:

```typescript
"session:restore",
"fs:openFolderAtPath",
```

## Manual test plan

| # | Steps | Expected |
| --- | --- | --- |
| 1 | First install launch | Empty state, no `session.json` yet |
| 2 | Open folder, pick file, quit, relaunch | Folder + file restored |
| 3 | Relaunch without ever opening a file | Folder restored, no file selected |
| 4 | Delete saved folder on disk, relaunch | Empty state; `session.json` removed |
| 5 | Delete only the last file, relaunch | Folder restored; no file selected |
| 6 | **Change Folder** to new path, relaunch | New folder restored |
| 7 | Open dialog, click Cancel | Previous session still restored on next launch |
| 8 | Unsaved edits, **Change Folder**, save | New folder persisted (unchanged unsaved flow) |
| 9 | `npm run dev` twice | Dev userData session persists across dev restarts |
| 10 | Inspect `session.json` | Valid JSON, absolute paths, `version: 1` |

### Finding session file during dev

```typescript
// Temporary log in session.ts readSession:
console.log("[session]", SESSION_FILE());
```

Or in DevTools main process console after app ready:

```
app.getPath('userData')
```

## Release checklist

- [ ] `npm run typecheck` passes
- [ ] Manual test plan above on target OS (Windows + macOS if available)
- [ ] No change to README required for v1 (invisible behavior); optional one-liner under Features
- [ ] Root `PLANNING.md` non-goals unchanged

## Troubleshooting

| Symptom | Likely cause |
| --- | --- |
| Restore never runs | `restoreLastSession` not called in lifecycle; preload missing |
| Restore runs twice | Strict Mode — guard with `if (get().rootPath) return` |
| File not restored | `fs:readFile` persist not wired; path outside root |
| Session cleared every launch | Path wrong in dev vs prod userData; folder moved |
| `openProjectFolder` wipes active file on restore | Use `loadProjectFolder` + explicit `writeSession` in restore handler |

## Future hooks (not in this PR)

- `fs:openFolderAtPath` → drag-and-drop and recent folders
- `session:clear` IPC → “Forget last folder” if settings ever added
- Migrate to `SessionV2` if recents array is added:

```typescript
type SessionV2 = {
  version: 2;
  recentRoots: string[]; // max 5, MRU order
  lastRootPath: string;
  activePath: string | null;
};
```
