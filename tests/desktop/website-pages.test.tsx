// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { WebsitePages } from "../../src/desktop/renderer/clients/website-pages.js";
import type {
  AuditJobRecord,
  AuditScopeRecord,
  DesktopApi,
  DiscoveryRun,
  WebsitePageListResult,
  WebsitePageRecord,
} from "../../src/desktop/shared/contracts.js";

const clientId = "953c75a4-6293-4fbc-bfe6-595f68368c1c";
const page: WebsitePageRecord = {
  availability: "available",
  changeState: "new",
  failureCode: null,
  failureMessage: null,
  firstDiscoveredAt: "2026-07-23T11:01:00.000Z",
  id: "58c4439a-30fd-42b7-b742-28d5b6f66781",
  lastChangedAt: "2026-07-23T11:01:00.000Z",
  lastObservedAt: "2026-07-23T11:01:00.000Z",
  normalizedUrl: "https://northstar.test/",
  observedUrl: "https://northstar.test/",
  pageType: "home",
  recommendationReason: "Representative customer-facing page recommended for review.",
  recommendationState: "recommended",
  selectionState: "default",
  statusCode: 200,
  title: "Northstar Dental",
};
const run: DiscoveryRun = {
  changedPageCount: 0,
  completedAt: "2026-07-23T11:01:00.000Z",
  discoveredUrlCount: 1,
  failedPageCount: 0,
  failureMessage: null,
  id: "68c4439a-30fd-42b7-b742-28d5b6f66782",
  newPageCount: 1,
  noLongerObservedCount: 0,
  observedPageCount: 1,
  source: "manual",
  startedAt: "2026-07-23T11:00:00.000Z",
  status: "completed",
  successfulPageCount: 1,
  unavailablePageCount: 0,
};

const emptyResult: WebsitePageListResult = {
  items: [],
  latestRun: null,
  page: 1,
  pageSize: 25,
  summary: {
    available: 0,
    eligible: 0,
    excluded: 0,
    notObserved: 0,
    selected: 0,
    unavailable: 0,
  },
  total: 0,
};
const readyResult: WebsitePageListResult = {
  items: [page],
  latestRun: run,
  page: 1,
  pageSize: 25,
  summary: {
    available: 1,
    eligible: 1,
    excluded: 0,
    notObserved: 0,
    selected: 0,
    unavailable: 0,
  },
  total: 1,
};
const selectedResult: WebsitePageListResult = {
  ...readyResult,
  items: [{ ...page, selectionState: "included" }],
  summary: { ...readyResult.summary, selected: 1 },
};
const scope: AuditScopeRecord = {
  clientBusinessName: "Northstar Dental",
  clientId,
  configuration: {
    includeAccessibility: true,
    includeAnalytics: true,
    includeForms: true,
    includeLighthouse: true,
    includeSecurity: true,
    includeSeo: true,
    includeUxHeuristics: true,
    submitForms: false,
    viewports: ["desktop", "mobile"],
  },
  createdAt: "2026-07-23T12:00:00.000Z",
  id: "78c4439a-30fd-42b7-b742-28d5b6f66783",
  normalizedDomain: "northstar.test",
  pages: [{ normalizedUrl: page.normalizedUrl, pageId: page.id, pageType: page.pageType }],
  reportFormats: ["client-summary-pdf", "summary-pdf", "pdf", "html", "json", "markdown"],
  requestedBy: "local-user",
  selectedPageCount: 1,
  targetUrl: "https://northstar.test/",
  websiteId: "88c4439a-30fd-42b7-b742-28d5b6f66784",
};
const queuedJob: AuditJobRecord = {
  attempt: 1,
  cancelAvailable: true,
  cancelRequestedAt: null,
  clientBusinessName: scope.clientBusinessName,
  clientId,
  completedAt: null,
  createdAt: "2026-07-23T12:01:00.000Z",
  failedPageCount: 0,
  failure: null,
  id: "98c4439a-30fd-42b7-b742-28d5b6f66785",
  pagesCompleted: 0,
  pagesTotal: 1,
  scopeId: scope.id,
  startedAt: null,
  state: "queued",
  targetUrl: scope.targetUrl,
  updatedAt: "2026-07-23T12:01:00.000Z",
  warningCount: 0,
  warnings: [],
  websiteId: scope.websiteId,
};

