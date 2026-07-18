import { randomUUID } from "node:crypto";
import { open, rename, rm, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

import { chromium } from "playwright";

import { auditResultSchema } from "../core/schemas.js";
import type { AuditResult } from "../core/types.js";
import { generateHtmlReport, resolveReportSiteName } from "./html-report.js";

const PDF_NAVIGATION_TIMEOUT_MS = 30_000;
const PDF_SIGNATURE = "%PDF-";

export interface PdfRenderRequest {
  readonly auditId: string;
  readonly htmlPath: string;
  readonly outputPath: string;
  readonly siteName: string;
}

export type PdfRenderer = (request: PdfRenderRequest) => Promise<void>;

export async function writePdfReport(
  pdfDirectory: string,
  auditResult: AuditResult,
  renderer: PdfRenderer = renderPdfWithPlaywright,
): Promise<AuditResult> {
  const validatedResult = auditResultSchema.parse(auditResult);
  const identifier = randomUUID();
  const destinationPath = resolve(pdfDirectory, "audit-report.pdf");
  const temporaryHtmlPath = resolve(pdfDirectory, `.audit-report-${identifier}.tmp.html`);
  const temporaryPdfPath = resolve(pdfDirectory, `.audit-report-${identifier}.tmp.pdf`);
  const resultWithOutput = auditResultSchema.parse({
    ...validatedResult,
    outputs: { ...validatedResult.outputs, pdfReportPath: destinationPath },
  });

  try {
    await writeFile(temporaryHtmlPath, generateHtmlReport(resultWithOutput), {
      encoding: "utf8",
      flag: "wx",
    });
    await renderer({
      auditId: resultWithOutput.auditId,
      htmlPath: temporaryHtmlPath,
      outputPath: temporaryPdfPath,
      siteName: resolveReportSiteName(resultWithOutput),
    });
    await assertPdfFile(temporaryPdfPath);
    await rename(temporaryPdfPath, destinationPath);
    return resultWithOutput;
  } finally {
    await Promise.all([
      rm(temporaryHtmlPath, { force: true }),
      rm(temporaryPdfPath, { force: true }),
    ]);
  }
}

export async function renderPdfWithPlaywright(request: PdfRenderRequest): Promise<void> {
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

      const page = await context.newPage();
      page.setDefaultNavigationTimeout(PDF_NAVIGATION_TIMEOUT_MS);
      await page.goto(pathToFileURL(request.htmlPath).href, {
        timeout: PDF_NAVIGATION_TIMEOUT_MS,
        waitUntil: "load",
      });
      await page.emulateMedia({ media: "print" });
      await page.pdf({
        displayHeaderFooter: true,
        footerTemplate: createFooterTemplate(request.siteName, request.auditId),
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
      await context.close();
    }
  } finally {
    await browser.close();
  }
}

function createFooterTemplate(siteName: string, auditId: string): string {
  return `<div style="box-sizing:border-box;width:100%;padding:0 16mm;color:#5d697a;font-family:Arial,Helvetica,sans-serif;font-size:8px;text-align:center;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;"><strong style="color:#152033;">Audit Report</strong> · ${escapeTemplate(siteName)} · ${escapeTemplate(auditId)} · Page <span class="pageNumber"></span> of <span class="totalPages"></span></div>`;
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
