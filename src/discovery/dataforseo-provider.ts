import { setTimeout as delay } from "node:timers/promises";

import { z } from "zod";

import {
  providerSearchInputSchema,
  providerSearchPageSchema,
  type ProviderBusinessRecord,
  type ProviderSearchInput,
  type ProviderSearchPage,
} from "./provider-contracts.js";

const ENDPOINT = "https://api.dataforseo.com/v3/business_data/business_listings/search/live";
const REQUEST_TIMEOUT_MS = 30_000;
const MAX_ATTEMPTS = 3;
const BACKOFF_MS = [500, 1_000, 2_000] as const;

const nullableString = z.string().nullable().optional();
const rawItemSchema = z
  .object({
    address: nullableString,
    address_info: z
      .object({
        address: nullableString,
        city: nullableString,
        country_code: nullableString,
        region: nullableString,
        zip: nullableString,
      })
      .nullable()
      .optional(),
    category: nullableString,
    check_url: nullableString,
    cid: nullableString,
    feature_id: nullableString,
    last_updated_time: nullableString,
    phone: nullableString,
    place_id: nullableString,
    title: nullableString,
    type: z.string().optional(),
    url: nullableString,
  })
  .loose();
const rawResponseSchema = z
  .object({
    status_code: z.number().int(),
    status_message: z.string(),
    tasks: z
      .array(
        z
          .object({
            result: z
              .array(
                z
                  .object({
                    count: z.number().int().nonnegative().optional(),
                    items: z.array(rawItemSchema).optional(),
                    offset_token: nullableString,
                    total_count: z.number().int().nonnegative().optional(),
                  })
                  .loose(),
              )
              .nullable()
              .optional(),
            status_code: z.number().int(),
            status_message: z.string(),
          })
          .loose(),
      )
      .max(1),
  })
  .loose();

export interface DataForSeoCredentials {
  login: string;
  password: string;
}

export interface DataForSeoSearchOptions {
  credentials?: DataForSeoCredentials;
  fetchImplementation?: typeof fetch;
  signal?: AbortSignal;
}

export async function searchDataForSeoBusinesses(
  inputValue: ProviderSearchInput,
  options: DataForSeoSearchOptions = {},
): Promise<ProviderSearchPage> {
  const input = providerSearchInputSchema.parse(inputValue);
  const credentials = options.credentials ?? credentialsFromEnvironment();
  const fetchImplementation = options.fetchImplementation ?? fetch;
  let lastError: unknown;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    throwIfAborted(options.signal);
    try {
      const response = await requestPage(input, credentials, fetchImplementation, options.signal);
      return providerSearchPageSchema.parse({
        ...mapResponse(response, input),
        providerRequestCount: attempt,
      });
    } catch (error) {
      lastError = error;
      if (options.signal?.aborted === true || !isRetryable(error) || attempt === MAX_ATTEMPTS) {
        throw sanitizeProviderError(error);
      }
      await delay(BACKOFF_MS[attempt - 1], undefined, { signal: options.signal });
    }
  }
  throw sanitizeProviderError(lastError);
}

export function credentialsFromEnvironment(): DataForSeoCredentials {
  const login = process.env.DATAFORSEO_LOGIN?.trim();
  const password = process.env.DATAFORSEO_PASSWORD?.trim();
  if (
    login === undefined ||
    login.length === 0 ||
    password === undefined ||
    password.length === 0
  ) {
    throw new ProviderConfigurationError(
      "DataForSEO is not configured. Set DATAFORSEO_LOGIN and DATAFORSEO_PASSWORD.",
    );
  }
  return { login, password };
}

