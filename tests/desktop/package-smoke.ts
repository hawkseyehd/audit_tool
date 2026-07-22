import path from "node:path";

import { _electron as electron } from "playwright";

const executablePath = path.resolve("node_modules", "electron", "dist", "electron.exe");
const mainEntry = path.resolve(".webpack", "x64", "main", "index.cjs");
const screenshotPath = path.resolve("tmp", "desktop-overview.png");
const compactScreenshotPath = path.resolve("tmp", "desktop-overview-compact.png");
const clientScreenshotPath = path.resolve("tmp", "desktop-clients.png");
const compactClientScreenshotPath = path.resolve("tmp", "desktop-clients-compact.png");

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

  process.stdout.write(
    `${JSON.stringify({ bootstrap, clientScreenshotPath, compactClientScreenshotPath, compactScreenshotPath, screenshotPath })}\n`,
  );
} finally {
  await application.close();
}
