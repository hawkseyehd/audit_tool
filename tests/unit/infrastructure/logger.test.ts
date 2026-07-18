import { PassThrough } from "node:stream";

import { describe, expect, it } from "vitest";

import { createLogger } from "../../../src/index.js";

describe("createLogger", () => {
  it("includes audit context and redacts sensitive fields", () => {
    const destination = new PassThrough();
    let output = "";
    destination.on("data", (chunk: Buffer) => {
      output += chunk.toString("utf8");
    });

    const logger = createLogger({ auditId: "audit-test", destination });
    logger.info(
      {
        password: "password-secret",
        token: "token-secret",
        formValues: { email: "person@example.com" },
        req: {
          headers: {
            authorization: "Bearer secret",
            cookie: "session=secret",
          },
        },
      },
      "Audit started",
    );

    const record = JSON.parse(output) as Record<string, unknown>;
    expect(record.auditId).toBe("audit-test");
    expect(record.password).toBe("[REDACTED]");
    expect(record.token).toBe("[REDACTED]");
    expect(record.formValues).toBe("[REDACTED]");
    expect(JSON.stringify(record)).not.toContain("person@example.com");
    expect(JSON.stringify(record)).not.toContain("Bearer secret");
    expect(JSON.stringify(record)).not.toContain("session=secret");
  });
});
