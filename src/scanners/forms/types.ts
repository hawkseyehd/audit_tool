import type { z } from "zod";

import type { ScannedPage } from "../../core/types.js";
import type {
  formFactSchema,
  formFieldFactSchema,
  formKindSchema,
  formPageSnapshotSchema,
} from "./schemas.js";

export type FormKind = z.infer<typeof formKindSchema>;
export type FormFieldFact = z.infer<typeof formFieldFactSchema>;
export type FormFact = z.infer<typeof formFactSchema>;
export type FormPageSnapshot = z.infer<typeof formPageSnapshotSchema>;

export interface FormSnapshotInput {
  readonly html: string;
  readonly page: Pick<ScannedPage, "pageType" | "url">;
}

export interface FormScanInput {
  readonly pages: readonly FormPageSnapshot[];
}
