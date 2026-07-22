import { app, BrowserWindow, Menu } from "electron";

import { ApplicationServices } from "./application-services.js";
import { createDesktopLogger } from "./desktop-logger.js";
import { registerIpcHandlers, removeIpcHandlers } from "./ipc.js";
import { createMainWindow } from "./window.js";

let mainWindow: BrowserWindow | undefined;
let services: ApplicationServices | undefined;

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0 && services !== undefined) {
    mainWindow = createMainWindow();
    registerIpcHandlers(mainWindow, services);
  }
});

app.on("before-quit", (event) => {
  if (services === undefined) return;
  event.preventDefault();
  const closingServices = services;
  services = undefined;
  removeIpcHandlers();
  void closingServices.close().finally(() => {
    app.exit(0);
  });
});

void app.whenReady().then(async () => {
  Menu.setApplicationMenu(null);
  const userDataDirectory = app.getPath("userData");
  const logger = createDesktopLogger(userDataDirectory);
  services = new ApplicationServices({ dataDirectory: userDataDirectory, logger });
  await services.initialize();

  mainWindow = createMainWindow();
  registerIpcHandlers(mainWindow, services);
});
