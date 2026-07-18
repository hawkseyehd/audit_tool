import type { z } from "zod";
import type { AuditConfig } from "../../config/audit-config.js";
import type { ScannedPage, Viewport } from "../../core/types.js";
import type {
  lighthouseMetricsSchema,
  lighthouseOpportunitySchema,
  lighthousePageResultSchema,
} from "./schemas.js";
export type LighthouseMetrics = z.infer<typeof lighthouseMetricsSchema>;
export type LighthouseOpportunity = z.infer<typeof lighthouseOpportunitySchema>;
export type LighthousePageResult = z.infer<typeof lighthousePageResultSchema>;
export interface LighthouseRunRequest {
  readonly url: string;
  readonly viewport: Viewport;
  readonly port: number;
}
export type LighthouseRunner = (request: LighthouseRunRequest) => Promise<{
  readonly finalUrl: string;
  readonly metrics: LighthouseMetrics;
  readonly opportunities: readonly LighthouseOpportunity[];
}>;
export interface LighthouseChrome {
  readonly port: number;
  kill(): Promise<void> | void;
}
export type LighthouseChromeLauncher = () => Promise<LighthouseChrome>;
export interface LighthouseAuditOptions {
  readonly config: AuditConfig;
  readonly pages: readonly ScannedPage[];
  readonly signal?: AbortSignal;
}
export interface LighthouseAuditDependencies {
  readonly launchChrome?: LighthouseChromeLauncher;
  readonly runLighthouse?: LighthouseRunner;
  readonly assertSafeTarget?: (url: string) => Promise<void>;
}
export interface LighthouseScanInput {
  readonly results: readonly LighthousePageResult[];
}
