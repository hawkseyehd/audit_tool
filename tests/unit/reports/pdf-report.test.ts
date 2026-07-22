import { mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it, vi } from "vitest";

import {
  auditResultSchema,
  writeClientSummaryReport,
  writePdfReport,
  writePdfReports,
  writePdfSummaryReport,
  type AuditResult,
  type PdfBatchRenderer,
  type PdfRenderer,
} from "../../../src/index.js";

const temporaryDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(
    temporaryDirectories
      .splice(0)
      .map((directory) => rm(directory, { force: true, recursive: true })),
  );
});

describe("writePdfReport", () => {
  it("atomically renders a validated PDF from the client report HTML", async () => {
    const directory = await createTemporaryDirectory();
    const renderer = vi.fn<PdfRenderer>(async (request) => {
      const html = await readFile(request.htmlPath, "utf8");
      expect(request.auditId).toBe("audit-pdf-report-test");
      expect(request.documentTitle).toBe("Audit Report");
      expect(request.siteName).toBe("Example Business");
      expect(request.outputPath).toMatch(/\.tmp\.pdf$/u);
      expect(html).toContain('<h1 id="report-title">Audit Report</h1>');
      expect(html).toContain("Example Business");
      expect(html).toContain("Button has no accessible name");
      await writeFile(request.outputPath, "%PDF-1.7\nclient report fixture", "ascii");
    });

    const writtenResult = await writePdfReport(directory, resultFixture(), renderer);
    const reportPath = writtenResult.outputs.pdfReportPath;

    expect(renderer).toHaveBeenCalledOnce();
    expect(reportPath).toBe(join(directory, "audit-report.pdf"));
    expect(() => auditResultSchema.parse(writtenResult)).not.toThrow();
    await expect(readFile(reportPath ?? "", "ascii")).resolves.toMatch(/^%PDF-/u);
    expect(await temporaryArtifacts(directory)).toEqual([]);
  });

  it("renders the full, audit summary, and client summary reports in one batch", async () => {
    const directory = await createTemporaryDirectory();
    const renderer = vi.fn<PdfBatchRenderer>(async (requests) => {
      expect(requests).toHaveLength(3);
      expect(requests.map((request) => request.documentTitle)).toEqual([
        "Audit Report",
        "Audit Summary",
        "Website Improvement Summary",
      ]);
      const html = await Promise.all(
        requests.map((request) => readFile(request.htmlPath, "utf8")),
      );
      expect(html[0]).toContain('<h1 id="report-title">Audit Report</h1>');
      expect(html[1]).toContain('<h1 id="summary-title">Audit Summary</h1>');
      expect(html[2]).toContain("Website Improvement Summary");
      expect(requests[2]?.includeAuditId).toBe(false);
      await Promise.all(
        requests.map((request) =>
          writeFile(request.outputPath, "%PDF-1.7\nreport fixture", "ascii"),
        ),
      );
    });

    const writtenResult = await writePdfReports(
      directory,
      resultFixture(),
      { writeClientSummary: true, writeFullReport: true, writeSummaryReport: true },
      renderer,
    );

    expect(renderer).toHaveBeenCalledOnce();
    expect(writtenResult.outputs.pdfReportPath).toBe(join(directory, "audit-report.pdf"));
    expect(writtenResult.outputs.summaryPdfReportPath).toBe(
      join(directory, "audit-summary.pdf"),
    );
    expect(writtenResult.outputs.clientSummaryPdfReportPath).toBe(
      join(directory, "client-summary.pdf"),
    );
    await expect(readFile(writtenResult.outputs.pdfReportPath ?? "", "ascii")).resolves.toMatch(
      /^%PDF-/u,
    );
    await expect(
      readFile(writtenResult.outputs.summaryPdfReportPath ?? "", "ascii"),
    ).resolves.toMatch(/^%PDF-/u);
    await expect(
      readFile(writtenResult.outputs.clientSummaryPdfReportPath ?? "", "ascii"),
    ).resolves.toMatch(/^%PDF-/u);
    expect(await temporaryArtifacts(directory)).toEqual([]);
  });

  it("supports writing the summary report by itself", async () => {
    const directory = await createTemporaryDirectory();
    const renderer = vi.fn<PdfRenderer>(async (request) => {
      const html = await readFile(request.htmlPath, "utf8");
      expect(request.documentTitle).toBe("Audit Summary");
      expect(html).toContain("Audit Summary");
      await writeFile(request.outputPath, "%PDF-1.7\nsummary fixture", "ascii");
    });

    const writtenResult = await writePdfSummaryReport(directory, resultFixture(), renderer);

    expect(writtenResult.outputs.pdfReportPath).toBeUndefined();
    expect(writtenResult.outputs.summaryPdfReportPath).toBe(
      join(directory, "audit-summary.pdf"),
    );
    expect(await temporaryArtifacts(directory)).toEqual([]);
  });

  it("supports writing the client business summary by itself", async () => {
    const directory = await createTemporaryDirectory();
    const renderer = vi.fn<PdfRenderer>(async (request) => {
      const html = await readFile(request.htmlPath, "utf8");
      expect(request.documentTitle).toBe("Website Improvement Summary");
      expect(request.includeAuditId).toBe(false);
      expect(html).toContain("Pages reviewed");
      expect(html).not.toContain("Audit ID");
      await writeFile(request.outputPath, "%PDF-1.7\nclient summary fixture", "ascii");
    });

    const writtenResult = await writeClientSummaryReport(directory, resultFixture(), renderer);

    expect(writtenResult.outputs.pdfReportPath).toBeUndefined();
    expect(writtenResult.outputs.summaryPdfReportPath).toBeUndefined();
    expect(writtenResult.outputs.clientSummaryPdfReportPath).toBe(
      join(directory, "client-summary.pdf"),
    );
    expect(await temporaryArtifacts(directory)).toEqual([]);
  });

  it("rejects invalid renderer output and removes temporary files", async () => {
    const directory = await createTemporaryDirectory();
    const renderer: PdfRenderer = async (request) => {
      await writeFile(request.outputPath, "not a PDF", "utf8");
    };

    await expect(writePdfReport(directory, resultFixture(), renderer)).rejects.toThrow(
      "valid PDF file",
    );
    expect(await temporaryArtifacts(directory)).toEqual([]);
  });

  it("removes temporary files when the renderer fails", async () => {
    const directory = await createTemporaryDirectory();
    const renderer: PdfRenderer = () => Promise.reject(new Error("Chromium unavailable"));

    await expect(writePdfReport(directory, resultFixture(), renderer)).rejects.toThrow(
      "Chromium unavailable",
    );
    expect(await temporaryArtifacts(directory)).toEqual([]);
  });

  it("does not commit either report when one batched PDF is invalid", async () => {
    const directory = await createTemporaryDirectory();
    const renderer: PdfBatchRenderer = async (requests) => {
      const first = requests[0];
      const second = requests[1];
      if (first === undefined || second === undefined) throw new Error("Expected two requests");
      await writeFile(first.outputPath, "%PDF-1.7\nvalid fixture", "ascii");
      await writeFile(second.outputPath, "invalid fixture", "ascii");
    };

    await expect(
      writePdfReports(
        directory,
        resultFixture(),
        { writeClientSummary: false, writeFullReport: true, writeSummaryReport: true },
        renderer,
      ),
    ).rejects.toThrow("valid PDF file");
    expect(await readdir(directory)).toEqual([]);
  });
});

