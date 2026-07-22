import { ipcMain, type BrowserWindow, type IpcMainInvokeEvent } from "electron";

import { IPC_CHANNELS } from "../shared/contracts.js";
import type { ApplicationServices } from "./application-services.js";

function assertTrustedSender(event: IpcMainInvokeEvent, window: BrowserWindow): void {
  const isMainContents = event.sender.id === window.webContents.id;
  const isMainFrame = event.senderFrame === window.webContents.mainFrame;
  if (!isMainContents || !isMainFrame) {
    throw new Error("IPC request came from an untrusted renderer");
  }
}

export function registerIpcHandlers(window: BrowserWindow, services: ApplicationServices): void {
  ipcMain.removeHandler(IPC_CHANNELS.getBootstrap);
  ipcMain.handle(
    IPC_CHANNELS.getBootstrap,
    (event: IpcMainInvokeEvent, ...arguments_: unknown[]) => {
      assertTrustedSender(event, window);
      if (arguments_.length !== 0) {
        throw new Error("Bootstrap request does not accept arguments");
      }
      return services.getBootstrap();
    },
  );
}

export function removeIpcHandlers(): void {
  ipcMain.removeHandler(IPC_CHANNELS.getBootstrap);
}
