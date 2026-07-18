import type { z } from "zod";
import type { securityPageSnapshotSchema } from "./schemas.js";
export type SecurityPageSnapshot = z.infer<typeof securityPageSnapshotSchema>;
export interface SecuritySnapshotInput {
  readonly url: string;
  readonly finalUrl?: string;
  readonly statusCode?: number;
  readonly headers: Readonly<Record<string, string | undefined>>;
  readonly setCookieHeaders?: readonly string[];
  readonly html: string;
  readonly httpRedirectsToHttps?: boolean;
}
export interface SecurityScanInput {
  readonly pages: readonly SecurityPageSnapshot[];
}
