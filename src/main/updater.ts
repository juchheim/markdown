import { app, BrowserWindow, dialog } from "electron";
import electronUpdater from "electron-updater";

const { autoUpdater } = electronUpdater;

function canAutoUpdate(): boolean {
  if (!app.isPackaged) return false;
  if (process.platform !== "win32") return false;
  // electron-builder sets this for portable executables; NSIS installs do not use it.
  if (process.env.PORTABLE_EXECUTABLE_DIR) return false;
  return true;
}

export function setupAutoUpdater(win: BrowserWindow): void {
  if (!canAutoUpdate()) return;

  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;

  autoUpdater.on("error", (error) => {
    console.error("[updater]", error);
  });

  autoUpdater.on("update-downloaded", (info) => {
    const parent = BrowserWindow.getFocusedWindow() ?? win;
    void dialog
      .showMessageBox(parent, {
        type: "info",
        title: "Update ready",
        message: `Version ${info.version} is ready to install.`,
        detail: "Restart Markdown to apply the update.",
        buttons: ["Restart now", "Later"],
        defaultId: 0,
        cancelId: 1,
      })
      .then(({ response }) => {
        if (response === 0) {
          autoUpdater.quitAndInstall();
        }
      });
  });

  void autoUpdater.checkForUpdates().catch((error: unknown) => {
    console.error("[updater] check failed:", error);
  });
}
