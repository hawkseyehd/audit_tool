import type { Browser } from "playwright";
import type { z } from "zod";

import type { AuditConfig } from "../../config/audit-config.js";
import type { ScannedPage, Viewport } from "../../core/types.js";
import type { CrawlScope } from "../../url/crawl-scope.js";
import type {
  accessibilityPageResultSchema,
  axeImpactSchema,
  axeViolationSchema,
} from "./schemas.js";

export type AxeImpact = z.infer<typeof axeImpactSchema>;
export type AxeViolation = z.infer<typeof axeViolationSchema>;
export type AccessibilityPageResult = z.infer<typeof accessibilityPageResultSchema>;

export interface AccessibilityScanInput {
  readonly results: readonly AccessibilityPageResult[];
}

export interface AccessibilityPageRequest {
  readonly scope: CrawlScope;
  readonly signal?: AbortSignal;
  readonly timeoutMs: number;
  readonly url: string;
  readonly viewport: Viewport;
}

export interface AccessibilitySession {
  auditPage(request: AccessibilityPageRequest): Promise<readonly AxeViolation[]>;
  close(): Promise<void>;
}

export type AccessibilitySessionLauncher = () => Promise<AccessibilitySession>;

export interface AccessibilityAuditOptions {
  readonly config: AuditConfig;
  readonly pages: readonly ScannedPage[];
  readonly signal?: AbortSignal;
}

export interface AccessibilityAuditDependencies {
  readonly assertSafeTarget?: (url: string) => Promise<void>;
  readonly launchBrowser?: () => Promise<Browser>;
  readonly launchSession?: AccessibilitySessionLauncher;
}