function installApi(overrides: Partial<DesktopApi>): void {
  const api: DesktopApi = {
    applyPageSelection: vi.fn(),
    cancelAuditJob: vi.fn(),
    createClient: vi.fn(),
    createAuditScope: vi.fn(),
    deleteClient: vi.fn(),
    deleteProspect: vi.fn(),
    discoverWebsitePages: vi.fn(),
    exportReport: vi.fn(),
    getBootstrap: vi.fn(),
    getAuditJob: vi.fn(),
    getAuditScope: vi.fn(),
    getClient: vi.fn(),
    getProspect: vi.fn(),
    listAuditHistory: vi.fn(),
    listAuditJobs: vi.fn(),
    listClients: vi.fn(),
    listProspects: vi.fn(),
    listReportArtifacts: vi.fn(),
    listWebsitePages: vi.fn(),
    openReport: vi.fn(),
    revealReport: vi.fn(),
    setClientStatus: vi.fn(),
    setProspectState: vi.fn(),
    retryAuditJob: vi.fn(),
    startAuditJob: vi.fn(),
    suppressProspect: vi.fn(),
    updateClient: vi.fn(),
    updateProspect: vi.fn(),
    ...overrides,
  };
  Object.defineProperty(window, "auditTool", { configurable: true, value: api });
}

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("WebsitePages", () => {
  it("discovers pages from the useful empty state and shows the persisted inventory", async () => {
    const listWebsitePages = vi
      .fn<DesktopApi["listWebsitePages"]>()
      .mockResolvedValueOnce(emptyResult)
      .mockResolvedValue(readyResult);
    const discoverWebsitePages = vi
      .fn<DesktopApi["discoverWebsitePages"]>()
      .mockResolvedValue({ ok: true, run });
    installApi({ discoverWebsitePages, listWebsitePages });
    const user = userEvent.setup();
    render(<WebsitePages clientId={clientId} websiteUrl="https://northstar.test/" />);

    expect(await screen.findByText("No website pages discovered")).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "Start discovery" }));

    expect(discoverWebsitePages).toHaveBeenCalledWith({ clientId, maxPages: 100 });
    expect(await screen.findByText("Northstar Dental")).toBeTruthy();
    expect(screen.getByText("Discovery complete")).toBeTruthy();
    expect(screen.getByText("200")).toBeTruthy();
  });

  it("keeps discovery failures actionable without discarding the current inventory", async () => {
    const discoverWebsitePages = vi.fn<DesktopApi["discoverWebsitePages"]>().mockResolvedValue({
      error: { code: "discovery-failed", message: "The website did not respond." },
      ok: false,
      run: { ...run, failureMessage: "The website did not respond.", status: "failed" },
    });
    installApi({
      discoverWebsitePages,
      listWebsitePages: vi.fn().mockResolvedValue(readyResult),
    });
    const user = userEvent.setup();
    render(<WebsitePages clientId={clientId} websiteUrl="https://northstar.test/" />);

    expect(await screen.findByText("Northstar Dental")).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "Discover pages" }));

    expect((await screen.findByRole("alert")).textContent).toContain(
      "The website did not respond.",
    );
    expect(screen.getByText("Northstar Dental")).toBeTruthy();
  });

  it("persists row selection and creates an immutable audit scope", async () => {
    const listWebsitePages = vi
      .fn<DesktopApi["listWebsitePages"]>()
      .mockResolvedValueOnce(readyResult)
      .mockResolvedValue(selectedResult);
    const applyPageSelection = vi
      .fn<DesktopApi["applyPageSelection"]>()
      .mockResolvedValue({ ok: true, summary: selectedResult.summary });
    const createAuditScope = vi
      .fn<DesktopApi["createAuditScope"]>()
      .mockResolvedValue({ ok: true, scope });
    const startAuditJob = vi
      .fn<DesktopApi["startAuditJob"]>()
      .mockResolvedValue({ job: queuedJob, ok: true });
    installApi({ applyPageSelection, createAuditScope, listWebsitePages, startAuditJob });
    const user = userEvent.setup();
    render(<WebsitePages clientId={clientId} websiteUrl="https://northstar.test/" />);

    await user.click(await screen.findByLabelText("Include Northstar Dental"));
    expect(applyPageSelection).toHaveBeenCalledWith({
      action: "include",
      clientId,
      pageIds: [page.id],
    });
    await user.click(await screen.findByRole("button", { name: "Lock audit scope" }));

    expect(createAuditScope).toHaveBeenCalledOnce();
    expect(await screen.findByText("Audit scope locked")).toBeTruthy();
    expect(screen.getByText("1 page · 78c4439a")).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "Start audit" }));

    expect(startAuditJob).toHaveBeenCalledWith({ scopeId: scope.id });
    expect(await screen.findByText("queued")).toBeTruthy();
  });
});
