// @vitest-environment jsdom

import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ProspectWorkspace } from "../../src/desktop/renderer/prospects/prospect-workspace.js";
import type {
  DesktopApi,
  DiscoveryCampaignRecord,
  ProspectListResult,
  ProspectRecord,
} from "../../src/desktop/shared/contracts.js";

const provider = {
  configured: true,
  credentialEnvironmentVariables: ["DATAFORSEO_LOGIN", "DATAFORSEO_PASSWORD"] as const,
  id: "dataforseo-business-listings" as const,
  label: "DataForSEO Business Listings" as const,
  maxResults: 5_000 as const,
  paidOperation: true as const,
  supportsRadius: true as const,
  termsVersion: "reviewed-2026-07-25" as const,
};

const campaign: DiscoveryCampaignRecord = {
  category: "dental_clinic",
  completedAt: null,
  country: "PK",
  createdAt: "2026-07-25T12:00:00.000Z",
  exclusionRules: [],
  failureMessage: null,
  hasContinuation: false,
  id: "78c4439a-30fd-42b7-b742-28d5b6f66783",
  keywords: [],
  latitude: null,
  locality: "Karachi",
  longitude: null,
  maxResults: 100,
  name: "Karachi dental practices",
  processedCount: 25,
  provider: "dataforseo-business-listings",
  providerRequestCount: 1,
  radiusKm: null,
  region: "Sindh",
  requireWebsite: true,
  requiredFields: ["businessName", "websiteUrl"],
  resultCount: 22,
  startedAt: "2026-07-25T12:00:02.000Z",
  state: "running",
  suppressedCount: 3,
  updatedAt: "2026-07-25T12:00:04.000Z",
  warningMessage: null,
};

const prospect: ProspectRecord = {
  activities: [
    {
      createdAt: "2026-07-25T10:00:00.000Z",
      id: "58c4439a-30fd-42b7-b742-28d5b6f66781",
      kind: "imported",
      summary: "Prospect imported from approved-fixture",
    },
  ],
  addressLine: null,
  businessName: "Northstar Dental",
  campaignId: null,
  category: "Dental clinic",
  confidence: 72,
  country: "Pakistan",
  createdAt: "2026-07-25T10:00:00.000Z",
  discoveredPageCount: null,
  doNotContactAt: null,
  duplicateReviewState: "not-reviewed",
  firstDiscoveredAt: "2026-07-25T10:00:00.000Z",
  id: "953c75a4-6293-4fbc-bfe6-595f68368c1c",
  lastVerifiedAt: "2026-07-25T10:00:00.000Z",
  locality: "Karachi",
  normalizedDomain: "northstar.test",
  notes: null,
  owner: null,
  postalCode: null,
  promotedClientId: null,
  publicEmail: null,
  publicPhone: null,
  region: null,
  retainedUntil: "2027-07-25T10:00:00.000Z",
  serviceArea: null,
  socialProfiles: [],
  sourceProvider: "approved-fixture",
  sourceRecordCount: 1,
  sourceRecords: [
    {
      collectedAt: "2026-07-25T10:00:00.000Z",
      fieldProvenance: { businessName: "provider record" },
      id: "68c4439a-30fd-42b7-b742-28d5b6f66782",
      lastVerifiedAt: "2026-07-25T10:00:00.000Z",
      permittedFields: ["businessName", "websiteUrl"],
      provider: "approved-fixture",
      providerRecordId: "northstar-1",
      retainedUntil: "2027-07-25T10:00:00.000Z",
      retentionPolicy: "Approved for one year.",
      sourceUpdatedAt: null,
      sourceUrl: null,
    },
  ],
  sourceUpdatedAt: null,
  state: "new",
  suppressedAt: null,
  tags: [],
  updatedAt: "2026-07-25T10:00:00.000Z",
  websiteAvailability: "available",
  websiteUrl: "https://northstar.test/",
};

