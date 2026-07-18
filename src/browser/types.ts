import type { z } from "zod";

import type { AuditConfig } from "../config/audit-config.js";
import type { ScannedPage, Viewport } from "../core/types.js";
import type { CrawlScope } from "../url/crawl-scope.js";
import type {
  browserInspectionResultSchema,
  browserInspectionStatsSchema,
  browserPageInspectionSchema,
} from "./schemas.js";

export type BrowserPageInspection = z.infer<typeof browserPageInspectionSchema>;
export type BrowserInspectionStats = z.infer<typeof browserInspectionStatsSchema>;
export type BrowserInspectionResult = z.infer<typeof browserInspectionResultSchema>;

export interface BrowserPageRequest {
  readonly scope: CrawlScope;
  readonly screenshotPath?: string;
  readonly signal?: AbortSignal;
  readonly timeoutMs: number;
  readonly url: string;
  readonly viewport: Viewport;
}

export interface BrowserPageSnapshot {
  readonly consoleErrors: readonly string[];
  readonly finalUrl: string;
  readonly pageErrors: readonly string[];
  readonly screenshotCaptured: boolean;
  readonly statusCode?: number;
  readonly title?: string;
}

export interface BrowserSession {
  inspectPage(request: BrowserPageRequest): Promise<BrowserPageSnapshot>;
  close(): Promise<void>;
}

export type BrowserLauncher = () => Promise<BrowserSession>;

export interface BrowserInspectionOptions {
  readonly auditDirectory: string;
  readonly config: AuditConfig;
  readonly pages: readonly ScannedPage[];
  readonly screenshotsDirectory: string;
  readonly signal?: AbortSignal;
}

export interface BrowserInspectionDependencies {
  readonly launchBrowser?: BrowserLauncher;
  readonly monotonicNow?: () => number;
  readonly now?: () => Date;
}
