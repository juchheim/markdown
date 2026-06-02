import { app, BrowserWindow, nativeTheme } from "electron";
import { existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { registerIpc, setupWindowCloseGuard } from "./ipc";
import { setupAutoUpdater } from "./updater";
import { stopWatching } from "./watch";

const __dirname = dirname(fileURLToPath(import.meta.url));

function getPreloadPath(): string {
  const candidates = [
    join(__dirname, "../preload/index.cjs"),
    join(__dirname, "../preload/index.js"),
    join(__dirname, "../preload/index.mjs"),
  ];

  for (const candidate of candidates) {
    if (existsSync(candidate)) {
      return resolve(candidate);
    }
  }

  return resolve(candidates[0]);
}

function createWindow(): BrowserWindow {
  const preloadPath = getPreloadPath();

  if (!existsSync(preloadPath)) {
    console.error(`Preload script not found. Expected one of:
  - ${join(__dirname, "../preload/index.cjs")}
  - ${join(__dirname, "../preload/index.js")}
  - ${join(__dirname, "../preload/index.mjs")}
Run "npm run dev" or "npm run build" first.`);
  }

  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    autoHideMenuBar: true,
    show: false,
    webPreferences: {
      preload: preloadPath,
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  win.webContents.on("preload-error", (_event, path, error) => {
    console.error("Preload script error:", path, error);
  });

  win.once("ready-to-show", () => {
    win.show();
  });

  setupWindowCloseGuard(win);

  if (process.env.ELECTRON_RENDERER_URL) {
    void win.loadURL(process.env.ELECTRON_RENDERER_URL);
  } else {
    void win.loadFile(join(__dirname, "../renderer/index.html"));
  }

  return win;
}

let ipcRegistered = false;

nativeTheme.on("updated", () => {
  for (const w of BrowserWindow.getAllWindows()) {
    if (!w.isDestroyed()) {
      w.webContents.send("theme:changed", {
        dark: nativeTheme.shouldUseDarkColors,
      });
    }
  }
});

app.whenReady().then(() => {
  app.setName("Markdown");
  const win = createWindow();
  if (!ipcRegistered) {
    registerIpc(win);
    ipcRegistered = true;
  }

  setupAutoUpdater(win);

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on("window-all-closed", () => {
  stopWatching();
  if (process.platform !== "darwin") {
    app.quit();
  }
});
