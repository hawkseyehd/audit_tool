import type { z } from "zod";

import type { AuditConfig } from "../../config/audit-config.js";
import type { ScannedPage } from "../../core/types.js";
import type { ScannerContext } from "../types.js";
import type {
  seoHeadingSchema,
  seoPageSnapshotSchema,
  seoSiteResourceSchema,
  seoSiteResourcesSchema,
} from "./schemas.js";

export type SeoHeading = z.infer<typeof seoHeadingSchema>;
export type SeoPageSnapshot = z.infer<typeof seoPageSnapshotSchema>;
export type SeoSiteResource = z.infer<typeof seoSiteResourceSchema>;
export type SeoSiteResources = z.infer<typeof seoSiteResourcesSchema>;

export interface SeoScanInput {
  readonly crawlPages: readonly ScannedPage[];
  readonly pages: readonly SeoPageSnapshot[];
  readonly siteResources: SeoSiteResources;
}

export interface SeoSnapshotInput {
  readonly html: string;
  readonly page: Pick<ScannedPage, "pageType" | "url">;
  readonly targetUrl: string;
  readonly allowedDomains?: readonly string[];
}

export interface SeoSiteResourceFetcherOptions {
  readonly maxRedirects: number;
  readonly maxResponseBytes: number;
  readonly signal?: AbortSignal;
  readonly timeoutMs: number;
}

export interface SeoFetchedResource {
  readonly body: string;
  readonly finalUrl: string;
  readonly statusCode: number;
}

export type SeoSiteResourceFetcher = (
  url: string,
  options: SeoSiteResourceFetcherOptions,
) => Promise<SeoFetchedResource>;

export interface SeoSiteResourceDependencies {
  readonly fetchResource?: SeoSiteResourceFetcher;
}

export interface SeoResourceFetcherDependencies {
  readonly assertSafeTarget?: (url: string) => Promise<void>;
  readonly fetchImpl?: typeof fetch;
}

export interface SeoScannerDependencies {
  readonly context?: ScannerContext;
}

export type SeoResourceConfig = Pick<
  AuditConfig,
  "allowedDomains" | "maxRedirects" | "maxResponseBytes" | "navigationTimeoutMs" | "targetUrl"
>;
