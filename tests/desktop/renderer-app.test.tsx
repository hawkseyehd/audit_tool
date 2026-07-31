// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { App } from "../../src/desktop/renderer/app.js";
import type { DesktopApi, DesktopBootstrap } from "../../src/desktop/shared/contracts.js";

const bootstrap: DesktopBootstrap = {
  app: { name: "Website Audit Tool", platform: "win32", version: "0.1.0" },
  initializedAt: "2026-07-23T10:00:00.000Z",
  services: { database: "ready", worker: "ready" },
  workspace: { audits: 0, clients: 0, prospects: 0, reports: 0 },
};

function installApi(api: DesktopApi): void {
  Object.defineProperty(window, "auditTool", { configurable: true, value: api });
}

function createApi(overrides: Partial<DesktopApi> = {}): DesktopApi {
  return {
    applyPageSelection: vi.fn(),
    cancelAuditJob: vi.fn(),
    cancelDiscoveryCampaign: vi.fn(),
    createClient: vi.fn(),
    createDiscoveryCampaign: vi.fn(),
    createAuditScope: vi.fn(),
    deleteClient: vi.fn(),
    deleteProspect: vi.fn(),
    discoverWebsitePages: vi.fn(),
    exportReport: vi.fn(),
    getBootstrap: vi.fn().mockResolvedValue(bootstrap),
    getAuditJob: vi.fn(),
    getAuditScope: vi.fn(),
    getClient: vi.fn(),
    getDiscoveryProvider: vi.fn(),
    getProspect: vi.fn(),
    listAuditHistory: vi.fn().mockResolvedValue({ items: [], page: 1, pageSize: 25, total: 0 }),
    listAuditJobs: vi.fn().mockResolvedValue({ items: [], page: 1, pageSize: 25, total: 0 }),
    listClients: vi.fn().mockResolvedValue({ items: [], page: 1, pageSize: 25, total: 0 }),
    listDiscoveryCampaigns: vi.fn(),
    listProspects: vi.fn().mockResolvedValue({ items: [], page: 1, pageSize: 25, total: 0 }),
    listReportArtifacts: vi.fn().mockResolvedValue({ items: [], page: 1, pageSize: 25, total: 0 }),
    listWebsitePages: vi.fn().mockResolvedValue({
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
    }),
    openReport: vi.fn(),
    promoteProspect: vi.fn(),
    revealReport: vi.fn(),
    setClientStatus: vi.fn(),
    setProspectState: vi.fn(),
    retryAuditJob: vi.fn(),
    resumeDiscoveryCampaign: vi.fn(),
    startAuditJob: vi.fn(),
    suppressProspect: vi.fn(),
    updateClient: vi.fn(),
    updateProspect: vi.fn(),
    verifyProspect: vi.fn(),
    ...overrides,
  };
}

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("desktop renderer", () => {
  it("loads real workspace state and navigates with an accessible current item", async () => {
    installApi(createApi());
    render(<App />);

    expect(screen.getByRole("status", { name: "Loading workspace" })).toBeTruthy();
    expect(await screen.findByRole("heading", { name: "Workspace" })).toBeTruthy();
    expect(screen.getByText("Database ready")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Clients" }));
    expect(screen.getByRole("heading", { name: "Clients" })).toBeTruthy();
    expect(await screen.findByText("No active clients")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Clients" }).getAttribute("aria-current")).toBe(
      "page",
    );
  });

  it("shows a recoverable error and retries the bootstrap request", async () => {
    const getBootstrap = vi
      .fn<DesktopApi["getBootstrap"]>()
      .mockRejectedValueOnce(new Error("Local services are unavailable"))
      .mockResolvedValueOnce(bootstrap);
    installApi(createApi({ getBootstrap }));
    render(<App />);

    expect(await screen.findByRole("heading", { name: "Workspace unavailable" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));

    await waitFor(() => {
      expect(getBootstrap).toHaveBeenCalledTimes(2);
    });
    expect(await screen.findByRole("heading", { name: "Workspace" })).toBeTruthy();
  });

  it("opens the durable audit monitor from the main navigation", async () => {
    const listAuditHistory = vi
      .fn<DesktopApi["listAuditHistory"]>()
      .mockResolvedValue({ items: [], page: 1, pageSize: 25, total: 0 });
    installApi(createApi({ listAuditHistory }));
    render(<App />);

    await screen.findByRole("heading", { name: "Workspace" });
    fireEvent.click(screen.getByRole("button", { name: "Audits" }));

    expect(screen.getByRole("heading", { name: "Audits" })).toBeTruthy();
    expect(await screen.findByText("No matching audits")).toBeTruthy();
    expect(listAuditHistory).toHaveBeenCalledWith({
      page: 1,
      pageSize: 25,
      resultState: "all",
      search: "",
      state: "all",
    });
  });
});
