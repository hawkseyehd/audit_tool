import { existsSync } from "node:fs";
import { mkdir, readdir, stat, writeFile } from "node:fs/promises";
import path from "node:path";

import { extractFile, listPackage } from "@electron/asar";

const packageRoot = path.resolve("out", "Website Audit Tool-win32-x64");
const executablePath = path.join(packageRoot, "website-audit-tool.exe");
const resourcesPath = path.join(packageRoot, "resources");
const asarPath = path.join(resourcesPath, "app.asar");
const browserPath = path.join(resourcesPath, ".playwright-browsers");
const installerRoot = path.resolve("out", "make", "squirrel.windows", "x64");
const requireInstaller = process.argv.includes("--require-installer");

for (const requiredPath of [executablePath, asarPath, browserPath]) {
  if (!existsSync(requiredPath)) {
    throw new Error(`Required packaged artifact is missing: ${requiredPath}`);
  }
}

const archiveEntries = listPackage(asarPath, { isPack: false }).map(normalizeArchivePath);
const requiredArchivePrefixes = [
  ".webpack/main/index.cjs",
  ".webpack/main/worker.cjs",
  "node_modules/@prisma/client/",
  "node_modules/.prisma/client/",
  "node_modules/lighthouse/",
  "node_modules/playwright/",
  "node_modules/playwright-core/",
] as const;
const missingArchiveEntries = requiredArchivePrefixes.filter(
  (prefix) => !archiveEntries.some((entry) => entry.startsWith(prefix)),
);
if (missingArchiveEntries.length > 0) {
  throw new Error(
    `Packaged ASAR is missing required runtime entries: ${missingArchiveEntries.join(", ")}`,
  );
}

const packagedManifest = JSON.parse(extractFile(asarPath, "package.json").toString("utf8")) as {
  main?: unknown;
};
if (packagedManifest.main !== ".webpack/main/index.cjs") {
  throw new Error("Packaged manifest does not point to the secured main-process bundle");
}

const browserFiles = await listFiles(browserPath);
const chromiumExecutable = browserFiles.find((file) => path.basename(file) === "chrome.exe");
const headlessExecutable = browserFiles.find(
  (file) => path.basename(file) === "chrome-headless-shell.exe",
);
if (chromiumExecutable === undefined || headlessExecutable === undefined) {
  throw new Error("Packaged Playwright Chromium executables are incomplete");
}

const installerFiles = existsSync(installerRoot) ? await listFiles(installerRoot) : [];
const setupExecutable = installerFiles.find(
  (file) => path.basename(file) === "WebsiteAuditToolSetup.exe",
);
const releasesFile = installerFiles.find((file) => path.basename(file) === "RELEASES");
const fullPackage = installerFiles.find((file) => file.endsWith("-full.nupkg"));
if (
  requireInstaller &&
  (setupExecutable === undefined || releasesFile === undefined || fullPackage === undefined)
) {
  throw new Error("Squirrel.Windows installer output is incomplete");
}

const evidence = {
  archiveEntryCount: archiveEntries.length,
  asarBytes: (await stat(asarPath)).size,
  browserBytes: await directorySize(browserPath),
  chromiumExecutable: path.relative(resourcesPath, chromiumExecutable),
  executableBytes: (await stat(executablePath)).size,
  headlessExecutable: path.relative(resourcesPath, headlessExecutable),
  installer: {
    fullPackage: fullPackage === undefined ? null : path.relative(path.resolve("out"), fullPackage),
    releasesFile:
      releasesFile === undefined ? null : path.relative(path.resolve("out"), releasesFile),
    setupExecutable:
      setupExecutable === undefined ? null : path.relative(path.resolve("out"), setupExecutable),
  },
  inspectedAt: new Date().toISOString(),
  requiredArchivePrefixes,
};
const evidencePath = path.resolve("tmp", "release-2a-package-evidence.json");
await mkdir(path.dirname(evidencePath), { recursive: true });
await writeFile(evidencePath, `${JSON.stringify(evidence, null, 2)}\n`, "utf8");
process.stdout.write(`${JSON.stringify({ evidencePath, ...evidence })}\n`);

function normalizeArchivePath(value: string): string {
  return value.replaceAll("\\", "/").replace(/^\/+/u, "");
}

async function listFiles(directory: string): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = await Promise.all(
    entries.map(async (entry) => {
      const entryPath = path.join(directory, entry.name);
      return entry.isDirectory() ? listFiles(entryPath) : [entryPath];
    }),
  );
  return files.flat();
}

async function directorySize(directory: string): Promise<number> {
  const files = await listFiles(directory);
  const sizes = await Promise.all(files.map((file) => stat(file).then((details) => details.size)));
  return sizes.reduce((total, size) => total + size, 0);
}
