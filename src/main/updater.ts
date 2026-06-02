import { app, BrowserWindow, ipcMain } from "electron";
import electronUpdater from "electron-updater";

const { autoUpdater } = electronUpdater;

type UpdateStatus =
  | { state: "available"; version: string }
  | { state: "downloaded"; version: string };

function canAutoUpdate(): boolean {
  if (!app.isPackaged) return false;
  if (process.platform !== "win32") return false;
  // electron-builder sets this for portable executables; NSIS installs do not use it.
  if (process.env.PORTABLE_EXECUTABLE_DIR) return false;
  return true;
}

function broadcast(status: UpdateStatus): void {
  for (const w of BrowserWindow.getAllWindows()) {
    if (!w.isDestroyed()) {
      w.webContents.send("updater:status", status);
    }
  }
}

let restartHandlerRegistered = false;

export function setupAutoUpdater(): void {
  if (!canAutoUpdate()) return;

  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;

  if (!restartHandlerRegistered) {
    ipcMain.on("updater:restart", () => {
      autoUpdater.quitAndInstall();
    });
    restartHandlerRegistered = true;
  }

  autoUpdater.on("error", (error) => {
    console.error("[updater]", error);
  });

  autoUpdater.on("update-available", (info) => {
    broadcast({ state: "available", version: info.version });
  });

  autoUpdater.on("update-downloaded", (info) => {
    broadcast({ state: "downloaded", version: info.version });
  });

  void autoUpdater.checkForUpdates().catch((error: unknown) => {
    console.error("[updater] check failed:", error);
  });
}
