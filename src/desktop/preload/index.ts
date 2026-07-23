import { contextBridge, ipcRenderer } from "electron";

import {
  applyPageSelectionRequestSchema,
  auditScopeRecordSchema,
  clientInputSchema,
  clientListQuerySchema,
  clientListResultSchema,
  clientMutationResultSchema,
  clientRecordSchema,
  createAuditScopeRequestSchema,
  createAuditScopeResultSchema,
  deleteClientRequestSchema,
  deleteClientResultSchema,
  desktopBootstrapSchema,
  discoverWebsitePagesRequestSchema,
  discoveryResultSchema,
  getClientRequestSchema,
  getAuditScopeRequestSchema,
  IPC_CHANNELS,
  pageSelectionResultSchema,
  setClientStatusRequestSchema,
  updateClientRequestSchema,
  websitePageListQuerySchema,
  websitePageListResultSchema,
  type DesktopApi,
} from "../shared/contracts.js";

const desktopApi: DesktopApi = {
  async applyPageSelection(input) {
    const request = applyPageSelectionRequestSchema.parse(input);
    return pageSelectionResultSchema.parse(
      await ipcRenderer.invoke(IPC_CHANNELS.applyPageSelection, request),
    );
  },
  async createAuditScope(input) {
    const request = createAuditScopeRequestSchema.parse(input);
    return createAuditScopeResultSchema.parse(
      await ipcRenderer.invoke(IPC_CHANNELS.createAuditScope, request),
    );
  },
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
  async getAuditScope(input) {
    const request = getAuditScopeRequestSchema.parse(input);
    const result: unknown = await ipcRenderer.invoke(IPC_CHANNELS.getAuditScope, request);
    return result === null ? null : auditScopeRecordSchema.parse(result);
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
