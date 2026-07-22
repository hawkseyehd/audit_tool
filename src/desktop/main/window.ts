import { BrowserWindow, session } from "electron";

export function createMainWindow(): BrowserWindow {
  const window = new BrowserWindow({
    backgroundColor: "#f4f6f9",
    height: 820,
    minHeight: 640,
    minWidth: 900,
    show: false,
    title: "Website Audit Tool",
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      preload: MAIN_WINDOW_PRELOAD_WEBPACK_ENTRY,
      sandbox: true,
      webSecurity: true,
    },
    width: 1280,
  });

  window.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
  window.webContents.on("will-navigate", (event, url) => {
    if (url !== window.webContents.getURL()) event.preventDefault();
  });
  window.webContents.on("will-attach-webview", (event) => {
    event.preventDefault();
  });
  session.defaultSession.setPermissionRequestHandler((_webContents, _permission, callback) => {
    callback(false);
  });

  window.once("ready-to-show", () => {
    window.show();
  });
  void window.loadURL(MAIN_WINDOW_WEBPACK_ENTRY);
  return window;
}
