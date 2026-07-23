// @vitest-environment jsdom

import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { AuditJobs } from "../../src/desktop/renderer/audits/audit-jobs.js";
import type {
  AuditHistoryListResult,
  AuditJobRecord,
  DesktopApi,
} from "../../src/desktop/shared/contracts.js";

const runningJob: AuditJobRecord = {
  attempt: 1,
  cancelAvailable: true,
  cancelRequestedAt: null,
  clientBusinessName: "Northstar Dental",
  clientId: "953c75a4-6293-4fbc-bfe6-595f68368c1c",
  completedAt: null,
  createdAt: "2026-07-24T10:00:00.000Z",
  failedPageCount: 1,
  failure: null,
  id: "58c4439a-30fd-42b7-b742-28d5b6f66781",
  pagesCompleted: 4,
  pagesTotal: 10,
  scopeId: "68c4439a-30fd-42b7-b742-28d5b6f66782",
  startedAt: "2026-07-24T10:00:01.000Z",
  state: "scanning",
  targetUrl: "https://northstar.test/",
  updatedAt: "2026-07-24T10:01:00.000Z",
  warningCount: 1,
  warnings: ["One scoped page could not be fetched."],
  websiteId: "78c4439a-30fd-42b7-b742-28d5b6f66783",
};

function result(job: AuditJobRecord): AuditHistoryListResult {
  return { items: [{ job, result: null }], page: 1, pageSize: 25, total: 1 };
}

function installApi(overrides: Partial<DesktopApi>): void {
  Object.defineProperty(window, "auditTool", {
    configurable: true,
    value: overrides,
  });
}

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("AuditJobs", () => {
  it("shows client, stage, progress, warnings, and cancels active work", async () => {
    const cancelled = {
      ...runningJob,
      cancelAvailable: false,
      cancelRequestedAt: "2026-07-24T10:02:00.000Z",
      completedAt: "2026-07-24T10:02:00.000Z",
      state: "cancelled" as const,
    };
    const listAuditHistory = vi
      .fn<DesktopApi["listAuditHistory"]>()
      .mockResolvedValueOnce(result(runningJob))
      .mockResolvedValue(result(cancelled));
    const cancelAuditJob = vi
      .fn<DesktopApi["cancelAuditJob"]>()
      .mockResolvedValue({ job: cancelled, ok: true });
    installApi({ cancelAuditJob, listAuditHistory, retryAuditJob: vi.fn() });
    const user = userEvent.setup();

    render(<AuditJobs />);

    expect(await screen.findByText("Northstar Dental")).toBeTruthy();
    expect(
      screen
        .getAllByText("Running checks")
        .some((item) => item.classList.contains("audit-job-status")),
    ).toBe(true);
    expect(screen.getByText("4 of 10 pages | 40%")).toBeTruthy();
    expect(screen.getByText("One scoped page could not be fetched.")).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "Cancel audit for Northstar Dental" }));

    expect(cancelAuditJob).toHaveBeenCalledWith({ id: runningJob.id });
    await waitFor(() => {
      expect(
        screen
          .getAllByText("Cancelled")
          .some((item) => item.classList.contains("audit-job-status")),
      ).toBe(true);
    });
  });

  it("keeps failed jobs actionable with retry and a clear failure reason", async () => {
    const failed: AuditJobRecord = {
      ...runningJob,
      cancelAvailable: false,
      completedAt: "2026-07-24T10:03:00.000Z",
      failure: { code: "worker-unavailable", message: "The audit worker stopped unexpectedly." },
      state: "failed",
      warningCount: 0,
      warnings: [],
    };
    const queued: AuditJobRecord = {
      ...failed,
      attempt: 2,
      completedAt: null,
      failure: null,
      pagesCompleted: 0,
      startedAt: null,
      state: "queued",
    };
    const listAuditHistory = vi
      .fn<DesktopApi["listAuditHistory"]>()
      .mockResolvedValueOnce(result(failed))
      .mockResolvedValue(result(queued));
    const retryAuditJob = vi
      .fn<DesktopApi["retryAuditJob"]>()
      .mockResolvedValue({ job: queued, ok: true });
    installApi({ cancelAuditJob: vi.fn(), listAuditHistory, retryAuditJob });
    const user = userEvent.setup();

    render(<AuditJobs clientId={runningJob.clientId} />);

    expect(await screen.findByText("The audit worker stopped unexpectedly.")).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "Retry audit for Northstar Dental" }));

    expect(retryAuditJob).toHaveBeenCalledWith({ id: failed.id });
    await waitFor(() => {
      expect(
        screen.getAllByText("Queued").some((item) => item.classList.contains("audit-job-status")),
      ).toBe(true);
    });
  });
});
