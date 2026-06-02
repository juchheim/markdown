import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("api", {
  openFolder: () => ipcRenderer.invoke("dialog:openFolder"),
  confirmUnsaved: () => ipcRenderer.invoke("dialog:confirmUnsaved"),
  readDir: (dirPath: string) => ipcRenderer.invoke("fs:readDir", dirPath),
  readFile: (filePath: string) => ipcRenderer.invoke("fs:readFile", filePath),
  writeFile: (filePath: string, content: string) =>
    ipcRenderer.invoke("fs:writeFile", { filePath, content }),
  refreshTree: (rootPath: string) =>
    ipcRenderer.invoke("fs:refreshTree", rootPath),
  getSystemDark: () => ipcRenderer.invoke("theme:getSystemDark") as Promise<boolean>,
  onFileChanged: (cb: (e: { event: string; path: string }) => void) => {
    const listener = (_: unknown, payload: { event: string; path: string }) =>
      cb(payload);
    ipcRenderer.on("fs:changed", listener);
    return () => ipcRenderer.removeListener("fs:changed", listener);
  },
  onThemeChanged: (cb: (dark: boolean) => void) => {
    const listener = (_: unknown, payload: { dark: boolean }) => cb(payload.dark);
    ipcRenderer.on("theme:changed", listener);
    return () => ipcRenderer.removeListener("theme:changed", listener);
  },
  onRequestClose: (cb: () => void) => {
    const listener = () => cb();
    ipcRenderer.on("app:request-close", listener);
    return () => ipcRenderer.removeListener("app:request-close", listener);
  },
  allowClose: () => ipcRenderer.send("app:allow-close"),
  onUpdateStatus: (
    cb: (status: {
      state: "available" | "downloaded";
      version: string;
    }) => void,
  ) => {
    const listener = (
      _: unknown,
      payload: { state: "available" | "downloaded"; version: string },
    ) => cb(payload);
    ipcRenderer.on("updater:status", listener);
    return () => ipcRenderer.removeListener("updater:status", listener);
  },
  restartToUpdate: () => ipcRenderer.send("updater:restart"),
});
