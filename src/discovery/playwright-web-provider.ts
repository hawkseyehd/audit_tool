import { createHash } from "node:crypto";
import { setTimeout as delay } from "node:timers/promises";

import {
  chromium,
  type Browser,
  type BrowserContextOptions,
  type Page,
  type Route,
} from "playwright";

import { assertPublicNetworkTarget } from "../url/network-safety.js";
import {
  providerSearchInputSchema,
  providerSearchPageSchema,
  type ProviderBusinessRecord,
  type ProviderSearchInput,
  type ProviderSearchPage,
} from "./provider-contracts.js";

const SEARCH_ENDPOINT = "https://www.google.com/maps/search/";
const NAVIGATION_TIMEOUT_MS = 20_000;
const MAX_SEARCH_RESULTS = 30;
const MAX_INSPECTIONS_PER_PAGE = 30;
const MAX_RESULT_SCROLLS = 8;
const PAGE_DELAY_MS = 650;
const BLOCKED_HOSTS = new Set([
  "bing.com",
  "facebook.com",
  "instagram.com",
  "linkedin.com",
  "microsoft.com",
  "pinterest.com",
  "tripadvisor.com",
  "wikipedia.org",
  "x.com",
  "yelp.com",
  "youtube.com",
]);

export interface WebSearchCandidate {
  title: string;
  url: string;
}

export interface WebPageDetails {
  addressLine?: string;
  businessName?: string;
  publicEmail?: string;
  publicPhone?: string;
  socialProfiles?: readonly string[];
  sourceUrl: string;
  websiteUrl?: string;
}

export interface PlaywrightWebSession {
  close(): Promise<void>;
  inspect(candidate: WebSearchCandidate, signal?: AbortSignal): Promise<WebPageDetails>;
  search(
    query: string,
    offset: number,
    limit: number,
    signal?: AbortSignal,
  ): Promise<readonly WebSearchCandidate[]>;
}

export interface PlaywrightWebProviderDependencies {
  createSession?: () => Promise<PlaywrightWebSession>;
  pause?: (milliseconds: number, signal?: AbortSignal) => Promise<void>;
  signal?: AbortSignal;
}

export async function searchPlaywrightWebBusinesses(
  inputValue: ProviderSearchInput,
  dependencies: PlaywrightWebProviderDependencies = {},
): Promise<ProviderSearchPage> {
  const input = providerSearchInputSchema.parse(inputValue);
  const offset = parseContinuationToken(input.continuationToken);
  const requestedCandidates = Math.min(MAX_SEARCH_RESULTS, Math.max(input.limit * 3, input.limit));
  const session = await (dependencies.createSession ?? createPlaywrightWebSession)();
  const pause = dependencies.pause ?? pauseWithSignal;
  const signal = dependencies.signal;

  try {
    const candidates = await session.search(
      createSearchQuery(input),
      offset,
      requestedCandidates,
      signal,
    );
    const records: ProviderBusinessRecord[] = [];
    let inspectedCount = 0;
    let failedCount = 0;

    for (const candidate of candidates.slice(0, MAX_INSPECTIONS_PER_PAGE)) {
      if (records.length >= input.limit) break;
      inspectedCount += 1;
      try {
        const details = await session.inspect(candidate, signal);
        const record = toBusinessRecord(input, candidate, details);
        if (record !== null && !isExcluded(record, input.exclusions)) {
          records.push(record);
        }
      } catch {
        failedCount += 1;
      }
      if (records.length < input.limit && inspectedCount < candidates.length) {
        await pause(PAGE_DELAY_MS, signal);
      }
    }

    const consumedAllCandidates = inspectedCount >= candidates.length;
    const hasMore =
      candidates.length === requestedCandidates || (!consumedAllCandidates && records.length > 0);
    const nextOffset = offset + inspectedCount;
    const warnings = [
      failedCount > 0
        ? `${String(failedCount)} business detail pages could not be read and were skipped.`
        : undefined,
      records.length === 0
        ? "No eligible businesses were found on this rendered results page. Refine the location or business criteria."
        : undefined,
    ].filter((value): value is string => value !== undefined);

    return providerSearchPageSchema.parse({
      continuationToken: hasMore && inspectedCount > 0 ? String(nextOffset) : null,
      providerRequestCount: 1,
      records,
      totalAvailable: nextOffset + (hasMore ? 1 : 0),
      ...(warnings.length === 0 ? {} : { warning: warnings.join(" ") }),
    });
  } finally {
    await session.close();
  }
}

