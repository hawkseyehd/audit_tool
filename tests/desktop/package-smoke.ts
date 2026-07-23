import path from "node:path";

import { PrismaClient } from "@prisma/client";
import { _electron as electron } from "playwright";

const executablePath = path.resolve("node_modules", "electron", "dist", "electron.exe");
const mainEntry = path.resolve(".webpack", "x64", "main", "index.cjs");
const screenshotPath = path.resolve("tmp", "desktop-overview.png");
const compactScreenshotPath = path.resolve("tmp", "desktop-overview-compact.png");
const clientScreenshotPath = path.resolve("tmp", "desktop-clients.png");
const compactClientScreenshotPath = path.resolve("tmp", "desktop-clients-compact.png");
const pageInventoryScreenshotPath = path.resolve("tmp", "desktop-page-inventory.png");
const compactPageInventoryScreenshotPath = path.resolve(
  "tmp",
  "desktop-page-inventory-compact.png",
);

const application = await electron.launch({ args: [mainEntry], executablePath });

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

  process.stdout.write(
    `${JSON.stringify({ bootstrap, clientScreenshotPath, compactClientScreenshotPath, compactPageInventoryScreenshotPath, compactScreenshotPath, pageInventoryScreenshotPath, screenshotPath })}\n`,
  );
} finally {
  await application.close();
}
