# Markdown Viewer — Implementation Document

This document is the step-by-step build guide for the app described in
[`PLANNING.md`](./PLANNING.md). It assumes the **Electron + React + TypeScript**
stack chosen there.

## 0. Prerequisites

- **Node.js** ≥ 20 LTS and **npm** ≥ 10 (or pnpm).
- **Git**.
- Windows 10/11 for final packaging/testing (dev works on macOS too).
- Recommended: VS Code / Cursor with ESLint + Prettier extensions.

## 1. Project Scaffold

We use [`electron-vite`](https://electron-vite.org/) for a ready-made
Electron + Vite + React + TS template.

```bash
npm create @quick-start/electron@latest markdown-viewer -- --template react-ts
cd markdown-viewer
npm install
```

Then add the runtime dependencies:

```bash
# Editor + Markdown rendering
npm install @uiw/react-codemirror @codemirror/lang-markdown @codemirror/language-data
npm install react-markdown remark-gfm rehype-highlight rehype-sanitize rehype-raw
npm install highlight.js

# State + icons
npm install zustand lucide-react

# Dev: packaging is provided by electron-builder (bundled with the template)
```

> If `@uiw/react-codemirror` feels too high-level, you can drop to the raw
> `codemirror` + `@codemirror/state`/`view` packages. The wrapper is fine for v1.

### Expected directory structure

```
markdown-viewer/
├─ electron-builder.yml          # packaging config
├─ electron.vite.config.ts       # build config (3 targets: main/preload/renderer)
├─ package.json
├─ tsconfig.json
├─ src/
│  ├─ main/                      # Electron main process (Node)
│  │  ├─ index.ts                # app lifecycle, BrowserWindow
│  │  └─ ipc.ts                  # ipcMain.handle handlers (fs, dialog, watch)
│  ├─ preload/
│  │  └─ index.ts                # contextBridge → window.api
│  └─ renderer/                  # React app
│     ├─ index.html
│     └─ src/
│        ├─ main.tsx
│        ├─ App.tsx
│        ├─ store.ts             # Zustand store
│        ├─ types.ts             # shared FileNode / IPC types
│        ├─ components/
│        │  ├─ Toolbar.tsx
│        │  ├─ Sidebar.tsx
│        │  ├─ FileTree.tsx
│        │  ├─ Editor.tsx
│        │  ├─ Preview.tsx
│        │  └─ MainView.tsx      # switches edit/preview/split
│        └─ styles/
│           └─ app.css
└─ resources/
   └─ icon.ico                   # Windows app icon
```

## 2. Shared Types

Create `src/renderer/src/types.ts` (and mirror in preload as needed):

```ts
export type FileNode = {
  name: string;
  path: string;
  type: 'file' | 'directory';
  children?: FileNode[];
};

export type ReadFileResult = { content: string; mtimeMs: number };
export type WriteFileResult = { mtimeMs: number };

export type Api = {
  openFolder: () => Promise<{ path: string; tree: FileNode[] } | null>;
  readDir: (dirPath: string) => Promise<FileNode[]>;
  readFile: (filePath: string) => Promise<ReadFileResult>;
  writeFile: (filePath: string, content: string) => Promise<WriteFileResult>;
  onFileChanged: (cb: (e: { event: string; path: string }) => void) => () => void;
};

declare global {
  interface Window {
    api: Api;
  }
}
```

## 3. Main Process

### 3.1 Window creation — `src/main/index.ts`

Key options (security + UX):

```ts
const win = new BrowserWindow({
  width: 1200,
  height: 800,
  minWidth: 800,
  minHeight: 500,
  show: false,
  autoHideMenuBar: true,
  webPreferences: {
    preload: join(__dirname, '../preload/index.js'),
    contextIsolation: true,
    nodeIntegration: false,
    sandbox: false, // needed so preload can require Node builtins
  },
});
win.on('ready-to-show', () => win.show());
```

Call `registerIpc(win)` (from `ipc.ts`) after the window is created.

### 3.2 File-system + dialog handlers — `src/main/ipc.ts`

Responsibilities:

- `dialog:openFolder` → `dialog.showOpenDialog({ properties: ['openDirectory'] })`,
  then build the tree via `buildTree(rootPath)`.
- `fs:readDir` → read one directory level (used for lazy expand).
- `fs:readFile` → `fs.promises.readFile(path, 'utf-8')` + `stat` for `mtimeMs`.
- `fs:writeFile` → `fs.promises.writeFile`, return new `mtimeMs`.
- `fs:watch` → `fs.watch(rootPath, { recursive: true })`, debounce, and push
  `fs:changed` events back to the renderer via `win.webContents.send`.

`buildTree` guidance:

```ts
const IGNORED = new Set(['node_modules', '.git', '.next', 'dist', 'out']);

async function buildTree(dir: string): Promise<FileNode[]> {
  const entries = await fs.promises.readdir(dir, { withFileTypes: true });
  const nodes = await Promise.all(
    entries
      .filter((e) => !IGNORED.has(e.name))
      .map(async (e) => {
        const full = path.join(dir, e.name);
        if (e.isDirectory()) {
          return { name: e.name, path: full, type: 'directory',
                   children: await buildTree(full) } as FileNode;
        }
        return { name: e.name, path: full, type: 'file' } as FileNode;
      }),
  );
  // directories first, then files, both alphabetical
  return nodes.sort((a, b) =>
    a.type === b.type ? a.name.localeCompare(b.name) : a.type === 'directory' ? -1 : 1,
  );
}
```

> For very large trees, switch `buildTree` to one level deep and load
> `children` lazily on expand via `fs:readDir`.

## 4. Preload Bridge — `src/preload/index.ts`

Expose a typed, minimal surface. The renderer never sees `ipcRenderer` directly.

```ts
import { contextBridge, ipcRenderer } from 'electron';

const api = {
  openFolder: () => ipcRenderer.invoke('dialog:openFolder'),
  readDir: (p: string) => ipcRenderer.invoke('fs:readDir', p),
  readFile: (p: string) => ipcRenderer.invoke('fs:readFile', p),
  writeFile: (p: string, content: string) =>
    ipcRenderer.invoke('fs:writeFile', { filePath: p, content }),
  onFileChanged: (cb: (e: { event: string; path: string }) => void) => {
    const listener = (_: unknown, payload: { event: string; path: string }) => cb(payload);
    ipcRenderer.on('fs:changed', listener);
    return () => ipcRenderer.removeListener('fs:changed', listener);
  },
};

contextBridge.exposeInMainWorld('api', api);
```

## 5. Renderer — State Store

`src/renderer/src/store.ts` (Zustand):

```ts
import { create } from 'zustand';
import type { FileNode } from './types';

type ViewMode = 'edit' | 'preview' | 'split';

interface State {
  rootPath: string | null;
  tree: FileNode[];
  activePath: string | null;
  content: string;
  savedContent: string;
  viewMode: ViewMode;
  isDirty: () => boolean;

  openFolder: () => Promise<void>;
  openFile: (path: string) => Promise<void>;
  setContent: (c: string) => void;
  save: () => Promise<void>;
  setViewMode: (m: ViewMode) => void;
}

export const useStore = create<State>((set, get) => ({
  rootPath: null,
  tree: [],
  activePath: null,
  content: '',
  savedContent: '',
  viewMode: 'split',
  isDirty: () => get().content !== get().savedContent,

  openFolder: async () => {
    const res = await window.api.openFolder();
    if (res) set({ rootPath: res.path, tree: res.tree });
  },
  openFile: async (path) => {
    // (guard unsaved changes before switching — see §7.3)
    const { content } = await window.api.readFile(path);
    set({ activePath: path, content, savedContent: content });
  },
  setContent: (c) => set({ content: c }),
  save: async () => {
    const { activePath, content } = get();
    if (!activePath) return;
    await window.api.writeFile(activePath, content);
    set({ savedContent: content });
  },
  setViewMode: (m) => set({ viewMode: m }),
}));
```

## 6. Renderer — Components

### 6.1 `App.tsx` — layout

```tsx
export default function App() {
  return (
    <div className="app">
      <Toolbar />
      <div className="body">
        <Sidebar />
        <MainView />
      </div>
    </div>
  );
}
```

CSS for the two-column layout (`styles/app.css`):

```css
.app { display: flex; flex-direction: column; height: 100vh; }
.body { display: flex; flex: 1; min-height: 0; }
.sidebar { width: 280px; min-width: 180px; overflow: auto; border-right: 1px solid var(--border); }
.main { flex: 1; min-width: 0; overflow: hidden; }
```

### 6.2 `Toolbar.tsx`

- "Open Folder" button → `store.openFolder()`.
- Segmented control: Edit | Split | Preview → `store.setViewMode(...)`.
- Save button (disabled unless `isDirty()`), shows `●` when dirty.

### 6.3 `Sidebar.tsx` + `FileTree.tsx`

- `Sidebar` renders the project name + `<FileTree nodes={tree} />`.
- `FileTree` is recursive: directories render an expandable row (chevron +
  folder icon) and their `children`; files render a clickable row.
- Clicking a `.md` file → `store.openFile(node.path)`. Highlight `activePath`.
- Non-`.md` files rendered dimmed; click is a no-op in v1.

### 6.4 `Editor.tsx` (CodeMirror)

```tsx
import CodeMirror from '@uiw/react-codemirror';
import { markdown, markdownLanguage } from '@codemirror/lang-markdown';
import { languages } from '@codemirror/language-data';

export function Editor() {
  const { content, setContent } = useStore();
  return (
    <CodeMirror
      value={content}
      height="100%"
      extensions={[markdown({ base: markdownLanguage, codeLanguages: languages })]}
      onChange={setContent}
      theme="dark"
    />
  );
}
```

### 6.5 `Preview.tsx` (react-markdown)

```tsx
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeHighlight from 'rehype-highlight';
import rehypeSanitize from 'rehype-sanitize';
import 'highlight.js/styles/github-dark.css';

export function Preview() {
  const content = useStore((s) => s.content);
  return (
    <div className="preview markdown-body">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeSanitize, rehypeHighlight]}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
```

> Add GitHub-like Markdown CSS (e.g. `github-markdown-css`) for nice typography.

### 6.6 `MainView.tsx` — mode switch

```tsx
export function MainView() {
  const viewMode = useStore((s) => s.viewMode);
  const activePath = useStore((s) => s.activePath);

  if (!activePath) return <div className="main empty">Select a Markdown file</div>;

  return (
    <div className="main">
      {viewMode === 'edit' && <Editor />}
      {viewMode === 'preview' && <Preview />}
      {viewMode === 'split' && (
        <div className="split">
          <div className="split-pane"><Editor /></div>
          <div className="split-pane"><Preview /></div>
        </div>
      )}
    </div>
  );
}
```

```css
.split { display: flex; height: 100%; }
.split-pane { flex: 1; min-width: 0; overflow: auto; }
.split-pane:first-child { border-right: 1px solid var(--border); }
```

## 7. Cross-Cutting Behavior

### 7.1 Keyboard shortcuts

Register in `App.tsx` via a `useEffect` keydown listener (or an Electron menu
accelerator in the main process):

| Shortcut | Action |
| --- | --- |
| `Ctrl+O` | Open folder |
| `Ctrl+S` | Save active file |
| `Ctrl+Shift+V` | Toggle Preview |
| `Ctrl+\` | Toggle Split |

### 7.2 File watching / external changes

- On `openFolder`, start the watcher; subscribe with `window.api.onFileChanged`.
- On a change event for `activePath`: if `!isDirty()`, silently reload; else show
  a banner with **Reload** / **Keep my changes**.
- On directory add/remove, refresh the tree (debounced).

### 7.3 Unsaved-changes guard

Before `openFile` switches files or the window closes, if `isDirty()`, show a
Save / Discard / Cancel dialog (`dialog.showMessageBox` in main, triggered via an
IPC call, or an in-app modal).

### 7.4 Theming

- Read `nativeTheme.shouldUseDarkColors` in main and pass to renderer, or use CSS
  `prefers-color-scheme`. Default dark. Expose a manual toggle later.

## 8. Packaging (Windows)

`electron-builder.yml`:

```yaml
appId: com.example.markdownviewer
productName: Markdown Viewer
directories:
  output: release
win:
  target:
    - nsis
    - portable
  icon: resources/icon.ico
nsis:
  oneClick: false
  allowToChangeInstallationDirectory: true
```

Build commands (already wired by the electron-vite template):

```bash
npm run build        # type-check + bundle main/preload/renderer
npm run build:win    # produce NSIS installer + portable .exe in release/
```

Output: `release/Markdown Viewer Setup x.y.z.exe` (installer) and a portable
`.exe`.

## 9. Testing Strategy

- **Unit:** `buildTree` sorting/ignore logic; store reducers (dirty calc, save).
  Use **Vitest**.
- **Component:** render `Preview` with sample Markdown (tables, code, links) and
  assert sanitization strips `<script>`. Use **React Testing Library**.
- **Manual smoke checklist** (per acceptance criteria in PLANNING §8):
  1. Open folder → tree populates.
  2. Click `.md` → preview renders.
  3. Edit mode → type → dirty dot appears.
  4. Split mode → preview updates live.
  5. `Ctrl+S` → dirty clears, file on disk updated.
  6. `npm run build:win` → installer runs on a clean Windows VM.

## 10. Build Order (mapped to milestones)

1. **M1 Skeleton:** scaffold, two-column CSS, empty Toolbar/Sidebar/MainView.
2. **M2 File tree:** main `dialog:openFolder` + `buildTree`; `Sidebar`/`FileTree`.
3. **M3 Editor:** `fs:readFile`/`fs:writeFile`; `Editor`; dirty tracking; save.
4. **M4 Preview & modes:** `Preview`; `MainView` mode switch; segmented control.
5. **M5 Polish:** shortcuts, watcher, unsaved guard, theming, scroll sync.
6. **M6 Packaging:** icon, `electron-builder.yml`, `build:win`, test on Windows.

## 11. Future Enhancements

- Tabs for multiple open files.
- Full-text search across the project.
- Synchronized scroll in Split mode (line-mapping).
- Export to HTML/PDF.
- Tauri migration to shrink install size.
- Settings panel (theme, font size, default view mode).
