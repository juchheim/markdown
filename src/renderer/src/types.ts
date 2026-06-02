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

export type Api = {
  openFolder: () => Promise<{ path: string; tree: FileNode[] } | null>;
  confirmUnsaved: () => Promise<UnsavedChoice>;
  readDir: (dirPath: string) => Promise<FileNode[]>;
  readFile: (filePath: string) => Promise<ReadFileResult>;
  writeFile: (filePath: string, content: string) => Promise<WriteFileResult>;
  refreshTree: (rootPath: string) => Promise<FileNode[]>;
  getSystemDark: () => Promise<boolean>;
  onFileChanged: (cb: (e: { event: string; path: string }) => void) => () => void;
  onThemeChanged: (cb: (dark: boolean) => void) => () => void;
  onRequestClose: (cb: () => void) => () => void;
  allowClose: () => void;
};

declare global {
  interface Window {
    api: Api;
  }
}