export async function createPlaywrightWebSession(): Promise<PlaywrightWebSession> {
  const browser = await chromium.launch({ headless: true });
  return {
    close: () => browser.close(),
    inspect: (candidate, signal) => inspectCandidate(browser, candidate, signal),
    search: (query, offset, limit, signal) =>
      searchRenderedPage(browser, query, offset, limit, signal),
  };
}

async function searchRenderedPage(
  browser: Browser,
  query: string,
  offset: number,
  limit: number,
  signal?: AbortSignal,
): Promise<readonly WebSearchCandidate[]> {
  const url = new URL(`${SEARCH_ENDPOINT}${encodeURIComponent(query)}`);
  await assertPublicNetworkTarget(url);

  return withPage(browser, signal, async (page) => {
    await page.goto(url.toString(), {
      timeout: NAVIGATION_TIMEOUT_MS,
      waitUntil: "domcontentloaded",
    });
    const feed = page.locator('[role="feed"]').first();
    await feed.waitFor({ state: "attached", timeout: 8_000 }).catch(() => undefined);
    if ((await feed.count()) === 0) {
      throw new Error(
        page.url().includes("/sorry/")
          ? "The rendered maps page requested a browser verification. Try again later."
          : "The rendered maps results could not be read.",
      );
    }

    const requestedTotal = offset + limit;
    for (let scroll = 0; scroll < MAX_RESULT_SCROLLS; scroll += 1) {
      signal?.throwIfAborted();
      const count = await page.locator("a.hfpxzc").count();
      if (count >= requestedTotal) break;
      await feed.evaluate((element) => {
        element.scrollTop = element.scrollHeight;
      });
      await page.waitForTimeout(PAGE_DELAY_MS);
    }

    const rawCandidates = await page.locator("a.hfpxzc").evaluateAll((links) =>
      links.map((link) => ({
        title: (link.getAttribute("aria-label") ?? link.textContent).replace(/\s+/gu, " ").trim(),
        url: link instanceof HTMLAnchorElement ? link.href : "",
      })),
    );

    return deduplicateCandidates(rawCandidates).slice(offset, requestedTotal);
  });
}

