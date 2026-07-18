import { describe, expect, it, vi } from "vitest";

import { assertPublicNetworkTarget, UrlPolicyError, type DnsResolver } from "../../../src/index.js";

describe("assertPublicNetworkTarget", () => {
  it.each([
    "http://127.0.0.1",
    "http://10.0.0.1",
    "http://169.254.169.254/latest/meta-data",
    "http://192.168.1.1",
    "http://[::1]",
    "http://[fc00::1]",
    "http://localhost",
    "http://service.internal",
    "http://printer.local",
  ])("blocks unsafe literal or local target %s", async (targetUrl) => {
    await expect(assertPublicNetworkTarget(targetUrl, unusedResolver())).rejects.toMatchObject({
      code: "unsafe-network",
    });
  });

  it("accepts a public literal address without DNS", async () => {
    const resolver = unusedResolver();
    await expect(assertPublicNetworkTarget("https://8.8.8.8", resolver)).resolves.toBeUndefined();
    expect(resolver).not.toHaveBeenCalled();
  });

  it("accepts a hostname only when every DNS result is public", async () => {
    const resolver: DnsResolver = vi.fn().mockResolvedValue(["8.8.8.8", "1.1.1.1"]);
    await expect(
      assertPublicNetworkTarget("https://example.com", resolver),
    ).resolves.toBeUndefined();
  });

  it("blocks a hostname when any DNS result is private", async () => {
    const resolver: DnsResolver = vi.fn().mockResolvedValue(["8.8.8.8", "10.0.0.8"]);
    await expect(assertPublicNetworkTarget("https://example.com", resolver)).rejects.toMatchObject({
      code: "unsafe-network",
    });
  });

  it("reports empty and failed DNS resolution separately", async () => {
    const emptyResolver: DnsResolver = vi.fn().mockResolvedValue([]);
    const failedResolver: DnsResolver = vi.fn().mockRejectedValue(new Error("DNS unavailable"));

    await expect(
      assertPublicNetworkTarget("https://example.com", emptyResolver),
    ).rejects.toMatchObject({ code: "dns-resolution-failed" });
    await expect(
      assertPublicNetworkTarget("https://example.com", failedResolver),
    ).rejects.toBeInstanceOf(UrlPolicyError);
  });
});

function unusedResolver(): ReturnType<typeof vi.fn<DnsResolver>> {
  return vi.fn<DnsResolver>(() => Promise.reject(new Error("Resolver should not be called")));
}