async function requestPage(
  input: ProviderSearchInput,
  credentials: DataForSeoCredentials,
  fetchImplementation: typeof fetch,
  externalSignal: AbortSignal | undefined,
): Promise<z.infer<typeof rawResponseSchema>> {
  const timeout = new AbortController();
  const timeoutId = setTimeout(() => {
    timeout.abort(new ProviderTimeoutError());
  }, REQUEST_TIMEOUT_MS);
  const abort = (): void => {
    timeout.abort(externalSignal?.reason);
  };
  externalSignal?.addEventListener("abort", abort, { once: true });
  try {
    const response = await fetchImplementation(ENDPOINT, {
      body: JSON.stringify([buildTask(input)]),
      headers: {
        Authorization: `Basic ${Buffer.from(`${credentials.login}:${credentials.password}`).toString("base64")}`,
        "Content-Type": "application/json",
      },
      method: "POST",
      signal: timeout.signal,
    });
    if (!response.ok) {
      throw new ProviderHttpError(response.status);
    }
    return rawResponseSchema.parse(await response.json());
  } finally {
    clearTimeout(timeoutId);
    externalSignal?.removeEventListener("abort", abort);
  }
}

function buildTask(input: ProviderSearchInput): Record<string, unknown> {
  const filters: unknown[] = [["address_info.country_code", "=", input.country]];
  if (input.region !== undefined) {
    filters.push("and", ["address_info.region", "ilike", `%${escapeFilter(input.region)}%`]);
  }
  if (input.locality !== undefined) {
    filters.push("and", ["address_info.city", "ilike", `%${escapeFilter(input.locality)}%`]);
  }
  if (input.keywords.length > 0) {
    const keywordFilters: unknown[] = [];
    for (const keyword of input.keywords) {
      if (keywordFilters.length > 0) keywordFilters.push("or");
      keywordFilters.push(["title", "ilike", `%${escapeFilter(keyword)}%`]);
      keywordFilters.push("or", ["category", "ilike", `%${escapeFilter(keyword)}%`]);
    }
    filters.push("and", keywordFilters);
  }
  return {
    ...(input.category === undefined
      ? {}
      : { categories: [input.category.trim().toLocaleLowerCase("en-US").replace(/\s+/gu, "_")] }),
    ...(input.continuationToken === undefined ? {} : { offset_token: input.continuationToken }),
    ...(input.radiusKm === undefined ||
    input.latitude === undefined ||
    input.longitude === undefined
      ? {}
      : {
          location_coordinate: `${String(input.latitude)},${String(input.longitude)},${String(input.radiusKm)}`,
        }),
    filters,
    limit: input.limit,
  };
}

function mapResponse(
  response: z.infer<typeof rawResponseSchema>,
  input: ProviderSearchInput,
): Omit<ProviderSearchPage, "providerRequestCount"> {
  if (response.status_code !== 20_000) {
    throw new ProviderResponseError(response.status_message);
  }
  const task = response.tasks[0];
  if (task?.status_code !== 20_000) {
    throw new ProviderResponseError(task?.status_message ?? "DataForSEO returned no task");
  }
  const result = task.result?.[0];
  const records = (result?.items ?? [])
    .map(mapItem)
    .filter((record): record is ProviderBusinessRecord => record !== null)
    .filter((record) => !input.requireWebsite || record.websiteUrl !== undefined)
    .filter((record) => !matchesExclusion(record, input.exclusions))
    .slice(0, input.limit);
  return {
    continuationToken: cleanText(result?.offset_token) ?? null,
    records,
    totalAvailable: result?.total_count ?? records.length,
    ...(records.length === 0 && (result?.count ?? 0) > 0
      ? {
          warning:
            "Provider records were excluded because required fields or exclusions did not match.",
        }
      : {}),
  };
}