async function inspectCandidate(
  browser: Browser,
  candidate: WebSearchCandidate,
  signal?: AbortSignal,
): Promise<WebPageDetails> {
  await assertPublicNetworkTarget(candidate.url);
  return withPage(browser, signal, async (page) => {
    await page.goto(candidate.url, {
      timeout: NAVIGATION_TIMEOUT_MS,
      waitUntil: "domcontentloaded",
    });
    await page.locator("h1").first().waitFor({ state: "attached", timeout: 8_000 });
    const sourceUrl = canonicalSourceUrl(page.url());
    await assertPublicNetworkTarget(sourceUrl);

    const visibleDetails = {
      addressLine: await readLabelledValue(page, '[data-item-id="address"]', "Address"),
      businessName: await readElementText(page, "h1"),
      publicEmail: await readPublicEmail(page),
      publicPhone: await readLabelledValue(page, '[data-item-id^="phone:tel:"]', "Phone"),
      socialProfiles: await readSocialProfileLinks(page),
      websiteUrl: await readOptionalHref(
        page,
        'a[data-item-id="authority"], a[aria-label^="Website:"]',
      ),
    };

    const websiteUrl = await safePublicWebsite(visibleDetails.websiteUrl);
    const socialProfiles = await safePublicSocialProfiles([
      ...visibleDetails.socialProfiles,
      ...(visibleDetails.websiteUrl === undefined ? [] : [visibleDetails.websiteUrl]),
    ]);
    return {
      ...(visibleDetails.addressLine === undefined
        ? {}
        : { addressLine: normalizeText(visibleDetails.addressLine, 300) }),
      ...(visibleDetails.businessName === undefined
        ? {}
        : { businessName: normalizeText(visibleDetails.businessName, 200) }),
      ...(visibleDetails.publicEmail === undefined
        ? {}
        : { publicEmail: visibleDetails.publicEmail }),
      ...(visibleDetails.publicPhone === undefined
        ? {}
        : { publicPhone: normalizeText(visibleDetails.publicPhone, 50) }),
      ...(socialProfiles.length === 0 ? {} : { socialProfiles }),
      sourceUrl,
      ...(websiteUrl === undefined ? {} : { websiteUrl }),
    };
  });
}

async function readPublicEmail(page: Page): Promise<string | undefined> {
  const element = page.locator('a[href^="mailto:"], [data-item-id^="email"]').first();
  if ((await element.count()) === 0) return undefined;
  const href = await element.getAttribute("href");
  const labelled = await readLabelledValue(
    page,
    'a[href^="mailto:"], [data-item-id^="email"]',
    "Email",
  );
  const value =
    href?.startsWith("mailto:") === true
      ? decodeURIComponent(href.slice("mailto:".length).split("?")[0] ?? "")
      : labelled;
  const normalized = value?.trim().toLowerCase();
  return normalized !== undefined &&
    normalized.length <= 320 &&
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/u.test(normalized)
    ? normalized
    : undefined;
}

async function readSocialProfileLinks(page: Page): Promise<readonly string[]> {
  return page
    .locator(
      'a[href*="linkedin.com/"], a[href*="facebook.com/"], a[href*="instagram.com/"], a[href*="x.com/"]',
    )
    .evaluateAll((links) =>
      links
        .filter((link): link is HTMLAnchorElement => link instanceof HTMLAnchorElement)
        .map((link) => link.href),
    );
}

async function readElementText(page: Page, selector: string): Promise<string | undefined> {
  const element = page.locator(selector).first();
  if ((await element.count()) === 0) return undefined;
  const value = await element.textContent();
  const normalized = value?.replace(/\s+/gu, " ").trim();
  return normalized === undefined || normalized.length === 0 ? undefined : normalized;
}

async function readLabelledValue(
  page: Page,
  selector: string,
  label: string,
): Promise<string | undefined> {
  const element = page.locator(selector).first();
  if ((await element.count()) === 0) return undefined;
  const ariaLabel = await element.getAttribute("aria-label");
  const value =
    ariaLabel === null
      ? await element.textContent()
      : ariaLabel.replace(new RegExp(`^${label}\\s*:\\s*`, "iu"), "");
  const normalized = value?.replace(/\s+/gu, " ").trim();
  return normalized === undefined || normalized.length === 0 ? undefined : normalized;
}

async function readOptionalHref(page: Page, selector: string): Promise<string | undefined> {
  const element = page.locator(selector).first();
  if ((await element.count()) === 0) return undefined;
  return (await element.getAttribute("href")) ?? undefined;
}

