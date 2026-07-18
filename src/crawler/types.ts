import type { z } from "zod";

import type { AuditConfig } from "../config/audit-config.js";
import type { CrawlScope } from "../url/crawl-scope.js";
import type { crawlResultSchema, crawlStatsSchema } from "./schemas.js";

export type CrawlStats = z.infer<typeof crawlStatsSchema>;
export type CrawlResult = z.infer<typeof crawlResultSchema>;

export interface FetchPageOptions {
  readonly maxRedirects: number;
  readonly maxResponseBytes: number;
  readonly scope: CrawlScope;
  readonly signal?: AbortSignal;
  readonly timeoutMs: number;
}

export interface FetchedPage {
  readonly body: string;
  readonly contentType: string | null;
  readonly finalUrl: string;
  readonly statusCode: number;
}

export type PageFetcher = (url: string, options: FetchPageOptions) => Promise<FetchedPage>;

export interface CrawlDependencies {
  readonly fetchPage?: PageFetcher;
  readonly now?: () => Date;
  readonly random?: () => number;
  readonly sleep?: (durationMs: number) => Promise<void>;
}

export interface CrawlWebsiteOptions {
  readonly config: AuditConfig;
  readonly signal?: AbortSignal;
}
