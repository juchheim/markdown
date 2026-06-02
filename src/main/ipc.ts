import { BrowserWindow, dialog, ipcMain, nativeTheme } from "electron";
import fs from "node:fs";
import path from "node:path";
import { startWatching, stopWatching } from "./watch";

export type FileNode = {
  name: string;
  path: string;
  type: "file" | "directory";
  children?: FileNode[];
};

const IGNORED = new Set(["node_modules", ".git", ".next", "dist", "out"]);

function sortNodes(nodes: FileNode[]): FileNode[] {
  return nodes.sort((a, b) =>
    a.type === b.type
      ? a.name.localeCompare(b.name)
      : a.type === "directory"
        ? -1
        : 1,
  );
}

export async function buildTree(dir: string): Promise<FileNode[]> {
  const entries = await fs.promises.readdir(dir, { withFileTypes: true });
  const nodes = await Promise.all(
    entries
      .filter((e) => !IGNORED.has(e.name))
      .map(async (e) => {
        const full = path.join(dir, e.name);
        if (e.isDirectory()) {
          return {
            name: e.name,
            path: full,
            type: "directory" as const,
            children: await buildTree(full),
          };
        }
        return { name: e.name, path: full, type: "file" as const };
      }),
  );
  return sortNodes(nodes);
}

async function readDirLevel(dir: string): Promise<FileNode[]> {
  const entries = await fs.promises.readdir(dir, { withFileTypes: true });
  const nodes: FileNode[] = [];
  for (const e of entries) {
    if (IGNORED.has(e.name)) continue;
    const full = path.join(dir, e.name);
    if (e.isDirectory()) {
      nodes.push({ name: e.name, path: full, type: "directory" });
    } else {
      nodes.push({ name: e.name, path: full, type: "file" });
    }
  }
  return sortNodes(nodes);
}

function getDialogParent(win: BrowserWindow): BrowserWindow {
  return BrowserWindow.getFocusedWindow() ?? win;
}

export type UnsavedChoice = "save" | "discard" | "cancel";

const closeAllowed = new WeakSet<BrowserWindow>();

export function setupWindowCloseGuard(win: BrowserWindow): void {
  win.on("close", (event) => {
    if (closeAllowed.has(win)) return;
    event.preventDefault();
    win.webContents.send("app:request-close");
  });
}

function allowWindowClose(win: BrowserWindow): void {
  closeAllowed.add(win);
  win.close();
}

export function registerIpc(win: BrowserWindow): void {
  for (const channel of [
    "dialog:openFolder",
    "dialog:confirmUnsaved",
    "fs:readDir",
    "fs:readFile",
    "fs:writeFile",
    "fs:refreshTree",
    "theme:getSystemDark",
  ]) {
    ipcMain.removeHandler(channel);
  }

  ipcMain.handle("dialog:openFolder", async () => {
    const result = await dialog.showOpenDialog(getDialogParent(win), {
      properties: ["openDirectory"],
    });
    if (result.canceled || result.filePaths.length === 0) {
      return null;
    }
    const rootPath = result.filePaths[0];
    const tree = await buildTree(rootPath);
    startWatching(win, rootPath);
    return { path: rootPath, tree };
  });

  ipcMain.handle("dialog:confirmUnsaved", async () => {
    const { response } = await dialog.showMessageBox(getDialogParent(win), {
      type: "warning",
      message: "Save changes?",
      detail: "Your changes will be lost if you don't save them.",
      buttons: ["Save", "Don't Save", "Cancel"],
      defaultId: 0,
      cancelId: 2,
    });
    const choices: UnsavedChoice[] = ["save", "discard", "cancel"];
    return choices[response] ?? "cancel";
  });

  ipcMain.handle("fs:refreshTree", async (_event, rootPath: string) => {
    return buildTree(rootPath);
  });

  ipcMain.handle("theme:getSystemDark", () => nativeTheme.shouldUseDarkColors);

  ipcMain.removeAllListeners("app:allow-close");
  ipcMain.on("app:allow-close", (event) => {
    const senderWin = BrowserWindow.fromWebContents(event.sender);
    if (senderWin) allowWindowClose(senderWin);
  });

  ipcMain.handle("fs:readDir", async (_event, dirPath: string) => {
    return readDirLevel(dirPath);
  });

  ipcMain.handle("fs:readFile", async (_event, filePath: string) => {
    const [content, stat] = await Promise.all([
      fs.promises.readFile(filePath, "utf-8"),
      fs.promises.stat(filePath),
    ]);
    return { content, mtimeMs: stat.mtimeMs };
  });

  ipcMain.handle(
    "fs:writeFile",
    async (_event, payload: { filePath: string; content: string }) => {
      await fs.promises.writeFile(payload.filePath, payload.content, "utf-8");
      const stat = await fs.promises.stat(payload.filePath);
      return { mtimeMs: stat.mtimeMs };
    },
  );
}
