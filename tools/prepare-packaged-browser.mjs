import { existsSync } from "node:fs";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import { spawn } from "node:child_process";

const projectRoot = path.resolve(import.meta.dirname, "..");
const browserDirectory = path.join(projectRoot, ".playwright-browsers");
const playwrightCli = path.join(projectRoot, "node_modules", "playwright", "cli.js");

if (!existsSync(playwrightCli)) {
  throw new Error("Playwright is not installed. Run pnpm install before desktop:prepare.");
}

await mkdir(browserDirectory, { recursive: true });
await new Promise((resolve, reject) => {
  const child = spawn(process.execPath, [playwrightCli, "install", "chromium"], {
    cwd: projectRoot,
    env: {
      ...process.env,
      PLAYWRIGHT_BROWSERS_PATH: browserDirectory,
    },
    stdio: "inherit",
  });
  child.once("error", reject);
  child.once("exit", (code) => {
    if (code === 0) resolve();
    else reject(new Error(`Playwright browser installation exited with code ${String(code)}`));
  });
});

process.env.PLAYWRIGHT_BROWSERS_PATH = browserDirectory;
const { chromium } = await import("playwright");
const executablePath = chromium.executablePath();
if (!existsSync(executablePath)) {
  throw new Error(`Packaged Chromium executable was not found at ${executablePath}`);
}

process.stdout.write(`${JSON.stringify({ browserDirectory, executablePath, prepared: true })}\n`);
