import type { DesktopApi } from "./shared/contracts.js";

declare global {
  const MAIN_WINDOW_PRELOAD_WEBPACK_ENTRY: string;
  const MAIN_WINDOW_WEBPACK_ENTRY: string;

  interface Window {
    auditTool: DesktopApi;
  }
}

export {};
