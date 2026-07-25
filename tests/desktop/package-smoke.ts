import { existsSync } from "node:fs";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import path from "node:path";

import { PrismaClient } from "@prisma/client";
import { _electron as electron } from "playwright";

const require = createRequire(import.meta.url);
const axe = require("axe-core") as { source: string };
const packagedExecutablePath = path.resolve(
  "out",
  "Website Audit Tool-win32-x64",
  "website-audit-tool.exe",
);
const packagedAsarPath = path.resolve(
  "out",
  "Website Audit Tool-win32-x64",
  "resources",
  "app.asar",
);
const developmentExecutablePath = path.resolve("node_modules", "electron", "dist", "electron.exe");
const mainEntry = path.resolve(".webpack", "x64", "main", "index.cjs");
const smokeTarget = process.env.AUDIT_TOOL_SMOKE_TARGET ?? "asar";
const usesPackagedApplication = smokeTarget !== "development" && existsSync(packagedExecutablePath);
const usesPackagedAsar = usesPackagedApplication && smokeTarget === "asar";
const smokeProfileDirectory = await mkdtemp(path.join(tmpdir(), "audit-tool-package-smoke-"));
const screenshotPath = path.resolve("tmp", "desktop-overview.png");
const compactScreenshotPath = path.resolve("tmp", "desktop-overview-compact.png");
const clientScreenshotPath = path.resolve("tmp", "desktop-clients.png");
const compactClientScreenshotPath = path.resolve("tmp", "desktop-clients-compact.png");
const pageInventoryScreenshotPath = path.resolve("tmp", "desktop-page-inventory.png");
const compactPageInventoryScreenshotPath = path.resolve(
  "tmp",
  "desktop-page-inventory-compact.png",
);
const auditsScreenshotPath = path.resolve("tmp", "desktop-audits.png");
const compactAuditsScreenshotPath = path.resolve("tmp", "desktop-audits-compact.png");
const reportsScreenshotPath = path.resolve("tmp", "desktop-reports.png");
const compactReportsScreenshotPath = path.resolve("tmp", "desktop-reports-compact.png");
const prospectsScreenshotPath = path.resolve("tmp", "desktop-prospects.png");
const compactProspectsScreenshotPath = path.resolve("tmp", "desktop-prospects-compact.png");
const prospectDetailScreenshotPath = path.resolve("tmp", "desktop-prospect-detail.png");
const campaignsScreenshotPath = path.resolve("tmp", "desktop-campaigns.png");
const compactCampaignsScreenshotPath = path.resolve("tmp", "desktop-campaigns-compact.png");
const campaignFormScreenshotPath = path.resolve("tmp", "desktop-campaign-form.png");
const compactCampaignFormScreenshotPath = path.resolve("tmp", "desktop-campaign-form-compact.png");

const application = await electron.launch({
  args: [
    ...(usesPackagedAsar ? [packagedAsarPath] : usesPackagedApplication ? [] : [mainEntry]),
    `--user-data-dir=${smokeProfileDirectory}`,
  ],
  executablePath: usesPackagedAsar
    ? developmentExecutablePath
    : usesPackagedApplication
      ? packagedExecutablePath
      : developmentExecutablePath,
});
await application.context().addInitScript({ content: axe.source });

