# Project Memory — Markdown Viewer

_Last updated: 2026-06-02 (reopen-last-folder planning)_

## Entities

- **Markdown Viewer (App)** — Windows desktop app to view/edit `.md` files with
  Edit / Preview / Split modes (Cursor-like).
- **Sidebar (Component)** — left column; file tree of the chosen project dir.
- **MainView (Component)** — wider right column; hosts Editor and/or Preview.
- **Editor (Component)** — CodeMirror 6 raw Markdown editing.
- **Preview (Component)** — react-markdown rendered output.
- **Main Process (Electron)** — file-system access, dialogs, watching, IPC.
- **PLANNING.md (Doc)** — vision, requirements, architecture, tech decision.
- **IMPLEMENTATION.md (Doc)** — scaffold, IPC contract, component code, packaging.
- **Scaffold Codebase (Code)** — initialized Electron + React + TypeScript app
  with `src/main`, `src/preload`, and `src/renderer` starter files.
- **electron-builder config (Build Asset)** — `electron-builder.yml` plus npm
  scripts for Windows NSIS + portable packaging.

## Relationships

- App **is built with** Electron + React + TypeScript + Vite (electron-vite).
- App **uses** CodeMirror 6 for editing, react-markdown (+remark-gfm,
  rehype-highlight, rehype-sanitize) for preview, Zustand for state.
- Sidebar + MainView **compose** the App's two-column layout.
- Renderer **communicates with** Main Process via typed preload `window.api` IPC
  (contextIsolation on, nodeIntegration off).
- PLANNING.md **is implemented by** IMPLEMENTATION.md.
- App **is packaged with** electron-builder (NSIS + portable, Windows target).
- electron-builder config **drives** release artifacts in `release/`.
- Scaffold Codebase **implements** Milestone M1 (project bootstrap and layout
  skeleton).

## Observations / Decisions

- Workspace was empty (greenfield); no prior memory file existed.
- Chose **Electron** over Tauri/WPF to match the Cursor/VS Code editing UX the
  user referenced; Tauri noted as future migration to reduce install size.
- Default view mode = **Preview**; default theme = **dark**.
- Three view modes are now **Markdown / Preview / Split**.
- File tree ignores `node_modules`, `.git`, `dist`, `out` by default.
- Security: sanitize rendered HTML (`rehype-sanitize`); no node access in renderer.
- 6 milestones M1–M6: Skeleton → File tree → Editor → Preview/modes → Polish →
  Packaging.
- Project scaffold is now in place with runnable scripts:
  `npm run dev`, `npm run build`, `npm run typecheck`.
- Initial UI includes toolbar + two-column shell (`sidebar` + wider `main` pane).
- Milestone M2 is now implemented:
  - Native Open Folder dialog wired through IPC.
  - Recursive file tree rendered in sidebar with expandable directories.
  - `.md` files are selectable and load their content in the main pane.
  - Non-markdown files are visible but disabled in v1.

## Open Questions / Next Steps

- Decide eager vs lazy directory tree loading for large projects.
- Scroll sync in Split mode is a stretch goal.
- Milestone M3 is now implemented:
  - CodeMirror markdown editor in main pane.
  - Dirty tracking via `content` vs `savedContent`.
  - Save via toolbar button and `Ctrl+S` / `Cmd+S`.
  - `fs:writeFile` IPC + preload bridge.
  - Unsaved-change confirm when switching files or opening a new folder.
- Milestone M4 is now implemented:
  - react-markdown preview with GFM, syntax highlighting, and sanitization.
  - Edit / Split / Preview toolbar segmented control (default: Split).
  - Live preview updates as user edits in Split mode.
  - Shortcuts: Ctrl+O open folder, Ctrl+S save, Ctrl+Shift+V toggle preview,
    Ctrl+\\ toggle split.
- Milestone M5 is now implemented:
  - File watcher with debounced tree refresh and external-change banner.
  - Native Save / Don't Save / Cancel dialog for unsaved changes.
  - Window close guard when dirty.
  - Theme: System / Dark / Light (toolbar cycle button).
  - Best-effort split-view scroll sync.
- Next implementation target is M6 (Windows packaging with electron-builder).
- Scroll behavior troubleshooting (2026-06-02):
  - Removed split scroll-sync wrapper from active rendering path.
  - Enforced CodeMirror internal scroller ownership via CSS
    (`.cm-scroller` overflow auto, parent overflow hidden).
