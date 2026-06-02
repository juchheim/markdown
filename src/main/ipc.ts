import { BrowserWindow, Menu, dialog, ipcMain, nativeTheme } from "electron";
import fs from "node:fs";
import path from "node:path";
import { clearSession, readSession, writeSession } from "./session";
import { startWatching } from "./watch";

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

async function pathExistsAsDirectory(p: string): Promise<boolean> {
  try {
    const stat = await fs.promises.stat(p);
    return stat.isDirectory();
  } catch {
    return false;
  }
}

function isPathInsideRoot(rootPath: string, filePath: string): boolean {
  const root = path.resolve(rootPath);
  const file = path.resolve(filePath);
  const rel = path.relative(root, file);
  return rel !== "" && !rel.startsWith("..") && !path.isAbsolute(rel);
}

function isMarkdownFile(p: string): boolean {
  return p.toLowerCase().endsWith(".md");
}

function validateMarkdownBasename(
  raw: string,
): { ok: true; name: string } | { ok: false; error: string } {
  let name = raw.trim();
  if (!name) return { ok: false, error: "Enter a file name." };
  if (/[\\/]/.test(name) || name.includes("..")) {
    return { ok: false, error: "Name can't contain slashes." };
  }
  if (!isMarkdownFile(name)) name += ".md";
  return { ok: true, name };
}

async function loadProjectFolder(
  win: BrowserWindow,
  rootPath: string,
): Promise<{ path: string; tree: FileNode[] } | null> {
  if (!(await pathExistsAsDirectory(rootPath))) return null;

  const tree = await buildTree(rootPath);
  startWatching(win, rootPath);
  return { path: rootPath, tree };
}

async function openProjectFolder(
  win: BrowserWindow,
  rootPath: string,
): Promise<{ path: string; tree: FileNode[] } | null> {
  const loaded = await loadProjectFolder(win, rootPath);
  if (!loaded) return null;
  await writeSession({ rootPath, activePath: null });
  return loaded;
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
    "dialog:fileContextMenu",
    "dialog:confirmDelete",
    "fs:readDir",
    "fs:readFile",
    "fs:writeFile",
    "fs:refreshTree",
    "fs:openFolderAtPath",
    "fs:createFile",
    "fs:renameFile",
    "fs:deleteFile",
    "session:restore",
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
    return openProjectFolder(win, result.filePaths[0]);
  });

  ipcMain.handle("fs:openFolderAtPath", async (_event, rootPath: string) => {
    return openProjectFolder(win, rootPath);
  });

  ipcMain.handle("session:restore", async () => {
    const session = await readSession();
    if (!session) return null;

    const loaded = await loadProjectFolder(win, session.rootPath);
    if (!loaded) {
      await clearSession();
      return null;
    }

    let activePath: string | null = null;
    let activeContent: string | null = null;

    if (
      session.activePath &&
      isMarkdownFile(session.activePath) &&
      isPathInsideRoot(session.rootPath, session.activePath)
    ) {
      try {
        activeContent = await fs.promises.readFile(session.activePath, "utf-8");
        activePath = session.activePath;
      } catch {
        await writeSession({ rootPath: session.rootPath, activePath: null });
      }
    }

    await writeSession({
      rootPath: session.rootPath,
      activePath,
    });

    return {
      path: loaded.path,
      tree: loaded.tree,
      activePath,
      activeContent,
    };
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

  ipcMain.handle("dialog:fileContextMenu", async (event) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    if (!win) return null;

    return await new Promise<"rename" | "delete" | null>((resolve) => {
      let settled = false;
      const finish = (value: "rename" | "delete" | null) => {
        if (settled) return;
        settled = true;
        resolve(value);
      };

      const menu = Menu.buildFromTemplate([
        { label: "Rename", click: () => finish("rename") },
        { label: "Delete", click: () => finish("delete") },
      ]);

      menu.popup({ window: win, callback: () => finish(null) });
    });
  });

  ipcMain.handle("dialog:confirmDelete", async (event, fileName: string) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    if (!win) return false;
    const { response } = await dialog.showMessageBox(getDialogParent(win), {
      type: "warning",
      message: `Delete "${fileName}"?`,
      detail: "This file will be removed from disk. This can't be undone.",
      buttons: ["Delete", "Cancel"],
      defaultId: 1,
      cancelId: 1,
    });
    return response === 0;
  });

  ipcMain.handle(
    "fs:createFile",
    async (_event, payload: { rootPath: string; name: string }) => {
      const rootPath = payload.rootPath;
      const validated = validateMarkdownBasename(payload.name);
      if (!validated.ok) return { ok: false, error: validated.error };
      const name = validated.name;

      const filePath = path.join(rootPath, name);
      if (!isPathInsideRoot(rootPath, filePath)) {
        return { ok: false, error: "Invalid file name." };
      }

      try {
        await fs.promises.writeFile(filePath, "", { flag: "wx" });
      } catch (err) {
        const code = (err as NodeJS.ErrnoException).code;
        if (code === "EEXIST") {
          return { ok: false, error: "A file with that name already exists." };
        }
        return { ok: false, error: "Could not create file." };
      }

      const session = await readSession();
      if (session && session.rootPath === rootPath) {
        await writeSession({ rootPath, activePath: filePath });
      }

      return { ok: true, path: filePath };
    },
  );

  ipcMain.handle(
    "fs:renameFile",
    async (
      _event,
      payload: { rootPath: string; filePath: string; newName: string },
    ) => {
      const { rootPath, filePath } = payload;
      const validated = validateMarkdownBasename(payload.newName);
      if (!validated.ok) return { ok: false, error: validated.error };

      if (!isMarkdownFile(filePath) || !isPathInsideRoot(rootPath, filePath)) {
        return { ok: false, error: "Invalid file." };
      }

      const newPath = path.join(path.dirname(filePath), validated.name);
      if (!isPathInsideRoot(rootPath, newPath)) {
        return { ok: false, error: "Invalid file name." };
      }
      if (newPath === filePath) {
        return { ok: true, path: filePath };
      }

      try {
        await fs.promises.rename(filePath, newPath);
      } catch (err) {
        const code = (err as NodeJS.ErrnoException).code;
        if (code === "EEXIST") {
          return { ok: false, error: "A file with that name already exists." };
        }
        return { ok: false, error: "Could not rename file." };
      }

      const session = await readSession();
      if (session && session.rootPath === rootPath) {
        const activePath =
          session.activePath === filePath ? newPath : session.activePath;
        await writeSession({ rootPath, activePath });
      }

      return { ok: true, path: newPath };
    },
  );

  ipcMain.handle(
    "fs:deleteFile",
    async (_event, payload: { rootPath: string; filePath: string }) => {
      const { rootPath, filePath } = payload;

      if (!isMarkdownFile(filePath) || !isPathInsideRoot(rootPath, filePath)) {
        return { ok: false, error: "Invalid file." };
      }

      try {
        await fs.promises.unlink(filePath);
      } catch {
        return { ok: false, error: "Could not delete file." };
      }

      const session = await readSession();
      if (
        session &&
        session.rootPath === rootPath &&
        session.activePath === filePath
      ) {
        await writeSession({ rootPath, activePath: null });
      }

      return { ok: true };
    },
  );

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

    const session = await readSession();
    if (
      session &&
      isMarkdownFile(filePath) &&
      isPathInsideRoot(session.rootPath, filePath)
    ) {
      await writeSession({ rootPath: session.rootPath, activePath: filePath });
    }

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
