import { ipcMain, type BrowserWindow, type IpcMainInvokeEvent } from "electron";

import {
  applyPageSelectionRequestSchema,
  auditHistoryListQuerySchema,
  auditHistoryListResultSchema,
  auditJobIdRequestSchema,
  auditJobListQuerySchema,
  auditJobListResultSchema,
  auditJobMutationResultSchema,
  auditJobRecordSchema,
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
  deleteProspectRequestSchema,
  discoverWebsitePagesRequestSchema,
  discoveryResultSchema,
  getAuditScopeRequestSchema,
  getClientRequestSchema,
  getProspectRequestSchema,
  IPC_CHANNELS,
  pageSelectionResultSchema,
  prospectActionResultSchema,
  prospectListQuerySchema,
  prospectListResultSchema,
  prospectMutationResultSchema,
  prospectRecordSchema,
  reportArtifactActionRequestSchema,
  reportArtifactActionResultSchema,
  reportArtifactListQuerySchema,
  reportArtifactListResultSchema,
  setClientStatusRequestSchema,
  setProspectStateRequestSchema,
  startAuditJobRequestSchema,
  suppressProspectRequestSchema,
  updateClientRequestSchema,
  updateProspectRequestSchema,
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
  ipcMain.handle(IPC_CHANNELS.listProspects, async (event, input: unknown) => {
    assertTrustedSender(event, window);
    const query = prospectListQuerySchema.parse(input);
    return prospectListResultSchema.parse(await services.database.listProspects(query));
  });
  ipcMain.handle(IPC_CHANNELS.getProspect, async (event, input: unknown) => {
    assertTrustedSender(event, window);
    const request = getProspectRequestSchema.parse(input);
    const prospect = await services.database.getProspect(request.id);
    return prospect === null ? null : prospectRecordSchema.parse(prospect);
  });
  ipcMain.handle(IPC_CHANNELS.updateProspect, async (event, input: unknown) => {
    assertTrustedSender(event, window);
    const request = updateProspectRequestSchema.parse(input);
    return prospectMutationResultSchema.parse(
      await services.database.updateProspect(request.id, request.input),
    );
  });
  ipcMain.handle(IPC_CHANNELS.setProspectState, async (event, input: unknown) => {
    assertTrustedSender(event, window);
    const request = setProspectStateRequestSchema.parse(input);
    return prospectMutationResultSchema.parse(
      await services.database.setProspectState(request.id, request.state),
    );
  });
  ipcMain.handle(IPC_CHANNELS.suppressProspect, async (event, input: unknown) => {
    assertTrustedSender(event, window);
    const request = suppressProspectRequestSchema.parse(input);
    return prospectMutationResultSchema.parse(
      await services.database.suppressProspect(request.id, request.reason, request.doNotContact),
    );
  });
  ipcMain.handle(IPC_CHANNELS.deleteProspect, async (event, input: unknown) => {
    assertTrustedSender(event, window);
    const request = deleteProspectRequestSchema.parse(input);
    return prospectActionResultSchema.parse(
      await services.database.deleteProspect(request.id, request.confirmation),
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
  ipcMain.handle(IPC_CHANNELS.applyPageSelection, async (event, input: unknown) => {
    assertTrustedSender(event, window);
    const request = applyPageSelectionRequestSchema.parse(input);
    return pageSelectionResultSchema.parse(
      await services.database.applyPageSelection(request.clientId, request.action, request.pageIds),
    );
  });
  ipcMain.handle(IPC_CHANNELS.createAuditScope, async (event, input: unknown) => {
    assertTrustedSender(event, window);
    const request = createAuditScopeRequestSchema.parse(input);
    return createAuditScopeResultSchema.parse(
      await services.database.createAuditScope(
        request.clientId,
        request.configuration,
        request.reportFormats,
      ),
    );
  });
  ipcMain.handle(IPC_CHANNELS.getAuditScope, async (event, input: unknown) => {
    assertTrustedSender(event, window);
    const request = getAuditScopeRequestSchema.parse(input);
    const scope = await services.database.getAuditScope(request.id);
    return scope === null ? null : auditScopeRecordSchema.parse(scope);
  });
  ipcMain.handle(IPC_CHANNELS.startAuditJob, async (event, input: unknown) => {
    assertTrustedSender(event, window);
    const request = startAuditJobRequestSchema.parse(input);
    return auditJobMutationResultSchema.parse(await services.jobs.start(request.scopeId));
  });
  ipcMain.handle(IPC_CHANNELS.getAuditJob, async (event, input: unknown) => {
    assertTrustedSender(event, window);
    const request = auditJobIdRequestSchema.parse(input);
    const job = await services.jobs.get(request.id);
    return job === null ? null : auditJobRecordSchema.parse(job);
  });
  ipcMain.handle(IPC_CHANNELS.listAuditJobs, async (event, input: unknown) => {
    assertTrustedSender(event, window);
    const query = auditJobListQuerySchema.parse(input);
    return auditJobListResultSchema.parse(await services.jobs.list(query));
  });
  ipcMain.handle(IPC_CHANNELS.listAuditHistory, async (event, input: unknown) => {
    assertTrustedSender(event, window);
    const query = auditHistoryListQuerySchema.parse(input);
    return auditHistoryListResultSchema.parse(await services.database.listAuditHistory(query));
  });
  ipcMain.handle(IPC_CHANNELS.listReportArtifacts, async (event, input: unknown) => {
    assertTrustedSender(event, window);
    const query = reportArtifactListQuerySchema.parse(input);
    return reportArtifactListResultSchema.parse(await services.reports.list(query));
  });
  ipcMain.handle(IPC_CHANNELS.openReport, async (event, input: unknown) => {
    assertTrustedSender(event, window);
    const request = reportArtifactActionRequestSchema.parse(input);
    return reportArtifactActionResultSchema.parse(await services.reports.open(request.artifactId));
  });
  ipcMain.handle(IPC_CHANNELS.revealReport, async (event, input: unknown) => {
    assertTrustedSender(event, window);
    const request = reportArtifactActionRequestSchema.parse(input);
    return reportArtifactActionResultSchema.parse(
      await services.reports.reveal(request.artifactId),
    );
  });
  ipcMain.handle(IPC_CHANNELS.exportReport, async (event, input: unknown) => {
    assertTrustedSender(event, window);
    const request = reportArtifactActionRequestSchema.parse(input);
    return reportArtifactActionResultSchema.parse(
      await services.reports.export(request.artifactId, window),
    );
  });
  ipcMain.handle(IPC_CHANNELS.cancelAuditJob, async (event, input: unknown) => {
    assertTrustedSender(event, window);
    const request = auditJobIdRequestSchema.parse(input);
    return auditJobMutationResultSchema.parse(await services.jobs.cancel(request.id));
  });
  ipcMain.handle(IPC_CHANNELS.retryAuditJob, async (event, input: unknown) => {
    assertTrustedSender(event, window);
    const request = auditJobIdRequestSchema.parse(input);
    return auditJobMutationResultSchema.parse(await services.jobs.retry(request.id));
  });
}

export function removeIpcHandlers(): void {
  for (const channel of Object.values(IPC_CHANNELS)) ipcMain.removeHandler(channel);
}
