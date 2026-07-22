import { ipcMain, type BrowserWindow, type IpcMainInvokeEvent } from "electron";

import {
  clientInputSchema,
  clientListQuerySchema,
  clientListResultSchema,
  clientMutationResultSchema,
  clientRecordSchema,
  deleteClientRequestSchema,
  deleteClientResultSchema,
  discoverWebsitePagesRequestSchema,
  discoveryResultSchema,
  getClientRequestSchema,
  IPC_CHANNELS,
  setClientStatusRequestSchema,
  updateClientRequestSchema,
  websitePageListQuerySchema,
  websitePageListResultSchema,
} from "../shared/contracts.js";
import type { ApplicationServices } from "./application-services.js";

function assertTrustedSender(event: IpcMainInvokeEvent, window: BrowserWindow): void {
  const isMainContents = event.sender.id === window.webContents.id;
  const isMainFrame = event.senderFrame === window.webContents.mainFrame;
  if (!isMainContents || !isMainFrame) {
    throw new Error("IPC request came from an untrusted renderer");
  }
}

export function registerIpcHandlers(window: BrowserWindow, services: ApplicationServices): void {
  removeIpcHandlers();
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
  ipcMain.handle(IPC_CHANNELS.listClients, async (event, input: unknown) => {
    assertTrustedSender(event, window);
    const query = clientListQuerySchema.parse(input);
    return clientListResultSchema.parse(await services.database.listClients(query));
  });
  ipcMain.handle(IPC_CHANNELS.getClient, async (event, input: unknown) => {
    assertTrustedSender(event, window);
    const request = getClientRequestSchema.parse(input);
    const client = await services.database.getClient(request.id);
    return client === null ? null : clientRecordSchema.parse(client);
  });
  ipcMain.handle(IPC_CHANNELS.createClient, async (event, input: unknown) => {
    assertTrustedSender(event, window);
    const request = clientInputSchema.parse(input);
    return clientMutationResultSchema.parse(await services.database.createClient(request));
  });
  ipcMain.handle(IPC_CHANNELS.updateClient, async (event, input: unknown) => {
    assertTrustedSender(event, window);
    const request = updateClientRequestSchema.parse(input);
    return clientMutationResultSchema.parse(
      await services.database.updateClient(request.id, request.input),
    );
  });
  ipcMain.handle(IPC_CHANNELS.setClientStatus, async (event, input: unknown) => {
    assertTrustedSender(event, window);
    const request = setClientStatusRequestSchema.parse(input);
    return clientMutationResultSchema.parse(
      await services.database.setClientStatus(request.id, request.status),
    );
  });
  ipcMain.handle(IPC_CHANNELS.deleteClient, async (event, input: unknown) => {
    assertTrustedSender(event, window);
    const request = deleteClientRequestSchema.parse(input);
    return deleteClientResultSchema.parse(
      await services.database.deleteClient(request.id, request.confirmation),
    );
  });
  ipcMain.handle(IPC_CHANNELS.listWebsitePages, async (event, input: unknown) => {
    assertTrustedSender(event, window);
    const query = websitePageListQuerySchema.parse(input);
    return websitePageListResultSchema.parse(await services.database.listWebsitePages(query));
  });
  ipcMain.handle(IPC_CHANNELS.discoverWebsitePages, async (event, input: unknown) => {
    assertTrustedSender(event, window);
    const request = discoverWebsitePagesRequestSchema.parse(input);
    return discoveryResultSchema.parse(
      await services.database.discoverWebsitePages(request.clientId, request.maxPages),
    );
  });
}

export function removeIpcHandlers(): void {
  for (const channel of Object.values(IPC_CHANNELS)) ipcMain.removeHandler(channel);
}
