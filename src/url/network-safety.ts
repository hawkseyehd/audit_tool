import { lookup } from "node:dns/promises";

import ipaddr from "ipaddr.js";

import { normalizeTargetUrl, UrlPolicyError } from "./normalize-url.js";

const BLOCKED_HOSTNAME_SUFFIXES = [".internal", ".local", ".localhost"] as const;

export type DnsResolver = (hostname: string) => Promise<readonly string[]>;

export async function assertPublicNetworkTarget(
  input: string | URL,
  resolveAddresses: DnsResolver = resolveSystemAddresses,
): Promise<void> {
  const normalizedUrl = normalizeTargetUrl(input.toString());
  const url = new URL(normalizedUrl);
  const hostname = removeIpv6Brackets(url.hostname).toLowerCase();

  if (isBlockedHostname(hostname)) {
    throw new UrlPolicyError("unsafe-network", `Blocked network hostname: ${hostname}`);
  }

  if (ipaddr.isValid(hostname)) {
    assertPublicAddress(hostname);
    return;
  }

  let addresses: readonly string[];
  try {
    addresses = await resolveAddresses(hostname);
  } catch (error: unknown) {
    throw new UrlPolicyError("dns-resolution-failed", `DNS resolution failed for ${hostname}`, {
      cause: error,
    });
  }

  if (addresses.length === 0) {
    throw new UrlPolicyError("dns-resolution-failed", `DNS returned no addresses for ${hostname}`);
  }

  for (const address of addresses) {
    assertPublicAddress(address);
  }
}

async function resolveSystemAddresses(hostname: string): Promise<readonly string[]> {
  const records = await lookup(hostname, { all: true, verbatim: true });
  return records.map((record) => record.address);
}

function assertPublicAddress(address: string): void {
  if (!ipaddr.isValid(address)) {
    throw new UrlPolicyError(
      "dns-resolution-failed",
      `DNS returned an invalid address: ${address}`,
    );
  }

  const parsedAddress = ipaddr.process(address);
  const range = parsedAddress.range();

  if (range !== "unicast") {
    throw new UrlPolicyError(
      "unsafe-network",
      `Blocked ${range} network address: ${parsedAddress.toString()}`,
    );
  }
}

function isBlockedHostname(hostname: string): boolean {
  return (
    hostname === "localhost" ||
    hostname === "metadata.google.internal" ||
    BLOCKED_HOSTNAME_SUFFIXES.some((suffix) => hostname.endsWith(suffix))
  );
}

function removeIpv6Brackets(hostname: string): string {
  return hostname.startsWith("[") && hostname.endsWith("]") ? hostname.slice(1, -1) : hostname;
}
