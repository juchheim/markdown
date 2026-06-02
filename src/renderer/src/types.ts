export type FileNode = {
  name: string;
  path: string;
  type: "file" | "directory";
  children?: FileNode[];
};

export type ReadFileResult = { content: string; mtimeMs: number };
export type WriteFileResult = { mtimeMs: number };
export type UnsavedChoice = "save" | "discard" | "cancel";
export type ThemePreference = "system" | "light" | "dark";
export type UpdateStatus =
  | { state: "available"; version: string }
  | { state: "downloaded"; version: string };

export type RestoreResult = {
  path: string;
  tree: FileNode[];
  activePath: string | null;
  activeContent: string | null;
};

export type Api = {
  openFolder: () => Promise<{ path: string; tree: FileNode[] } | null>;
  confirmUnsaved: () => Promise<UnsavedChoice>;
  readDir: (dirPath: string) => Promise<FileNode[]>;
  readFile: (filePath: string) => Promise<ReadFileResult>;
  writeFile: (filePath: string, content: string) => Promise<WriteFileResult>;
  refreshTree: (rootPath: string) => Promise<FileNode[]>;
  restoreLastSession: () => Promise<RestoreResult | null>;
  getSystemDark: () => Promise<boolean>;
  onFileChanged: (cb: (e: { event: string; path: string }) => void) => () => void;
  onThemeChanged: (cb: (dark: boolean) => void) => () => void;
  onRequestClose: (cb: () => void) => () => void;
  allowClose: () => void;
  onUpdateStatus: (cb: (status: UpdateStatus) => void) => () => void;
  restartToUpdate: () => void;
};

declare global {
  interface Window {
    api: Api;
  }
}
