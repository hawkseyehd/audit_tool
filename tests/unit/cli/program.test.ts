import { describe, expect, it, vi } from "vitest";

import {
  executeCli,
  type AuditConfig,
  type AuditRunReceipt,
  type CliDependencies,
} from "../../../src/index.js";

const successfulReceipt: AuditRunReceipt = {
  status: "initialized",
  auditId: "audit-test",
  scannedPageCount: 0,
  outputDirectory: "C:/reports/audit-test",
};

describe("executeCli", () => {
  it("validates defaults and initializes an audit", async () => {
    const harness = createHarness();
    const exitCode = await executeCli(
      ["node", "website-audit", "audit", "example.com"],
      harness.dependencies,
    );

    expect(exitCode).toBe(0);
    expect(harness.runAudit).toHaveBeenCalledOnce();
    expect(harness.runAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        targetUrl: "example.com",
        maxPages: 15,
        outputDir: "./reports",
        viewports: ["desktop"],
        writeHtml: true,
        writeJson: true,
        writeMarkdown: true,
        writePdf: true,
        writePdfSummary: true,
        submitForms: false,
      }),
    );
    expect(harness.stdout.join("\n")).toContain("Starting audit for example.com");
    expect(harness.stdout.join("\n")).toContain("Audit initialized: audit-test");
    expect(harness.stdout.join("\n")).toContain("Scanned pages: 0");
  });

  it("maps viewport and output-format flags", async () => {
    const harness = createHarness();
    await executeCli(
      [
        "node",
        "website-audit",
        "audit",
        "https://example.com",
        "--max-pages",
        "20",
        "--output",
        "./custom-reports",
        "--mobile",
        "--desktop",
        "--json",
        "--no-submit-forms",
      ],
      harness.dependencies,
    );

    const config = harness.runAudit.mock.calls[0]?.[0];
    expect(config).toMatchObject({
      maxPages: 20,
      outputDir: "./custom-reports",
      viewports: ["desktop", "mobile"],
      writeHtml: false,
      writeJson: true,
      writeMarkdown: false,
      writePdf: false,
      writePdfSummary: false,
      submitForms: false,
    });
  });

  it("prints browser inspection and screenshot artifacts", async () => {
    const harness = createHarness({
      receipt: {
        status: "inspected",
        auditId: "audit-browser",
        scannedPageCount: 2,
        outputDirectory: "C:/reports/audit-browser",
        browserInspectionPath: "C:/reports/audit-browser/json/browser-inspection.json",
        pdfReportPath: "C:/reports/audit-browser/pdf/audit-report.pdf",
        summaryPdfReportPath: "C:/reports/audit-browser/pdf/audit-summary.pdf",
        screenshotDirectory: "C:/reports/audit-browser/screenshots",
      },
    });

    const exitCode = await executeCli(
      ["node", "website-audit", "audit", "example.com"],
      harness.dependencies,
    );

    const output = harness.stdout.join("\n");
    expect(exitCode).toBe(0);
    expect(output).toContain("Audit browser inspection completed: audit-browser");
    expect(output).toContain("Browser inspection:");
    expect(output).toContain("PDF report:");
    expect(output).toContain("Summary PDF:");
    expect(output).toContain("Screenshots:");
  });

  it("supports selecting PDF as the only report format", async () => {
    const harness = createHarness();
    await executeCli(
      ["node", "website-audit", "audit", "https://example.com", "--pdf"],
      harness.dependencies,
    );

    expect(harness.runAudit.mock.calls[0]?.[0]).toMatchObject({
      writeHtml: false,
      writeJson: false,
      writeMarkdown: false,
      writePdf: true,
      writePdfSummary: false,
    });
  });

  it("supports selecting the summary PDF as the only report format", async () => {
    const harness = createHarness();
    await executeCli(
      ["node", "website-audit", "audit", "https://example.com", "--summary-pdf"],
      harness.dependencies,
    );

    expect(harness.runAudit.mock.calls[0]?.[0]).toMatchObject({
      writeHtml: false,
      writeJson: false,
      writeMarkdown: false,
      writePdf: false,
      writePdfSummary: true,
    });
  });

  it("returns exit code 2 for an invalid target", async () => {
    const harness = createHarness();
    const exitCode = await executeCli(
      ["node", "website-audit", "audit", "ftp://example.com"],
      harness.dependencies,
    );

    expect(exitCode).toBe(2);
    expect(harness.runAudit).not.toHaveBeenCalled();
    expect(harness.stderr.join("\n")).toContain("Invalid audit configuration");
    expect(harness.stderr.join("\n")).toContain("targetUrl");
  });

  it("returns exit code 2 for a non-integer max page count", async () => {
    const harness = createHarness();
    const exitCode = await executeCli(
      ["node", "website-audit", "audit", "example.com", "--max-pages", "1.5"],
      harness.dependencies,
    );

    expect(exitCode).toBe(2);
    expect(harness.runAudit).not.toHaveBeenCalled();
    expect(harness.stderr.join("\n")).toContain("Expected a whole number");
  });

  it("returns exit code 1 without a stack trace when the runner fails", async () => {
    const harness = createHarness({ runnerError: new Error("Output directory is blocked") });
    const exitCode = await executeCli(
      ["node", "website-audit", "audit", "example.com"],
      harness.dependencies,
    );

    expect(exitCode).toBe(1);
    expect(harness.stderr).toEqual(["Audit failed: Output directory is blocked"]);
    expect(harness.stderr.join("\n")).not.toContain("at ");
  });

  it("prints all required audit options in help output", async () => {
    const harness = createHarness();
    const exitCode = await executeCli(
      ["node", "website-audit", "audit", "--help"],
      harness.dependencies,
    );

    const help = harness.stdout.join("\n");
    expect(exitCode).toBe(0);
    expect(help).toContain("--max-pages");
    expect(help).toContain("--output");
    expect(help).toContain("--mobile");
    expect(help).toContain("--desktop");
    expect(help).toContain("--html");
    expect(help).toContain("--json");
    expect(help).toContain("--markdown");
    expect(help).toContain("--pdf");
    expect(help).toContain("--summary-pdf");
    expect(help).toContain("--no-submit-forms");
  });
});

function createHarness(
  options: { readonly receipt?: AuditRunReceipt; readonly runnerError?: Error } = {},
): {
  readonly dependencies: CliDependencies;
  readonly runAudit: ReturnType<typeof vi.fn<(config: AuditConfig) => Promise<AuditRunReceipt>>>;
  readonly stderr: string[];
  readonly stdout: string[];
} {
  const stdout: string[] = [];
  const stderr: string[] = [];
  const runAudit = vi.fn((_config: AuditConfig) => {
    if (options.runnerError !== undefined) {
      return Promise.reject(options.runnerError);
    }
    return Promise.resolve(options.receipt ?? successfulReceipt);
  });

  return {
    dependencies: {
      logger: {
        error: vi.fn(),
        info: vi.fn(),
        warn: vi.fn(),
      },
      runAudit,
      writeError: (message) => stderr.push(message),
      writeOut: (message) => stdout.push(message),
    },
    runAudit,
    stderr,
    stdout,
  };
}