function mapItem(item: z.infer<typeof rawItemSchema>): ProviderBusinessRecord | null {
  const businessName = cleanText(item.title);
  const providerRecordId =
    cleanText(item.place_id) ?? cleanText(item.cid) ?? cleanText(item.feature_id);
  if (businessName === undefined || providerRecordId === undefined) return null;
  const websiteUrl = normalizePublicUrl(item.url);
  const sourceUpdatedAt = normalizeProviderDate(item.last_updated_time);
  return {
    businessName,
    providerRecordId,
    ...((cleanText(item.address_info?.address) ?? cleanText(item.address))
      ? { addressLine: cleanText(item.address_info?.address) ?? cleanText(item.address) }
      : {}),
    ...(cleanText(item.category) === undefined ? {} : { category: cleanText(item.category) }),
    ...(cleanText(item.address_info?.country_code) === undefined
      ? {}
      : { country: cleanText(item.address_info?.country_code) }),
    ...(cleanText(item.address_info?.city) === undefined
      ? {}
      : { locality: cleanText(item.address_info?.city) }),
    ...(cleanText(item.address_info?.zip) === undefined
      ? {}
      : { postalCode: cleanText(item.address_info?.zip) }),
    ...(cleanText(item.phone) === undefined ? {} : { publicPhone: cleanText(item.phone) }),
    ...(cleanText(item.address_info?.region) === undefined
      ? {}
      : { region: cleanText(item.address_info?.region) }),
    ...(sourceUpdatedAt === undefined ? {} : { sourceUpdatedAt }),
    ...(normalizePublicUrl(item.check_url) === undefined
      ? {}
      : { sourceUrl: normalizePublicUrl(item.check_url) }),
    ...(websiteUrl === undefined ? {} : { websiteUrl }),
  };
}

function matchesExclusion(record: ProviderBusinessRecord, exclusions: readonly string[]): boolean {
  const haystack = [record.businessName, record.websiteUrl, record.addressLine]
    .filter((value): value is string => value !== undefined)
    .join(" ")
    .toLocaleLowerCase("en-US");
  return exclusions.some((value) => haystack.includes(value.toLocaleLowerCase("en-US")));
}

function cleanText(value: string | null | undefined): string | undefined {
  const cleaned = value?.replace(/\s+/gu, " ").trim();
  return cleaned === undefined || cleaned.length === 0 ? undefined : cleaned;
}

function normalizePublicUrl(value: string | null | undefined): string | undefined {
  const cleaned = cleanText(value);
  if (cleaned === undefined) return undefined;
  try {
    const url = new URL(cleaned);
    return url.protocol === "http:" || url.protocol === "https:" ? url.toString() : undefined;
  } catch {
    return undefined;
  }
}

function normalizeProviderDate(value: string | null | undefined): string | undefined {
  const cleaned = cleanText(value);
  if (cleaned === undefined) return undefined;
  const parsed = new Date(cleaned.replace(/ (\d{2})-(\d{2})-(\d{2}) /u, "T$1:$2:$3"));
  return Number.isNaN(parsed.getTime()) ? undefined : parsed.toISOString();
}

function escapeFilter(value: string): string {
  return value.replace(/[%_\\]/gu, (character) => `\\${character}`);
}

function throwIfAborted(signal: AbortSignal | undefined): void {
  if (signal?.aborted === true) throw signal.reason ?? new Error("Discovery cancelled");
}

function isRetryable(error: unknown): boolean {
  return error instanceof ProviderHttpError
    ? error.status === 408 || error.status === 429 || error.status >= 500
    : error instanceof ProviderTimeoutError ||
        error instanceof TypeError ||
        (error instanceof Error && error.name === "AbortError");
}

function sanitizeProviderError(error: unknown): Error {
  if (
    error instanceof ProviderConfigurationError ||
    error instanceof ProviderHttpError ||
    error instanceof ProviderResponseError ||
    error instanceof ProviderTimeoutError
  ) {
    return error;
  }
  return new ProviderResponseError(
    error instanceof Error && error.name === "AbortError"
      ? "DataForSEO request was cancelled"
      : "DataForSEO request failed",
  );
}

export class ProviderConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ProviderConfigurationError";
  }
}

class ProviderHttpError extends Error {
  readonly status: number;

  constructor(status: number) {
    super(`DataForSEO request failed with HTTP ${String(status)}`);
    this.name = "ProviderHttpError";
    this.status = status;
  }
}

class ProviderResponseError extends Error {
  constructor(message: string) {
    super(message.replace(/\s+/gu, " ").trim().slice(0, 500));
    this.name = "ProviderResponseError";
  }
}

class ProviderTimeoutError extends Error {
  constructor() {
    super("DataForSEO request timed out");
    this.name = "ProviderTimeoutError";
  }
}
