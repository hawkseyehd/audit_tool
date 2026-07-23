// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ReportLibrary } from "../../src/desktop/renderer/reports/report-library.js";
import type { DesktopApi, ReportArtifactRecord } from "../../src/desktop/shared/contracts.js";

const report: ReportArtifactRecord = {
  auditId: "audit-one",
  clientBusinessName: "Northstar Dental",
  clientId: "953c75a4-6293-4fbc-bfe6-595f68368c1c",
  createdAt: "2026-07-24T10:05:00.000Z",
  fileName: "client-summary.pdf",
  format: "client-summary-pdf",
  id: "58c4439a-30fd-42b7-b742-28d5b6f66781",
  jobId: "68c4439a-30fd-42b7-b742-28d5b6f66782",
  retainedUntil: null,
  status: "available",
  targetUrl: "https://northstar.test/",
  updatedAt: "2026-07-24T10:05:00.000Z",
  verifiedAt: null,
  websiteId: "78c4439a-30fd-42b7-b742-28d5b6f66783",
};

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("ReportLibrary", () => {
  it("lists safe metadata and opens reports by opaque artifact ID", async () => {
    const listReportArtifacts = vi
      .fn<DesktopApi["listReportArtifacts"]>()
      .mockResolvedValue({ items: [report], page: 1, pageSize: 25, total: 1 });
    const openReport = vi
      .fn<DesktopApi["openReport"]>()
      .mockResolvedValue({ action: "opened", ok: true });
    Object.defineProperty(window, "auditTool", {
      configurable: true,
      value: {
        exportReport: vi.fn(),
        listReportArtifacts,
        openReport,
        revealReport: vi.fn(),
      },
    });
    const user = userEvent.setup();

    render(<ReportLibrary />);
    expect(await screen.findByText("Northstar Dental")).toBeTruthy();
    expect(screen.queryByText(/AUDIT_TOOL/u)).toBeNull();
    await user.click(screen.getByRole("button", { name: "Open client-summary.pdf" }));

    expect(openReport).toHaveBeenCalledWith({ artifactId: report.id });
  });

  it("disables actions for unavailable artifacts", async () => {
    Object.defineProperty(window, "auditTool", {
      configurable: true,
      value: {
        listReportArtifacts: vi.fn().mockResolvedValue({
          items: [{ ...report, status: "generation-failed" }],
          page: 1,
          pageSize: 25,
          total: 1,
        }),
      },
    });

    render(<ReportLibrary clientId={report.clientId} />);
    expect(await screen.findByText("Generation failed")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Open client-summary.pdf" })).toHaveProperty(
      "disabled",
      true,
    );
  });
});
