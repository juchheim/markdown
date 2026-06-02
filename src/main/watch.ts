import type { BrowserWindow } from "electron";
import fs from "node:fs";
import path from "node:path";

let watcher: fs.FSWatcher | null = null;
let watchedRoot: string | null = null;
let debounceTimer: ReturnType<typeof setTimeout> | null = null;

function emitChange(win: BrowserWindow, event: string, filePath: string): void {
  if (win.isDestroyed()) return;
  win.webContents.send("fs:changed", { event, path: filePath });
}

function scheduleChange(
  win: BrowserWindow,
  event: string,
  filePath: string,
): void {
  if (debounceTimer) clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => emitChange(win, event, filePath), 300);
}

export function stopWatching(): void {
  if (debounceTimer) {
    clearTimeout(debounceTimer);
    debounceTimer = null;
  }
  watcher?.close();
  watcher = null;
  watchedRoot = null;
}

export function startWatching(win: BrowserWindow, rootPath: string): void {
  stopWatching();
  watchedRoot = rootPath;

  const onWatchEvent = (event: string, filename: string | null) => {
    if (!filename || !watchedRoot) return;
    const fullPath = path.join(watchedRoot, filename);
    scheduleChange(win, event, fullPath);
  };

  try {
    watcher = fs.watch(rootPath, { recursive: true }, onWatchEvent);
  } catch {
    watcher = fs.watch(rootPath, onWatchEvent);
  }
}
