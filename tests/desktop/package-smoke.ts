import { existsSync } from "node:fs";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { PrismaClient } from "@prisma/client";
import { _electron as electron } from "playwright";

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

try {
  const page = await application.firstWindow();
  await page.getByRole("heading", { name: "Workspace" }).waitFor({ timeout: 15_000 });
  await page.getByText("Database ready").waitFor({ timeout: 15_000 });
  await page.getByText("Audit worker").waitFor({ timeout: 15_000 });

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
  } finally {
    await database.$disconnect();
  }

  await application.evaluate(({ BrowserWindow }) => {
    BrowserWindow.getAllWindows()[0]?.setSize(1280, 820);
  });
  await page.getByRole("button", { name: "Clients" }).click();
  await page.getByText("Northstar Dental Studio").waitFor();
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

  const jobDatabase = new PrismaClient();
  await jobDatabase.$connect();
  try {
    const scope = await jobDatabase.auditScope.findFirstOrThrow({
      orderBy: { createdAt: "desc" },
      where: { normalizedDomain: "visual-test.local" },
    });
    await jobDatabase.auditJob.upsert({
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
  } finally {
    await jobDatabase.$disconnect();
  }

  await page.getByRole("button", { name: "Audits" }).click();
  await page.getByText("Partially completed").first().waitFor();
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

  process.stdout.write(
    `${JSON.stringify({ auditsScreenshotPath, bootstrap, clientScreenshotPath, compactAuditsScreenshotPath, compactClientScreenshotPath, compactPageInventoryScreenshotPath, compactScreenshotPath, pageInventoryScreenshotPath, screenshotPath, smokeTarget, usesPackagedApplication })}\n`,
  );
} finally {
  await application.close();
  await rm(smokeProfileDirectory, { force: true, recursive: true });
}
