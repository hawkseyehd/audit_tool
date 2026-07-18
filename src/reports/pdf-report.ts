import { randomUUID } from "node:crypto";
import { open, rename, rm, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

import { chromium } from "playwright";

import { auditResultSchema } from "../core/schemas.js";
import type { AuditResult } from "../core/types.js";
import { generateHtmlReport, resolveReportSiteName } from "./html-report.js";
import { generatePdfSummaryReport } from "./pdf-summary-report.js";

const PDF_NAVIGATION_TIMEOUT_MS = 30_000;
const PDF_SIGNATURE = "%PDF-";

export interface PdfRenderRequest {
  readonly auditId: string;
  readonly documentTitle: string;
  readonly htmlPath: string;
  readonly outputPath: string;
  readonly siteName: string;
}

export interface PdfReportSelection {
  readonly writeFullReport: boolean;
  readonly writeSummaryReport: boolean;
}

export type PdfRenderer = (request: PdfRenderRequest) => Promise<void>;
export type PdfBatchRenderer = (requests: readonly PdfRenderRequest[]) => Promise<void>;

interface PdfDocument {
  readonly destinationPath: string;
  readonly documentTitle: string;
  readonly temporaryHtmlPath: string;
  readonly temporaryPdfPath: string;
  readonly writeHtml: (result: AuditResult) => string;
}

export async function writePdfReport(
  pdfDirectory: string,
  auditResult: AuditResult,
  renderer: PdfRenderer = renderPdfWithPlaywright,
): Promise<AuditResult> {
  return writePdfReports(
    pdfDirectory,
    auditResult,
    { writeFullReport: true, writeSummaryReport: false },
    async (requests) => {
      for (const request of requests) await renderer(request);
    },
  );
}

export async function writePdfSummaryReport(
  pdfDirectory: string,
  auditResult: AuditResult,
  renderer: PdfRenderer = renderPdfWithPlaywright,
): Promise<AuditResult> {
  return writePdfReports(
    pdfDirectory,
    auditResult,
    { writeFullReport: false, writeSummaryReport: true },
    async (requests) => {
      for (const request of requests) await renderer(request);
    },
  );
}

export async function writePdfReports(
  pdfDirectory: string,
  auditResult: AuditResult,
  selection: PdfReportSelection,
  renderer: PdfBatchRenderer = renderPdfsWithPlaywright,
): Promise<AuditResult> {
  const validatedResult = auditResultSchema.parse(auditResult);
  if (!selection.writeFullReport && !selection.writeSummaryReport) return validatedResult;

  const identifier = randomUUID();
  const fullReportPath = resolve(pdfDirectory, "audit-report.pdf");
  const summaryReportPath = resolve(pdfDirectory, "audit-summary.pdf");
  const resultWithOutputs = auditResultSchema.parse({
    ...validatedResult,
    outputs: {
      ...validatedResult.outputs,
      ...(selection.writeFullReport ? { pdfReportPath: fullReportPath } : {}),
      ...(selection.writeSummaryReport ? { summaryPdfReportPath: summaryReportPath } : {}),
    },
  });
  const documents: PdfDocument[] = [];

  if (selection.writeFullReport) {
    documents.push({
      destinationPath: fullReportPath,
      documentTitle: "Audit Report",
      temporaryHtmlPath: resolve(pdfDirectory, `.audit-report-${identifier}.tmp.html`),
      temporaryPdfPath: resolve(pdfDirectory, `.audit-report-${identifier}.tmp.pdf`),
      writeHtml: generateHtmlReport,
    });
  }
  if (selection.writeSummaryReport) {
    documents.push({
      destinationPath: summaryReportPath,
      documentTitle: "Audit Summary",
      temporaryHtmlPath: resolve(pdfDirectory, `.audit-summary-${identifier}.tmp.html`),
      temporaryPdfPath: resolve(pdfDirectory, `.audit-summary-${identifier}.tmp.pdf`),
      writeHtml: generatePdfSummaryReport,
    });
  }

  const siteName = resolveReportSiteName(resultWithOutputs);
  const committedPaths: string[] = [];

  try {
    await Promise.all(
      documents.map((document) =>
        writeFile(document.temporaryHtmlPath, document.writeHtml(resultWithOutputs), {
          encoding: "utf8",
          flag: "wx",
        }),
      ),
    );
    await renderer(
      documents.map((document) => ({
        auditId: resultWithOutputs.auditId,
        documentTitle: document.documentTitle,
        htmlPath: document.temporaryHtmlPath,
        outputPath: document.temporaryPdfPath,
        siteName,
      })),
    );
    await Promise.all(documents.map((document) => assertPdfFile(document.temporaryPdfPath)));

    for (const document of documents) {
      await rename(document.temporaryPdfPath, document.destinationPath);
      committedPaths.push(document.destinationPath);
    }
    return resultWithOutputs;
  } catch (error: unknown) {
    await Promise.all(committedPaths.map((path) => rm(path, { force: true })));
    throw error;
  } finally {
    await Promise.all(
      documents.flatMap((document) => [
        rm(document.temporaryHtmlPath, { force: true }),
        rm(document.temporaryPdfPath, { force: true }),
      ]),
    );
  }
}

export async function renderPdfWithPlaywright(request: PdfRenderRequest): Promise<void> {
  await renderPdfsWithPlaywright([request]);
}

export async function renderPdfsWithPlaywright(
  requests: readonly PdfRenderRequest[],
): Promise<void> {
  if (requests.length === 0) return;

  const browser = await chromium.launch({ headless: true });
  try {
    const context = await browser.newContext({
      acceptDownloads: false,
      javaScriptEnabled: false,
      serviceWorkers: "block",
    });
    try {
      await context.route("**/*", async (route) => {
        const protocol = new URL(route.request().url()).protocol;
        if (protocol === "file:" || protocol === "data:" || protocol === "about:") {
          await route.continue();
          return;
        }
        await route.abort("blockedbyclient");
      });

      for (const request of requests) {
        const page = await context.newPage();
        try {
          page.setDefaultNavigationTimeout(PDF_NAVIGATION_TIMEOUT_MS);
          await page.goto(pathToFileURL(request.htmlPath).href, {
            timeout: PDF_NAVIGATION_TIMEOUT_MS,
            waitUntil: "load",
          });
          await page.emulateMedia({ media: "print" });
          await page.pdf({
            displayHeaderFooter: true,
            footerTemplate: createFooterTemplate(request),
            format: "A4",
            headerTemplate: "<span></span>",
            margin: { bottom: "20mm", left: "16mm", right: "16mm", top: "18mm" },
            outline: true,
            path: request.outputPath,
            preferCSSPageSize: true,
            printBackground: true,
            tagged: true,
          });
        } finally {
          await page.close();
        }
      }
    } finally {
      await context.close();
    }
  } finally {
    await browser.close();
  }
}

function createFooterTemplate(request: PdfRenderRequest): string {
  return `<div style="box-sizing:border-box;width:100%;padding:0 16mm;color:#5d697a;font-family:Arial,Helvetica,sans-serif;font-size:8px;text-align:center;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;"><strong style="color:#152033;">${escapeTemplate(request.documentTitle)}</strong> &middot; ${escapeTemplate(request.siteName)} &middot; ${escapeTemplate(request.auditId)} &middot; Page <span class="pageNumber"></span> of <span class="totalPages"></span></div>`;
}

async function assertPdfFile(path: string): Promise<void> {
  const handle = await open(path, "r");
  try {
    const signature = Buffer.alloc(PDF_SIGNATURE.length);
    const { bytesRead } = await handle.read(signature, 0, signature.length, 0);
    if (bytesRead !== signature.length || signature.toString("ascii") !== PDF_SIGNATURE) {
      throw new Error("PDF renderer did not create a valid PDF file");
    }
  } finally {
    await handle.close();
  }
}

function escapeTemplate(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}