- Theme preference default changed to `dark` so app now starts in dark mode.
- UI/UX design pass (2026-06-02):
  - Removed "Markdown Viewer" title from toolbar; toolbar shows active filename + dirty dot.
  - Open Folder moved to sidebar as primary `button-primary` action.
  - Smaller "Explorer" label (10px uppercase) with folder name below.
  - Resizable sidebar width and split pane ratio (persisted in localStorage).
  - Full `styles.css` refresh: tokens, toolbar, sidebar, tree, resize handles, empty states.
  - Deleted unused `SplitScrollSync.tsx`.
- M6 packaging setup (2026-06-02):
  - Added `electron-builder` dev dependency and `electron-builder.yml`.
  - Added scripts: `dist` and `build:win` (x64, NSIS + portable).
  - Moved `electron` to `devDependencies` to satisfy builder requirements.
  - Verified Windows packaging from macOS produces:
    - `release/Markdown Viewer Setup 1.0.0.exe`
    - `release/Markdown Viewer 1.0.0.exe`
- Branding update (2026-06-02):
  - App/window/installer name changed from "Markdown Viewer" to "Markdown".
  - Icon paths: `resources/icon.ico` (Windows), `resources/icon.icns` (macOS), `resources/icon.png` (Linux).
- Git (2026-06-02):
  - Repo initialized; remote `git@github.com:juchheim/markdown.git`, branch `main`.
  - `.gitignore` excludes `node_modules/`, `out/`, `release/`, build artifacts.
- README.md (2026-06-02): thorough project README added at repo root.
- Reopen last folder planning (2026-06-02):
  - `docs/planning/reopen-last-folder/PLANNING.md` — product scope, UX, architecture.
  - `docs/planning/reopen-last-folder/IMPLEMENTATION.md` — step-by-step build guide.
  - Decision: main-process `userData/session.json` (not renderer localStorage).
  - Restore last folder + last active `.md` on cold start; silent fallback if missing.
  - Shared `loadProjectFolder` / `openProjectFolder` IPC; `session:restore` on mount.
- Reopen last folder implemented (2026-06-02):
  - `src/main/session.ts` — atomic read/write/clear of `userData/session.json`.
  - `src/main/ipc.ts` — `loadProjectFolder`, `openProjectFolder`, `session:restore`,
    `fs:openFolderAtPath`; persist active file on `fs:readFile`.
  - Renderer: `restoreLastSession` in store + `useAppLifecycle` on mount.
- Find in file (2026-06-02):
  - Unified `FindBar` over shared `content` buffer — works in Markdown, Preview, Split.
  - Removed `@codemirror/search`; CM used only for selection/scroll in editor modes.
  - Preview navigation via DOM text walk; README shortcuts updated.
  - Match highlighting: CodeMirror decorations + CSS Custom Highlight API in preview.
  - Find bar navigates only on Enter (not per-keystroke); contained scrolling
    (`scrollRangeIntoContainer`) so the app shell never scrolls.
  - Discovery: subtle muted `find-hint` button in Toolbar (`⌘F`/`Ctrl+F to find`),
    shown only when a file is open; visible in all view modes; clicking opens find.
- Auto-updater v1 (2026-06-02):
  - `electron-updater` + `src/main/updater.ts` — check on startup, Windows NSIS only.
  - GitHub publish in `electron-builder.yml` (`juchheim/markdown`).
  - Docs: `docs/planning/updater/PLANNING.md`, `IMPLEMENTATION.md`.
  - Script: `npm run dist:publish:win` (requires `GH_TOKEN`).
  - Portable builds and dev mode skip updater.
  - GitHub Actions: `.github/workflows/release.yml` on tag `v*` → publish NSIS to Releases.
  - Fix: `electron-updater` is CJS — import default then destructure `autoUpdater`
    (ESM main crashed on named import).
- In-app update notification (2026-06-02):
  - Main broadcasts `updater:status` (`available` / `downloaded` + version);
    `updater:restart` IPC → `quitAndInstall()`.
  - Preload `onUpdateStatus` + `restartToUpdate`; store `updateStatus` + actions.
  - `UpdateToast.tsx` — bottom-left toast; "Restart now" / "Later"; instructs that
    closing and reopening also applies the update.
  - Released as v1.0.1 (bump required so an installed v1.0.0 sees an update to test).
