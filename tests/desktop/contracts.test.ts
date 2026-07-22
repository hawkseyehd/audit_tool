import { describe, expect, it } from "vitest";

import { desktopBootstrapSchema } from "../../src/desktop/shared/contracts.js";
import { workerRequestSchema } from "../../src/desktop/shared/worker-contracts.js";

const validBootstrap = {
  app: { name: "Website Audit Tool", platform: "win32", version: "0.1.0" },
  initializedAt: "2026-07-23T10:00:00.000Z",
  services: { database: "ready", worker: "ready" },
  workspace: { audits: 0, clients: 0, prospects: 0, reports: 0 },
};

describe("desktop contracts", () => {
  it("accepts the strict bootstrap contract", () => {
    expect(desktopBootstrapSchema.parse(validBootstrap)).toEqual(validBootstrap);
  });

  it("rejects unexpected bootstrap fields", () => {
    expect(() =>
      desktopBootstrapSchema.parse({ ...validBootstrap, databasePath: "C:/private.db" }),
    ).toThrow();
  });

  it("rejects worker messages without stable identifiers", () => {
    expect(workerRequestSchema.safeParse({ type: "ping" }).success).toBe(false);
  });
});
