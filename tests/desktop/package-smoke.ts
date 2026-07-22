import path from "node:path";

import { _electron as electron } from "playwright";

const executablePath = path.resolve("node_modules", "electron", "dist", "electron.exe");
const mainEntry = path.resolve(".webpack", "x64", "main", "index.cjs");
const screenshotPath = path.resolve("tmp", "desktop-overview.png");
const compactScreenshotPath = path.resolve("tmp", "desktop-overview-compact.png");

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

  process.stdout.write(`${JSON.stringify({ bootstrap, compactScreenshotPath, screenshotPath })}\n`);
} finally {
  await application.close();
}
