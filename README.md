# Markdown

A lightweight desktop app for browsing, editing, and previewing Markdown files in a project folder. The layout and workflow are inspired by the Markdown experience in Cursor and VS Code: a file explorer on the left, editing and preview on the right, with **Markdown**, **Split**, and **Preview** view modes.

Built with **Electron**, **React**, and **TypeScript**. Offline-first; no accounts or cloud sync.

## Features

### Project & file browser

- Open any folder via a native directory picker (**Open Folder** in the sidebar).
- Recursive file tree with expandable directories.
- Only `.md` files are editable; other files appear in the tree but are disabled.
- Heavy or generated folders are skipped: `node_modules`, `.git`, `.next`, `dist`, `out`.

### Three view modes

| Mode | Left / main area | Behavior |
| --- | --- | --- |
| **Markdown** | CodeMirror 6 | Raw Markdown source with syntax highlighting and line numbers. |
| **Preview** | MDXEditor | Rich editing surface with formatting toolbar (headings, lists, links, tables, code blocks, etc.). |
| **Split** | CodeMirror + MDXEditor | Source on the left, live preview on the right; panes are resizable. |

Content is shared through a single document buffer, so edits in any mode stay in sync until you save.

### Editing & saving

- Dirty indicator (dot next to filename) when the buffer differs from disk.
- **Save** toolbar button and **Ctrl+S** / **Cmd+S**.
- Create a new `.md` file in the open folder via the **+** button in the Explorer header or **Ctrl+N** / **Cmd+N**.
- Right-click a markdown file in the explorer to **Rename** or **Delete** it.
- Unsaved-change prompts when switching files, opening a new folder, or closing the window (native **Save** / **Don't Save** / **Cancel** on supported platforms).

### External file changes

- The main process watches the open project directory (debounced).
- If the active file changes on disk and you have no local edits, it reloads automatically.
- If you have unsaved edits, a banner offers **Reload** or **Keep my changes**.

### UI polish

- Resizable sidebar and split-pane ratio (persisted in `localStorage`).
- Theme cycle: **System** → **Dark** → **Light** (default: **Dark**).
- Keyboard shortcuts for common actions (see below).

### Packaging

- **Windows**: NSIS installer and portable `.exe` (x64).
- **macOS**: DMG and ZIP (icons included).
- **Linux**: configurable via `electron-builder` (icon included).

## Screenshots

_Add screenshots here after capturing the app in Markdown / Split / Preview modes._

## Requirements

- **Node.js** 20 LTS or newer
- **npm** 10+ (or compatible package manager)
- **Git** (to clone the repository)

For building Windows installers, you can run `electron-builder` from macOS or Linux; final smoke-testing on Windows is recommended.

## Getting started

### Clone and install

```bash
git clone git@github.com:juchheim/markdown.git
cd markdown
npm install
```

### Development

Start the app with hot reload (Electron + Vite):

```bash
npm run dev
```

Type-check without emitting files:

```bash
npm run typecheck
```

### Production build (app bundle only)

Compile main, preload, and renderer into `out/`:

```bash
npm run build
```

Preview the built renderer in Electron (optional):

```bash
npm run preview
```

### Distribution installers

Build for the current platform (uses `electron-builder.yml`):

```bash
npm run dist
```

Platform-specific shortcuts:

```bash
# Windows: NSIS installer + portable exe
npm run build:win

# macOS: DMG + ZIP
npm run build:mac
```

Artifacts are written to `release/`, for example:

- `release/Markdown Setup 1.0.0.exe` (Windows installer)
- `release/Markdown 1.0.0.exe` (Windows portable)
- macOS DMG / ZIP under `release/` when built on macOS

### Download for end users

Published Windows installers are on GitHub Releases:

**https://github.com/juchheim/markdown/releases/latest**

Download **Markdown Setup …exe** (NSIS). That build receives in-app updates on startup. The portable `.exe` does not auto-update.

### Releasing (maintainers)

1. Bump `version` in `package.json`.
2. Commit and push to `main`.
3. Tag and push (tag must match version, e.g. `v1.0.1` ↔ `"1.0.1"`):

   ```bash
   git tag v1.0.1
   git push origin v1.0.1
   ```

4. GitHub Actions (`.github/workflows/release.yml`) builds and publishes the NSIS installer + `latest.yml`.

Details: [`docs/planning/updater/IMPLEMENTATION.md`](./docs/planning/updater/IMPLEMENTATION.md).

## Keyboard shortcuts

Shortcuts use **Ctrl** on Windows/Linux and **Cmd** on macOS.

| Shortcut | Action |
| --- | --- |
| **Ctrl+O** / **Cmd+O** | Open folder |
| **Ctrl+N** / **Cmd+N** | New markdown file |
| **Ctrl+S** / **Cmd+S** | Save active file |
| **Ctrl+F** / **Cmd+F** | Find in file (all view modes) |
| **Ctrl+G** / **Cmd+G** | Next match (while find bar is open) |
| **Ctrl+Shift+G** / **Cmd+Shift+G** | Previous match (while find bar is open) |
| **Escape** | Close find bar |
| **Ctrl+Shift+V** / **Cmd+Shift+V** | Toggle Markdown ↔ Preview |
| **Ctrl+\\** / **Cmd+\\** | Toggle Markdown ↔ Split |

View mode can also be switched from the toolbar segmented control when a file is open.

## Project structure

```
.
├── electron-builder.yml      # Installer / portable / DMG config
├── electron.vite.config.ts   # Main, preload, renderer build targets
├── package.json
├── tsconfig.json
├── resources/                # App icons (.ico, .icns, .png)
├── src/
│   ├── main/                 # Electron main process
│   │   ├── index.ts          # App lifecycle, window, theme events
│   │   ├── ipc.ts            # Dialogs, filesystem, IPC handlers
│   │   └── watch.ts          # Debounced directory watcher
│   ├── preload/
│   │   └── index.ts          # contextBridge → window.api
│   └── renderer/             # React UI
│       ├── index.html
│       └── src/
│           ├── App.tsx
│           ├── store.ts      # Zustand app state
│           ├── types.ts      # Shared types + Api contract
│           ├── components/   # Toolbar, Sidebar, Editor, Preview, …
│           ├── hooks/        # Lifecycle, scroll sync
│           └── styles.css
├── PLANNING.md               # Product vision, architecture, milestones
└── IMPLEMENTATION.md         # Build guide and implementation notes
```

Generated paths (not committed):

- `node_modules/` — dependencies
- `out/` — compiled app from `npm run build`
- `release/` — installers from `npm run dist`

## Architecture

### Process model

```
┌─────────────────────────────────────────────────────────────┐
│  Main process (Node)                                        │
│  • Window lifecycle                                         │
│  • Native open-folder / unsaved dialogs                     │
│  • Filesystem read/write, recursive tree build              │
│  • fs.watch on project root (debounced → renderer)          │
└──────────────────────────┬──────────────────────────────────┘
                           │ IPC
┌──────────────────────────▼──────────────────────────────────┐
│  Preload (contextBridge)                                    │
│  • Exposes typed window.api — no Node in renderer            │
└──────────────────────────┬──────────────────────────────────┘
                           │
┌──────────────────────────▼──────────────────────────────────┐
│  Renderer (React + Zustand)                                 │
│  • Sidebar file tree                                        │
│  • Toolbar: filename, view modes, theme, save               │
│  • MainView: Editor (CodeMirror) / Preview (MDXEditor)      │
└─────────────────────────────────────────────────────────────┘
```

### Security defaults

- `contextIsolation: true`
- `nodeIntegration: false`
- Renderer filesystem access only through preload IPC (`window.api`)

### IPC API (`window.api`)

| Method / event | Description |
| --- | --- |
| `openFolder()` | Native folder picker; returns `{ path, tree }` and starts watching. |
| `readFile(path)` | Read UTF-8 file + `mtimeMs`. |
| `writeFile(path, content)` | Write file; returns updated `mtimeMs`. |
| `refreshTree(rootPath)` | Rebuild file tree after external changes. |
| `confirmUnsaved()` | Native Save / Don't Save / Cancel dialog. |
| `getSystemDark()` | Whether OS prefers dark mode. |
| `onFileChanged(cb)` | Push when watched files change. |
| `onThemeChanged(cb)` | Push when system theme changes. |
| `onRequestClose(cb)` | Window close intercepted until unsaved handled. |
| `allowClose()` | Permit window to close after user choice. |

### State (Zustand)

Core fields: `rootPath`, `tree`, `activePath`, `content`, `savedContent`, `viewMode`, `themePreference`, layout (`sidebarWidth`, `splitRatio`).

Persistence keys in `localStorage`:

- `mv:sidebarWidth` (default `256`, clamped 180–480)
- `mv:splitRatio` (default `0.5`, clamped 0.2–0.8)

## Tech stack

| Layer | Choice |
| --- | --- |
| Shell | [Electron](https://www.electronjs.org/) 41 |
| Build / dev | [electron-vite](https://electron-vite.org/) + [Vite](https://vitejs.dev/) 7 |
| UI | [React](https://react.dev/) 19 + TypeScript 6 |
| Raw editor | [CodeMirror 6](https://codemirror.net/) via `@uiw/react-codemirror` |
| Preview editor | [MDXEditor](https://mdxeditor.dev/) (`@mdxeditor/editor`) |
| State | [Zustand](https://zustand.docs.pmnd.rs/) |
| Icons | [lucide-react](https://lucide.dev/) |
| Packaging | [electron-builder](https://www.electron.build/) |

## Scripts reference

| Script | Description |
| --- | --- |
| `npm run dev` | Development with HMR |
| `npm run build` | Compile to `out/` |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run preview` | Preview production renderer build |
| `npm run dist` | `build` + platform packages in `release/` |
| `npm run build:win` | Windows NSIS + portable (x64) |
| `npm run build:mac` | macOS DMG + ZIP |

## Roadmap & non-goals

Planned or documented scope lives in [`PLANNING.md`](./PLANNING.md). Current **non-goals** for v1 include:

- Real-time collaboration
- Cloud sync / user accounts
- Git UI, diffs, or source control integration
- Web or mobile clients

Possible future improvements: lazy directory loading for huge trees, smaller binary via Tauri migration, tighter split-view scroll sync.

## Contributing

1. Fork or branch from `main`.
2. Run `npm run dev` and `npm run typecheck` before opening a PR.
3. Keep changes focused; match existing patterns in `src/main`, `src/preload`, and `src/renderer`.

For deeper design context, see [`PLANNING.md`](./PLANNING.md) and [`IMPLEMENTATION.md`](./IMPLEMENTATION.md).

## License

ISC — see [`package.json`](./package.json).
