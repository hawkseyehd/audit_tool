import { parseAuditConfig } from "../../config/audit-config.js";
import { crawlWebsite } from "../../crawler/crawler.js";
import type { CrawlResult, CrawlWebsiteOptions } from "../../crawler/types.js";
import { discoveryResultSchema, type DiscoveryResult } from "../shared/contracts.js";
import type { PageInventoryRepository } from "./page-inventory-repository.js";

const DISCOVERY_TIMEOUT_MS = 600_000;

export type DiscoveryCrawler = (options: CrawlWebsiteOptions) => Promise<CrawlResult>;

export class PageDiscoveryService {
  readonly #activeClientIds = new Set<string>();
  readonly #crawler: DiscoveryCrawler;
  readonly #inventory: PageInventoryRepository;

  constructor(inventory: PageInventoryRepository, crawler: DiscoveryCrawler = crawlWebsite) {
    this.#crawler = crawler;
    this.#inventory = inventory;
  }

  async discover(clientId: string, maxPages: number): Promise<DiscoveryResult> {
    if (this.#activeClientIds.has(clientId)) {
      return discoveryResultSchema.parse({
        error: {
          code: "already-running",
          message: "A page discovery run is already in progress for this website.",
        },
        ok: false,
      });
    }
    this.#activeClientIds.add(clientId);
    try {
      return await this.#runDiscovery(clientId, maxPages);
    } finally {
      this.#activeClientIds.delete(clientId);
    }
  }

  async #runDiscovery(clientId: string, maxPages: number): Promise<DiscoveryResult> {
    const started = await this.#inventory.startRun(clientId);
    if (!started.ok) {
      return discoveryResultSchema.parse({
        error: { code: started.code, message: started.message },
        ok: false,
      });
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => {
      controller.abort(new Error("Website discovery exceeded its ten-minute safety limit"));
    }, DISCOVERY_TIMEOUT_MS);

    try {
      const config = parseAuditConfig({
        includeAccessibility: false,
        includeAnalytics: false,
        includeForms: false,
        includeLighthouse: false,
        includeSecurity: false,
        includeSeo: false,
        includeUxHeuristics: false,
        maxPages,
        submitForms: false,
        targetUrl: started.targetUrl,
        viewports: ["desktop"],
        writeClientSummaryPdf: false,
        writeHtml: false,
        writeJson: false,
        writeMarkdown: false,
        writePdf: false,
        writePdfSummary: false,
      });
      const result = await this.#crawler({ config, signal: controller.signal });
      const run = await this.#inventory.completeRun(started.run.id, result);
      return discoveryResultSchema.parse({ ok: true, run });
    } catch (error) {
      const run = await this.#inventory.failRun(started.run.id, error);
      return discoveryResultSchema.parse({
        error: {
          code: "discovery-failed",
          message: run.failureMessage ?? "Website discovery failed",
        },
        ok: false,
        run,
      });
    } finally {
      clearTimeout(timeout);
    }
  }
}
