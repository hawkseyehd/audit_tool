import { contextBridge, ipcRenderer } from "electron";

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
  createDiscoveryCampaignRequestSchema,
  deleteClientRequestSchema,
  deleteClientResultSchema,
  deleteProspectRequestSchema,
  desktopBootstrapSchema,
  discoverWebsitePagesRequestSchema,
  discoveryResultSchema,
  discoveryCampaignIdRequestSchema,
  discoveryCampaignListQuerySchema,
  discoveryCampaignListResultSchema,
  discoveryCampaignMutationResultSchema,
  discoveryProviderSchema,
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
  type DesktopApi,
} from "../shared/contracts.js";

const desktopApi: DesktopApi = {
  async applyPageSelection(input) {
    const request = applyPageSelectionRequestSchema.parse(input);
    return pageSelectionResultSchema.parse(
      await ipcRenderer.invoke(IPC_CHANNELS.applyPageSelection, request),
    );
  },
  async cancelAuditJob(input) {
    const request = auditJobIdRequestSchema.parse(input);
    return auditJobMutationResultSchema.parse(
      await ipcRenderer.invoke(IPC_CHANNELS.cancelAuditJob, request),
    );
  },
  async cancelDiscoveryCampaign(input) {
    const request = discoveryCampaignIdRequestSchema.parse(input);
    return discoveryCampaignMutationResultSchema.parse(
      await ipcRenderer.invoke(IPC_CHANNELS.cancelDiscoveryCampaign, request),
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
  async createDiscoveryCampaign(input) {
    const request = createDiscoveryCampaignRequestSchema.parse(input);
    return discoveryCampaignMutationResultSchema.parse(
      await ipcRenderer.invoke(IPC_CHANNELS.createDiscoveryCampaign, request),
    );
  },
  async deleteClient(input) {
    const request = deleteClientRequestSchema.parse(input);
    return deleteClientResultSchema.parse(
      await ipcRenderer.invoke(IPC_CHANNELS.deleteClient, request),
    );
  },
  async deleteProspect(input) {
    const request = deleteProspectRequestSchema.parse(input);
    return prospectActionResultSchema.parse(
      await ipcRenderer.invoke(IPC_CHANNELS.deleteProspect, request),
    );
  },
  async exportReport(input) {
    const request = reportArtifactActionRequestSchema.parse(input);
    return reportArtifactActionResultSchema.parse(
      await ipcRenderer.invoke(IPC_CHANNELS.exportReport, request),
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
  async getAuditJob(input) {
    const request = auditJobIdRequestSchema.parse(input);
    const result: unknown = await ipcRenderer.invoke(IPC_CHANNELS.getAuditJob, request);
    return result === null ? null : auditJobRecordSchema.parse(result);
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
  async getDiscoveryProvider() {
    return discoveryProviderSchema.parse(
      await ipcRenderer.invoke(IPC_CHANNELS.getDiscoveryProvider),
    );
  },
  async getProspect(input) {
    const request = getProspectRequestSchema.parse(input);
    const result: unknown = await ipcRenderer.invoke(IPC_CHANNELS.getProspect, request);
    return result === null ? null : prospectRecordSchema.parse(result);
  },
  async listClients(input) {
    const request = clientListQuerySchema.parse(input);
    return clientListResultSchema.parse(
      await ipcRenderer.invoke(IPC_CHANNELS.listClients, request),
    );
  },
  async listProspects(input) {
    const request = prospectListQuerySchema.parse(input);
    return prospectListResultSchema.parse(
      await ipcRenderer.invoke(IPC_CHANNELS.listProspects, request),
    );
  },
  async listDiscoveryCampaigns(input) {
    const request = discoveryCampaignListQuerySchema.parse(input);
    return discoveryCampaignListResultSchema.parse(
      await ipcRenderer.invoke(IPC_CHANNELS.listDiscoveryCampaigns, request),
    );
  },
  async listAuditHistory(input) {
    const request = auditHistoryListQuerySchema.parse(input);
    return auditHistoryListResultSchema.parse(
      await ipcRenderer.invoke(IPC_CHANNELS.listAuditHistory, request),
    );
  },
  async listAuditJobs(input) {
    const request = auditJobListQuerySchema.parse(input);
    return auditJobListResultSchema.parse(
      await ipcRenderer.invoke(IPC_CHANNELS.listAuditJobs, request),
    );
  },
  async listReportArtifacts(input) {
    const request = reportArtifactListQuerySchema.parse(input);
    return reportArtifactListResultSchema.parse(
      await ipcRenderer.invoke(IPC_CHANNELS.listReportArtifacts, request),
    );
  },
  async listWebsitePages(input) {
    const request = websitePageListQuerySchema.parse(input);
    return websitePageListResultSchema.parse(
      await ipcRenderer.invoke(IPC_CHANNELS.listWebsitePages, request),
    );
  },
  async openReport(input) {
    const request = reportArtifactActionRequestSchema.parse(input);
    return reportArtifactActionResultSchema.parse(
      await ipcRenderer.invoke(IPC_CHANNELS.openReport, request),
    );
  },
  async revealReport(input) {
    const request = reportArtifactActionRequestSchema.parse(input);
    return reportArtifactActionResultSchema.parse(
      await ipcRenderer.invoke(IPC_CHANNELS.revealReport, request),
    );
  },
  async setClientStatus(input) {
    const request = setClientStatusRequestSchema.parse(input);
    return clientMutationResultSchema.parse(
      await ipcRenderer.invoke(IPC_CHANNELS.setClientStatus, request),
    );
  },
  async setProspectState(input) {
    const request = setProspectStateRequestSchema.parse(input);
    return prospectMutationResultSchema.parse(
      await ipcRenderer.invoke(IPC_CHANNELS.setProspectState, request),
    );
  },
  async retryAuditJob(input) {
    const request = auditJobIdRequestSchema.parse(input);
    return auditJobMutationResultSchema.parse(
      await ipcRenderer.invoke(IPC_CHANNELS.retryAuditJob, request),
    );
  },
  async resumeDiscoveryCampaign(input) {
    const request = discoveryCampaignIdRequestSchema.parse(input);
    return discoveryCampaignMutationResultSchema.parse(
      await ipcRenderer.invoke(IPC_CHANNELS.resumeDiscoveryCampaign, request),
    );
  },
  async startAuditJob(input) {
    const request = startAuditJobRequestSchema.parse(input);
    return auditJobMutationResultSchema.parse(
      await ipcRenderer.invoke(IPC_CHANNELS.startAuditJob, request),
    );
  },
  async suppressProspect(input) {
    const request = suppressProspectRequestSchema.parse(input);
    return prospectMutationResultSchema.parse(
      await ipcRenderer.invoke(IPC_CHANNELS.suppressProspect, request),
    );
  },
  async updateClient(input) {
    const request = updateClientRequestSchema.parse(input);
    return clientMutationResultSchema.parse(
      await ipcRenderer.invoke(IPC_CHANNELS.updateClient, request),
    );
  },
  async updateProspect(input) {
    const request = updateProspectRequestSchema.parse(input);
    return prospectMutationResultSchema.parse(
      await ipcRenderer.invoke(IPC_CHANNELS.updateProspect, request),
    );
  },
};

contextBridge.exposeInMainWorld("auditTool", Object.freeze(desktopApi));
