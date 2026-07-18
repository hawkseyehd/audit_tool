import { load } from "cheerio";

import {
  evaluateCrawlCandidate,
  type CrawlRejectionReason,
  type CrawlScope,
} from "../url/crawl-scope.js";

const MAX_LINKS_PER_PAGE = 1_000;

export interface ExtractedPage {
  readonly title?: string;
  readonly links: readonly string[];
  readonly rejectionCounts: Readonly<Partial<Record<CrawlRejectionReason, number>>>;
}

export function extractPageLinks(html: string, pageUrl: string, scope: CrawlScope): ExtractedPage {
  const document = load(html);
  const titleText = document("title").first().text().replace(/\s+/gu, " ").trim();
  const links = new Set<string>();
  const rejectionCounts: Partial<Record<CrawlRejectionReason, number>> = {};

  document("a[href], area[href]").each((_index, element) => {
    const href = document(element).attr("href");
    if (href === undefined) {
      return;
    }

    const decision = evaluateCrawlCandidate(href, pageUrl, scope);
    if (decision.accepted) {
      if (!links.has(decision.url) && links.size >= MAX_LINKS_PER_PAGE) {
        rejectionCounts["link-limit"] = (rejectionCounts["link-limit"] ?? 0) + 1;
        return;
      }
      links.add(decision.url);
      return;
    }

    rejectionCounts[decision.reason] = (rejectionCounts[decision.reason] ?? 0) + 1;
  });

  return {
    ...(titleText.length > 0 ? { title: titleText } : {}),
    links: [...links],
    rejectionCounts,
  };
}