function resultFixture(): AuditResult {
  return auditResultSchema.parse({
    schemaVersion: "1.0.0",
    auditId: "audit-pdf-report-test",
    startedAt: "2026-07-18T17:00:00.000Z",
    completedAt: "2026-07-18T17:05:00.000Z",
    targetUrl: "example.com",
    normalizedUrl: "https://example.com/",
    scannedPages: [
      {
        url: "https://example.com/",
        title: "Example Business",
        pageType: "home",
        statusCode: 200,
      },
    ],
    summary: {
      overallScore: 78,
      categoryScores: {
        performance: 82,
        accessibility: 62,
        formsAndConversionUx: 91,
        seo: 88,
        securityPrivacy: 94,
        technicalContentQuality: 79,
      },
      findingCounts: { critical: 0, high: 1, medium: 0, low: 0, info: 0 },
      topPriorities: ["Button has no accessible name"],
    },
    findings: [
      {
        id: "accessibility-button-name",
        ruleId: "button-name",
        url: "https://example.com/",
        category: "accessibility",
        severity: "high",
        title: "Button has no accessible name",
        description: "A primary action has no programmatic name.",
        impact: "Screen-reader users may not understand or complete the action.",
        recommendation: "Add a concise accessible name and verify it manually.",
        scanner: "accessibility",
        detectedAt: "2026-07-18T17:03:00.000Z",
        evidence: { selector: "button", source: "axe" },
      },
    ],
    outputs: {},
  });
}

async function createTemporaryDirectory(): Promise<string> {
  const directory = await mkdtemp(join(tmpdir(), "website-audit-pdf-report-"));
  temporaryDirectories.push(directory);
  return directory;
}

async function temporaryArtifacts(directory: string): Promise<string[]> {
  return (await readdir(directory)).filter((name) => name.includes(".tmp."));
}
