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
    createClient: vi.fn(),
    deleteClient: vi.fn(),
    discoverWebsitePages: vi.fn(),
    getBootstrap: vi.fn().mockResolvedValue(bootstrap),
    getClient: vi.fn(),
    listClients: vi.fn().mockResolvedValue({ items: [], page: 1, pageSize: 25, total: 0 }),
    listWebsitePages: vi.fn().mockResolvedValue({
      items: [],
      latestRun: null,
      page: 1,
      pageSize: 25,
      summary: { available: 0, notObserved: 0, selected: 0, unavailable: 0 },
      total: 0,
    }),
    setClientStatus: vi.fn(),
    updateClient: vi.fn(),
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
});
