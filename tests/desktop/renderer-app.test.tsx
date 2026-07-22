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

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("desktop renderer", () => {
  it("loads real workspace state and navigates with an accessible current item", async () => {
    installApi({ getBootstrap: vi.fn().mockResolvedValue(bootstrap) });
    render(<App />);

    expect(screen.getByRole("status", { name: "Loading workspace" })).toBeTruthy();
    expect(await screen.findByRole("heading", { name: "Workspace" })).toBeTruthy();
    expect(screen.getByText("Database ready")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Clients" }));
    expect(screen.getByRole("heading", { name: "Clients" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "No clients yet" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Clients" }).getAttribute("aria-current")).toBe(
      "page",
    );
  });

  it("shows a recoverable error and retries the bootstrap request", async () => {
    const getBootstrap = vi
      .fn<DesktopApi["getBootstrap"]>()
      .mockRejectedValueOnce(new Error("Local services are unavailable"))
      .mockResolvedValueOnce(bootstrap);
    installApi({ getBootstrap });
    render(<App />);

    expect(await screen.findByRole("heading", { name: "Workspace unavailable" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));

    await waitFor(() => {
      expect(getBootstrap).toHaveBeenCalledTimes(2);
    });
    expect(await screen.findByRole("heading", { name: "Workspace" })).toBeTruthy();
  });
});
