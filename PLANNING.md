# Markdown Viewer - Planning Document

## 1. Overview

**Markdown Viewer** is a lightweight Windows desktop application for viewing and
editing Markdown (`.md`) files. The experience mirrors the Markdown editing flow
in Cursor / VS Code: the user can toggle between a raw **Edit** mode and a
rendered **Preview** mode, with a **Split** view that shows both side-by-side.

The window is split into two columns:

- **Left column (sidebar):** a file tree showing every file in the chosen
  project directory.
- **Right column (main area):** the selected `.md` file is viewed and edited
  here. This column is wider than the sidebar.

### Goals

- Open a project directory and browse its files in a tree.
- View a `.md` file rendered as formatted HTML (preview).
- Edit the raw Markdown source with syntax highlighting.
- Toggle between Edit, Preview, and Split modes (Cursor-like behavior).
- Save changes back to disk with clear unsaved-change state.
- Keep performance responsive for normal project sizes.

### Non-Goals (initial release)

- Real-time collaboration or multi-user editing.
- Cloud sync and user accounts.
- WYSIWYG rich-text editing (raw Markdown only).
- Git integration, diffing, or source-control UI.
- Mobile or web-hosted versions.

## 2. Target Platform & Constraints

- **Primary OS:** Windows 10/11 (x64).
- **Distribution:** standard Windows installer (`.exe`) and portable build.
- **Offline-first:** app works without network connectivity.

## 3. Technology Decision

We considered these options:

| Option | Pros | Cons |
| --- | --- | --- |
| **Electron + React** | Closest to Cursor/VS Code UX; mature editor ecosystem; straightforward filesystem access. | Larger install size and higher memory use. |
| **Tauri + React** | Smaller binaries and lower memory footprint. | Rust complexity and somewhat less mature desktop ecosystem. |
| **WPF/.NET** | Native Windows look/feel. | More custom effort for modern editor/preview UX. |

### Chosen stack: **Electron + React + TypeScript**

Reasoning: it best matches the Cursor-like markdown editing experience requested,
provides low-risk delivery speed, and supports polished editor/preview behavior.

#### Core libraries

| Concern | Library | Notes |
| --- | --- | --- |
| App shell | **Electron** | Main + renderer processes. |
| Build/dev | **Vite** + **electron-vite** | Fast HMR and TS workflow. |
| UI | **React 18 + TypeScript** | Component architecture. |
| Editor | **CodeMirror 6** (`@codemirror/lang-markdown`) | Markdown editing with syntax support. |
| Markdown render | **react-markdown** + **remark-gfm** + **rehype-highlight** | GitHub-flavored preview + code highlighting. |
| Sanitization | **rehype-sanitize** | Safer rendering of markdown content. |
| State | **Zustand** | Lightweight shared app state. |
| Packaging | **electron-builder** | Windows installer + portable outputs. |

## 4. Architecture

### 4.1 Process model (Electron)

```
Main Process (Node):
- App lifecycle + window creation
- File system reads/writes
- Native dialogs (open folder)
- File watcher + IPC handlers

Preload Bridge:
- Typed safe API exposed as window.api

Renderer Process (React):
- Sidebar file tree
- Editor / Preview / Split UI
- Store for app state and dirty tracking
```

Security defaults:

- `contextIsolation: true`
- `nodeIntegration: false`
- Renderer accesses filesystem only through preload + IPC.

### 4.2 IPC contract (renderer <-> main)

| Channel | Direction | Payload | Returns |
| --- | --- | --- | --- |
| `dialog:openFolder` | R->M | none | `{ path, tree } | null` |
| `fs:readDir` | R->M | `dirPath` | `FileNode[]` |
| `fs:readFile` | R->M | `filePath` | `{ content, mtimeMs }` |
| `fs:writeFile` | R->M | `{ filePath, content }` | `{ mtimeMs }` |
| `fs:watch` | R->M | `rootPath` | watcher started |
| `fs:changed` | M->R | `{ event, path }` | event push |

### 4.3 Data model

```ts
type FileNode = {
  name: string;
  path: string;
  type: 'file' | 'directory';
  children?: FileNode[];
};

type EditorState = {
  rootPath: string | null;
  tree: FileNode[];
  activePath: string | null;
  content: string;
  savedContent: string;
  isDirty: boolean;
  viewMode: 'edit' | 'preview' | 'split';
};
```

## 5. UX / UI Layout

```
Toolbar: Open Folder | Edit / Split / Preview | Save
-----------------------------------------------------
| Left Sidebar (project file tree) | Right Main Pane |
| ~280px                            | wide area       |
| expandable folders and files      | editor/preview  |
```

### Behavior details

- **Open project:** user chooses a directory from native folder picker.
- **File tree:** folders expand/collapse; `.md` files selectable for viewing/editing.
- **Modes:**
  - **Edit** - full-width markdown editor.
  - **Preview** - full-width rendered markdown.
  - **Split** - editor and live preview side-by-side.
- **Dirty state:** visible unsaved indicator when current buffer differs from disk.
- **Save:** `Ctrl+S` writes file and clears dirty indicator.
- **External changes:** auto-reload when safe; prompt when local edits are dirty.

### Theming

- Light/dark support with dark default and system-theme awareness.

## 6. Milestones

| Milestone | Scope |
| --- | --- |
| **M1 - Skeleton** | Bootstrap Electron + React app; two-column layout; toolbar shell. |
| **M2 - File tree** | Open folder dialog; display expandable file tree. |
| **M3 - Editor** | Load/save `.md` files; dirty tracking; keyboard save shortcut. |
| **M4 - Preview & modes** | Render markdown; Edit/Preview/Split toggles with live updates. |
| **M5 - Polish** | Watcher updates, unsaved-change guards, theme tuning, shortcuts. |
| **M6 - Packaging** | Build Windows installer + portable executable. |

## 7. Risks & Mitigations

| Risk | Mitigation |
| --- | --- |
| Unsafe markdown HTML | Use `rehype-sanitize` and keep renderer isolated. |
| Slow large directory loads | Ignore heavy folders and support lazy loading if needed. |
| Electron bundle size | Accept in v1; evaluate Tauri later if needed. |
| Split-mode scroll sync complexity | Ship best-effort sync first; iterate later. |

## 8. Acceptance Criteria (v1)

1. User opens a project directory and sees files in the left sidebar.
2. Clicking a `.md` file shows content in the right pane.
3. User can edit markdown source in Edit mode.
4. User can preview rendered markdown in Preview mode.
5. User can use Split mode for simultaneous edit + preview.
6. `Ctrl+S` saves changes to disk and clears dirty state.
7. App can be packaged and installed on Windows.
