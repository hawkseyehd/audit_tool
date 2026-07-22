import { z } from "zod";

export const workerRequestSchema = z.discriminatedUnion("type", [
  z.object({ id: z.uuid(), type: z.literal("ping") }).strict(),
  z.object({ id: z.uuid(), type: z.literal("shutdown") }).strict(),
]);

export const workerResponseSchema = z.discriminatedUnion("type", [
  z.object({ id: z.uuid(), type: z.literal("ready") }).strict(),
  z.object({ id: z.uuid(), type: z.literal("pong") }).strict(),
  z.object({ id: z.uuid(), type: z.literal("stopped") }).strict(),
  z
    .object({
      id: z.uuid(),
      message: z.string().trim().min(1).max(500),
      type: z.literal("error"),
    })
    .strict(),
]);

export type WorkerRequest = z.infer<typeof workerRequestSchema>;
export type WorkerResponse = z.infer<typeof workerResponseSchema>;
