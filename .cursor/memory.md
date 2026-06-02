# Project Memory — Markdown Viewer

_Last updated: 2026-06-02 (M6 packaging wired)_

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