async function withPage<Result>(
  browser: Browser,
  signal: AbortSignal | undefined,
  operation: (page: Page) => Promise<Result>,
): Promise<Result> {
  signal?.throwIfAborted();
  const context = await browser.newContext(browserContextOptions(browser.version()));
  context.setDefaultNavigationTimeout(NAVIGATION_TIMEOUT_MS);
  context.setDefaultTimeout(NAVIGATION_TIMEOUT_MS);
  const page = await context.newPage();
  const closeOnAbort = (): void => {
    void context.close().catch(() => undefined);
  };
  signal?.addEventListener("abort", closeOnAbort, { once: true });

  await context.route("**/*", (route) => handleRoute(route));
  page.on("dialog", (dialog) => {
    void dialog.dismiss().catch(() => undefined);
  });
  page.on("download", (download) => {
    void download.cancel().catch(() => undefined);
  });

  try {
    return await operation(page);
  } finally {
    signal?.removeEventListener("abort", closeOnAbort);
    await context.close().catch(() => undefined);
  }
}

async function handleRoute(route: Route): Promise<void> {
  const request = route.request();
  if (["font", "image", "media"].includes(request.resourceType())) {
    await route.abort("blockedbyclient").catch(() => undefined);
    return;
  }
  const url = request.url();
  if (!url.startsWith("http://") && !url.startsWith("https://")) {
    await route.abort("blockedbyclient").catch(() => undefined);
    return;
  }
  try {
    await assertPublicNetworkTarget(url);
    await route.continue();
  } catch {
    await route.abort("blockedbyclient").catch(() => undefined);
  }
}

function browserContextOptions(browserVersion: string): BrowserContextOptions {
  const chromeVersion = browserVersion.replace(/[^0-9.]/gu, "") || "120.0.0.0";
  return {
    acceptDownloads: false,
    colorScheme: "light",
    javaScriptEnabled: true,
    locale: "en-US",
    permissions: [],
    reducedMotion: "reduce",
    serviceWorkers: "block",
    userAgent: `Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${chromeVersion} Safari/537.36 WebsiteAuditTool/0.1`,
    viewport: { height: 900, width: 1_440 },
  };
}

function createSearchQuery(input: ProviderSearchInput): string {
  const businessTerms = [input.category, ...input.keywords].filter(
    (value): value is string => value !== undefined && value.length > 0,
  );
  const locationTerms = [input.locality, input.region, input.country].filter(
    (value): value is string => value !== undefined && value.length > 0,
  );
  return `${businessTerms.join(" ")} in ${locationTerms.join(", ")}`;
}

function toBusinessRecord(
  input: ProviderSearchInput,
  candidate: WebSearchCandidate,
  details: WebPageDetails,
): ProviderBusinessRecord | null {
  const website = details.websiteUrl === undefined ? undefined : new URL(details.websiteUrl);
  if (input.requireWebsite && website === undefined) return null;

  const preferredName = normalizeText(
    details.businessName ?? cleanResultTitle(candidate.title),
    200,
  );
  const businessName =
    preferredName.length > 0
      ? preferredName
      : (website?.hostname.replace(/^www\./u, "") ?? "Unnamed business");
  const providerRecordId =
    website?.hostname.toLowerCase().replace(/^www\./u, "") ??
    `maps-${createHash("sha256").update(details.sourceUrl).digest("hex").slice(0, 32)}`;
  const record = {
    ...(details.addressLine === undefined ? {} : { addressLine: details.addressLine }),
    businessName,
    ...(input.category === undefined ? {} : { category: input.category }),
    country: input.country,
    ...(input.locality === undefined ? {} : { locality: input.locality }),
    providerRecordId,
    ...(details.publicEmail === undefined ? {} : { publicEmail: details.publicEmail }),
    ...(details.publicPhone === undefined ? {} : { publicPhone: details.publicPhone }),
    ...(input.region === undefined ? {} : { region: input.region }),
    sourceUrl: details.sourceUrl,
    ...((details.socialProfiles?.length ?? 0) === 0
      ? {}
      : { socialProfiles: [...(details.socialProfiles ?? [])] }),
    ...(website === undefined ? {} : { websiteUrl: website.toString() }),
  };
  return record;
}

