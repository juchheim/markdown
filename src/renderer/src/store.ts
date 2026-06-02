import { clearFindHighlight } from "./codemirror/findHighlight";
import type { EditorView } from "@codemirror/view";
import { EditorView as EditorViewNS } from "@codemirror/view";
import { create } from "zustand";
import type {
  FileNode,
  ThemePreference,
  UnsavedChoice,
  UpdateStatus,
} from "./types";
import { findMatches } from "./utils/findMatches";
import { scrollPreviewToMatch } from "./utils/previewFindHighlight";

export type ViewMode = "markdown" | "preview" | "split";

const SIDEBAR_MIN = 180;
const SIDEBAR_MAX = 480;
const SPLIT_MIN = 0.2;
const SPLIT_MAX = 0.8;

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

function readNumber(key: string, fallback: number): number {
  if (typeof localStorage === "undefined") return fallback;
  const raw = localStorage.getItem(key);
  const parsed = raw == null ? NaN : Number(raw);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function writeNumber(key: string, value: number): void {
  if (typeof localStorage !== "undefined") {
    localStorage.setItem(key, String(value));
  }
}

interface State {
  rootPath: string | null;
  tree: FileNode[];
  activePath: string | null;
  content: string;
  savedContent: string;
  viewMode: ViewMode;
  themePreference: ThemePreference;
  systemDark: boolean;
  externalChangePath: string | null;
  updateStatus: UpdateStatus | null;
  sidebarWidth: number;
  splitRatio: number;

  isDirty: () => boolean;
  effectiveTheme: () => "light" | "dark";
  openFolder: () => Promise<void>;
  applyFolder: (payload: { path: string; tree: FileNode[] }) => void;
  restoreLastSession: () => Promise<void>;
  openFile: (filePath: string) => Promise<void>;
  creatingFile: boolean;
  beginCreateFile: () => void;
  cancelCreateFile: () => void;
  createFile: (name: string) => Promise<{ ok: boolean; error?: string }>;
  renamingPath: string | null;
  beginRename: (filePath: string) => void;
  cancelRename: () => void;
  renameFile: (
    filePath: string,
    newName: string,
  ) => Promise<{ ok: boolean; error?: string }>;
  deleteFile: (filePath: string) => Promise<void>;
  showFileContextMenu: (filePath: string) => Promise<void>;
  setContent: (content: string) => void;
  save: () => Promise<void>;
  reloadActiveFile: () => Promise<void>;
  refreshTree: () => Promise<void>;
  handleFileChanged: (payload: { event: string; path: string }) => void;
  dismissExternalChange: () => void;
  applyExternalReload: () => Promise<void>;
  setViewMode: (mode: ViewMode) => void;
  togglePreview: () => void;
  toggleSplit: () => void;
  cycleTheme: () => void;
  setSystemDark: (dark: boolean) => void;
  setSidebarWidth: (width: number) => void;
  setSplitRatio: (ratio: number) => void;
  resetSidebarWidth: () => void;
  resetSplitRatio: () => void;
  requestAppClose: () => Promise<void>;
  setTree: (tree: FileNode[]) => void;
  setUpdateStatus: (status: UpdateStatus) => void;
  dismissUpdate: () => void;
  restartToUpdate: () => void;
  editorView: EditorView | null;
  setEditorView: (view: EditorView | null) => void;
  previewSearchRoot: HTMLElement | null;
  setPreviewSearchRoot: (root: HTMLElement | null) => void;
  findOpen: boolean;
  findQuery: string;
  findCaseSensitive: boolean;
  findMatchIndex: number;
  findNavigated: boolean;
  openFind: () => void;
  closeFind: () => void;
  setFindQuery: (query: string) => void;
  toggleFindCase: () => void;
  findNext: () => void;
  findPrevious: () => void;
  applyFindMatch: (indexOverride?: number) => void;
}

async function resolveUnsaved(
  get: () => State,
): Promise<"continue" | "abort"> {
  if (!get().isDirty()) return "continue";

  let choice: UnsavedChoice = "cancel";
  if (window.api?.confirmUnsaved) {
    choice = await window.api.confirmUnsaved();
  } else if (!window.confirm("Discard unsaved changes?")) {
    return "abort";
  } else {
    return "continue";
  }

  if (choice === "cancel") return "abort";
  if (choice === "save") {
    await get().save();
    if (get().isDirty()) return "abort";
  }
  return "continue";
}

export const useStore = create<State>((set, get) => ({
  rootPath: null,
  tree: [],
  activePath: null,
  content: "",
  savedContent: "",
  viewMode: "preview",
  themePreference: "dark",
  systemDark: true,
  externalChangePath: null,
  updateStatus: null,
  creatingFile: false,
  renamingPath: null,
  sidebarWidth: clamp(readNumber("mv:sidebarWidth", 256), SIDEBAR_MIN, SIDEBAR_MAX),
  splitRatio: clamp(readNumber("mv:splitRatio", 0.5), SPLIT_MIN, SPLIT_MAX),

  isDirty: () => get().content !== get().savedContent,

  effectiveTheme: () => {
    const { themePreference, systemDark } = get();
    if (themePreference === "system") return systemDark ? "dark" : "light";
    return themePreference;
  },

  openFolder: async () => {
    if ((await resolveUnsaved(get)) === "abort") return;

    if (!window.api?.openFolder) {
      const inElectron = navigator.userAgent.toLowerCase().includes("electron");
      window.alert(
        inElectron
          ? "Could not open folder dialog (preload failed). Quit the app fully, run `npm run dev`, and try again."
          : "Open Folder only works in the Electron desktop window. Run `npm run dev`.",
      );
      return;
    }

    try {
      const res = await window.api.openFolder();
      if (res) get().applyFolder(res);
    } catch (error) {
      console.error("openFolder failed:", error);
      window.alert(
        error instanceof Error ? error.message : "Failed to open folder.",
      );
    }
  },

  applyFolder: (payload) => {
    set({
      rootPath: payload.path,
      tree: payload.tree,
      activePath: null,
      content: "",
      savedContent: "",
      externalChangePath: null,
      findOpen: false,
      findQuery: "",
      findMatchIndex: 0,
      findNavigated: false,
    });
  },

  restoreLastSession: async () => {
    if (get().rootPath) return;

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

  openFile: async (filePath: string) => {
    if (!filePath.toLowerCase().endsWith(".md")) return;
    if (filePath === get().activePath) return;
    if ((await resolveUnsaved(get)) === "abort") return;

    const { content } = await window.api.readFile(filePath);
    set({
      activePath: filePath,
      content,
      savedContent: content,
      externalChangePath: null,
      findOpen: false,
      findQuery: "",
      findMatchIndex: 0,
      findNavigated: false,
    });
  },

  beginCreateFile: () => {
    if (get().rootPath) set({ creatingFile: true, renamingPath: null });
  },

  cancelCreateFile: () => set({ creatingFile: false }),

  createFile: async (rawName) => {
    const { rootPath } = get();
    if (!rootPath || !window.api?.createFile) {
      return { ok: false, error: "No folder open." };
    }
    if ((await resolveUnsaved(get)) === "abort") return { ok: false };

    try {
      const res = await window.api.createFile(rootPath, rawName);
      if (!res.ok) return { ok: false, error: res.error };

      await get().refreshTree();
      set({
        activePath: res.path,
        content: "",
        savedContent: "",
        externalChangePath: null,
        creatingFile: false,
        findOpen: false,
        findQuery: "",
        findMatchIndex: 0,
        findNavigated: false,
      });
      return { ok: true };
    } catch (error) {
      return {
        ok: false,
        error: error instanceof Error ? error.message : "Could not create file.",
      };
    }
  },

  beginRename: (filePath) => {
    set({ renamingPath: filePath, creatingFile: false });
  },

  cancelRename: () => set({ renamingPath: null }),

  renameFile: async (filePath, rawName) => {
    const { rootPath, activePath } = get();
    if (!rootPath || !window.api?.renameFile) {
      return { ok: false, error: "No folder open." };
    }

    try {
      const res = await window.api.renameFile(rootPath, filePath, rawName);
      if (!res.ok) return { ok: false, error: res.error };

      await get().refreshTree();
      set({
        renamingPath: null,
        ...(activePath === filePath ? { activePath: res.path } : {}),
      });
      return { ok: true };
    } catch (error) {
      return {
        ok: false,
        error: error instanceof Error ? error.message : "Could not rename file.",
      };
    }
  },

  deleteFile: async (filePath) => {
    const { rootPath, activePath } = get();
    if (!rootPath || !window.api?.deleteFile) return;

    const isActive = filePath === activePath;
    if (isActive && (await resolveUnsaved(get)) === "abort") return;

    const fileName = filePath.split(/[\\/]/).pop() ?? filePath;
    const confirmed = await window.api.confirmDelete(fileName);
    if (!confirmed) return;

    try {
      const res = await window.api.deleteFile(rootPath, filePath);
      if (!res.ok) {
        window.alert(res.error ?? "Could not delete file.");
        return;
      }

      await get().refreshTree();
      if (isActive) {
        set({
          activePath: null,
          content: "",
          savedContent: "",
          externalChangePath: null,
          findOpen: false,
          findQuery: "",
          findMatchIndex: 0,
          findNavigated: false,
        });
      }
    } catch (error) {
      window.alert(
        error instanceof Error ? error.message : "Could not delete file.",
      );
    }
  },

  showFileContextMenu: async (filePath) => {
    if (!filePath.toLowerCase().endsWith(".md") || !window.api?.showFileContextMenu) {
      return;
    }

    const action = await window.api.showFileContextMenu();
    if (action === "rename") {
      get().beginRename(filePath);
    } else if (action === "delete") {
      await get().deleteFile(filePath);
    }
  },

  setContent: (content) => set({ content }),

  save: async () => {
    const { activePath, content } = get();
    if (!activePath || !get().isDirty()) return;
    await window.api.writeFile(activePath, content);
    set({ savedContent: content, externalChangePath: null });
  },

  reloadActiveFile: async () => {
    const { activePath } = get();
    if (!activePath) return;
    const { content } = await window.api.readFile(activePath);
    set({ content, savedContent: content, externalChangePath: null });
  },

  refreshTree: async () => {
    const { rootPath } = get();
    if (!rootPath) return;
    const tree = await window.api.refreshTree(rootPath);
    set({ tree });
  },

  handleFileChanged: ({ path }) => {
    const { rootPath, activePath } = get();
    if (!rootPath) return;

    const norm = (p: string) => p.replace(/\\/g, "/");
    void get().refreshTree();

    if (activePath && norm(path) === norm(activePath)) {
      if (!get().isDirty()) {
        void get().reloadActiveFile();
      } else {
        set({ externalChangePath: path });
      }
    }
  },

  dismissExternalChange: () => set({ externalChangePath: null }),

  applyExternalReload: async () => {
    await get().reloadActiveFile();
    set({ externalChangePath: null });
  },

  setViewMode: (viewMode) => set({ viewMode }),

  togglePreview: () => {
    const { viewMode } = get();
    set({ viewMode: viewMode === "preview" ? "markdown" : "preview" });
  },

  toggleSplit: () => {
    const { viewMode } = get();
    set({ viewMode: viewMode === "split" ? "markdown" : "split" });
  },

  cycleTheme: () => {
    const order: ThemePreference[] = ["system", "dark", "light"];
    const idx = order.indexOf(get().themePreference);
    set({ themePreference: order[(idx + 1) % order.length] });
  },

  setSystemDark: (systemDark) => set({ systemDark }),

  setSidebarWidth: (width) => {
    const next = clamp(width, SIDEBAR_MIN, SIDEBAR_MAX);
    writeNumber("mv:sidebarWidth", next);
    set({ sidebarWidth: next });
  },

  setSplitRatio: (ratio) => {
    const next = clamp(ratio, SPLIT_MIN, SPLIT_MAX);
    writeNumber("mv:splitRatio", next);
    set({ splitRatio: next });
  },

  resetSidebarWidth: () => {
    const next = 256;
    writeNumber("mv:sidebarWidth", next);
    set({ sidebarWidth: next });
  },

  resetSplitRatio: () => {
    const next = 0.5;
    writeNumber("mv:splitRatio", next);
    set({ splitRatio: next });
  },

  requestAppClose: async () => {
    if ((await resolveUnsaved(get)) === "abort") return;
    window.api?.allowClose();
  },

  setTree: (tree) => set({ tree }),

  setUpdateStatus: (updateStatus) => set({ updateStatus }),

  dismissUpdate: () => set({ updateStatus: null }),

  restartToUpdate: () => {
    window.api?.restartToUpdate?.();
  },

  editorView: null,

  setEditorView: (editorView) => set({ editorView }),

  previewSearchRoot: null,

  setPreviewSearchRoot: (previewSearchRoot) => set({ previewSearchRoot }),

  findOpen: false,
  findQuery: "",
  findCaseSensitive: false,
  findMatchIndex: 0,
  findNavigated: false,

  openFind: () => {
    if (!get().activePath) return;
    const wasOpen = get().findOpen;
    set({ findOpen: true });
    if (wasOpen) {
      queueMicrotask(() => {
        const input = document.querySelector<HTMLInputElement>(".find-bar-input");
        input?.focus();
        input?.select();
      });
    }
  },

  closeFind: () => {
    const { editorView } = get();
    if (editorView) clearFindHighlight(editorView);
    set({ findOpen: false, findNavigated: false });
  },

  setFindQuery: (findQuery) => {
    set({ findQuery, findMatchIndex: 0, findNavigated: false });
  },

  toggleFindCase: () => {
    set((state) => ({
      findCaseSensitive: !state.findCaseSensitive,
      findMatchIndex: 0,
      findNavigated: false,
    }));
  },

  findNext: () => {
    const { content, findQuery, findCaseSensitive, findMatchIndex, findNavigated } =
      get();
    const matches = findMatches(content, findQuery, findCaseSensitive);
    if (matches.length === 0) return;

    if (!findNavigated) {
      set({ findMatchIndex: 0, findNavigated: true });
      get().applyFindMatch(0);
      return;
    }

    const nextIndex = (findMatchIndex + 1) % matches.length;
    set({ findMatchIndex: nextIndex });
    get().applyFindMatch(nextIndex);
  },

  findPrevious: () => {
    const { content, findQuery, findCaseSensitive, findMatchIndex, findNavigated } =
      get();
    const matches = findMatches(content, findQuery, findCaseSensitive);
    if (matches.length === 0) return;

    if (!findNavigated) {
      const lastIndex = matches.length - 1;
      set({ findMatchIndex: lastIndex, findNavigated: true });
      get().applyFindMatch(lastIndex);
      return;
    }

    const prevIndex = (findMatchIndex - 1 + matches.length) % matches.length;
    set({ findMatchIndex: prevIndex });
    get().applyFindMatch(prevIndex);
  },

  applyFindMatch: (indexOverride?: number) => {
    const {
      content,
      findQuery,
      findCaseSensitive,
      findMatchIndex,
      editorView,
      previewSearchRoot,
    } = get();
    const matches = findMatches(content, findQuery, findCaseSensitive);
    if (!findQuery || matches.length === 0) return;

    const index = indexOverride ?? Math.min(findMatchIndex, matches.length - 1);
    const { from } = matches[index];

    if (editorView) {
      editorView.dispatch({
        effects: EditorViewNS.scrollIntoView(from, { y: "nearest" }),
      });
      if (get().findOpen) {
        queueMicrotask(() => {
          document.querySelector<HTMLInputElement>(".find-bar-input")?.focus();
        });
      } else {
        editorView.focus();
      }
      return;
    }

    if (previewSearchRoot) {
      scrollPreviewToMatch(
        previewSearchRoot,
        findQuery,
        index,
        findCaseSensitive,
      );
      if (get().findOpen) {
        queueMicrotask(() => {
          document.querySelector<HTMLInputElement>(".find-bar-input")?.focus();
        });
      }
    }
  },
}));
