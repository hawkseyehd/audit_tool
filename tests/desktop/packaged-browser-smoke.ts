import { existsSync } from "node:fs";
import { mkdir, readFile } from "node:fs/promises";
import { createServer } from "node:http";
import path from "node:path";

import { launch } from "chrome-launcher";

const resourcesPath = path.resolve("out", "Website Audit Tool-win32-x64", "resources");
const browserDirectory = path.join(resourcesPath, ".playwright-browsers");
if (!existsSync(browserDirectory)) {
  throw new Error(`Packaged browser directory is missing: ${browserDirectory}`);
}

process.env.PLAYWRIGHT_BROWSERS_PATH = browserDirectory;
const { chromium } = await import("playwright");
const chromiumExecutable = chromium.executablePath();
if (!existsSync(chromiumExecutable)) {
  throw new Error(`Packaged Chromium executable is missing: ${chromiumExecutable}`);
}

const evidenceDirectory = path.resolve("tmp");
const pdfPath = path.join(evidenceDirectory, "release-2a-packaged-browser.pdf");
await mkdir(evidenceDirectory, { recursive: true });

const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage();
  await page.setContent(`
    <!doctype html>
    <html lang="en">
      <head>
        <meta charset="utf-8">
        <title>Packaged browser acceptance</title>
        <style>
          body { color: #152033; font: 16px/1.5 system-ui, sans-serif; padding: 48px; }
          h1 { color: #1f5fbf; font-size: 28px; }
        </style>
      </head>
      <body>
        <main>
          <h1>Audit Report</h1>
          <p>Packaged Chromium rendered this deterministic release acceptance page.</p>
        </main>
      </body>
    </html>
  `);
  await page.pdf({ format: "A4", path: pdfPath, printBackground: true });
} finally {
  await browser.close();
}

const pdf = await readFile(pdfPath);
if (pdf.length < 1_000 || pdf.subarray(0, 5).toString("ascii") !== "%PDF-") {
  throw new Error("Packaged Chromium did not produce a valid non-empty PDF");
}

const server = createServer((_request, response) => {
  response.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
  response.end(`<!doctype html>
    <html lang="en">
      <head><meta charset="utf-8"><title>Audit target</title></head>
      <body><main><h1>Release acceptance target</h1><p>Local deterministic content.</p></main></body>
    </html>`);
});
await new Promise<void>((resolve, reject) => {
  server.once("error", reject);
  server.listen(0, "127.0.0.1", resolve);
});

const address = server.address();
if (address === null || typeof address === "string") {
  server.close();
  throw new Error("Could not determine the local acceptance server port");
}

let chrome: Awaited<ReturnType<typeof launch>> | undefined;
try {
  chrome = await launch({
    chromeFlags: ["--headless=new", "--no-first-run", "--disable-gpu"],
    chromePath: chromiumExecutable,
  });
  const lighthouse = (await import("lighthouse")).default;
  const result = await lighthouse(`http://127.0.0.1:${String(address.port)}/`, {
    logLevel: "error",
    onlyCategories: ["performance"],
    output: "json",
    port: chrome.port,
  });
  const score = result?.lhr.categories.performance?.score;
  if (score === null || score === undefined) {
    throw new Error("Packaged Chromium Lighthouse smoke did not return a performance score");
  }
  process.stdout.write(
    `${JSON.stringify({
      browserDirectory,
      chromiumExecutable,
      lighthousePerformanceScore: Math.round(score * 100),
      pdfBytes: pdf.length,
      pdfPath,
    })}\n`,
  );
} finally {
  chrome?.kill();
  await new Promise<void>((resolve, reject) => {
    server.close((error) => {
      if (error === undefined) resolve();
      else reject(error);
    });
  });
}
