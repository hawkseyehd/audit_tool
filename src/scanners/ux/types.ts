import type { z } from "zod";
import type { ScannedPage } from "../../core/types.js";
import type { uxPageSnapshotSchema, uxRenderedObservationSchema } from "./schemas.js";
export type UxRenderedObservation = z.infer<typeof uxRenderedObservationSchema>;
export type UxPageSnapshot = z.infer<typeof uxPageSnapshotSchema>;
export interface UxSnapshotInput {
  readonly html: string;
  readonly page: Pick<ScannedPage, "pageType" | "url">;
  readonly rendered?: readonly UxRenderedObservation[];
}
export interface UxScanInput {
  readonly pages: readonly UxPageSnapshot[];
}
