// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ClientWorkspace } from "../../src/desktop/renderer/clients/client-workspace.js";
import type { ClientRecord, DesktopApi } from "../../src/desktop/shared/contracts.js";

const clientWebsiteUrl = "https://northstar.test/";
const client: ClientRecord = {
  activities: [
    {
      createdAt: "2026-07-23T10:00:00.000Z",
      id: "58c4439a-30fd-42b7-b742-28d5b6f66781",
      kind: "created",
      summary: "Client created",
    },
  ],
  addressLine: null,
  businessName: "Northstar Dental",
  category: "Dental clinic",
  country: null,
  createdAt: "2026-07-23T10:00:00.000Z",
  id: "953c75a4-6293-4fbc-bfe6-595f68368c1c",
  locality: "Karachi",
  normalizedDomain: "northstar.test",
  notes: "Priority account",
  owner: "Aisha",
  postalCode: null,
  publicEmail: "hello@northstar.test",
  publicPhone: null,
  region: null,
  status: "active",
  tags: ["Healthcare"],
  updatedAt: "2026-07-23T10:00:00.000Z",
  websiteUrl: clientWebsiteUrl,
};

function installApi(overrides: Partial<DesktopApi> = {}): DesktopApi {
  const api: DesktopApi = {
    applyPageSelection: vi.fn(),
    cancelAuditJob: vi.fn(),
    cancelDiscoveryCampaign: vi.fn(),
    createClient: vi.fn().mockResolvedValue({ client, ok: true }),
    createDiscoveryCampaign: vi.fn(),
    createAuditScope: vi.fn(),
    deleteClient: vi.fn().mockResolvedValue({ ok: true }),
    deleteProspect: vi.fn(),
    discoverWebsitePages: vi.fn(),
    exportReport: vi.fn(),
    getBootstrap: vi.fn(),
    getAuditJob: vi.fn(),
    getAuditScope: vi.fn(),
    getClient: vi.fn().mockResolvedValue(client),
    getDiscoveryProvider: vi.fn(),
    getProspect: vi.fn(),
    listAuditHistory: vi.fn().mockResolvedValue({ items: [], page: 1, pageSize: 25, total: 0 }),
    listAuditJobs: vi.fn().mockResolvedValue({ items: [], page: 1, pageSize: 25, total: 0 }),
    listClients: vi.fn().mockResolvedValue({ items: [], page: 1, pageSize: 25, total: 0 }),
    listDiscoveryCampaigns: vi.fn(),
    listProspects: vi.fn(),
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
    setClientStatus: vi
      .fn()
      .mockResolvedValue({ client: { ...client, status: "archived" }, ok: true }),
    setProspectState: vi.fn(),
    retryAuditJob: vi.fn(),
    resumeDiscoveryCampaign: vi.fn(),
    startAuditJob: vi.fn(),
    suppressProspect: vi.fn(),
    updateClient: vi.fn().mockResolvedValue({ client, ok: true }),
    updateProspect: vi.fn(),
    verifyProspect: vi.fn(),
    ...overrides,
  };
  Object.defineProperty(window, "auditTool", { configurable: true, value: api });
  return api;
}

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("ClientWorkspace", () => {
  it("shows the useful empty state and validates required creation fields", async () => {
    installApi();
    const user = userEvent.setup();
    render(<ClientWorkspace />);

    expect(await screen.findByText("No active clients")).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "New client" }));
    await user.click(screen.getByRole("button", { name: "Create client" }));

    expect(screen.getByText("Business name is required")).toBeTruthy();
    expect(screen.getByText("Website URL is required")).toBeTruthy();
  });

  it("creates a client and opens its profile workspace", async () => {
    const createClient = vi.fn().mockResolvedValue({ client, ok: true });
    installApi({ createClient });
    const user = userEvent.setup();
    render(<ClientWorkspace />);

    await screen.findByText("No active clients");
    await user.click(screen.getByRole("button", { name: "New client" }));
    await user.type(screen.getByLabelText("Business name *"), client.businessName);
    await user.type(screen.getByLabelText("Website URL *"), clientWebsiteUrl);
    await user.click(screen.getByRole("button", { name: "Create client" }));

    expect(createClient).toHaveBeenCalledOnce();
    expect(await screen.findByRole("heading", { name: client.businessName })).toBeTruthy();
    expect(screen.getByText(clientWebsiteUrl)).toBeTruthy();
  });

  it("keeps duplicate domains actionable in the form", async () => {
    const getClient = vi.fn().mockResolvedValue(client);
    installApi({
      createClient: vi.fn().mockResolvedValue({
        error: {
          clientId: client.id,
          code: "duplicate-domain",
          message: "This website already belongs to Northstar Dental.",
        },
        ok: false,
      }),
      getClient,
    });
    const user = userEvent.setup();
    render(<ClientWorkspace />);

    await screen.findByText("No active clients");
    await user.click(screen.getByRole("button", { name: "New client" }));
    await user.type(screen.getByLabelText("Business name *"), "Duplicate Dental");
    await user.type(screen.getByLabelText("Website URL *"), clientWebsiteUrl);
    await user.click(screen.getByRole("button", { name: "Create client" }));

    expect(
      await screen.findByText("This website already belongs to Northstar Dental."),
    ).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "Open existing client" }));
    expect(getClient).toHaveBeenCalledWith({ id: client.id });
    expect(await screen.findByRole("heading", { name: client.businessName })).toBeTruthy();
  });

  it("opens a directory record, shows activity, and archives it", async () => {
    const listItem = (({ activities: _activities, notes: _notes, ...item }) => item)(client);
    const setClientStatus = vi
      .fn()
      .mockResolvedValue({ client: { ...client, status: "archived" }, ok: true });
    installApi({
      listClients: vi
        .fn()
        .mockResolvedValue({ items: [listItem], page: 1, pageSize: 25, total: 1 }),
      setClientStatus,
    });
    const user = userEvent.setup();
    render(<ClientWorkspace />);

    await user.click(await screen.findByText(client.businessName));
    expect(await screen.findByRole("heading", { name: client.businessName })).toBeTruthy();
    await user.click(screen.getByRole("tab", { name: "Activity" }));
    expect(screen.getByText("Client created")).toBeTruthy();

    await user.click(screen.getByRole("button", { name: "Archive" }));
    expect(setClientStatus).toHaveBeenCalledWith({ id: client.id, status: "archived" });
    expect(await screen.findByText("archived")).toBeTruthy();
  });
});
