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
  discoverWebsitePagesRequestSchema,
  discoveryResultSchema,
  getClientRequestSchema,
  IPC_CHANNELS,
  setClientStatusRequestSchema,
  updateClientRequestSchema,
  websitePageListQuerySchema,
  websitePageListResultSchema,
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
  async discoverWebsitePages(input) {
    const request = discoverWebsitePagesRequestSchema.parse(input);
    return discoveryResultSchema.parse(
      await ipcRenderer.invoke(IPC_CHANNELS.discoverWebsitePages, request),
    );
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
  async listWebsitePages(input) {
    const request = websitePageListQuerySchema.parse(input);
    return websitePageListResultSchema.parse(
      await ipcRenderer.invoke(IPC_CHANNELS.listWebsitePages, request),
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
