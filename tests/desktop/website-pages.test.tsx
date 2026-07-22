// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { WebsitePages } from "../../src/desktop/renderer/clients/website-pages.js";
import type {
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
  summary: { available: 0, notObserved: 0, selected: 0, unavailable: 0 },
  total: 0,
};
const readyResult: WebsitePageListResult = {
  items: [page],
  latestRun: run,
  page: 1,
  pageSize: 25,
  summary: { available: 1, notObserved: 0, selected: 0, unavailable: 0 },
  total: 1,
};

function installApi(overrides: Partial<DesktopApi>): void {
  const api: DesktopApi = {
    createClient: vi.fn(),
    deleteClient: vi.fn(),
    discoverWebsitePages: vi.fn(),
    getBootstrap: vi.fn(),
    getClient: vi.fn(),
    listClients: vi.fn(),
    listWebsitePages: vi.fn(),
    setClientStatus: vi.fn(),
    updateClient: vi.fn(),
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
});