function deduplicateCandidates(
  candidates: readonly WebSearchCandidate[],
): readonly WebSearchCandidate[] {
  const seen = new Set<string>();
  return candidates.filter((candidate) => {
    try {
      const url = new URL(candidate.url);
      const key = `${candidate.title.toLowerCase()}|${url.pathname}`;
      if (
        candidate.title.length === 0 ||
        !["http:", "https:"].includes(url.protocol) ||
        !url.hostname.endsWith("google.com") ||
        !url.pathname.includes("/maps/place/") ||
        seen.has(key)
      ) {
        return false;
      }
      seen.add(key);
      return true;
    } catch {
      return false;
    }
  });
}

function isBlockedHost(hostname: string): boolean {
  const normalized = hostname.toLowerCase().replace(/^www\./u, "");
  return [...BLOCKED_HOSTS].some(
    (blocked) => normalized === blocked || normalized.endsWith(`.${blocked}`),
  );
}

function isExcluded(record: ProviderBusinessRecord, exclusions: readonly string[]): boolean {
  const haystack = [
    record.businessName,
    record.websiteUrl,
    record.addressLine,
    record.publicEmail,
    record.publicPhone,
    ...(record.socialProfiles ?? []),
  ]
    .filter((value): value is string => value !== undefined)
    .join(" ")
    .toLowerCase();
  return exclusions.some((value) => haystack.includes(value.toLowerCase()));
}

function cleanResultTitle(title: string): string {
  return title
    .replace(/\s+[|\-–—]\s+(?:official\s+site|home|homepage).*$/iu, "")
    .replace(/\s+/gu, " ")
    .trim();
}

async function safePublicWebsite(value: string | undefined): Promise<string | undefined> {
  if (value === undefined) return undefined;
  try {
    const url = new URL(value);
    if (!["http:", "https:"].includes(url.protocol) || isBlockedHost(url.hostname)) {
      return undefined;
    }
    await assertPublicNetworkTarget(url);
    return url.toString();
  } catch {
    return undefined;
  }
}

async function safePublicSocialProfiles(values: readonly string[]): Promise<readonly string[]> {
  const profiles = new Set<string>();
  for (const value of values) {
    const unwrapped = unwrapGoogleRedirect(value);
    try {
      const url = new URL(unwrapped);
      const host = url.hostname.toLowerCase().replace(/^www\./u, "");
      const linkedinCompany =
        host === "linkedin.com" &&
        /^\/(?:company|school|showcase)\//u.test(url.pathname.toLowerCase());
      const supportedBusinessProfile =
        linkedinCompany || host === "facebook.com" || host === "instagram.com" || host === "x.com";
      if (!supportedBusinessProfile) continue;
      await assertPublicNetworkTarget(url);
      url.search = "";
      url.hash = "";
      profiles.add(url.toString());
      if (profiles.size >= 10) break;
    } catch {
      continue;
    }
  }
  return [...profiles];
}

function unwrapGoogleRedirect(value: string): string {
  try {
    const url = new URL(value);
    if (url.hostname.endsWith("google.com") && url.pathname === "/url") {
      return url.searchParams.get("q") ?? url.searchParams.get("url") ?? value;
    }
  } catch {
    return value;
  }
  return value;
}

function canonicalSourceUrl(value: string): string {
  const url = new URL(value);
  url.search = "";
  url.hash = "";
  return url.toString();
}

function normalizeText(value: string, maximum: number): string {
  return value.replace(/\s+/gu, " ").trim().slice(0, maximum);
}

function parseContinuationToken(value: string | undefined): number {
  if (value === undefined) return 0;
  const offset = Number(value);
  if (!Number.isInteger(offset) || offset < 0 || offset > 10_000) {
    throw new Error("Playwright discovery continuation token is invalid");
  }
  return offset;
}

async function pauseWithSignal(milliseconds: number, signal?: AbortSignal): Promise<void> {
  await delay(milliseconds, undefined, { signal });
}
