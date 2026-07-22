import { contextBridge, ipcRenderer } from "electron";

import { desktopBootstrapSchema, IPC_CHANNELS, type DesktopApi } from "../shared/contracts.js";

const desktopApi: DesktopApi = Object.freeze({
  async getBootstrap() {
    const result: unknown = await ipcRenderer.invoke(IPC_CHANNELS.getBootstrap);
    return desktopBootstrapSchema.parse(result);
  },
});

contextBridge.exposeInMainWorld("auditTool", desktopApi);