try {
  const page = await application.firstWindow();
  await page.reload();
  await page.getByRole("heading", { name: "Workspace" }).waitFor({ timeout: 15_000 });
  await page.getByText("Database ready").waitFor({ timeout: 15_000 });
  await page.getByText("Audit worker").waitFor({ timeout: 15_000 });
  await page.keyboard.press("Tab");
  const initialFocus = await page.evaluate(() => {
    const active = document.activeElement;
    if (!(active instanceof HTMLElement)) return null;
    const bounds = active.getBoundingClientRect();
    return {
      height: bounds.height,
      tagName: active.tagName,
      width: bounds.width,
    };
  });
  if (
    initialFocus === null ||
    !["A", "BUTTON", "INPUT", "SELECT", "TEXTAREA"].includes(initialFocus.tagName) ||
    initialFocus.height <= 0 ||
    initialFocus.width <= 0
  ) {
    throw new Error(
      `Keyboard focus did not reach a visible control: ${JSON.stringify(initialFocus)}`,
    );
  }
  await assertNoSeriousAccessibilityViolations(page, "workspace overview");

  await application.evaluate(({ BrowserWindow }) => {
    const window = BrowserWindow.getAllWindows()[0];
    window?.setSize(1280, 820);
    window?.center();
  });
  await page.screenshot({ path: screenshotPath });

  await application.evaluate(({ BrowserWindow }) => {
    BrowserWindow.getAllWindows()[0]?.setSize(900, 700);
  });
  await page.waitForTimeout(250);
  await page.screenshot({ path: compactScreenshotPath });
  await application.evaluate(({ BrowserWindow }) => {
    BrowserWindow.getAllWindows()[0]?.webContents.setZoomFactor(1.25);
  });
  await page.waitForTimeout(250);
  const zoomedLayout = await page.evaluate(() => ({
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
  }));
  if (zoomedLayout.scrollWidth > zoomedLayout.clientWidth + 1) {
    throw new Error(`Display scaling caused page overflow: ${JSON.stringify(zoomedLayout)}`);
  }
  await application.evaluate(({ BrowserWindow }) => {
    BrowserWindow.getAllWindows()[0]?.webContents.setZoomFactor(1);
  });

  const bootstrap = await page.evaluate(() => window.auditTool.getBootstrap());
  if (bootstrap.services.database !== "ready" || bootstrap.services.worker !== "ready") {
    throw new Error(`Packaged services are degraded: ${JSON.stringify(bootstrap.services)}`);
  }

  await page.evaluate(async () => {
    const result = await window.auditTool.createClient({
      businessName: "Northstar Dental Studio",
      category: "Dental clinic",
      locality: "Karachi",
      owner: "Aisha",
      tags: ["Healthcare", "Priority"],
      websiteUrl: "https://visual-test.local/",
    });
    if (!result.ok && result.error.code !== "duplicate-domain") {
      throw new Error(result.error.message);
    }
  });

  const userDataDirectory = await application.evaluate(({ app }) => app.getPath("userData"));
  process.env.DATABASE_URL = `file:${path.join(userDataDirectory, "workspace.db").replaceAll("\\", "/")}`;
  const database = new PrismaClient();
  await database.$connect();
  try {
    const website = await database.website.findUniqueOrThrow({
      where: { normalizedDomain: "visual-test.local" },
    });
    const observedAt = new Date();
    const pages = [
      {
        availability: "available",
        changeState: "changed",
        normalizedUrl: "https://visual-test.local/",
        observedUrl: "https://visual-test.local/",
        pageType: "home",
        recommendationReason: "Representative customer-facing page recommended for review.",
        recommendationState: "recommended",
        selectionState: "included",
        statusCode: 200,
        title: "Northstar Dental Studio",
      },
      {
        availability: "available",
        changeState: "new",
        normalizedUrl: "https://visual-test.local/services",
        observedUrl: "https://visual-test.local/services",
        pageType: "service",
        recommendationReason: "Representative customer-facing page recommended for review.",
        recommendationState: "recommended",
        selectionState: "default",
        statusCode: 200,
        title: "Dental Services",
      },
      {
        availability: "unavailable",
        changeState: "unavailable",
        failureCode: "http-status",
        failureMessage: "Request returned HTTP 503",
        normalizedUrl: "https://visual-test.local/contact",
        observedUrl: "https://visual-test.local/contact",
        pageType: "contact",
        recommendationReason: "Representative customer-facing page recommended for review.",
        recommendationState: "recommended",
        selectionState: "default",
        statusCode: null,
        title: "Contact",
      },
    ];
    for (const inventoryPage of pages) {
      await database.websitePage.upsert({
        create: {
          ...inventoryPage,
          firstDiscoveredAt: observedAt,
          lastChangedAt: observedAt,
          lastObservedAt: observedAt,
          websiteId: website.id,
        },
        update: {
          ...inventoryPage,
          lastChangedAt: observedAt,
          lastObservedAt: observedAt,
        },
        where: {
          websiteId_normalizedUrl: {
            normalizedUrl: inventoryPage.normalizedUrl,
            websiteId: website.id,
          },
        },
      });
    }
    await database.discoveryRun.create({
      data: {
        completedAt: observedAt,
        discoveredUrlCount: 3,
        failedPageCount: 1,
        newPageCount: 1,
        observedPageCount: 3,
        source: "smoke-test",
        startedAt: new Date(observedAt.getTime() - 60_000),
        status: "partial",
        successfulPageCount: 2,
        unavailablePageCount: 1,
        websiteId: website.id,
      },
    });
    const retainedUntil = new Date(observedAt.getTime() + 365 * 24 * 60 * 60 * 1_000);
    await database.prospect.create({
      data: {
        activities: {
          create: {
            kind: "imported",
            summary: "Prospect imported from approved-fixture",
          },
        },
        businessName: "Harbour Legal Partners",
        category: "Legal services",
        confidence: 78,
        country: "Pakistan",
        duplicateReviewState: "confirmed-distinct",
        firstDiscoveredAt: observedAt,
        lastVerifiedAt: observedAt,
        locality: "Karachi",
        normalizedDomain: "harbour-legal.test",
        normalizedWebsiteUrl: "https://harbour-legal.test/",
        owner: "Aisha",
        retainedUntil,
        searchText: "harbour legal partners harbour-legal.test legal services karachi",
        sourceRecords: {
          create: {
            collectedAt: observedAt,
            fieldProvenanceJson: JSON.stringify({
              businessName: "approved provider record",
              websiteUrl: "approved provider record",
            }),
            permittedFieldsJson: JSON.stringify(["businessName", "websiteUrl", "category"]),
            provider: "approved-fixture",
            providerRecordId: "harbour-legal-1",
            retainedUntil,
            retentionPolicy: "Approved fixture retention for one year.",
          },
        },
        state: "reviewing",
        websiteAvailability: "available",
        websiteUrl: "https://harbour-legal.test/",
      },
    });
    await database.discoveryCampaign.create({
      data: {
        category: "dental_clinic",
        completedAt: observedAt,
        country: "PK",
        exclusionRulesJson: JSON.stringify(["Existing clients"]),
        keywordsJson: JSON.stringify(["dentist", "orthodontist"]),
        locality: "Karachi",
        maxResults: 100,
        name: "Karachi dental practices",
        processedCount: 100,
        provider: "dataforseo-business-listings",
        providerRequestCount: 1,
        providerTermsVersion: "reviewed-2026-07-25",
        region: "Sindh",
        requireWebsite: true,
        requiredFieldsJson: JSON.stringify(["businessName", "websiteUrl"]),
        resultCount: 82,
        startedAt: new Date(observedAt.getTime() - 30_000),
        state: "completed",
        suppressedCount: 4,
        warningMessage: "14 records did not contain all required fields.",
      },
    });
  } finally {
    await database.$disconnect();
  }

  await application.evaluate(({ BrowserWindow }) => {
    BrowserWindow.getAllWindows()[0]?.setSize(1280, 820);
  });
  await page.getByRole("button", { name: "Clients" }).click();
  await page.getByText("Northstar Dental Studio").waitFor();
  await assertNoSeriousAccessibilityViolations(page, "client list");
  await page.screenshot({ path: clientScreenshotPath });
  await application.evaluate(({ BrowserWindow }) => {
    BrowserWindow.getAllWindows()[0]?.setSize(900, 700);
  });
  await page.waitForTimeout(250);
  await page.screenshot({ path: compactClientScreenshotPath });

  await page.getByText("Northstar Dental Studio").click();
  await page.getByRole("tab", { name: "Website Pages" }).click();
  await page.getByText("Dental Services").waitFor();
  await page.getByRole("button", { name: "Lock audit scope" }).click();
  await page.getByText("Audit scope locked").waitFor();
  await assertNoSeriousAccessibilityViolations(page, "page inventory");
  await application.evaluate(({ BrowserWindow }) => {
    BrowserWindow.getAllWindows()[0]?.setSize(1280, 820);
  });
  await page.waitForTimeout(250);
  await page.screenshot({ fullPage: true, path: pageInventoryScreenshotPath });
  await application.evaluate(({ BrowserWindow }) => {
    BrowserWindow.getAllWindows()[0]?.setSize(900, 700);
  });
  await page.waitForTimeout(250);
  await page.screenshot({ fullPage: true, path: compactPageInventoryScreenshotPath });

  await page.getByRole("button", { name: "Prospects" }).click();
  await page.getByText("Harbour Legal Partners").waitFor();
  await assertNoSeriousAccessibilityViolations(page, "prospect workspace");
  await application.evaluate(({ BrowserWindow }) => {
    BrowserWindow.getAllWindows()[0]?.setSize(1280, 820);
  });
  await page.screenshot({ fullPage: true, path: prospectsScreenshotPath });
  await application.evaluate(({ BrowserWindow }) => {
    BrowserWindow.getAllWindows()[0]?.setSize(900, 700);
  });
  await page.waitForTimeout(250);
  await page.screenshot({ fullPage: true, path: compactProspectsScreenshotPath });
  await page.getByRole("button", { name: "Find prospects" }).click();
  await page.getByText("Karachi dental practices").waitFor();
  await assertNoSeriousAccessibilityViolations(page, "discovery campaigns");
  await application.evaluate(({ BrowserWindow }) => {
    BrowserWindow.getAllWindows()[0]?.setSize(1280, 820);
  });
  await page.waitForTimeout(250);
  await page.screenshot({ fullPage: true, path: campaignsScreenshotPath });
  await application.evaluate(({ BrowserWindow }) => {
    BrowserWindow.getAllWindows()[0]?.setSize(900, 700);
  });
  await page.waitForTimeout(250);
  await page.screenshot({ fullPage: true, path: compactCampaignsScreenshotPath });
  await page.getByRole("button", { name: "New campaign" }).click();
  await page.getByRole("heading", { name: "New discovery campaign" }).waitFor();
  await assertNoSeriousAccessibilityViolations(page, "campaign creation");
  await application.evaluate(({ BrowserWindow }) => {
    BrowserWindow.getAllWindows()[0]?.setSize(1280, 820);
  });
  await page.waitForTimeout(250);
  await page.screenshot({ fullPage: true, path: campaignFormScreenshotPath });
  await application.evaluate(({ BrowserWindow }) => {
    BrowserWindow.getAllWindows()[0]?.setSize(900, 700);
  });
  await page.waitForTimeout(250);
  await page.screenshot({ fullPage: true, path: compactCampaignFormScreenshotPath });
  await page.getByRole("button", { name: "Back to campaigns" }).click();
  await page.getByRole("button", { name: "Back to prospects" }).click();
  await page.getByRole("button", { name: /Harbour Legal Partners/u }).click();
  await page.getByRole("heading", { name: "Qualification details" }).waitFor();
  await assertNoSeriousAccessibilityViolations(page, "prospect detail");
  await page.screenshot({ fullPage: true, path: prospectDetailScreenshotPath });

  const jobDatabase = new PrismaClient();
  await jobDatabase.$connect();
  try {
    const scope = await jobDatabase.auditScope.findFirstOrThrow({
      orderBy: { createdAt: "desc" },
      where: { normalizedDomain: "visual-test.local" },
    });
    const job = await jobDatabase.auditJob.upsert({
      create: {
        clientBusinessName: scope.clientBusinessName,
        clientId: scope.clientId,
        failedPageCount: 1,
        pagesCompleted: 1,
        pagesTotal: scope.selectedPageCount,
        scopeId: scope.id,
        completedAt: new Date(),
        startedAt: new Date(),
        state: "partially-completed",
        targetUrl: scope.targetUrl,
        warningCount: 1,
        warningsJson: JSON.stringify(["One scoped page could not be fetched."]),
        websiteId: scope.websiteId,
      },
      update: {
        failedPageCount: 1,
        pagesCompleted: 1,
        completedAt: new Date(),
        startedAt: new Date(),
        state: "partially-completed",
        warningCount: 1,
        warningsJson: JSON.stringify(["One scoped page could not be fetched."]),
      },
      where: { scopeId: scope.id },
    });
    const completedAt = new Date();
    const result = await jobDatabase.auditResultRecord.upsert({
      create: {
        auditId: "smoke-audit",
        canonicalResultJson: "{}",
        categoryScoresJson: JSON.stringify({
          accessibility: 78,
          formsAndConversionUx: 82,
          performance: 74,
          securityPrivacy: 88,
          seo: 80,
          technicalContentQuality: 84,
        }),
        clientId: job.clientId,
        completedAt,
        findingCountsJson: JSON.stringify({
          critical: 0,
          high: 1,
          info: 0,
          low: 1,
          medium: 2,
        }),
        jobId: job.id,
        overallScore: 81.4,
        resultState: "partially-completed",
        schemaVersion: "1.0.0",
        scopeId: scope.id,
        startedAt: new Date(completedAt.getTime() - 60_000),
        websiteId: job.websiteId,
      },
      update: {
        categoryScoresJson: JSON.stringify({ performance: 74, seo: 80 }),
        completedAt,
        findingCountsJson: JSON.stringify({
          critical: 0,
          high: 1,
          info: 0,
          low: 1,
          medium: 2,
        }),
        overallScore: 81.4,
      },
      where: { jobId: job.id },
    });
    await jobDatabase.reportArtifact.upsert({
      create: {
        clientId: job.clientId,
        fileName: "client-summary.pdf",
        format: "client-summary-pdf",
        jobId: job.id,
        resultId: result.id,
        status: "available",
        storedPath: path.join("smoke-audit", "client-summary.pdf"),
        websiteId: job.websiteId,
      },
      update: {
        status: "available",
        storedPath: path.join("smoke-audit", "client-summary.pdf"),
      },
      where: { jobId_format: { format: "client-summary-pdf", jobId: job.id } },
    });
    const reportDirectory = path.join(userDataDirectory, "audits", "smoke-audit");
    await mkdir(reportDirectory, { recursive: true });
    await writeFile(path.join(reportDirectory, "client-summary.pdf"), "%PDF-1.4\n");
  } finally {
    await jobDatabase.$disconnect();
  }

  await page.getByRole("button", { name: "Audits" }).click();
  await page.locator(".audit-job-status-partially-completed").waitFor();
  await assertNoSeriousAccessibilityViolations(page, "audit history");
  await application.evaluate(({ BrowserWindow }) => {
    BrowserWindow.getAllWindows()[0]?.setSize(1280, 820);
  });
  await page.waitForTimeout(250);
  await page.screenshot({ fullPage: true, path: auditsScreenshotPath });
  await application.evaluate(({ BrowserWindow }) => {
    BrowserWindow.getAllWindows()[0]?.setSize(900, 700);
  });
  await page.waitForTimeout(250);
  await page.screenshot({ fullPage: true, path: compactAuditsScreenshotPath });

  await page.getByRole("button", { name: "Reports" }).click();
  await page.getByText("client-summary.pdf").waitFor();
  await assertNoSeriousAccessibilityViolations(page, "report library");
  await application.evaluate(({ BrowserWindow }) => {
    BrowserWindow.getAllWindows()[0]?.setSize(1280, 820);
  });
  await page.waitForTimeout(250);
  await page.screenshot({ fullPage: true, path: reportsScreenshotPath });
  await application.evaluate(({ BrowserWindow }) => {
    BrowserWindow.getAllWindows()[0]?.setSize(900, 700);
  });
  await page.waitForTimeout(250);
  await page.screenshot({ fullPage: true, path: compactReportsScreenshotPath });

  process.stdout.write(
    `${JSON.stringify({ auditsScreenshotPath, bootstrap, campaignFormScreenshotPath, campaignsScreenshotPath, clientScreenshotPath, compactAuditsScreenshotPath, compactCampaignFormScreenshotPath, compactCampaignsScreenshotPath, compactClientScreenshotPath, compactPageInventoryScreenshotPath, compactProspectsScreenshotPath, compactReportsScreenshotPath, compactScreenshotPath, pageInventoryScreenshotPath, prospectDetailScreenshotPath, prospectsScreenshotPath, reportsScreenshotPath, screenshotPath, smokeTarget, usesPackagedApplication })}\n`,
  );
} finally {
  await application.close();
  await rm(smokeProfileDirectory, { force: true, recursive: true });
}

async function assertNoSeriousAccessibilityViolations(
  page: Awaited<ReturnType<typeof application.firstWindow>>,
  surface: string,
): Promise<void> {
  await page.waitForTimeout(250);
  const result = await page.evaluate(async () => {
    const axeApi = (
      window as unknown as {
        axe: {
          run: () => Promise<{
            violations: {
              id: string;
              impact: "critical" | "minor" | "moderate" | "serious" | null;
              nodes: {
                failureSummary?: string;
                html: string;
                target: string[];
              }[];
            }[];
          }>;
        };
      }
    ).axe;
    return axeApi.run();
  });
  const blocking = result.violations.filter(
    (violation) => violation.impact === "critical" || violation.impact === "serious",
  );
  if (blocking.length === 0) return;
  throw new Error(
    `${surface} has serious accessibility violations: ${blocking
      .map(
        (violation) =>
          `${violation.id} ${violation.nodes
            .map((node) => `${node.target.join(" ")}: ${node.failureSummary ?? node.html}`)
            .join("; ")}`,
      )
      .join(", ")}`,
  );
}
