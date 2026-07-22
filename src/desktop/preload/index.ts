import { contextBridge, ipcRenderer } from "electron";

import {
  clientInputSchema,
  clientListQuerySchema,
  clientListResultSchema,
  clientMutationResultSchema,
  clientRecordSchema,
  deleteClientRequestSchema,
  deleteClientResultSchema,
  desktopBootstrapSchema,
  getClientRequestSchema,
  IPC_CHANNELS,
  setClientStatusRequestSchema,
  updateClientRequestSchema,
  type DesktopApi,
} from "../shared/contracts.js";

const desktopApi: DesktopApi = {
  async createClient(input) {
    const request = clientInputSchema.parse(input);
    return clientMutationResultSchema.parse(
      await ipcRenderer.invoke(IPC_CHANNELS.createClient, request),
    );
  },
  async deleteClient(input) {
    const request = deleteClientRequestSchema.parse(input);
    return deleteClientResultSchema.parse(
      await ipcRenderer.invoke(IPC_CHANNELS.deleteClient, request),
    );
  },
  async getBootstrap() {
    const result: unknown = await ipcRenderer.invoke(IPC_CHANNELS.getBootstrap);
    return desktopBootstrapSchema.parse(result);
  },
  async getClient(input) {
    const request = getClientRequestSchema.parse(input);
    const result: unknown = await ipcRenderer.invoke(IPC_CHANNELS.getClient, request);
    return result === null ? null : clientRecordSchema.parse(result);
  },
  async listClients(input) {
    const request = clientListQuerySchema.parse(input);
    return clientListResultSchema.parse(
      await ipcRenderer.invoke(IPC_CHANNELS.listClients, request),
    );
  },
  async setClientStatus(input) {
    const request = setClientStatusRequestSchema.parse(input);
    return clientMutationResultSchema.parse(
      await ipcRenderer.invoke(IPC_CHANNELS.setClientStatus, request),
    );
  },
  async updateClient(input) {
    const request = updateClientRequestSchema.parse(input);
    return clientMutationResultSchema.parse(
      await ipcRenderer.invoke(IPC_CHANNELS.updateClient, request),
    );
  },
};

contextBridge.exposeInMainWorld("auditTool", Object.freeze(desktopApi));