const {
  activities: _activities,
  notes: _notes,
  sourceRecords: _sourceRecords,
  ...prospectListItem
} = prospect;
const listResult: ProspectListResult = {
  items: [prospectListItem],
  page: 1,
  pageSize: 25,
  total: 1,
};

function installApi(overrides: Partial<DesktopApi> = {}): DesktopApi {
  const api: DesktopApi = {
    applyPageSelection: vi.fn(),
    cancelAuditJob: vi.fn(),
    cancelDiscoveryCampaign: vi.fn(),
    createAuditScope: vi.fn(),
    createClient: vi.fn(),
    createDiscoveryCampaign: vi.fn(),
    deleteClient: vi.fn(),
    deleteProspect: vi.fn().mockResolvedValue({ ok: true }),
    discoverWebsitePages: vi.fn(),
    exportReport: vi.fn(),
    getAuditJob: vi.fn(),
    getAuditScope: vi.fn(),
    getBootstrap: vi.fn(),
    getClient: vi.fn(),
    getDiscoveryProvider: vi.fn(),
    getProspect: vi.fn().mockResolvedValue(prospect),
    listAuditHistory: vi.fn(),
    listAuditJobs: vi.fn(),
    listClients: vi.fn(),
    listDiscoveryCampaigns: vi.fn(),
    listProspects: vi.fn().mockResolvedValue(listResult),
    listReportArtifacts: vi.fn(),
    listWebsitePages: vi.fn(),
    openReport: vi.fn(),
    revealReport: vi.fn(),
    retryAuditJob: vi.fn(),
    resumeDiscoveryCampaign: vi.fn(),
    setClientStatus: vi.fn(),
    setProspectState: vi.fn().mockResolvedValue({
      ok: true,
      prospect: { ...prospect, state: "reviewing" },
    }),
    startAuditJob: vi.fn(),
    suppressProspect: vi.fn().mockResolvedValue({
      ok: true,
      prospect: {
        ...prospect,
        doNotContactAt: "2026-07-25T11:00:00.000Z",
        state: "suppressed",
        suppressedAt: "2026-07-25T11:00:00.000Z",
      },
    }),
    updateClient: vi.fn(),
    updateProspect: vi.fn().mockResolvedValue({
      ok: true,
      prospect: { ...prospect, confidence: 85, owner: "Aisha", tags: ["Priority"] },
    }),
    ...overrides,
  };
  Object.defineProperty(window, "auditTool", { configurable: true, value: api });
  return api;
}

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("ProspectWorkspace", () => {
  it("lists, filters, and opens provenance-aware prospect records", async () => {
    const listProspects = vi.fn<DesktopApi["listProspects"]>().mockResolvedValue(listResult);
    installApi({ listProspects });
    const user = userEvent.setup();
    render(<ProspectWorkspace />);

    expect(await screen.findByText("Northstar Dental")).toBeTruthy();
    expect(screen.getByText("approved-fixture")).toBeTruthy();
    await user.selectOptions(screen.getByLabelText("State"), "qualified");
    await waitFor(() => {
      expect(listProspects).toHaveBeenLastCalledWith(
        expect.objectContaining({ state: "qualified" }),
      );
    });

    await user.click(screen.getByRole("button", { name: /Northstar Dental/u }));
    expect(await screen.findByRole("heading", { name: "Qualification details" })).toBeTruthy();
    await user.click(screen.getByRole("tab", { name: "Sources" }));
    expect(screen.getByText("Approved for one year.")).toBeTruthy();
  });

  it("updates qualification and creates explicit do-not-contact suppression", async () => {
    const updateProspect = vi.fn<DesktopApi["updateProspect"]>().mockResolvedValue({
      ok: true,
      prospect: { ...prospect, confidence: 85, owner: "Aisha", tags: ["Priority"] },
    });
    const suppressProspect = vi.fn<DesktopApi["suppressProspect"]>().mockResolvedValue({
      ok: true,
      prospect: {
        ...prospect,
        doNotContactAt: "2026-07-25T11:00:00.000Z",
        state: "suppressed",
        suppressedAt: "2026-07-25T11:00:00.000Z",
      },
    });
    installApi({ suppressProspect, updateProspect });
    const user = userEvent.setup();
    render(<ProspectWorkspace />);

    await user.click(await screen.findByRole("button", { name: /Northstar Dental/u }));
    await user.type(screen.getByLabelText("Owner"), "Aisha");
    await user.clear(screen.getByRole("spinbutton", { name: /^Confidence/u }));
    await user.type(screen.getByRole("spinbutton", { name: /^Confidence/u }), "85");
    await user.type(screen.getByLabelText("Tags"), "Priority");
    await user.click(screen.getByRole("button", { name: "Save details" }));
    await waitFor(() => {
      expect(updateProspect.mock.calls[0]?.[0]).toMatchObject({
        id: prospect.id,
        input: {
          confidence: 85,
          owner: "Aisha",
          tags: ["Priority"],
        },
      });
    });

    await user.type(screen.getByLabelText("Reason"), "Business requested removal");
    await user.click(screen.getByLabelText("Mark as do not contact"));
    await user.click(screen.getByRole("button", { name: "Suppress prospect" }));
    await waitFor(() => {
      expect(suppressProspect).toHaveBeenCalledWith({
        doNotContact: true,
        id: prospect.id,
        reason: "Business requested removal",
      });
    });
  });

  it("creates a bounded paid discovery campaign from the prospect workspace", async () => {
    const createDiscoveryCampaign = vi
      .fn<DesktopApi["createDiscoveryCampaign"]>()
      .mockResolvedValue({ campaign: { ...campaign, state: "queued" }, ok: true });
    installApi({
      createDiscoveryCampaign,
      getDiscoveryProvider: vi.fn().mockResolvedValue(provider),
      listDiscoveryCampaigns: vi
        .fn()
        .mockResolvedValue({ items: [], page: 1, pageSize: 10, total: 0 }),
    });
    const user = userEvent.setup();
    render(<ProspectWorkspace />);

    await user.click(screen.getByRole("button", { name: "Find prospects" }));
    expect(await screen.findByRole("heading", { name: "Discovery campaigns" })).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "New campaign" }));
    await user.type(screen.getByLabelText("Campaign name *"), campaign.name);
    await user.type(screen.getByLabelText("Country code *"), "PK");
    await user.type(screen.getByLabelText("City or locality"), "Karachi");
    await user.type(screen.getByLabelText("Category"), "dental_clinic");
    await user.click(screen.getByRole("button", { name: "Start discovery" }));

    await waitFor(() => {
      expect(createDiscoveryCampaign.mock.calls[0]?.[0].input).toMatchObject({
        country: "PK",
        locality: "Karachi",
        maxResults: 100,
        provider: "dataforseo-business-listings",
      });
    });
  });

  it("shows live campaign progress and supports explicit cancellation", async () => {
    const cancelDiscoveryCampaign = vi
      .fn<DesktopApi["cancelDiscoveryCampaign"]>()
      .mockResolvedValue({ campaign: { ...campaign, state: "cancelled" }, ok: true });
    installApi({
      cancelDiscoveryCampaign,
      getDiscoveryProvider: vi.fn().mockResolvedValue(provider),
      listDiscoveryCampaigns: vi
        .fn()
        .mockResolvedValue({ items: [campaign], page: 1, pageSize: 10, total: 1 }),
    });
    const user = userEvent.setup();
    render(<ProspectWorkspace />);

    await user.click(screen.getByRole("button", { name: "Find prospects" }));
    expect(await screen.findByText("Karachi dental practices")).toBeTruthy();
    expect(screen.getByText("25 / 100")).toBeTruthy();
    expect(screen.getByText("3 suppressed")).toBeTruthy();
    await user.click(screen.getByRole("button", { name: `Cancel ${campaign.name}` }));
    expect(cancelDiscoveryCampaign).toHaveBeenCalledWith({ id: campaign.id });
  });
});
