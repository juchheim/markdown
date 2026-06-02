import { create } from "zustand";
import type {
  FileNode,
  ThemePreference,
  UnsavedChoice,
  UpdateStatus,
} from "./types";

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
  openFile: (filePath: string) => Promise<void>;
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
      if (res) {
        set({
          rootPath: res.path,
          tree: res.tree,
          activePath: null,
          content: "",
          savedContent: "",
          externalChangePath: null,
        });
      }
    } catch (error) {
      console.error("openFolder failed:", error);
      window.alert(
        error instanceof Error ? error.message : "Failed to open folder.",
      );
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
    });
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
}));
