import { z } from "zod";

export const IPC_CHANNELS = {
  getBootstrap: "desktop:get-bootstrap",
} as const;

export const serviceStateSchema = z.enum(["ready", "unavailable"]);

export const workspaceSummarySchema = z
  .object({
    audits: z.number().int().nonnegative(),
    clients: z.number().int().nonnegative(),
    prospects: z.number().int().nonnegative(),
    reports: z.number().int().nonnegative(),
  })
  .strict();

export const desktopBootstrapSchema = z
  .object({
    app: z
      .object({
        name: z.string().trim().min(1).max(100),
        platform: z.enum(["darwin", "linux", "win32"]),
        version: z.string().trim().min(1).max(50),
      })
      .strict(),
    initializedAt: z.iso.datetime(),
    services: z
      .object({
        database: serviceStateSchema,
        worker: serviceStateSchema,
      })
      .strict(),
    workspace: workspaceSummarySchema,
  })
  .strict();

export type DesktopBootstrap = z.infer<typeof desktopBootstrapSchema>;

export interface DesktopApi {
  getBootstrap(): Promise<DesktopBootstrap>;
}
