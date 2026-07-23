import path from "node:path";

export function configurePackagedBrowserEnvironment(
  isPackaged: boolean,
  resourcesPath = process.resourcesPath,
): void {
  if (!isPackaged) return;
  process.env.PLAYWRIGHT_BROWSERS_PATH = path.join(resourcesPath, ".playwright-browsers");
}
